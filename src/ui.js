/**
 * @file UI Components and Controls for PDF-A-go-go.
 * 
 * This module provides comprehensive UI functionality for the PDF viewer including:
 * - Loading progress indicators with visual feedback
 * - Navigation controls (previous/next, page selector, download)
 * - Search functionality with text highlighting and match navigation
 * - Accessibility features (screen reader support, keyboard navigation)
 * - Error handling and user feedback
 * - Mobile-responsive design and touch interaction
 * 
 * All UI components are designed with accessibility in mind, featuring proper
 * ARIA labels, keyboard navigation support, and screen reader compatibility.
 * 
 * @author PDF-A-go-go Contributors
 * @version 1.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

/**
 * Creates and inserts a loading progress bar inside the given container.
 * 
 * The loading bar provides visual feedback during PDF loading with both
 * a progress bar and percentage text. It's designed to be accessible
 * and provides clear indication of loading status.
 * 
 * @param {HTMLElement} container - The container element to insert the loading bar into
 * @returns {HTMLProgressElement} The created progress bar element for updating progress
 * 
 * @example
 * const container = document.getElementById('pdf-container');
 * const progressBar = createLoadingBar(container);
 * 
 * // Later, update the progress
 * updateLoadingBar(progressBar, 0.5); // 50% complete
 * 
 * @example
 * // The loading bar creates this structure:
 * // <div class="pdfagogo-loading">
 * //   <div class="pdfagogo-loading-text">Loading <span class="pdfagogo-loading-percent">0%</span></div>
 * //   <progress class="pdfagogo-progress-bar" value="0" max="1"></progress>
 * // </div>
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
 * Updates the loading progress bar value and percentage text display.
 * 
 * This function handles both determinate progress (with specific percentage)
 * and indeterminate progress (when exact progress is unknown). It updates
 * both the visual progress bar and the text percentage display.
 * 
 * @param {HTMLProgressElement} progressBar - The progress bar element to update
 * @param {number|null} value - Progress value between 0-1, or null for indeterminate progress
 * 
 * @example
 * // Update to 75% complete
 * updateLoadingBar(progressBar, 0.75);
 * 
 * @example
 * // Set to indeterminate state (spinning/unknown progress)
 * updateLoadingBar(progressBar, null);
 * 
 * @example
 * // Typical usage in a loading sequence
 * const progressBar = createLoadingBar(container);
 * 
 * // Start with indeterminate
 * updateLoadingBar(progressBar, null);
 * 
 * // Update with actual progress as it becomes available
 * fetch('/api/pdf-data')
 *   .then(response => {
 *     const reader = response.body.getReader();
 *     const contentLength = response.headers.get('Content-Length');
 *     let receivedLength = 0;
 *     
 *     return new ReadableStream({
 *       start(controller) {
 *         function pump() {
 *           return reader.read().then(({ done, value }) => {
 *             if (done) {
 *               controller.close();
 *               return;
 *             }
 *             receivedLength += value.length;
 *             updateLoadingBar(progressBar, receivedLength / contentLength);
 *             controller.enqueue(value);
 *             return pump();
 *           });
 *         }
 *         return pump();
 *       }
 *     });
 *   });
 */
export function updateLoadingBar(progressBar, value) {
  if (!progressBar) return;
  
  const percentSpan = document.querySelector('.pdfagogo-loading-percent');
  
  if (typeof value === "number") {
    // Determinate progress - show specific percentage
    progressBar.value = value;
    if (percentSpan) percentSpan.textContent = `${Math.round(value * 100)}%`;
  } else {
    // Indeterminate progress - remove value attribute for spinning animation
    progressBar.removeAttribute("value");
    if (percentSpan) percentSpan.textContent = '';
  }
}

/**
 * Removes the loading bar from the DOM completely.
 * 
 * This function safely removes the loading indicator once PDF loading
 * is complete or has failed. It handles cases where the loading bar
 * might not exist or has already been removed.
 * 
 * @example
 * // After successful PDF load
 * loadPdf(url)
 *   .then(pdf => {
 *     removeLoadingBar();
 *     initializeViewer(pdf);
 *   })
 *   .catch(error => {
 *     removeLoadingBar();
 *     showError('Failed to load PDF: ' + error.message);
 *   });
 */
export function removeLoadingBar() {
  const loadingDiv = document.querySelector(".pdfagogo-loading");
  if (loadingDiv && loadingDiv.parentNode) {
    loadingDiv.parentNode.removeChild(loadingDiv);
  }
}

