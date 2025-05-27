/**
 * @file PageManager.js
 * Manages PDF pages, including their lifecycle, rendering states, and visibility.
 * It coordinates with the RenderQueue to schedule page rendering tasks.
 */

import { debounce } from '../utils/debounce.js';

const OFFSCREEN_PAGE_RENDER_DELAY_MS = 50; // Small delay before rendering offscreen pages to batch operations
const VISIBILITY_CHECK_DEBOUNCE_MS = 100; // Debounce for checking visible pages on scroll/resize
const MAX_CONCURRENT_RENDERS = 2; // Limit concurrent rendering operations

/**
 * @typedef {object} PageDimension
 * @property {number} width - The width of the page.
 * @property {number} height - The height of the page.
 * @property {number} aspectRatio - The aspect ratio (width / height) of the page.
 */

/**
 * @typedef {object} PageState
 * @property {number} pageIndex - 0-indexed page number.
 * @property {HTMLDivElement | null} wrapper - The DOM wrapper for the page canvas and text layer.
 * @property {HTMLCanvasElement | null} canvas - The canvas element for rendering the page.
 * @property {HTMLDivElement | null} textLayer - The div for the text layer.
 * @property {boolean} isVisible - Whether the page is currently considered visible in the viewport.
 * @property {boolean} lowResRendered - Whether the low-resolution version has been rendered.
 * @property {boolean} highResRendered - Whether the high-resolution version has been rendered.
 * @property {boolean} isRenderingLow - Whether a low-resolution render is currently in progress.
 * @property {boolean} isRenderingHigh - Whether a high-resolution render is currently in progress.
 * @property {PageDimension | null} dimensions - The dimensions of the page (width, height, aspectRatio).
 * @property {any | null} pdfJsPage - The PDF.js page object.
 * @property {AbortController | null} currentLowResAbortController - Abort controller for the current low-res render task.
 * @property {AbortController | null} currentHighResAbortController - Abort controller for the current high-res render task.
 */

/**
 * Manages the lifecycle and rendering of PDF pages.
 * Determines which pages are visible and schedules their rendering (low-res and high-res)
 * via a RenderQueue.
 */
export class PageManager {
  /**
   * @private
   * @type {import('../scrollablePdfViewer.js').ScrollablePdfViewer | null} Reference to the main viewer instance.
   */
  _viewerInstance = null;

  /**
   * @private
   * @type {HTMLElement | null} The scrollable container holding the pages.
   */
  _scrollContainer = null;

  /**
   * @private
   * @type {HTMLElement | null} The container where page wrappers are appended.
   */
  _pagesContainer = null;

  /**
   * @private
   * @type {any} The PDF.js document object.
   */
  _book = null;

  /**
   * @private
   * @type {import('./RenderQueue.js').RenderQueue} The render queue for managing page rendering tasks.
   */
  _renderQueue = null;

  /**
   * @private
   * @type {import('./EventBus.js').EventBus} The event bus for emitting page-related events.
   */
  _eventBus = null;

  /**
   * @private
   * @type {import('./ConfigManager.js').ConfigManager} The configuration manager instance.
   */
  _configManager = null;

  /**
   * @private
   * @type {Array<PageState>}
   * An array holding the state for each page in the PDF document.
   */
  _pageStates = [];

  /**
   * @private
   * @type {number} The 0-indexed number of the current page primarily in view.
   */
  _currentPage = 0;

  /**
   * @private
   * @type {Set<number>} A set of page indices currently visible in the viewport.
   */
  _visiblePages = new Set();

  /**
   * @private
   * @type {boolean} Flag to indicate if the PageManager has been initialized.
   */
  _isInitialized = false;

  /**
   * @private
   * @type {Function} Debounced version of _checkVisiblePagesAndRender.
   */
  _debouncedCheckAndRender;

  /**
   * @private
   * @type {boolean} Flag to enable/disable debug logging.
   */
  _debug = false;

