export class PageManager {
  constructor(viewer, book, options, ui, renderQueue, eventBus) {
    this.viewer = viewer; // Reference to the main viewer (ScrollablePdfViewer instance)
    this.book = book;
    this.options = options;
    this.ui = ui; // Reference to the UI manager (to be created)
    this.renderQueue = renderQueue;
    this.eventBus = eventBus; // Store eventBus

    this.pageCount = book.numPages();
    this.currentPage = 0; // 0-indexed
    this.pageCanvases = {}; // Stores canvas elements { [pageIndex]: canvasEl }
    this.pageWrappers = {}; // Stores wrapper elements { [pageIndex]: wrapperEl }
    this.pageData = {}; // Stores page specific data like dimensions, textContent { [pageIndex]: {width, height, textContentPromise} }

    this.isMobile = window.innerWidth <= 768;
    this.maxCachedPages = this.options.maxCachedPages || (this.isMobile ? 3 : 5);
    this.visibleRange = this.options.visibleRange || (this.isMobile ? 1 : 2); // Pages to render around current view, on each side

    this._visiblePages = new Set(); // Set of 0-indexed page numbers currently considered visible
    this._scrollTimeout = null;
    this._resizeTimeout = null;

    // DOM elements are accessed dynamically from this.viewer
    // this.scrollContainer = this.viewer.scrollContainer; 
    // this.pagesContainer = this.viewer.pagesContainer;
  }