/**
 * Displays an error message to the user in place of the loading indicator.
 * 
 * This function replaces the loading bar content with an error message,
 * providing clear feedback when PDF loading fails. The error is displayed
 * in a user-friendly format with appropriate styling.
 * 
 * @param {string} message - The error message to display to the user
 * 
 * @example
 * // Handle network error
 * showError('PDF not found. Please check the URL and try again.');
 * 
 * @example
 * // Handle parsing error
 * showError('Invalid PDF file. The file may be corrupted.');
 * 
 * @example
 * // Handle timeout error
 * showError('Loading timeout. Please check your connection and try again.');
 */
export function showError(message) {
  const loadingDiv = document.querySelector(".pdfagogo-loading");
  if (loadingDiv) {
    loadingDiv.innerHTML = `<div class="pdfagogo-loading-error">${message}</div>`;
  }
}

/**
 * Sets up all main UI controls and wires up their event listeners.
 * 
 * This is the primary UI initialization function that creates and configures:
 * - Search controls with text input and match navigation
 * - Navigation controls (previous/next buttons, page selector)
 * - Download and share functionality
 * - Accessibility features (screen reader announcements, keyboard navigation)
 * - Page tracking and URL fragment support
 * - Mobile-responsive touch interactions
 * 
 * The function handles feature toggles through the featureOptions parameter,
 * allowing selective enabling/disabling of UI components. All controls are
 * designed with accessibility in mind and include proper ARIA labels.
 * 
 * @param {HTMLElement} container - The main viewer container element
 * @param {Object} featureOptions - Feature toggles and configuration options
 * @param {boolean} [featureOptions.showSearch=true] - Enable search functionality
 * @param {boolean} [featureOptions.showPrevNext=true] - Show previous/next navigation buttons
 * @param {boolean} [featureOptions.showPageSelector=true] - Show page number input field
 * @param {boolean} [featureOptions.showCurrentPage=true] - Show current page indicator
 * @param {boolean} [featureOptions.showDownload=true] - Show download button
 * @param {boolean} [featureOptions.showResizeGrip=true] - Show resize handle
 * @param {ScrollablePdfViewer} viewer - The initialized PDF viewer instance
 * @param {Object} book - The PDF book object with page access methods
 * @param {Function} book.numPages - Returns total number of pages
 * @param {Function} book.getPage - Retrieves a specific page
 * @param {Object} pdf - The loaded PDF.js document instance
 * 
 * @example
 * // Basic setup with all features enabled
 * setupControls(
 *   document.getElementById('pdf-container'),
 *   {
 *     showSearch: true,
 *     showPrevNext: true,
 *     showPageSelector: true,
 *     showCurrentPage: true,
 *     showDownload: true
 *   },
 *   viewerInstance,
 *   bookObject,
 *   pdfDocument
 * );
 * 
 * @example
 * // Minimal setup with only navigation
 * setupControls(
 *   container,
 *   {
 *     showSearch: false,
 *     showPrevNext: true,
 *     showPageSelector: false,
 *     showCurrentPage: true,
 *     showDownload: false
 *   },
 *   viewer,
 *   book,
 *   pdf
 * );
 * 
 * @example
 * // The function creates this UI structure:
 * // <div class="pdfagogo-search-controls">
 * //   <input class="pdfagogo-search-box" type="text" placeholder="Search text..." />
 * //   <button class="pdfagogo-search-btn">Search</button>
 * //   <span class="pdfagogo-search-result"></span>
 * //   <button class="pdfagogo-prev-match-btn">Prev Match</button>
 * //   <button class="pdfagogo-next-match-btn">Next Match</button>
 * // </div>
 * // <div class="pdfagogo-controls">
 * //   <button class="pdfagogo-prev">Previous</button>
 * //   <button class="pdfagogo-next">Next</button>
 * //   <button class="pdfagogo-share">Share</button>
 * //   <button class="pdfagogo-download">Download PDF</button>
 * //   <input class="pdfagogo-goto-page" type="number" />
 * //   <button class="pdfagogo-goto-btn">Go</button>
 * //   <span class="pdfagogo-page-indicator"></span>
 * // </div>
 * // <div class="pdfagogo-page-announcement" aria-live="polite"></div>
 * // <div class="pdfagogo-a11y-instructions"></div>
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

  // Track the current page number using the 'seen' event
  let currentPage = 0;

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
      const page = currentPage + 1;
      const shareUrl = `${window.location.origin}${window.location.pathname}#pdf-page=${page}`;
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
    currentPage = parseInt(n);
    const totalPages = book.numPages();
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
  let prevMatchPage = null; // Track previous match page index
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
    const pageIdx = matchPages[currentMatchIdx];
    // Highlight only the current match
    const highlights = matchHighlights[pageIdx] || [];
    // Set global highlights for viewer
    window.__pdfagogo__highlights = {};
    window.__pdfagogo__highlights[pageIdx] = highlights;
    setPageByNumber(pageNum);
    // Only re-render the current and previous match pages
    if (typeof viewer.rerenderPage === 'function') {
      viewer.rerenderPage(pageIdx);
      if (prevMatchPage !== null && prevMatchPage !== pageIdx) {
        // Clear highlights for previous page and re-render
        window.__pdfagogo__highlights[prevMatchPage] = [];
        viewer.rerenderPage(prevMatchPage);
      }
      prevMatchPage = pageIdx;
    } else if (typeof viewer._renderAllPages === 'function') {
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
    isFirst = currentPage === 0;
    isLast = currentPage >= pdf.numPages;
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
    const match = window.location.hash.match(/pdf-page=(\d+)/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdf.numPages) {
        return pageNum;
      }
    }
    return null;
  }
  function goToHashPage() {
    // console.log('goToHashPage');
    const pageNum = getPageFromHash();
    if (pageNum) {
      setTimeout(() => {
        // console.log('goToHashPage', pageNum);
        setPageByNumber(pageNum);
        window.__pdfagogo__pageSetBy = 'hash';
      }, 200);
    }
  }
  // Wait for initial render before going to hash page
  viewer.on('initialRenderComplete', () => {
    console.log('initialRenderComplete');
    goToHashPage();
  });

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
    window.location.hash = `pdf-page=${pageNum}`;
    originalSetPageByNumber(pageNum);
  };

  // --- Resize grip feature: enabled by default, can be disabled with featureOptions.resize === false ---
  if (featureOptions.showResizeGrip !== false) {
    let resizeGrip = document.createElement("div");
    resizeGrip.className = "pdfagogo-resize-grip";
    resizeGrip.setAttribute("tabindex", "0");
    resizeGrip.setAttribute("role", "separator");
    resizeGrip.setAttribute("aria-orientation", "vertical");
    resizeGrip.setAttribute("aria-label", "Resize PDF viewer");
    resizeGrip.setAttribute("title", "Drag to resize PDF viewer height");
    container.appendChild(resizeGrip);

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    /**
     * Handler for when the user starts dragging the resize grip.
     * Sets up initial state and event listeners for mouse/touch move and up.
     */
    function onMouseDown(e) {
      isResizing = true;
      startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startHeight = container.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      // document.addEventListener('touchmove', onMouseMove, { passive: false });
      // document.addEventListener('touchend', onMouseUp);
      e.preventDefault();
    }

    /**
     * Handler for mouse/touch move events during resizing.
     * Dynamically updates the container height as the user drags.
     */
    function onMouseMove(e) {
      if (!isResizing) return;
      let clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      let newHeight = startHeight + (clientY - startY);
      newHeight = Math.max(200, newHeight); // Minimum height
      container.style.height = newHeight + 'px';
      e.preventDefault();
    }

    /**
     * Handler for when the user releases the resize grip (mouse/touch up).
     * Cleans up event listeners, redraws the PDF pages, and restores the scroll position to the current page.
     */
    async function onMouseUp(e) {
      isResizing = false;
      document.body.style.cursor = '';
      // document.removeEventListener('mousemove', onMouseMove);
      // document.removeEventListener('mouseup', onMouseUp);
      // document.removeEventListener('touchmove', onMouseMove);
      // document.removeEventListener('touchend', onMouseUp);
      // Only redraw after resizing ends
      // Store the current page index so we can restore the scroll position after redraw
      let currentPage = (typeof viewer.showNdx === 'number') ? viewer.showNdx : (viewer.currentPage || 0);

      // Trigger window resize event to redraw pages at new dimensions
      window.dispatchEvent(new Event('resize'));

      // Restore the scroll position to the same page after resizing
      if (typeof viewer?.go_to_page === 'function') {
        viewer.go_to_page(currentPage);
      }
      e.preventDefault();
    }

    // Attach event listeners to the resize grip for mouse and touch support
    resizeGrip.addEventListener('mousedown', onMouseDown);
    resizeGrip.addEventListener('touchstart', onMouseDown, { passive: false });
  }
}