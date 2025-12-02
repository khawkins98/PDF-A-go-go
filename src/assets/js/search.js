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

  // Find the toolbar center section to insert search controls
  const toolbarCenter = container.querySelector('.pdfagogo-toolbar-center');
  if (!toolbarCenter) {
    console.warn('PDF-A-go-go: Toolbar center section not found, search disabled');
    return;
  }

  // Remove any existing search controls to avoid duplicates
  toolbarCenter.innerHTML = '';

  // Build the search UI - inline in toolbar
  // Icons from Lucide (https://lucide.dev) - MIT License
  const searchControls = document.createElement('div');
  searchControls.className = 'pdfagogo-search-group';
  searchControls.innerHTML = `
    <input class="pdfagogo-search-input" type="text" placeholder="Search..." aria-label="Search in document" />
    <span class="pdfagogo-search-result"></span>
    <button class="pdfagogo-prev-match-btn" aria-label="Previous match" title="Previous (Shift+Enter)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
    <button class="pdfagogo-next-match-btn" aria-label="Next match" title="Next (Enter)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
  `;
  toolbarCenter.appendChild(searchControls);

  const searchBox = searchControls.querySelector('.pdfagogo-search-input');
  const searchResult = searchControls.querySelector('.pdfagogo-search-result');
  const prevMatchBtn = searchControls.querySelector('.pdfagogo-prev-match-btn');
  const nextMatchBtn = searchControls.querySelector('.pdfagogo-next-match-btn');

  // Initially hide result count and nav buttons
  if (searchResult) searchResult.style.display = 'none';
  if (prevMatchBtn) prevMatchBtn.style.display = 'none';
  if (nextMatchBtn) nextMatchBtn.style.display = 'none';

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
            const y = item.transform[5];
            const h = item.height || 12;
            boxes.push({ x, y, width: item.width, height: h });
          }
        }
        matchHighlights[i] = boxes;
      }
    }
  }

  function showMatch(idx) {
    if (matchPages.length === 0) {
      window.__pdfagogo__highlights = {};
      if (searchResult) {
        searchResult.textContent = 'No matches';
        searchResult.style.display = '';
      }
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

    // Update result count (compact format)
    if (searchResult) {
      searchResult.textContent = `${currentMatchIdx + 1} / ${matchPages.length}`;
      searchResult.style.display = '';
    }

    // Show navigation buttons
    if (prevMatchBtn) {
      prevMatchBtn.disabled = false;
      prevMatchBtn.style.display = '';
    }
    if (nextMatchBtn) {
      nextMatchBtn.disabled = false;
      nextMatchBtn.style.display = '';
    }
  }

  // Search function - triggered on Enter
  async function doSearch() {
    const query = searchBox ? searchBox.value.trim().toLowerCase() : '';
    if (!query) return;
    if (searchResult) {
      searchResult.textContent = '...';
      searchResult.style.display = '';
    }
    await searchPdf(query);
    lastQuery = query;
    if (matchPages.length > 0) {
      showMatch(0);
    } else {
      showMatch(-1); // Will show "No matches"
    }
  }

  // Navigation button handlers
  if (prevMatchBtn)
    prevMatchBtn.onclick = function () {
      showMatch(currentMatchIdx - 1);
    };

  if (nextMatchBtn)
    nextMatchBtn.onclick = function () {
      showMatch(currentMatchIdx + 1);
    };

  // Keyboard handling
  if (searchBox) {
    searchBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchBox.value.trim().toLowerCase();
        if (query && query === lastQuery && matchPages.length > 0) {
          // Same query - navigate matches
          if (e.shiftKey) {
            showMatch(currentMatchIdx - 1);
          } else {
            showMatch(currentMatchIdx + 1);
          }
        } else {
          // New query - search
          doSearch();
        }
      } else if (e.key === 'Escape') {
        clearSearch();
      }
    });

    // Live search as user types (debounced)
    let searchTimeout = null;
    searchBox.addEventListener('input', function () {
      // Hide results while typing
      if (searchResult) searchResult.style.display = 'none';
      if (prevMatchBtn) prevMatchBtn.style.display = 'none';
      if (nextMatchBtn) nextMatchBtn.style.display = 'none';

      // Debounce search
      clearTimeout(searchTimeout);
      const query = searchBox.value.trim();
      if (query.length >= 2) {
        searchTimeout = setTimeout(doSearch, 300);
      }
    });
  }

  // Clear search function
  function clearSearch() {
    lastQuery = '';
    matchPages = [];
    currentMatchIdx = 0;
    if (searchBox) searchBox.value = '';
    if (searchResult) {
      searchResult.textContent = '';
      searchResult.style.display = 'none';
    }
    // Clear highlights and rerender affected page(s)
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
  }
}