  /**
   * Creates an instance of PageManager.
   * @param {object} options - Configuration options for the PageManager.
   * @param {import('../scrollablePdfViewer.js').ScrollablePdfViewer} options.viewerInstance - The main ScrollablePdfViewer instance.
   * @param {any} options.book - The PDF.js document object.
   * @param {import('./RenderQueue.js').RenderQueue} options.renderQueue - The render queue instance.
   * @param {import('./EventBus.js').EventBus} options.eventBus - The event bus instance.
   * @param {import('./ConfigManager.js').ConfigManager} options.configManager - The configuration manager instance.
   */
  constructor({ viewerInstance, book, renderQueue, eventBus, configManager }) {
    this._viewerInstance = viewerInstance;
    this._book = book;
    this._renderQueue = renderQueue;
    this._eventBus = eventBus;
    this._configManager = configManager;
    this._debug = this._configManager.get('debug', false);

    this.pageCount = book.numPages();
    this._currentPage = 0;
    this._pageStates = Array(this.pageCount).fill(null).map((_, i) => ({
      pageIndex: i,
      wrapper: null,
      canvas: null,
      textLayer: null,
      isVisible: false,
      lowResRendered: false,
      highResRendered: false,
      isRenderingLow: false,
      isRenderingHigh: false,
      dimensions: null,
      pdfJsPage: null,
      currentLowResAbortController: null,
      currentHighResAbortController: null,
    }));

    if (!this._viewerInstance || !this._viewerInstance.app) {
      console.error("[PageManager] Constructor: viewerInstance or viewerInstance.app is not available!");
      // Potentially throw an error or handle this state to prevent further issues
      this._scrollContainer = null;
      this._pagesContainer = null;
    } else {
      this._scrollContainer = this._viewerInstance.app.querySelector('.pdfagogo-scroll-container');
      this._pagesContainer = this._viewerInstance.app.querySelector('.pdfagogo-pages-container');
    }

    if (!this._scrollContainer) {
        console.error("[PageManager] Constructor: Scroll container (.pdfagogo-scroll-container) not found within viewerInstance.app!");
    }
    if (!this._pagesContainer) {
        console.error("[PageManager] Constructor: Pages container (.pdfagogo-pages-container) not found within viewerInstance.app!");
    }

    this._debouncedCheckAndRender = debounce(this._checkVisiblePagesAndRender.bind(this), VISIBILITY_CHECK_DEBOUNCE_MS);
    if (this._debug) console.log('[PageManager] Constructed');
  }

  /**
   * Initializes the PageManager.
   * Creates page structures, fetches initial dimensions, and sets up the pages container.
   * Must be called before other methods can be used reliably.
   * @returns {Promise<void>}
   * @throws {Error} If initialization fails (e.g., book not provided).
   */
  async initializePages() {
    if (this._debug) console.log('[PageManager] initializePages START');

    if (!this._pagesContainer) {
      console.error("[PageManager] initializePages: Cannot proceed, _pagesContainer is null.");
      return;
    }
    if (!this._book) {
      console.error("[PageManager] initializePages: Cannot proceed, _book is null.");
      throw new Error("PDF book not available for PageManager initialization.");
    }

    // Clear any existing children from pagesContainer
    while (this._pagesContainer.firstChild) {
        this._pagesContainer.removeChild(this._pagesContainer.firstChild);
    }
    if (this._debug) console.log('[PageManager] initializePages: Cleared existing children from _pagesContainer.');

    const pageDimensionPromises = [];
    for (let i = 0; i < this.pageCount; i++) {
      this._pageStates[i].wrapper = this._createPageStructure(i);
      this._pagesContainer.appendChild(this._pageStates[i].wrapper);
      if (this._debug && i < 3) console.log(`[PageManager] initializePages: Created and appended wrapper for page ${i}`);

      pageDimensionPromises.push(
        this._book.getPage(i + 1) // PDF.js getPage is 1-indexed
          .then(pdfJsPage => {
            this._pageStates[i].pdfJsPage = pdfJsPage;
            const viewport = pdfJsPage.getViewport({ scale: 1.0 });
            this._pageStates[i].dimensions = {
              width: viewport.width,
              height: viewport.height,
              aspectRatio: viewport.width / viewport.height,
            };
            // Apply initial dimensions to wrapper (height will be set by flex, width by aspect ratio)
            this._pageStates[i].wrapper.style.aspectRatio = String(this._pageStates[i].dimensions.aspectRatio);
            if (this._debug && i < 3) console.log(`[PageManager] initializePages: Dimensions fetched for page ${i}:`, this._pageStates[i].dimensions);
          })
          .catch(err => {
            console.error(`[PageManager] initializePages: Failed to get PDF.js page or dimensions for page ${i}:`, err);
            this._pageStates[i].dimensions = { width: 300, height: 400, aspectRatio: 3/4 }; // Fallback
            this._pageStates[i].wrapper.style.aspectRatio = String(3/4);
          })
      );
    }

    try {
      await Promise.all(pageDimensionPromises);
      if (this._debug) console.log('[PageManager] initializePages: All page dimension promises resolved.');
    } catch (error) {
      console.error('[PageManager] initializePages: Error resolving some page dimension promises:', error);
      // Continue, fallbacks should be in place
    }

    this._isInitialized = true;
    if (this._debug) console.log('[PageManager] initializePages: _isInitialized = true. Total pages: ', this.pageCount);

    // Initial check for visible pages
    this._checkVisiblePagesAndRender();
    this._eventBus.emit('pageManagerInitialized');
    if (this._debug) console.log('[PageManager] initializePages END');
  }

