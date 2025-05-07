/**
 * UI helper functions for PDF-A-go-go.
 */

/**
 * Creates and inserts a loading progress bar inside the given container.
 * @param {HTMLElement} container - The container to insert the loading bar into.
 * @returns {HTMLProgressElement} The created progress bar element.
 */
export function createLoadingBar(container) {
  let loadingDiv = document.createElement("div");
  loadingDiv.className = "pdfagogo-loading";
  loadingDiv.style.maxWidth = "600px";
  loadingDiv.style.margin = "2rem auto";
  loadingDiv.style.textAlign = "center";
  loadingDiv.style.padding = "1.5rem 0";
  loadingDiv.innerHTML = `
    <div class="pdfagogo-loading-text">Loading <span class="pdfagogo-loading-percent">0%</span></div>
    <progress class="pdfagogo-progress-bar" value="0" max="1" style="width:80%;height:1.2em;"></progress>
  `;
  container.appendChild(loadingDiv);
  return loadingDiv.querySelector(".pdfagogo-progress-bar");
}

/**
 * Updates the loading progress bar value and percent text.
 * @param {HTMLProgressElement} progressBar - The progress bar element.
 * @param {number|null} value - Progress value (0-1) or null for indeterminate.
 */
export function updateLoadingBar(progressBar, value) {
  if (!progressBar) return;
  const percentSpan = document.querySelector('.pdfagogo-loading-percent');
  if (typeof value === "number") {
    progressBar.value = value;
    if (percentSpan) percentSpan.textContent = `${Math.round(value * 100)}%`;
  } else {
    progressBar.removeAttribute("value");
    if (percentSpan) percentSpan.textContent = '';
  }
}

/**
 * Removes the loading bar from the DOM.
 */