  /**
   * Initializes page elements (wrappers and canvases) and renders initial visible pages.
   */
  async initializePages() {
    console.log('[PageManager] Initializing pages...'); // Step 1: Log start

    const offscreenContainer = document.createElement('div');
    offscreenContainer.style.position = 'absolute';
    offscreenContainer.style.visibility = 'hidden';
    // ... (rest of offscreenContainer setup from ScrollablePdfViewer)
    offscreenContainer.className = 'pdfagogo-pages-container-offscreen'; // Differentiate if needed
    this.viewer.app.appendChild(offscreenContainer); // viewer.app is the main app container

    for (let i = 0; i < this.pageCount; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdfagogo-page-wrapper';
      wrapper.style.position = 'relative'; // For potential overlays or absolute positioned children

      const canvas = document.createElement("canvas");
      canvas.className = "pdfagogo-page-canvas";
      canvas.setAttribute("tabindex", "-1"); // Pages themselves aren't directly focusable, wrapper might be
      canvas.setAttribute("data-page-index", i);
      canvas.setAttribute("data-resolution", "placeholder");

      wrapper.appendChild(canvas);
      this.pageCanvases[i] = canvas;
      this.pageWrappers[i] = wrapper;
      // Store initial placeholder data, actual dimensions will come from PDF page itself
      this.pageData[i] = { state: 'placeholder' }; 
      offscreenContainer.appendChild(wrapper);
    }
    console.log(`[PageManager] Created ${this.pageCount} wrappers/canvases in offscreen container. Offscreen child count: ${offscreenContainer.childElementCount}`); // Step 2: Log creation
    
    // Fetch actual page dimensions for all pages to set wrapper sizes correctly
    // This helps in calculating scroll positions accurately from the start
    const dimensionPromises = [];
    for (let i = 0; i < this.pageCount; i++) {
        dimensionPromises.push(
            new Promise((resolve, reject) => { // Wrap callback in a new Promise
                this.book.getPage(i, (err, pageDetails) => { // Assuming 0-indexed 'i' is correct for this.book.getPage
                    if (err) {
                        console.error(`[PageManager] Error getting page ${i} details for dimensioning:`, err);
                        // Ensure pageData[i] exists before trying to spread it
                        this.pageData[i] = { ...(this.pageData[i] || {}), width: 300, height: 400, error: true, state: 'error' };
                        reject(err); // Reject the promise
                        return;
                    }
                    if (!pageDetails) {
                         console.error(`[PageManager] No page details returned for page ${i} for dimensioning`);
                         this.pageData[i] = { ...(this.pageData[i] || {}), width: 300, height: 400, error: true, state: 'error' };
                         reject(new Error(`No page details for page ${i}`));
                         return;
                    }
                    const scale = 1.0; // Use a common scale just for dimensioning
                    const viewport = pageDetails.getViewport({ scale });
                    this.pageData[i] = {
                        ...this.pageData[i], // Keep existing state like 'placeholder' initially
                        width: viewport.width,
                        height: viewport.height,
                        aspectRatio: viewport.width / viewport.height,
                        state: 'dimensioned' // Update state
                    };

                    // Update wrapper style immediately once dimensions are known
                    const targetHeight = this.viewer._getPageHeight(); // Use viewer's method for consistent height
                    const wrapperWidth = targetHeight * this.pageData[i].aspectRatio;
                    this.pageWrappers[i].style.width = `${wrapperWidth}px`;
                    this.pageWrappers[i].style.height = `${targetHeight}px`;
                    resolve(); // Resolve the promise
                })
            })
        );
    }

    try {
        await Promise.all(dimensionPromises);
        console.log('[PageManager] All dimension promises resolved.'); // Step 3: Log promise resolution
    } catch (error) {
        console.warn('[PageManager] One or more page dimension fetches failed during initialization. Fallback dimensions will be used for affected pages.', error);
    }

    // Check pageData integrity after dimension fetching
    let allAspectRatiosOk = true;
    for (let i = 0; i < this.pageCount; i++) {
        if (!this.pageData[i] || typeof this.pageData[i].aspectRatio !== 'number' || isNaN(this.pageData[i].aspectRatio)) {
            console.error(`[PageManager] CRITICAL: Page ${i} missing or invalid aspectRatio after dimensioning!`, this.pageData[i]);
            allAspectRatiosOk = false;
            // Provide a fallback to prevent NaN issues, though layout will be wrong
            if (this.pageData[i]) this.pageData[i].aspectRatio = 3/4;
            else this.pageData[i] = { state: 'error', aspectRatio: 3/4, width:300, height:400 };
        }
    }
    if (allAspectRatiosOk) {
        console.log('[PageManager] All pages have valid aspectRatios after dimensioning.');
    }

    // Move all prepared pages to the visible container at once
    const targetPagesContainer = this.viewer.pagesContainer;
    console.log('[PageManager] Attempting to move pages from offscreen to visible container:', targetPagesContainer); // Step 4: Log move attempt
    if (!targetPagesContainer) {
        console.error("[PageManager] FATAL: this.viewer.pagesContainer is null or undefined before moving pages!");
        // If we return here, updateAndRenderVisiblePages won't run, explaining no visible pages.
        return; 
    }
    let movedCount = 0;
    while (offscreenContainer.firstChild) {
      targetPagesContainer.appendChild(offscreenContainer.firstChild);
      movedCount++;
    }
    console.log(`[PageManager] Moved ${movedCount} page wrappers to visible container. Visible container child count: ${targetPagesContainer.childElementCount}`); // Step 5: Log move result
    
    if (offscreenContainer.parentElement === this.viewer.app) { 
        this.viewer.app.removeChild(offscreenContainer);
        console.log('[PageManager] Offscreen container removed from app.');
    } else {
        console.warn('[PageManager] Offscreen container was not a child of viewer.app, or viewer.app was not found.');
    }

    await this.updateAndRenderVisiblePages();
    this.eventBus.emit('pageManagerInitialized');
    console.log('[PageManager] Pages initialized completed.'); // Step 6: Log completion
  }

  /**
   * Determines which pages are visible or nearly visible and triggers rendering for them.
   * Also handles cleanup of offscreen pages.
   */
  async updateAndRenderVisiblePages(isScroll = false) {
    const newVisiblePages = this._calculateVisiblePages();
    const { pagesToRender, pagesToUpgrade, pagesToCleanup } = this._diffVisiblePages(newVisiblePages);

    // Prioritize rendering/upgrading visible pages
    pagesToRender.forEach(pageIndex => this.renderPage(pageIndex, 'low', isScroll));
    pagesToUpgrade.forEach(pageIndex => this.renderPage(pageIndex, 'high', isScroll)); // Or a separate upgrade method

    // Cleanup non-visible pages
    this.cleanupPages(pagesToCleanup);

    this._visiblePages = newVisiblePages;
    this._updateCurrentPage(newVisiblePages); 
  }

