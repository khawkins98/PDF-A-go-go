/**
 * @file Search controls and text highlighting for PDF-A-go-go.
 *
 * This module encapsulates the search UI (input, buttons, results) and the
 * logic to find matches across the PDF, navigate between them, and render
 * highlight rectangles on the page canvas via the viewer.
 */

/**
 * Create and wire up search controls.
 *
 * @param {HTMLElement} container - The main viewer container element
 * @param {Object} featureOptions - Feature toggles and configuration options
 * @param {import('./scrollablePdfViewer').ScrollablePdfViewer} viewer - The initialized PDF viewer instance
 * @param {Object} book - The PDF book object with page access methods
 * @param {Function} book.numPages - Returns total number of pages
 * @param {Function} book.getPage - Retrieves a specific page
 * @param {Object} pdf - The loaded PDF.js document instance
 * @param {Function} setPageByNumber - Function to navigate to a 1-based page number
 * @returns {void}
 */
export function setupSearchControls(container, featureOptions, viewer, book, pdf, setPageByNumber) {
  // If search feature is disabled, don't render controls.
  if (!featureOptions || featureOptions.showSearch === false) {
    return;
  }

  // Remove any existing search controls to avoid duplicates
  const existing = document.querySelector('.pdfagogo-search-controls');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  // Build the search UI
  const searchControls = document.createElement('div');
  searchControls.className = 'pdfagogo-search-controls';
  searchControls.innerHTML = `
    <input class="pdfagogo-search-box" type="text" placeholder="Search text..." aria-label="Search text" />
    <button class="pdfagogo-search-btn">Search</button>
    <button class="pdfagogo-search-clear-btn" aria-label="Clear search" title="Clear search">Clear</button>
    <span class="pdfagogo-search-result"></span>
    <button class="pdfagogo-prev-match-btn" aria-label="Previous match" disabled>Prev</button>
    <button class="pdfagogo-next-match-btn" aria-label="Next match" disabled>Next</button>
  `;
  // Prefer inserting search controls inside the main controls container if present
  const controlsContainer = document.querySelector('.pdfagogo-controls');
  if (controlsContainer) {
    // Place search controls at the top of the controls container
    controlsContainer.insertBefore(searchControls, controlsContainer.firstChild);
  } else if (container && container.parentNode) {
    // Fallback to previous behavior if controls container isn't available yet
    container.parentNode.insertBefore(searchControls, container);
  }

  const searchBox = searchControls.querySelector('.pdfagogo-search-box');
  const searchBtn = searchControls.querySelector('.pdfagogo-search-btn');
  const searchResult = searchControls.querySelector('.pdfagogo-search-result');
  const prevMatchBtn = searchControls.querySelector('.pdfagogo-prev-match-btn');
  const nextMatchBtn = searchControls.querySelector('.pdfagogo-next-match-btn');
  const clearBtn = searchControls.querySelector('.pdfagogo-search-clear-btn');

  // Hide navigation buttons until a search is active with results
  if (prevMatchBtn) prevMatchBtn.style.display = 'none';
  if (nextMatchBtn) nextMatchBtn.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';

  // --- Search state ---
  let matchPages = [];
  let currentMatchIdx = 0;
  let matchHighlights = {}; // {pageIndex: [highlightBox, ...]}
  let prevMatchPage = null; // Track previous match page index
  let lastQuery = '';

  // Find text across pages and compute highlight boxes per page.
  async function searchPdf(query) {
    matchPages = [];
    currentMatchIdx = 0;
    matchHighlights = {};
    window.__pdfagogo__highlights = {};

    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      const items = textContent.items;
      const text = items.map((item) => item.str).join(' ').toLowerCase();
      if (text.includes(query)) {
        matchPages.push(i);
        // Compute bounding boxes for matches on this page
        const boxes = [];
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          const itemText = item.str.toLowerCase();
          const idx = itemText.indexOf(query);
          if (idx !== -1) {
            const x = item.transform[4];
            const y = item.transform[5] - (item.height || 10);
            boxes.push({ x, y, width: item.width, height: item.height || 10 });
          }
        }
        matchHighlights[i] = boxes;
      }
    }
  }

  function showMatch(idx) {
    if (matchPages.length === 0) {
      window.__pdfagogo__highlights = {};
      if (prevMatchBtn) {
        prevMatchBtn.disabled = true;
        prevMatchBtn.style.display = 'none';
      }
      if (nextMatchBtn) {
        nextMatchBtn.disabled = true;
        nextMatchBtn.style.display = 'none';
      }
      return;
    }

    // Wrap around
    currentMatchIdx = ((idx % matchPages.length) + matchPages.length) % matchPages.length;
    const pageNum = matchPages[currentMatchIdx] + 1; // 1-based
    const pageIdx = matchPages[currentMatchIdx];

    // Highlight only the current match page
    const highlights = matchHighlights[pageIdx] || [];
    window.__pdfagogo__highlights = {};
    window.__pdfagogo__highlights[pageIdx] = highlights;

    setPageByNumber(pageNum);

    // Re-render current and previous pages to update highlights
    if (typeof viewer.rerenderPage === 'function') {
      viewer.rerenderPage(pageIdx);
      if (prevMatchPage !== null && prevMatchPage !== pageIdx) {
        window.__pdfagogo__highlights[prevMatchPage] = [];
        viewer.rerenderPage(prevMatchPage);
      }
      prevMatchPage = pageIdx;
    } else if (typeof viewer._renderAllPages === 'function') {
      viewer._renderAllPages();
    } else if (typeof viewer.go_to_page === 'function') {
      viewer.go_to_page(viewer.currentPage || 0);
    }

    if (searchResult) {
      searchResult.textContent = `Match set ${currentMatchIdx + 1} of ${matchPages.length} (page ${pageNum})`;
    }

    if (prevMatchBtn) {
      prevMatchBtn.disabled = matchPages.length <= 1;
      prevMatchBtn.style.display = '';
    }
    if (nextMatchBtn) {
      nextMatchBtn.disabled = matchPages.length <= 1;
      nextMatchBtn.style.display = '';
    }
    if (clearBtn) {
      clearBtn.style.display = '';
    }
  }

  if (searchBtn)
    searchBtn.onclick = async function () {
      const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
      if (!query) return;
      if (searchResult) searchResult.textContent = 'Searching...';
      await searchPdf(query);
      lastQuery = query;
      if (matchPages.length > 0) {
        showMatch(0);
      } else {
        if (searchResult) searchResult.textContent = 'Not found';
        if (prevMatchBtn) {
          prevMatchBtn.disabled = true;
          prevMatchBtn.style.display = 'none';
        }
        if (nextMatchBtn) {
          nextMatchBtn.disabled = true;
          nextMatchBtn.style.display = 'none';
        }
        if (clearBtn) clearBtn.style.display = '';
      }
    };

  if (prevMatchBtn)
    prevMatchBtn.onclick = function () {
      showMatch(currentMatchIdx - 1);
    };

  if (nextMatchBtn)
    nextMatchBtn.onclick = function () {
      showMatch(currentMatchIdx + 1);
    };

  if (searchBox)
    searchBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        const query = searchBox.value.trim().toLowerCase();
        if (query && query === lastQuery && matchPages.length > 0) {
          if (e.shiftKey) {
            showMatch(currentMatchIdx - 1);
          } else {
            showMatch(currentMatchIdx + 1);
          }
        } else if (searchBtn) {
          searchBtn.click();
        }
      } else if (e.key === 'Escape') {
        if (clearBtn && clearBtn.style.display !== 'none') {
          clearBtn.click();
        } else if (searchBox && searchBox.value) {
          // If clear button is hidden but there is text, clear the input
          searchBox.value = '';
          if (searchResult) searchResult.textContent = '';
          if (prevMatchBtn) prevMatchBtn.style.display = 'none';
          if (nextMatchBtn) nextMatchBtn.style.display = 'none';
          if (clearBtn) clearBtn.style.display = 'none';
        }
      }
    });

  // When typing a new query, hide the nav buttons until search runs again
  if (searchBox) {
    searchBox.addEventListener('input', function () {
      if (prevMatchBtn) prevMatchBtn.style.display = 'none';
      if (nextMatchBtn) nextMatchBtn.style.display = 'none';
      if (clearBtn) clearBtn.style.display = searchBox.value.trim() ? '' : 'none';
    });
  }

  // Clear/end the current search and reset UI
  if (clearBtn) {
    clearBtn.onclick = function () {
      lastQuery = '';
      matchPages = [];
      currentMatchIdx = 0;
      if (searchBox) searchBox.value = '';
      if (searchResult) searchResult.textContent = '';
      // clear highlights and rerender affected page(s)
      const pageToClear = prevMatchPage;
      window.__pdfagogo__highlights = {};
      if (typeof viewer.rerenderPage === 'function') {
        if (typeof pageToClear === 'number') {
          viewer.rerenderPage(pageToClear);
        }
      } else if (typeof viewer._renderAllPages === 'function') {
        viewer._renderAllPages();
      }
      if (prevMatchBtn) {
        prevMatchBtn.disabled = true;
        prevMatchBtn.style.display = 'none';
      }
      if (nextMatchBtn) {
        nextMatchBtn.disabled = true;
        nextMatchBtn.style.display = 'none';
      }
      if (clearBtn) clearBtn.style.display = 'none';
    };
  }
}