export function removeLoadingBar() {
  const loadingDiv = document.querySelector(".pdfagogo-loading");
  if (loadingDiv && loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
}

/**
 * Shows an error message
 * @param {string} message - The error message to display.
 */
export function showError(message) {
  const loadingDiv = document.querySelector(".pdfagogo-loading");
  if (loadingDiv) {
    loadingDiv.innerHTML = `<div class="pdfagogo-loading-error">${message}</div>`;
  }
}

/**
 * Sets up all main UI controls (search, navigation, page selector, accessibility, etc.)
 * and wires up their event listeners.
 * @param {HTMLElement} container - The main viewer container.
 * @param {Object} featureOptions - Feature toggles and options.
 * @param {Object} viewer - The viewer instance (after init).
 * @param {Object} book - The book object (with numPages, getPage).
 * @param {Object} pdf - The loaded PDF.js document.
 */
export function setupControls(container, featureOptions, viewer, book, pdf) {
  // Remove any existing controls
  [
    "pdfagogo-search-controls",
    "pdfagogo-controls",
    "pdfagogo-page-announcement",
    "pdfagogo-a11y-instructions",
  ].forEach((cls) => {
    const el = document.querySelector("." + cls);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  // Search controls
  let searchControls, searchBox, searchBtn, searchResult, nextMatchBtn, prevMatchBtn;
  if (featureOptions.showSearch) {
    searchControls = document.createElement("div");
    searchControls.className = "pdfagogo-search-controls";
    searchControls.innerHTML = `
      <input class="pdfagogo-search-box" type="text" placeholder="Search text..." aria-label="Search text" />
      <button class="pdfagogo-search-btn">Search</button>
      <span class="pdfagogo-search-result"></span>
    `;
    container.parentNode.insertBefore(searchControls, container);
    searchBox = searchControls.querySelector(".pdfagogo-search-box");
    searchBtn = searchControls.querySelector(".pdfagogo-search-btn");
    searchResult = searchControls.querySelector(".pdfagogo-search-result");
    // Add next/prev match buttons
    nextMatchBtn = document.createElement("button");
    nextMatchBtn.textContent = "Next Match";
    nextMatchBtn.className = "pdfagogo-next-match-btn";
    prevMatchBtn = document.createElement("button");
    prevMatchBtn.textContent = "Prev Match";
    prevMatchBtn.className = "pdfagogo-prev-match-btn";
    searchControls.appendChild(prevMatchBtn);
    searchControls.appendChild(nextMatchBtn);
  }

  // Main controls
  const controls = document.createElement("div");
  controls.className = "pdfagogo-controls";
  let controlsHTML = "";
  if (featureOptions.showPrevNext) {
    controlsHTML +=
      '<button class="pdfagogo-prev" aria-label="Previous page">Previous</button>';
    controlsHTML +=
      '<button class="pdfagogo-next" aria-label="Next page">Next</button>';
  }
  controlsHTML +=
    '<button class="pdfagogo-share" aria-label="Share current page">Share</button>';
  if (featureOptions.showDownload) {
    controlsHTML += '<button class="pdfagogo-download" aria-label="Download PDF">Download PDF</button>';
  }
  if (featureOptions.showPageSelector) {
    controlsHTML +=
      '<input class="pdfagogo-goto-page" type="number" min="0" max="999" style="width:60px;" placeholder="Page #" aria-label="Go to page" />';
    controlsHTML += '<button class="pdfagogo-goto-btn">Go</button>';
  }
  if (featureOptions.showCurrentPage) {
    controlsHTML +=
      '<span class="pdfagogo-page-indicator" aria-live="polite"></span>';
  }
  controls.innerHTML = controlsHTML;
  container.parentNode.insertBefore(
    controls,
    container.nextSibling
  );

  // Page announcement for screen readers
  let pageAnnouncement = document.querySelector(".pdfagogo-page-announcement");
  if (!pageAnnouncement) {
    pageAnnouncement = document.createElement("div");
    pageAnnouncement.className = "pdfagogo-page-announcement";
    pageAnnouncement.style.position = "absolute";
    pageAnnouncement.style.left = "-9999px";
    pageAnnouncement.style.top = "auto";
    pageAnnouncement.style.width = "1px";
    pageAnnouncement.style.height = "1px";
    pageAnnouncement.style.overflow = "hidden";
    pageAnnouncement.setAttribute("aria-live", "polite");
    container.parentNode.insertBefore(
      pageAnnouncement,
      controls.nextSibling
    );
  }

  // Accessibility instructions
  let a11yInstructions = document.querySelector(".pdfagogo-a11y-instructions");
  if (!a11yInstructions) {
    a11yInstructions = document.createElement("div");
    a11yInstructions.className = "pdfagogo-a11y-instructions";
    a11yInstructions.setAttribute("aria-live", "polite");
    a11yInstructions.innerHTML = `
      <strong>Accessibility:</strong><br>
      - Use <kbd>Tab</kbd> to focus the reader.<br>
      - Use <kbd>Left Arrow</kbd> or click/tap the left side to go to the previous page.<br>
      - Use <kbd>Right Arrow</kbd> or click/tap the right side to go to the next page.<br>
      - Use <kbd>+</kbd> or <kbd>-</kbd> to zoom in/out.<br>
      - Use the buttons below for navigation, sharing, and searching.<br>
      - The current page is announced for screen readers.
    `;
    container.parentNode.insertBefore(
      a11yInstructions,
      pageAnnouncement.nextSibling
    );
  }

  // --- Event wiring and logic ---

  // Navigation buttons
  const prevBtn = document.querySelector(".pdfagogo-prev");
  const nextBtn = document.querySelector(".pdfagogo-next");
  if (nextBtn) nextBtn.onclick = () => viewer.flip_forward();
  if (prevBtn) prevBtn.onclick = () => viewer.flip_back();
  if (!featureOptions.showPrevNext) {
    if (prevBtn) prevBtn.style.display = "none";
    if (nextBtn) nextBtn.style.display = "none";
  }

  // Share button
  const shareBtn = document.querySelector(".pdfagogo-share");
  if (shareBtn)
    shareBtn.onclick = () => {
      const page = viewer.showNdx ? viewer.showNdx + 1 : 1;
      const shareUrl = `${window.location.origin}${window.location.pathname}#page=${page}`;
      navigator.clipboard.writeText(shareUrl);
      alert("Share link copied to clipboard:\n" + shareUrl);
    };

  // Download button
  const downloadBtn = document.querySelector(".pdfagogo-download");
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const link = document.createElement('a');
      link.href = featureOptions.pdfUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  // Page selector
  const gotoPageInput = document.querySelector(".pdfagogo-goto-page");
  const gotoBtn = document.querySelector(".pdfagogo-goto-btn");
  function setPageByNumber(pageNum) {
    if (!viewer || !book) return;
    if (
      typeof pageNum !== "number" ||
      isNaN(pageNum) ||
      pageNum < 1 ||
      pageNum > book.numPages()
    ) {
      alert("Invalid page number");
      return;
    }
    if (typeof viewer.go_to_page === "function") {
      viewer.go_to_page(pageNum - 1); // zero-based
      return;
    }
  }
  if (gotoBtn)
    gotoBtn.onclick = function () {
      const val = gotoPageInput ? parseInt(gotoPageInput.value, 10) : NaN;
      setPageByNumber(val);
    };
  if (gotoPageInput && gotoBtn) {
    gotoPageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        gotoBtn.click();
      }
    });
  }
  if (!featureOptions.showPageSelector) {
    if (gotoPageInput) gotoPageInput.style.display = "none";
    if (gotoBtn) gotoBtn.style.display = "none";
  }

  // Current page indicator
  const pageIndicator = document.querySelector(
    ".pdfagogo-page-indicator"
  );
  function updatePage(n) {
    const totalPages = book.numPages();
    const currentPage = parseInt(n);
    if (pageIndicator)
      pageIndicator.textContent = `Page: ${currentPage} / ${totalPages}`;
    if (pageAnnouncement)
      pageAnnouncement.textContent = `Page ${currentPage} of ${totalPages}`;
  }
  viewer.on("seen", updatePage);
  updatePage(0);
  if (!featureOptions.showCurrentPage) {
    if (pageIndicator) pageIndicator.style.display = "none";
  }

  // SEARCH FUNCTIONALITY
  let matchPages = [];
  let currentMatchIdx = 0;
  let matchHighlights = {}; // {pageNum: [highlightBox, ...]}
  async function searchPdf(query) {
    matchPages = [];
    currentMatchIdx = 0;
    matchHighlights = {};
    window.__pdfagogo__highlights = {};
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const textContent = await page.getTextContent();
      const items = textContent.items;
      const text = items.map((item) => item.str).join(" ").toLowerCase();
      if (text.includes(query)) {
        matchPages.push(i);
        // Find bounding boxes for matches on this page
        const boxes = [];
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          const itemText = item.str.toLowerCase();
          const idx = itemText.indexOf(query);
          if (idx !== -1) {
            const x = item.transform[4];
            const y = item.transform[5] - (item.height || 10);
            boxes.push({
              x: x,
              y: y,
              width: item.width,
              height: item.height || 10,
            });
          }
        }
        matchHighlights[i] = boxes;
      }
    }
  }
  function showMatch(idx) {
    if (matchPages.length === 0) {
      window.__pdfagogo__highlights = {};
      return;
    }
    currentMatchIdx =
      ((idx % matchPages.length) + matchPages.length) % matchPages.length; // wrap around
    const pageNum = matchPages[currentMatchIdx] + 1; // 1-based
    // Highlight only the current match
    const highlights = matchHighlights[matchPages[currentMatchIdx]] || [];
    // Set global highlights for viewer
    window.__pdfagogo__highlights = {};
    window.__pdfagogo__highlights[matchPages[currentMatchIdx]] = highlights;
    setPageByNumber(pageNum);
    // Force viewer to re-render so highlights are picked up
    if (typeof viewer._renderAllPages === 'function') {
      viewer._renderAllPages();
    } else if (typeof viewer.go_to_page === 'function') {
      viewer.go_to_page(viewer.currentPage || 0);
    }
    if (searchResult)
      searchResult.textContent = `Match ${currentMatchIdx + 1} of ${
        matchPages.length
      } (page ${pageNum})`;
  }
  if (searchBtn)
    searchBtn.onclick = async function () {
      const query = searchBox ? searchBox.value.trim().toLowerCase() : "";
      if (!query) return;
      if (searchResult) searchResult.textContent = "Searching...";
      await searchPdf(query);
      if (matchPages.length > 0) {
        showMatch(0);
      } else {
        if (searchResult) searchResult.textContent = "Not found";
      }
    };
  if (nextMatchBtn)
    nextMatchBtn.onclick = function () {
      if (matchPages.length > 0) {
        showMatch(currentMatchIdx + 1);
      }
    };
  if (prevMatchBtn)
    prevMatchBtn.onclick = function () {
      if (matchPages.length > 0) {
        showMatch(currentMatchIdx - 1);
      }
    };
  if (searchBox)
    searchBox.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && searchBtn) searchBtn.click();
    });
  if (!featureOptions.showSearch) {
    if (searchControls) searchControls.style.display = "none";
  }

  // Keyboard navigation for accessibility
  container.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      viewer.flip_back();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      viewer.flip_forward();
      event.preventDefault();
    } else if (event.key === "+" || event.key === "=") {
      // No zoom in scroll mode
      event.preventDefault();
    } else if (event.key === "-") {
      // No zoom in scroll mode
      event.preventDefault();
    }
  });

  // Hide/show navigation arrows on first/last page
  function updateNavArrows() {
    if (!prevBtn || !nextBtn) return;
    let isFirst, isLast;
    if (featureOptions.spreadMode) {
      isFirst = viewer.showNdx === 0;
      isLast = viewer.showNdx === (pdf.numPages - 1);
    } else {
      isFirst = viewer.showNdx === 0;
      isLast = (viewer.showNdx + 1) >= pdf.numPages;
    }
    prevBtn.style.visibility = isFirst ? 'hidden' : '';
    nextBtn.style.visibility = isLast ? 'hidden' : '';
    setTimeout(() => {
      const leftHint = document.querySelector('.pdfagogo-hint-left');
      const rightHint = document.querySelector('.pdfagogo-hint-right');
      if (leftHint) leftHint.style.display = isFirst ? 'none' : '';
      if (rightHint) rightHint.style.display = isLast ? 'none' : '';
    }, 100);
  }
  viewer.on("seen", updateNavArrows);
  updateNavArrows();

  // Dynamically add overlay hint zones for click navigation
  setTimeout(() => {
    let leftZone = document.querySelector('.pdfagogo-hint-left');
    let rightZone = document.querySelector('.pdfagogo-hint-right');
    if (!leftZone) {
      leftZone = document.createElement("div");
      leftZone.className = "pdfagogo-hint-zone pdfagogo-hint-left";
      const leftArrow = document.createElement("span");
      leftArrow.className = "pdfagogo-hint-arrow";
      leftArrow.setAttribute("aria-hidden", "true");
      leftArrow.innerHTML = "&#8592;";
      leftZone.appendChild(leftArrow);
      container.appendChild(leftZone);
    }
    if (!rightZone) {
      rightZone = document.createElement("div");
      rightZone.className = "pdfagogo-hint-zone pdfagogo-hint-right";
      const rightArrow = document.createElement("span");
      rightArrow.className = "pdfagogo-hint-arrow";
      rightArrow.setAttribute("aria-hidden", "true");
      rightArrow.innerHTML = "&#8594;";
      rightZone.appendChild(rightArrow);
      container.appendChild(rightZone);
    }
    leftZone.addEventListener("mouseenter", () => leftZone.classList.add("active"));
    leftZone.addEventListener("mouseleave", () => leftZone.classList.remove("active"));
    rightZone.addEventListener("mouseenter", () => rightZone.classList.add("active"));
    rightZone.addEventListener("mouseleave", () => rightZone.classList.remove("active"));
    leftZone.addEventListener("click", () => viewer.flip_back());
    rightZone.addEventListener("click", () => viewer.flip_forward());
  }, 100);

  // --- Hash-based page navigation ---
  function getPageFromHash() {
    const match = window.location.hash.match(/page=(\d+)/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdf.numPages) {
        return pageNum;
      }
    }
    return null;
  }
  function goToHashPage() {
    const pageNum = getPageFromHash();
    if (pageNum) {
      setPageByNumber(pageNum);
      window.__pdfagogo__pageSetBy = 'hash';
    }
  }
  // Go to page on load if hash is present
  goToHashPage();
  // Listen for hash changes
  window.addEventListener("hashchange", goToHashPage);
  // If no hash, use defaultPage from options
  if (!getPageFromHash() && featureOptions.defaultPage) {
    const defPage = parseInt(featureOptions.defaultPage, 10);
    if (!isNaN(defPage) && defPage >= 1 && defPage <= pdf.numPages) {
      setPageByNumber(defPage);
      window.__pdfagogo__pageSetBy = 'defaultPage';
    }
  }
  // When navigating to a page, update the hash
  const originalSetPageByNumber = setPageByNumber;
  setPageByNumber = function(pageNum) {
    if (!viewer || !pdf) return;
    if (
      typeof pageNum !== "number" ||
      isNaN(pageNum) ||
      pageNum < 1 ||
      pageNum > pdf.numPages
    ) {
      alert("Invalid page number");
      return;
    }
    window.location.hash = `page=${pageNum}`;
    originalSetPageByNumber(pageNum);
  };
}