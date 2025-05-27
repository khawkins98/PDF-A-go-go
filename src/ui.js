/**
 * @file ui.js
 * Provides UI helper functions and main control setup for the PDF viewer.
 * This module is responsible for creating and managing the visual components
 * of the viewer, such as toolbars, buttons, and loading indicators.
 */

/**
 * Creates and inserts a loading progress bar inside the given container.
 * @param {HTMLElement} container - The container to insert the loading bar into.
 * @returns {HTMLProgressElement | null} The created progress bar element, or null if container is invalid.
 */
export function createLoadingBar(container) {
  if (!container || typeof container.appendChild !== 'function') {
    console.error('[UI] Invalid container provided to createLoadingBar.');
    return null;
  }
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
 * @param {HTMLProgressElement | null} progressBar - The progress bar element (returned by `createLoadingBar`).
 * @param {number|null} value - Progress value (0-1). If null or not a number, the progress bar becomes indeterminate.
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
 * Finds the loading bar by its class and removes it from its parent.
 */
export function removeLoadingBar() {
  const loadingDiv = document.querySelector(".pdfagogo-loading");
  if (loadingDiv && loadingDiv.parentNode) loadingDiv.parentNode.removeChild(loadingDiv);
}

/**
 * Shows an error message in place of the loading bar, or as a general error display.
 * If a loading bar exists, its content is replaced. Otherwise, it might create a new error display (future enhancement).
 * @param {string} message - The error message to display.
 * @param {HTMLElement} [container] - Optional. If provided and no loading bar exists, might create error in this container.
 */
export function showError(message, container) {
  const loadingDiv = document.querySelector(".pdfagogo-loading");
  if (loadingDiv) {
    loadingDiv.innerHTML = `<div class="pdfagogo-loading-error">${message}</div>`;
  }
}

/**
 * Sets up all main UI controls (search, navigation, page selector, accessibility, etc.)
 * and wires up their event listeners.
 *
 * This function is responsible for dynamically creating the toolbar, search bar,
 * navigation buttons, page indicators, hint zones for page flipping, and the resize grip.
 * It uses the `ConfigManager` to determine which UI elements to show and how they behave.
 * It also sets up event listeners for user interactions and for events from the viewer core (e.g., 'pagechanged').
 *
 * @param {HTMLElement} container - The main viewer container element where UI elements will be attached or related to.
 * @param {import('./core/ConfigManager.js').ConfigManager} configManager - The configuration manager instance.
 * @param {object} viewer - The main viewer instance (e.g., `ScrollablePdfViewer`). This object should have methods like `flip_forward`, `flip_back`, `go_to_page` and emit events like `pagechanged`, `initialRenderComplete`.
 * @param {object} book - The PDF.js document object (usually `pdfDocument`), providing access to document properties like `numPages`.
 * @param {object} pdf - An alias for the PDF.js document object, often used for convenience (can be the same as `book`).
 */
export function setupControls(container, configManager, viewer, book, pdf) {
  // Remove any existing controls
  [
    "pdfagogo-search-controls",
    "pdfagogo-controls",
    "pdfagogo-page-announcement",
    "pdfagogo-a11y-instructions",
  ].forEach((cls) => {
    const el = document.querySelector("." + cls);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });

  // Search controls
  let searchControls, searchBox, searchBtn, searchResult, nextMatchBtn, prevMatchBtn;
  if (configManager.get('showSearch')) {
    searchControls = document.createElement("div");
    searchControls.className = "pdfagogo-search-controls";
    searchControls.innerHTML = `
      <input class="pdfagogo-search-box" type="text" placeholder="Search text..." aria-label="Search text" />
      <button class="pdfagogo-search-btn">Search</button>
      <span class="pdfagogo-search-result"></span>
    `;
    if (container && container.parentNode) {
      container.parentNode.insertBefore(searchControls, container);
    } else {
      console.error('[UI] Cannot append search controls: container or container.parentNode is null.', {container});
    }
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

    // Event listeners for search
    if (searchBtn && searchBox) {
      searchBtn.addEventListener("click", () => {
        if (viewer && typeof viewer.search === 'function') {
          viewer.search(searchBox.value);
        }
      });
      searchBox.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          if (viewer && typeof viewer.search === 'function') {
            viewer.search(searchBox.value);
          }
        }
      });
    }
    if (nextMatchBtn) {
      nextMatchBtn.addEventListener("click", () => {
        if (viewer && typeof viewer.findNext === 'function') {
          viewer.findNext();
        }
      });
    }
    if (prevMatchBtn) {
      prevMatchBtn.addEventListener("click", () => {
        if (viewer && typeof viewer.findPrevious === 'function') {
          viewer.findPrevious();
        }
      });
    }

    // Listen to search events from the viewer to update UI
    if (viewer && typeof viewer.on === 'function') {
      viewer.on('searchupdated', (data) => {
        if (searchResult) {
          if (data.totalMatches > 0) {
            searchResult.textContent = `Found ${data.totalMatches} matches. Displaying ${data.currentMatchIndex}.`;
          } else if (data.query && data.query.length > 0) {
            searchResult.textContent = "No matches found.";
          } else {
            searchResult.textContent = ""; // Cleared or initial state
          }
        }
        if (nextMatchBtn) {
          nextMatchBtn.disabled = data.totalMatches === 0 || data.currentMatchIndex >= data.totalMatches;
        }
        if (prevMatchBtn) {
          prevMatchBtn.disabled = data.totalMatches === 0 || data.currentMatchIndex <= 1;
        }
      });
      viewer.on('searchcleared', () => {
        if (searchBox) searchBox.value = "";
        if (searchResult) searchResult.textContent = "";
        if (nextMatchBtn) nextMatchBtn.disabled = true;
        if (prevMatchBtn) prevMatchBtn.disabled = true;
      });
       viewer.on('searchfailed', (data) => {
        if (searchResult) {
          searchResult.textContent = `Search failed: ${data.error || 'Unknown reason'}`;
        }
      });
    }
  }

  // Main controls
  const controls = document.createElement("div");
  controls.className = "pdfagogo-controls";
  let controlsHTML = "";
  if (configManager.get('showPrevNext')) {
    controlsHTML +=
      '<button class="pdfagogo-prev" aria-label="Previous page">Previous</button>';
    controlsHTML +=
      '<button class="pdfagogo-next" aria-label="Next page">Next</button>';
  }
  controlsHTML +=
    '<button class="pdfagogo-share" aria-label="Share current page">Share</button>';
  if (configManager.get('showDownload')) {
    controlsHTML += '<button class="pdfagogo-download" aria-label="Download PDF">Download PDF</button>';
  }
  if (configManager.get('showPageSelector')) {
    controlsHTML +=
      '<input class="pdfagogo-goto-page" type="number" min="0" max="999" style="width:60px;" placeholder="Page #" aria-label="Go to page" />';
    controlsHTML += '<button class="pdfagogo-goto-btn">Go</button>';
  }
  if (configManager.get('showCurrentPage')) {
    controlsHTML +=
      '<span class="pdfagogo-page-indicator" aria-live="polite"></span>';
  }
  controls.innerHTML = controlsHTML;
  if (container && container.parentNode) {
    container.parentNode.insertBefore(
      controls, // This is the main controls div
      container.nextSibling
    );
  } else {
    console.error('[UI] Cannot append main controls: container or container.parentNode is null.', {container});
  }

  // Query essential elements NOW that they are in the DOM
  const pageIndicatorElement = document.querySelector(".pdfagogo-page-indicator");
  const prevButtonElement = document.querySelector(".pdfagogo-prev");
  const nextButtonElement = document.querySelector(".pdfagogo-next");
  const gotoPageInputElement = document.querySelector(".pdfagogo-goto-page");
  const gotoButtonElement = document.querySelector(".pdfagogo-goto-btn"); // Query goto button as well
  const shareButtonElement = document.querySelector(".pdfagogo-share");
  const downloadButtonElement = document.querySelector(".pdfagogo-download");

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
    // Ensure 'controls' element (main control bar) exists before trying to use it as a reference
    const mainControlsElement = document.querySelector('.pdfagogo-controls');
    if (container && container.parentNode && mainControlsElement && mainControlsElement.nextSibling) {
        container.parentNode.insertBefore(pageAnnouncement, mainControlsElement.nextSibling);
    } else if (container && container.parentNode) { // Fallback if mainControlsElement.nextSibling is an issue
        console.warn('[UI] Could not find mainControlsElement.nextSibling, appending pageAnnouncement after container as fallback.');
        container.parentNode.insertBefore(pageAnnouncement, container.nextSibling);
    } else {
        console.error('[UI] Cannot append pageAnnouncement: container or parentNode is invalid.', {container});
    }
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
    const pageAnnouncementElement = document.querySelector('.pdfagogo-page-announcement');
    if (container && container.parentNode && pageAnnouncementElement && pageAnnouncementElement.nextSibling) {
        container.parentNode.insertBefore(a11yInstructions, pageAnnouncementElement.nextSibling);
    } else if (container && container.parentNode) { // Fallback
        console.warn('[UI] Could not find pageAnnouncementElement.nextSibling, appending a11yInstructions after container as fallback.');
        container.parentNode.insertBefore(a11yInstructions, container.nextSibling);
    } else {
        console.error('[UI] Cannot append a11yInstructions: container or parentNode is invalid.', {container});
    }
  }

  // Track the current page number using the 'seen' event
  let currentPage = 0;

  // Dynamically add overlay hint zones for click navigation
  let leftZone = document.querySelector('.pdfagogo-hint-left');
  let rightZone = document.querySelector('.pdfagogo-hint-right');

  if (container && typeof container.appendChild === 'function') {
    if (!leftZone) {
      leftZone = document.createElement("div");
      leftZone.className = "pdfagogo-hint-zone pdfagogo-hint-left";
      const leftArrow = document.createElement("span");
      leftArrow.className = "pdfagogo-hint-arrow";
      leftArrow.setAttribute("aria-hidden", "true");
      leftArrow.innerHTML = "&#8592;";
      leftZone.appendChild(leftArrow);
      container.appendChild(leftZone);
      leftZone.addEventListener("mouseenter", () => leftZone.classList.add("active"));
      leftZone.addEventListener("mouseleave", () => leftZone.classList.remove("active"));
      leftZone.addEventListener("click", () => viewer.flip_back());
    } else {
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
      rightZone.addEventListener("mouseenter", () => rightZone.classList.add("active"));
      rightZone.addEventListener("mouseleave", () => rightZone.classList.remove("active"));
      rightZone.addEventListener("click", () => viewer.flip_forward());
    } else {
    }
  } else {
    console.error('[UI] Hint zones NOT created because main container is invalid or missing appendChild method:', container);
  }
  // End of hint zone creation block

  // Forward declaration for updateNavArrows as updatePageIndicator calls it.
  let updateNavArrows = () => {};

  function updatePageIndicator(data) { // data will be { currentPage, totalPages, origin }
    if (pageIndicatorElement && data && typeof data.currentPage === 'number' && typeof data.totalPages === 'number') {
      pageIndicatorElement.innerHTML = `Page: <b>${data.currentPage}</b> / ${data.totalPages}`;
      // Update local currentPage for other UI elements if needed, e.g., share button
      currentPage = data.currentPage -1; // Keep our internal currentPage 0-indexed
    }
    // Announce for screen readers
    if (pageAnnouncement && data && typeof data.currentPage === 'number' && typeof data.totalPages === 'number') {
      pageAnnouncement.textContent = `Page ${data.currentPage} of ${data.totalPages}`;
    }
    // Update gotoPageInput if it exists
    if (gotoPageInputElement && data && typeof data.currentPage === 'number') {
        gotoPageInputElement.value = data.currentPage;
    }
    updateNavArrows(); // Call after currentPage might have been updated.
  }

  // Update navigation arrows (prev/next buttons visibility/disabled state)
  updateNavArrows = function() { // Assign to the forward-declared variable
    if (!book) {
      console.error('[UI] updateNavArrows: book object is not available! Cannot proceed.');
      return;
    }

    if (!prevButtonElement && !nextButtonElement && configManager.get('showPrevNext')) {
      console.warn('[UI] updateNavArrows: prevButtonElement or nextButtonElement (or both) not found. This may be normal if showPrevNext=false, or an issue if true.');
    }

    const totalPages = book.numPages();
    const isFirstPage = currentPage === 0;
    const isLastPage = totalPages > 0 && currentPage === totalPages - 1;

    if (prevButtonElement) {
        prevButtonElement.style.visibility = isFirstPage ? 'hidden' : '';
    }
    if (nextButtonElement) {
        nextButtonElement.style.visibility = isLastPage ? 'hidden' : '';
    }
  }

  // Initial update of page indicator and nav arrows
  if (viewer && book) {
    const initialPageToShow = (typeof viewer.currentPage === 'number' && viewer.currentPage >= 0) ? viewer.currentPage + 1 : 1;
    const totalPages = book.numPages();
    updatePageIndicator({ currentPage: initialPageToShow, totalPages: totalPages, origin: 'initialization' });
  } else {
     updateNavArrows(); // Still call to set initial state if viewer/book not ready for indicator
  }

  // Listen for page changes from the viewer (which gets it from PageManager via EventBus)
  if (viewer && typeof viewer.on === 'function') {
    viewer.on('pagechanged', (eventData) => {
      updatePageIndicator(eventData);
    });
  }

  // Navigation buttons
  if (configManager.get('showPrevNext') && prevButtonElement && nextButtonElement) {
    prevButtonElement.addEventListener("click", () => {
      console.log("[UI] Prev button clicked. Viewer available?", !!viewer);
      if (viewer && typeof viewer.flip_back === 'function') {
        viewer.flip_back();
      } else {
        console.error("[UI] Prev button: viewer or viewer.flip_back is not available.");
      }
    });
    nextButtonElement.addEventListener("click", () => {
      console.log("[UI] Next button clicked. Viewer available?", !!viewer);
      if (viewer && typeof viewer.flip_forward === 'function') {
        viewer.flip_forward();
      } else {
        console.error("[UI] Next button: viewer or viewer.flip_forward is not available.");
      }
    });
  }

  // Share button
  if (shareButtonElement)
    shareButtonElement.onclick = () => {
      const page = currentPage + 1;
      const shareUrl = `${window.location.origin}${window.location.pathname}#pdf-page=${page}`;
      navigator.clipboard.writeText(shareUrl);
      alert("Share link copied to clipboard:\n" + shareUrl);
    };

  // Download button
  if (downloadButtonElement) {
    downloadButtonElement.onclick = () => {
      const link = document.createElement('a');
      link.href = configManager.get('pdfUrl');
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  // Page selector
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
  if (gotoButtonElement)
    gotoButtonElement.onclick = function () {
      const val = gotoPageInputElement ? parseInt(gotoPageInputElement.value, 10) : NaN;
      setPageByNumber(val);
    };
  if (gotoPageInputElement && gotoButtonElement) {
    gotoPageInputElement.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.keyCode === 13) {
        gotoButtonElement.click();
      }
    });
  }
  if (!configManager.get('showPageSelector')) {
    if (gotoPageInputElement) gotoPageInputElement.style.display = "none";
    if (gotoButtonElement) gotoButtonElement.style.display = "none";
  }

  // Ensure nav arrows (including hints) are updated after potential creation
  updateNavArrows();

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
    const pageNum = getPageFromHash();
    if (pageNum) {
      setTimeout(() => {
        setPageByNumber(pageNum);
        window.__pdfagogo__pageSetBy = 'hash';
      }, 200);
    }
  }
  viewer.on('initialRenderComplete', () => {
    goToHashPage();
  });
  window.addEventListener("hashchange", goToHashPage);
  const defaultPageFromConfig = configManager.get('defaultPage');
  if (!getPageFromHash() && defaultPageFromConfig) {
    const defPage = parseInt(defaultPageFromConfig, 10);
    if (!isNaN(defPage) && defPage >= 1 && defPage <= pdf.numPages) {
      setPageByNumber(defPage);
      window.__pdfagogo__pageSetBy = 'defaultPage';
    }
  }
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
  // END OF HASH NAVIGATION //

  // --- Resize grip feature ---
  const showResizeGrip = configManager.get('showResizeGrip', true);

  if (showResizeGrip !== false) {
    let resizeGrip = document.querySelector('.pdfagogo-resize-grip'); // Check if it somehow already exists
    if (!resizeGrip) {
        resizeGrip = document.createElement("div");
        resizeGrip.className = "pdfagogo-resize-grip";
    } else {
    }

    resizeGrip.setAttribute("tabindex", "0");
    resizeGrip.setAttribute("role", "separator");
    resizeGrip.setAttribute("aria-orientation", "vertical");
    resizeGrip.setAttribute("aria-label", "Resize PDF viewer");
    resizeGrip.setAttribute("title", "Drag to resize PDF viewer height");

    if (container && typeof container.appendChild === 'function') {
      // Only append if it's not already a child of this container
      if (resizeGrip.parentElement !== container) {
        container.appendChild(resizeGrip);
      } else {
      }
    } else {
      console.error('[UI] Cannot append resize grip: container is invalid.', {container});
    }

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    function onMouseDown(e) {
      isResizing = true;
      startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startHeight = container.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onMouseMove, { passive: false });
      document.addEventListener('touchend', onMouseUp);
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!isResizing) return;
      let clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      let newHeight = startHeight + (clientY - startY);
      newHeight = Math.max(200, newHeight);
      container.style.height = newHeight + 'px';
    }

    async function onMouseUp(e) {
      if (!isResizing) return;
      isResizing = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('touchend', onMouseUp);

      window.dispatchEvent(new Event('resize'));
    }

    resizeGrip.addEventListener('mousedown', onMouseDown);
    resizeGrip.addEventListener('touchstart', onMouseDown, { passive: false });
  }
}