  _calculateVisiblePages() {
    const visible = new Set();
    const scrollContainer = this.viewer.scrollContainer;
    if (!scrollContainer) {
        console.warn('[_calculateVisiblePages] scrollContainer is null/undefined.');
        return visible; 
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    if (!containerRect || containerRect.width === 0) {
        console.warn('[_calculateVisiblePages] containerRect is invalid or has zero width.', containerRect);
        // If width is 0, pages likely won't be calculated as visible.
        // We might still want to render the first page as a fallback or based on currentPage.
        // For now, returning empty if rect is bad.
        return visible;
    }
    const scrollLeft = scrollContainer.scrollLeft;
    const scrollRight = scrollLeft + containerRect.width;

    // Define a buffer zone for pre-rendering (e.g., one container width)
    const buffer = containerRect.width * this.options.renderBufferFactor || containerRect.width; // TODO: Add renderBufferFactor to options
    const extendedLeft = scrollLeft - buffer;
    const extendedRight = scrollRight + buffer;

    let currentX = 0;
    for (let i = 0; i < this.pageCount; i++) {
      if (!this.pageData[i] || typeof this.pageData[i].aspectRatio !== 'number' || isNaN(this.pageData[i].aspectRatio) || this.pageData[i].error) {
        console.warn(`[_calculateVisiblePages] Skipping page ${i} due to missing/invalid pageData or error.`, this.pageData[i]);
        currentX += this.pageData[i]?.width || 300; // Use actual/fallback width if available
        currentX += (this.options.pageMargin || 0);
        continue;
      }
      const pageHeight = this.viewer._getPageHeight();
      if (pageHeight === 0) {
          console.warn('[_calculateVisiblePages] viewer._getPageHeight() returned 0. Pages will have zero height/width.');
      }
      const pageWidth = pageHeight * this.pageData[i].aspectRatio;

      const pageLeft = currentX;
      const pageRight = currentX + pageWidth;

      // Check if any part of the page (including buffer) is visible
      if (pageRight > extendedLeft && pageLeft < extendedRight) {
        visible.add(i);
      }
      currentX += pageWidth + (this.options.pageMargin || 0);
    }
    return visible;
  }

  _diffVisiblePages(newVisiblePages) {
    const pagesToRender = [];
    const pagesToUpgrade = []; // Pages already visible but might need high-res
    const pagesToKeep = new Set();

    for (const pageIndex of newVisiblePages) {
      if (!this._visiblePages.has(pageIndex) || this.pageData[pageIndex].state === 'placeholder' || this.pageData[pageIndex].state === 'dimensioned') {
        pagesToRender.push(pageIndex);
      } else if (this.pageData[pageIndex].state === 'low-res') {
        pagesToUpgrade.push(pageIndex);
      }
      pagesToKeep.add(pageIndex);
    }

    const pagesToCleanup = [];
    for (const pageIndex of this._visiblePages) {
      if (!pagesToKeep.has(pageIndex)) {
        pagesToCleanup.push(pageIndex);
      }
    }
    return { pagesToRender, pagesToUpgrade, pagesToCleanup };
  }

  /**
   * Updates the viewer's current page based on the most visible page.
   * @param {Set<number>} visiblePageSet - Set of currently visible page indices.
   */
  _updateCurrentPage(visiblePageSet) {
    if (visiblePageSet.size === 0) return;

    const scrollContainer = this.viewer.scrollContainer;
    if (!scrollContainer) return; // Guard

    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollCenter = scrollContainer.scrollLeft + containerRect.width / 2;

    let mostVisiblePageIndex = -1;
    let minDistanceFromCenter = Infinity;
    let currentX = 0;

    for (let i = 0; i < this.pageCount; i++) {
        if (!this.pageData[i] || this.pageData[i].error) {
            currentX += this.pageData[i]?.width || 300; // Use actual stored/fallback width
            currentX += (this.options.pageMargin || 0);
            continue;
        }
        const pageHeight = this.viewer._getPageHeight();
        const pageWidth = pageHeight * this.pageData[i].aspectRatio;
        const pageCenter = currentX + pageWidth / 2;

        if (visiblePageSet.has(i)) {
            const distance = Math.abs(pageCenter - scrollCenter);
            if (distance < minDistanceFromCenter) {
                minDistanceFromCenter = distance;
                mostVisiblePageIndex = i;
            }
        }
        currentX += pageWidth + (this.options.pageMargin || 0);
    }
    
    if (mostVisiblePageIndex !== -1 && this.currentPage !== mostVisiblePageIndex) {
        this.currentPage = mostVisiblePageIndex;
        // this.viewer.emit("pagechanged", { currentPage: this.currentPage + 1, totalPages: this.pageCount });
        this.eventBus.emit("pagechanged", { currentPage: this.currentPage + 1, totalPages: this.pageCount, origin: 'PageManager' });
    }
  }


  /**
   * Queues a page for rendering.
   * @param {number} pageIndex - 0-indexed page number.
   * @param {string} resolution - 'low' or 'high'.
   * @param {boolean} isScroll - True if triggered by scroll, for prioritization.
   */
  renderPage(pageIndex, resolution = 'high', isInteraction = false) {
    if (pageIndex < 0 || pageIndex >= this.pageCount || !this.pageCanvases[pageIndex]) {
      console.warn(`[PageManager] Invalid page index for render: ${pageIndex}`);
      this.eventBus.emit('pageRenderAttemptFailed', { pageIndex, error: 'Invalid index or no canvas'});
      return;
    }

    if (resolution === 'low' && (this.pageData[pageIndex].state === 'low-res' || this.pageData[pageIndex].state === 'high-res')) return;
    if (resolution === 'high' && this.pageData[pageIndex].state === 'high-res') return;

    this.renderQueue.add(async () => {
      if (this.viewer.debug) {
          console.log(`%c[PageManager] Rendering page ${pageIndex + 1} (${resolution}-res)`, 'color: #4CAF50; font-weight: bold;');
      }
      this.eventBus.emit('pageRenderQueued', { pageIndex, resolution });
      try {
        await this.viewer._renderPageInternal(pageIndex, resolution);
        this.pageData[pageIndex].state = `${resolution}-res`;
        this.eventBus.emit('pageRenderSuccessful', { pageIndex, resolution });
      } catch (error) {
        console.error(`[PageManager] Error during _renderPageInternal for page ${pageIndex}:`, error);
        this.pageData[pageIndex].state = 'error'; // Mark as error if render fails
        this.eventBus.emit('pageRenderFailedInternal', { pageIndex, resolution, error: error.message });
      }
    }, isInteraction); 
  }

  /**
   * Cleans up pages that are no longer visible to free up resources.
   * @param {Array<number>} pageIndices - Array of 0-indexed page numbers to cleanup.
   */
  cleanupPages(pageIndices) {
    if (!this.options.enablePageCleanup) return; // TODO: Add enablePageCleanup to options

    pageIndices.forEach(pageIndex => {
      const canvas = this.pageCanvases[pageIndex];
      if (canvas && this.pageData[pageIndex].state !== 'placeholder' && this.pageData[pageIndex].state !== 'dimensioned') {
        if (this.viewer.debug) {
            console.log(`[PageManager] Cleaning up page ${pageIndex + 1}`);
        }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Optionally resize canvas to 1x1 to further reduce memory
        // canvas.width = 1;
        // canvas.height = 1;
        canvas.removeAttribute('data-rendered-scale');
        this.pageData[pageIndex].state = 'dimensioned'; // Reset to dimensioned, but not placeholder
        // delete this.pageData[pageIndex].textContentPromise; // If text content was fetched
      }
    });
  }
  
  /**
   * Re-renders a specific page, typically for zoom changes or forced refresh.
   * @param {number} pageIndex - 0-indexed page number.
   */
  rerenderPage(pageIndex) {
    if (this.pageData[pageIndex]) {
        this.pageData[pageIndex].state = 'dimensioned'; // Force re-render by resetting state
        this.renderPage(pageIndex, 'high', true); // Re-render high-res, prioritize
    }
  }

  /**
   * Navigates to a specific page number (1-indexed).
   * @param {number} pageNum - 1-indexed page number.
   */
  goToPage(pageNum) {
    const pageIndex = pageNum - 1;
    if (pageIndex < 0 || pageIndex >= this.pageCount) {
      console.warn(`[PageManager] Invalid page number for goToPage: ${pageNum}`);
      return;
    }
    const scrollContainer = this.viewer.scrollContainer;
    if (!scrollContainer) return; // Guard

    // Calculate scroll position for the target page
    let targetScrollX = 0;
    for (let i = 0; i < pageIndex; i++) {
        if (!this.pageData[i] || this.pageData[i].error) {
            targetScrollX += 300; // approx width
            continue;
        }
        const pageHeight = this.viewer._getPageHeight();
        targetScrollX += (pageHeight * this.pageData[i].aspectRatio) + (this.options.pageMargin || 0);
    }

    scrollContainer.scrollTo({
      left: targetScrollX,
      behavior: 'smooth' 
    });

    if (this.pageData[pageIndex].state !== 'high-res') {
        this.renderPage(pageIndex, 'high', true);
    }
    // Avoid emitting pagechanged here if scroll event will handle it, to prevent double emits.
    // However, if behavior is 'auto', a scroll event might not fire or might be too quick.
    // For now, rely on scroll handler or a forced update if immediate feedback is needed.
    if (this.currentPage !== pageIndex) {
        this.currentPage = pageIndex;
        this.eventBus.emit("pagechanged", { currentPage: this.currentPage + 1, totalPages: this.pageCount, origin: 'goToPage' });
    }
  }

  /**
   * Handles scroll events to update visible pages and trigger rendering.
   */
  handleScroll() {
    clearTimeout(this._scrollTimeout);
    this._scrollTimeout = setTimeout(async () => {
      await this.updateAndRenderVisiblePages(true);
    }, this.options.scrollDebounceTime || 50); // TODO: Add scrollDebounceTime to options
  }

  /**
   * Handles resize events to update page sizes and re-render if necessary.
   */
  async handleResize() {
    clearTimeout(this._resizeTimeout);
    this._resizeTimeout = setTimeout(async () => {
      if (this.viewer.debug) {
        console.log('[PageManager] Handling resize.');
      }
      // Update all page wrapper sizes based on new container height
      const targetHeight = this.viewer._getPageHeight();
      for (let i = 0; i < this.pageCount; i++) {
          if (this.pageWrappers[i] && this.pageData[i] && !this.pageData[i].error) {
              const wrapperWidth = targetHeight * this.pageData[i].aspectRatio;
              this.pageWrappers[i].style.width = `${wrapperWidth}px`;
              this.pageWrappers[i].style.height = `${targetHeight}px`;
              // Mark pages for re-render if their canvas size needs to change significantly
              // or simply re-render all visible pages
              if (this._visiblePages.has(i)) {
                this.pageData[i].state = 'dimensioned'; // Reset state to trigger re-render
              }
          }
      }
      await this.updateAndRenderVisiblePages();
      // After resize, current scroll position might show a different page as "current"
      this._updateCurrentPage(this._visiblePages);

    }, this.options.resizeDebounceTime || 150); // TODO: Add resizeDebounceTime to options
  }

  // ... other methods like _getPageHeight, _getPageWidth if they are purely geometric and don't depend on viewer state too much
  // For now, keep them in viewer and pass results or let PageManager call viewer.method()

  destroy() {
    clearTimeout(this._scrollTimeout);
    clearTimeout(this._resizeTimeout);
    // RenderQueue is managed by the viewer, but good to clear tasks if owned by PageManager
    // this.renderQueue.clear(); 
    // EventBus listeners added by PageManager itself should be cleaned up if any.
    // For now, assuming EventBus passed in is managed/cleared by viewer.
    console.log('[PageManager] Destroyed.');
  }

  getMetrics() {
    // Basic metrics from PageManager
    return {
        currentPage: this.currentPage,
        visiblePageCount: this._visiblePages.size,
        pageDataStates: Object.values(this.pageData).map(pd => pd.state)
    };
  }
} 