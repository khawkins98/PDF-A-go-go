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
import { setupSearchControls } from './search.js';

export function setupControls(container, featureOptions, viewer, book, pdf) {
  // Remove any existing controls to prevent duplicates
  [
    "pdfagogo-search-controls",
    "pdfagogo-controls",
    "pdfagogo-page-announcement",
    "pdfagogo-a11y-instructions"
  ].forEach((cls) => {
    const el = document.querySelector("." + cls);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  // Search controls are now handled by the dedicated module
  let setPageByNumber = null; // will be defined below then passed into search module

  // Main controls
  const controls = document.createElement("div");
  controls.className = "pdfagogo-controls";
  let controlsHTML = "";
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
      - Use <kbd>Up or Left Arrow</kbd> to go to the previous page.<br>
      - Use <kbd>Down or Right Arrow</kbd> to go to the next page.<br>
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

  // Share button
  const shareBtn = document.querySelector(".pdfagogo-share");
  if (shareBtn)
    shareBtn.onclick = () => {
      const page = currentPage + 1;
      const shareUrl = `${window.location.origin}${window.location.pathname}#pdf-page-${page}`;
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
  function baseSetPageByNumber(pageNum) {
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
  // Initialize the navigation function variable
  setPageByNumber = baseSetPageByNumber;
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
  updatePage(1); // Start at page 1 since that's what's initially visible
  if (!featureOptions.showCurrentPage) {
    if (pageIndicator) pageIndicator.style.display = "none";
  }

  // Initialize search controls (delegated to search module)
  setupSearchControls(container, featureOptions, viewer, book, pdf, setPageByNumber);

  // Keyboard navigation for accessibility
  container.addEventListener("keydown", function (event) {
    if (event.key === "ArrowLeft") {
      viewer.flip_back();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      viewer.flip_forward();
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      viewer.flip_back();
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
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

  // --- Hash-based page navigation ---
  function getPageFromHash() {
    const match = window.location.hash.match(/pdf-page-(\d+)/);
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
    // Update visible pages to sync the page counter with what's actually shown
    if (typeof viewer._updateVisiblePages === 'function') {
      viewer._updateVisiblePages();
    }
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
  // When navigating to a page, update the hash as well
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
    window.location.hash = `pdf-page-${pageNum}`;
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
     * Cleans up event listeners. Note: PDF pages maintain their scale - only container height changes.
     */
    async function onMouseUp(e) {
      isResizing = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Note: We no longer trigger window resize events to maintain consistent PDF page scale
      // The container height change provides more vertical space without affecting page rendering
      e.preventDefault();
    }

    // Attach event listeners to the resize grip for mouse and touch support
    resizeGrip.addEventListener('mousedown', onMouseDown);
    resizeGrip.addEventListener('touchstart', onMouseDown, { passive: false });
  }
}