  _createPageStructure(pageIndex) {
    const pageState = this._pageStates[pageIndex];

    const wrapper = document.createElement('div');
    wrapper.className = 'pdfagogo-page-wrapper';
    wrapper.style.position = 'relative'; // For canvas and text layer positioning
    // Height will be 100% of the flex row (pagesContainer), width will be set by aspect ratio
    wrapper.style.height = '100%';
    // Add a margin if configured
    const pageMargin = this._configManager.get('pageMarginHorizontal', 0); // example option name
    if (pageMargin > 0) {
        wrapper.style.marginLeft = `${pageMargin}px`;
        wrapper.style.marginRight = `${pageMargin}px`;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'pdfagogo-page-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block'; // Ensure canvas takes up block space
    canvas.setAttribute('data-page-index', String(pageIndex));
    pageState.canvas = canvas;

    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdfagogo-text-layer';
    // Style text layer to overlay canvas
    textLayerDiv.style.position = 'absolute';
    textLayerDiv.style.left = '0';
    textLayerDiv.style.top = '0';
    textLayerDiv.style.right = '0';
    textLayerDiv.style.bottom = '0';
    textLayerDiv.style.pointerEvents = 'none'; // Pass clicks through to canvas or selection layer
    pageState.textLayer = textLayerDiv;

    wrapper.appendChild(canvas);
    wrapper.appendChild(textLayerDiv);
    pageState.wrapper = wrapper;

    if (this._debug && pageIndex < 3) console.log(`[PageManager] _createPageStructure: Created structure for page ${pageIndex}`);
    return wrapper;
  }

  _fetchAllPageDimensions() { /* This is now integrated into initializePages */ }

  _checkVisiblePagesAndRender() {
    if (!this._isInitialized || !this._scrollContainer) return;
    if (this._debug) console.log('[PageManager] _checkVisiblePagesAndRender START');

    const newVisiblePageIndices = this._getVisiblePageIndices();
    if (this._debug) console.log('[PageManager] _checkVisiblePagesAndRender: New visible indices:', newVisiblePageIndices);

    // Logic to determine which pages need rendering (newly visible, or needing high-res upgrade)
    const pagesToRenderLow = [];
    const pagesToRenderHigh = [];

    for (const pageIndex of newVisiblePageIndices) {
      const pageState = this._pageStates[pageIndex];
      if (!pageState.lowResRendered && !pageState.isRenderingLow) {
        pagesToRenderLow.push(pageIndex);
      }
      // Add a delay or condition for high-res rendering to avoid hogging resources
      // For example, only render high-res if it has been visible for a certain time, or after scrolling stops.
      // For now, let's queue high-res if low-res is done and high-res isn't.
      else if (pageState.lowResRendered && !pageState.highResRendered && !pageState.isRenderingHigh) {
        // Simple approach: if low-res is done, and high-res is not, queue high-res
        // More advanced: use a timeout after low-res render or after scroll stops
        const highResDelay = this._configManager.get('highResRenderDelayMs', 250);
        setTimeout(() => {
            // Re-check conditions as state might have changed
            if (pageState.lowResRendered && !pageState.highResRendered && !pageState.isRenderingHigh && this._visiblePages.has(pageIndex)) {
                 if (this._debug) console.log(`[PageManager] _checkVisiblePagesAndRender: Queuing HIGH-RES for page ${pageIndex} after delay.`);
                 this._renderPage(pageIndex, true); // true for highRes
            }
        }, highResDelay);
      }
    }

    // Update visibility state for all pages
    for (let i = 0; i < this.pageCount; i++) {
      this._pageStates[i].isVisible = newVisiblePageIndices.has(i);
    }

    // Render newly visible pages (low-res first)
    pagesToRenderLow.forEach(pageIndex => {
      if (this._debug) console.log(`[PageManager] _checkVisiblePagesAndRender: Queuing LOW-RES for page ${pageIndex}`);
      this._renderPage(pageIndex, false); // false for lowRes
    });

    this._visiblePages = newVisiblePageIndices;
    this._updateCurrentPage(newVisiblePageIndices);
    if (this._debug) console.log('[PageManager] _checkVisiblePagesAndRender END, Current page:', this._currentPage);
  }

  _getVisiblePageIndices() {
    const visibleIndices = new Set();
    if (!this._isInitialized || !this._scrollContainer || !this._pagesContainer || this._pagesContainer.children.length === 0) {
      if (this._debug && this._isInitialized) console.warn('[_getVisiblePageIndices] Scroll/Pages container not ready or no children.');
      return visibleIndices;
    }

    const scrollRect = this._scrollContainer.getBoundingClientRect();
    const scrollLeft = this._scrollContainer.scrollLeft;
    const scrollRight = scrollLeft + scrollRect.width;

    // Buffer for pre-rendering pages slightly off-screen
    const buffer = scrollRect.width * this._configManager.get('renderBufferFactor', 0.5); // e.g., 0.5 container widths on each side
    const extendedScrollLeft = scrollLeft - buffer;
    const extendedScrollRight = scrollRight + buffer;

    for (let i = 0; i < this._pageStates.length; i++) {
      const pageState = this._pageStates[i];
      if (!pageState.wrapper) continue;

      // Get wrapper position relative to the _pagesContainer (its offsetParent)
      const pageWrapperLeft = pageState.wrapper.offsetLeft;
      const pageWrapperRight = pageWrapperLeft + pageState.wrapper.offsetWidth;

      if (pageWrapperRight > extendedScrollLeft && pageWrapperLeft < extendedScrollRight) {
        visibleIndices.add(i);
      }
    }
    if (this._debug && visibleIndices.size === 0 && this.pageCount > 0) {
        // If no pages are calculated as visible, but there are pages, log info
        console.log(`[_getVisiblePageIndices] No pages calculated as visible. scrollLeft: ${scrollLeft}, scrollRight: ${scrollRight}, buffer: ${buffer}`);
        // console.log('[_getVisiblePageIndices] First page wrapper rect:', this._pageStates[0]?.wrapper?.getBoundingClientRect());
        // console.log('[_getVisiblePageIndices] Scroll container rect:', scrollRect);
    } else if (this._debug) {
      // console.log('[_getVisiblePageIndices] Calculated visible:', Array.from(visibleIndices));
    }
    return visibleIndices;
  }

  _updateCurrentPage(newVisiblePages) {
    if (!this._isInitialized || !this._scrollContainer) {
      if (this._debug) console.log('[PageManager] _updateCurrentPage: Not initialized or no scroll container.');
      return;
    }
    if (newVisiblePages.size === 0) {
      if (this._debug) console.log('[PageManager] _updateCurrentPage: No new visible pages to determine current page from.');
      // Optionally, we could decide not to change _currentPage here, or set it to a default like 0
      // For now, if no pages are visible, we don't update _currentPage.
      return;
    }

    const scrollRect = this._scrollContainer.getBoundingClientRect();
    const scrollContainerCenterX = this._scrollContainer.scrollLeft + scrollRect.width / 2;
    if (this._debug) console.log(`[PageManager] _updateCurrentPage: scrollLeft: ${this._scrollContainer.scrollLeft.toFixed(2)}, containerWidth: ${scrollRect.width.toFixed(2)}, scrollContainerCenterX: ${scrollContainerCenterX.toFixed(2)}`);

    let newCurrentPageCandidate = this._currentPage; // Start with the current page
    let minDistanceToCenter = Infinity;
    let closestPageInfo = {};

    newVisiblePages.forEach(pageIndex => {
      const pageState = this._pageStates[pageIndex];
      if (pageState.wrapper && pageState.wrapper.offsetParent) { // Ensure wrapper is in layout
        const pageWrapperLeft = pageState.wrapper.offsetLeft;
        const pageWrapperWidth = pageState.wrapper.offsetWidth;
        const pageWrapperCenterX = pageWrapperLeft + pageWrapperWidth / 2;
        const distance = Math.abs(pageWrapperCenterX - scrollContainerCenterX);
        if (this._debug) console.log(`[PageManager] _updateCurrentPage: Checking page ${pageIndex}: wrapperLeft=${pageWrapperLeft.toFixed(2)}, wrapperWidth=${pageWrapperWidth.toFixed(2)}, wrapperCenter=${pageWrapperCenterX.toFixed(2)}, distanceToCenter=${distance.toFixed(2)}`);
        if (distance < minDistanceToCenter) {
          minDistanceToCenter = distance;
          newCurrentPageCandidate = pageIndex;
          closestPageInfo = { pageIndex, pageWrapperCenterX, distance };
        } else if (distance === minDistanceToCenter && pageIndex < newCurrentPageCandidate) {
          // Tie-breaking: if distances are equal, prefer the lower page index (more to the left)
          // This can help when multiple pages are fully visible and one might be slightly more centered by a pixel.
          if (this._debug) console.log(`[PageManager] _updateCurrentPage: Tie-break for distance, preferring page ${pageIndex} over ${newCurrentPageCandidate}`);
          newCurrentPageCandidate = pageIndex;
          closestPageInfo = { pageIndex, pageWrapperCenterX, distance };
        }
      }
    });

    if (this._debug) console.log(`[PageManager] _updateCurrentPage: Closest page determined: idx=${closestPageInfo.pageIndex}, center=${closestPageInfo.pageWrapperCenterX?.toFixed(2)}, dist=${closestPageInfo.distance?.toFixed(2)}. Previous _currentPage was ${this._currentPage}.`);

    if (newCurrentPageCandidate !== this._currentPage) {
      this._currentPage = newCurrentPageCandidate;
      if (this._debug) console.log(`[PageManager] _updateCurrentPage: Current page CHANGED to ${this._currentPage}. Emitting pagechanged (1-indexed: ${this._currentPage + 1})`);
      this._eventBus.emit('pagechanged', { currentPage: this._currentPage + 1, totalPages: this.pageCount, origin: 'PageManagerUpdate' });
    } else {
      if (this._debug) console.log(`[PageManager] _updateCurrentPage: Current page REMAINS ${this._currentPage}. No pagechanged event.`);
    }
  }

  _renderPage(pageIndex, isHighResPass = false) {
    const pageState = this._pageStates[pageIndex];
    if (!pageState || !pageState.wrapper || !pageState.canvas) {
      console.error(`[PageManager] _renderPage: Cannot render page ${pageIndex}, missing state, wrapper or canvas.`);
      return;
    }

    const resolution = isHighResPass ? 'high' : 'low';

    if (isHighResPass) {
      if (pageState.highResRendered || pageState.isRenderingHigh) return;
      if (pageState.currentHighResAbortController) pageState.currentHighResAbortController.abort();
      pageState.currentHighResAbortController = new AbortController();
      pageState.isRenderingHigh = true;
    } else {
      if (pageState.lowResRendered || pageState.isRenderingLow) return;
      if (pageState.currentLowResAbortController) pageState.currentLowResAbortController.abort();
      pageState.currentLowResAbortController = new AbortController();
      pageState.isRenderingLow = true;
    }
    if (this._debug) console.log(`[PageManager] _renderPage: Queuing ${resolution}-res for page ${pageIndex}. Current state: lowResRendered=${pageState.lowResRendered}, highResRendered=${pageState.highResRendered}`);

    this._renderQueue.add(
      async () => {
        if (this._debug) console.log(`[PageManager] RenderQueue EXECUTING ${resolution}-res for page ${pageIndex}`);
        if ((isHighResPass && pageState.currentHighResAbortController.signal.aborted) || 
            (!isHighResPass && pageState.currentLowResAbortController.signal.aborted)) {
          if (this._debug) console.log(`[PageManager] Render task for page ${pageIndex} (${resolution}) aborted before execution.`);
          if (isHighResPass) pageState.isRenderingHigh = false;
          else pageState.isRenderingLow = false;
          return;
        }
        
        this._eventBus.emit('pageRenderQueued', { pageIndex, resolution });
        try {
          if (typeof this._viewerInstance._renderPageInternal !== 'function') {
            console.error("[PageManager] _viewerInstance._renderPageInternal is not a function!");
            throw new Error("_renderPageInternal not found on _viewerInstance");
          }

          await this._viewerInstance._renderPageInternal(
            pageIndex,
            resolution,
            isHighResPass ? pageState.currentHighResAbortController.signal : pageState.currentLowResAbortController.signal
          );

          if (this._debug) console.log(`[PageManager] RenderQueue COMPLETED ${resolution}-res for page ${pageIndex}`);
          if (isHighResPass) {
            pageState.highResRendered = true;
            pageState.isRenderingHigh = false;
          } else {
            pageState.lowResRendered = true;
            pageState.isRenderingLow = false;
            // If this was a low-res render and high-res is needed and not yet started/done, queue it (e.g., after a delay or if conditions met)
            if (pageState.isVisible && !pageState.highResRendered && !pageState.isRenderingHigh) {
                 const highResDelay = this._configManager.get('highResRenderDelayMs', 250);
                 setTimeout(() => {
                    if (pageState.isVisible && !pageState.highResRendered && !pageState.isRenderingHigh) {
                        if (this._debug) console.log(`[PageManager] POST LOW-RES: Queuing HIGH-RES for page ${pageIndex}`);
                        this._renderPage(pageIndex, true);
                    }
                 }, highResDelay);
            }
          }
          this._eventBus.emit('pageRenderSuccessful', { pageIndex, resolution });
        } catch (error) {
          if (error.name === 'AbortError') {
            if (this._debug) console.log(`[PageManager] Render task for page ${pageIndex} (${resolution}) was aborted.`);
          } else {
            console.error(`[PageManager] Error rendering page ${pageIndex} (${resolution}):`, error);
            this._eventBus.emit('pageRenderFailedInternal', { pageIndex, resolution, error: error.message });
          }
          if (isHighResPass) pageState.isRenderingHigh = false;
          else pageState.isRenderingLow = false;
          // Do not reset lowResRendered or highResRendered here, as a partial render might have occurred or an abort might be temporary.
        }
      },
      { priority: isHighResPass ? 0 : 1 }
    );
  }

  // ... (getCurrentPage, getTotalPages, getPageInfo, goToPage, rerenderPage, rerenderVisiblePages, handleScroll, handleResize, destroy as before) ...
  // Ensure goToPage, rerenderPage, rerenderVisiblePages use the new _pageStates and _renderPage mechanisms.

  getCurrentPage() {
    return this._currentPage;
  }

  getTotalPages() {
    return this.pageCount;
  }

  getPageInfo(pageIndex) {
    return this._pageStates[pageIndex];
  }

  goToPage(pageIndex, { smooth = false, updateCurrent = true, origin = 'unknown' } = {}) {
    if (!this._isInitialized || !this._scrollContainer) return;
    if (pageIndex < 0 || pageIndex >= this.pageCount) {
      console.warn(`[PageManager] goToPage: Invalid page index ${pageIndex} from ${origin}`);
      return;
    }

    const pageState = this._pageStates[pageIndex];
    if (!pageState || !pageState.wrapper) {
      console.warn(`[PageManager] goToPage: Wrapper for page ${pageIndex} not found (from ${origin}).`);
      return;
    }

    const scrollContainerWidth = this._scrollContainer.getBoundingClientRect().width;
    const pageWrapperWidth = pageState.wrapper.offsetWidth;
    const pageWrapperOffsetLeft = pageState.wrapper.offsetLeft;

    // Calculate the scrollLeft value needed to center the page
    let targetScrollX = pageWrapperOffsetLeft + (pageWrapperWidth / 2) - (scrollContainerWidth / 2);

    // Ensure targetScrollX is not negative and not beyond the max scroll width
    const maxScrollLeft = this._scrollContainer.scrollWidth - scrollContainerWidth;
    targetScrollX = Math.max(0, Math.min(targetScrollX, maxScrollLeft));

    if (this._debug) console.log(`[PageManager] goToPage (from ${origin}): Target page ${pageIndex}. Current scrollLeft: ${this._scrollContainer.scrollLeft.toFixed(2)}. Calculated targetScrollX (to center page): ${targetScrollX.toFixed(2)}. Page wrapper offsetLeft: ${pageWrapperOffsetLeft.toFixed(2)}, PWW: ${pageWrapperWidth.toFixed(2)}, SCW: ${scrollContainerWidth.toFixed(2)}`);

    this._scrollContainer.scrollTo({
      left: targetScrollX, 
      behavior: smooth ? 'smooth' : 'auto',
    });

    // Immediately update and render if not smooth or if forced by updateCurrent
    // The scroll event might be debounced or not fire if already at the target.
    if (updateCurrent || !smooth) {
        if (this._debug) console.log(`[PageManager] goToPage (from ${origin}): Calling _checkVisiblePagesAndRender immediately for page ${pageIndex}`);
        // Clear any pending debounced check, as we are doing it now.
        if (this._debouncedCheckAndRender.cancel) this._debouncedCheckAndRender.cancel(); 
        this._checkVisiblePagesAndRender(); 
    } 
    // For smooth scrolling, the scroll event listener will eventually call _checkVisiblePagesAndRender.
  }

  rerenderPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pageCount) return;
    const pageState = this._pageStates[pageIndex];
    if (!pageState) return;

    if (this._debug) console.log(`[PageManager] rerenderPage: Forcing re-render of page ${pageIndex}`);
    // Reset render state to allow re-queueing
    pageState.lowResRendered = false;
    pageState.highResRendered = false;
    // pageState.isRenderingLow = false; // Let abort controllers handle this
    // pageState.isRenderingHigh = false;
    if (pageState.currentLowResAbortController) pageState.currentLowResAbortController.abort();
    if (pageState.currentHighResAbortController) pageState.currentHighResAbortController.abort();

    // If the page is currently visible, re-queue for rendering, low-res first for quick feedback.
    if (pageState.isVisible) {
      this._renderPage(pageIndex, false); // Queue low-res
      // High-res will be queued by the logic in _checkVisiblePagesAndRender or after low-res completes
    }
  }

  rerenderVisiblePages() {
    if (this._debug) console.log('[PageManager] rerenderVisiblePages: Re-rendering all visible pages.');
    this._visiblePages.forEach(pageIndex => {
      this.rerenderPage(pageIndex);
    });
  }

  handleScroll() {
    if (!this._isInitialized) return;
    this._debouncedCheckAndRender();
  }

  handleResize() {
    if (!this._isInitialized || !this._pagesContainer) return;
    if (this._debug) console.log('[PageManager] handleResize START');

    // Page wrappers will resize based on aspect ratio and 100% height of pagesContainer (flex row).
    // The main thing is to trigger a re-check of visible pages and re-render them as their
    // actual pixel dimensions for rendering might have changed.

    // Mark all pages (or just visible ones) as needing re-render because canvas backing store needs to update.
    this._pageStates.forEach(ps => {
        ps.lowResRendered = false;
        ps.highResRendered = false;
        if (ps.currentLowResAbortController) ps.currentLowResAbortController.abort();
        if (ps.currentHighResAbortController) ps.currentHighResAbortController.abort();
    });
    if (this._debug) console.log('[PageManager] handleResize: Reset render states for all pages.');

    // After styles recalculate due to resize, check visibility and render
    // Use a small timeout to allow browser to reflow/repaint before we measure for visibility
    setTimeout(() => {
        if (this._debug) console.log('[PageManager] handleResize: Debouncing _checkVisiblePagesAndRender after resize reflow delay.');
        this._debouncedCheckAndRender();
    }, 50); // Short delay for reflow
    if (this._debug) console.log('[PageManager] handleResize END');
  }

  destroy() {
    if (this._debug) console.log('[PageManager] destroy START');
    this._isInitialized = false;
    this._eventBus.emit('pageManagerDestroyed');
    // Abort any ongoing rendering tasks via their controllers
    this._pageStates.forEach(pageState => {
      if (pageState.currentLowResAbortController) pageState.currentLowResAbortController.abort();
      if (pageState.currentHighResAbortController) pageState.currentHighResAbortController.abort();
    });
    this._pageStates.forEach(ps => this.clearPageHighlights(ps.pageIndex)); // Clear highlights on all pages
    this._pageStates = [];
    if (this._pagesContainer) {
        while (this._pagesContainer.firstChild) {
            this._pagesContainer.removeChild(this._pagesContainer.firstChild);
        }
    }
    // RenderQueue is managed by ScrollablePdfViewer, it will call clear on it.
    if (this._debug) console.log('[PageManager] destroy END');
  }

  /**
   * Retrieves performance and state metrics from the PageManager.
   * @returns {object} An object containing metrics such as current page, visible page count, and states of all pages.
   */
  getMetrics() {
    return {
      currentPage: this._currentPage,
      visiblePageCount: this._visiblePages.size,
      pageStatesSummary: this._pageStates.map(ps => ({
        idx: ps.pageIndex,
        vis: ps.isVisible,
        lowR: ps.lowResRendered,
        highR: ps.highResRendered,
        rendL: ps.isRenderingLow,
        rendH: ps.isRenderingHigh,
      }))
      // Add more detailed metrics if needed in the future
    };
  }

  /**
   * Updates or creates highlights on a specific page's text layer based on search results.
   * @param {number} pageIndex - The 0-indexed page number.
   * @param {Array<object>} searchResultsOnPage - An array of search result objects for this page.
   * Each object should contain at least: { transform, width, height, matchStartIndex, matchLength, textContentItemIndex, text }
   * @param {object|null} currentGlobalMatch - The global search result object that is currently active.
   * Used to apply a special style if it's on this page.
   */
  updatePageHighlights(pageIndex, searchResultsOnPage, currentGlobalMatch) {
    if (!this._isInitialized) return;
    const pageState = this._pageStates[pageIndex];
    if (!pageState || !pageState.textLayer) {
      console.warn(`[PageManager] updatePageHighlights: No text layer for page ${pageIndex}`);
      return;
    }

    this.clearPageHighlights(pageIndex);
    if (this._debug) console.log(`[PageManager] updatePageHighlights for page ${pageIndex}, results: ${searchResultsOnPage.length}`);

    const textLayer = pageState.textLayer;

    searchResultsOnPage.forEach((result) => {
      const highlightWrapper = document.createElement('div');
      highlightWrapper.className = 'pdfagogo-highlight';
      highlightWrapper.style.position = 'absolute';
      highlightWrapper.style.pointerEvents = 'none';
      highlightWrapper.style.zIndex = '3';

      const { transform, width, height, matchStartIndex, matchLength, text } = result;

      // Diagnostic: Use a fixed small size for the wrapper to test positioning
      const diagnosticSize = 5; // 5px square
      highlightWrapper.style.left = `${transform[4]}px`;
      highlightWrapper.style.top = `${transform[5]}px`;
      highlightWrapper.style.width = `${diagnosticSize}px`; // Fixed width
      highlightWrapper.style.height = `${diagnosticSize}px`; // Fixed height
      // Apply scaling and skew from the item's transform, but not the translation (e,f parts)
      // The matrix will scale our fixed-size div.
      highlightWrapper.style.transform = `matrix(${transform[0]}, ${transform[1]}, ${transform[2]}, ${transform[3]}, 0, 0)`;
      highlightWrapper.style.transformOrigin = '0 0';

      const actualHighlight = document.createElement('div');
      actualHighlight.className = 'pdfagogo-highlight-inner';
      actualHighlight.style.position = 'absolute';
      actualHighlight.style.top = '0%';
      actualHighlight.style.height = '100%';

      // Simplification: Highlight the entire text item if it contains a match.
      // The precision of highlighting only the matched substring is removed for now.
      actualHighlight.style.left = `0%`;
      actualHighlight.style.width = `100%`;
      
      // Base styling will be applied by CSS. Conditional styling for current match:
      if (currentGlobalMatch && 
          currentGlobalMatch.pageIndex === pageIndex && 
          currentGlobalMatch.textContentItemIndex === result.textContentItemIndex &&
          currentGlobalMatch.matchStartIndex === result.matchStartIndex) {
        highlightWrapper.classList.add('current-match');
      }

      highlightWrapper.appendChild(actualHighlight);
      textLayer.appendChild(highlightWrapper);
    });
  }

  /**
   * Clears all highlights from a specific page's text layer.
   * @param {number} pageIndex - The 0-indexed page number.
   */
  clearPageHighlights(pageIndex) {
    if (!this._isInitialized) return;
    const pageState = this._pageStates[pageIndex];
    if (pageState && pageState.textLayer) {
      const highlights = pageState.textLayer.querySelectorAll('.pdfagogo-highlight');
      highlights.forEach(h => h.remove());
      if (this._debug && highlights.length > 0) console.log(`[PageManager] Cleared ${highlights.length} highlights from page ${pageIndex}`);
    }
  }
}