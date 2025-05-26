import { RenderQueue } from "./core/RenderQueue.js";
import { PageManager } from "./core/PageManager.js";
import { EventBus } from "./core/EventBus.js";

export class ScrollablePdfViewer {
  constructor({ app, book, options }) {
    this.app = app;
    this.book = book;
    this.options = Object.assign({}, ScrollablePdfViewer.defaultOptions, options);
    console.log("[ScrollablePdfViewer] Constructor started. Options:", this.options);

    this.eventBus = new EventBus(this.options.debug);
    this.renderQueue = new RenderQueue({maxConcurrent: this.options.renderMaxConcurrentTasks || 1});
    try {
      this.pageManager = new PageManager(this, this.book, this.options, /* uiManager */ null, this.renderQueue, this.eventBus);
      console.log("[ScrollablePdfViewer] PageManager instance created:", this.pageManager);
    } catch (e) {
      console.error("[ScrollablePdfViewer] ERROR creating PageManager:", e);
      throw e;
    }

    this.pageCount = book.numPages();
    this.currentPage = 0;

    this.isMobile = window.innerWidth <= 768;

    this._createDOM();
    console.log("[ScrollablePdfViewer] _createDOM completed.");

    this.debug = this.options.debug;
    this.metrics = {
      initialRenderStart: 0,
      initialRenderEnd: 0,
      pageRenderTimes: {},
      highResUpgradeTimes: {},
      totalPagesRendered: 0,
      totalHighResUpgrades: 0,
      memoryUsage: {},
      lastUpdate: Date.now()
    };

    console.log("[ScrollablePdfViewer] About to call _setupDebugDisplay. Debug is:", this.debug);
    if (this.debug) {
      try {
        this._setupDebugDisplay();
        console.log("[ScrollablePdfViewer] _setupDebugDisplay completed.");
      } catch (e) {
        console.error("[ScrollablePdfViewer] ERROR in _setupDebugDisplay:", e);
      }
    }

    console.log("[ScrollablePdfViewer] About to call _setupEventHandlers.");
    try {
      this._setupEventHandlers();
      console.log("[ScrollablePdfViewer] _setupEventHandlers completed.");
    } catch (e) {
      console.error("[ScrollablePdfViewer] ERROR in _setupEventHandlers:", e);
    }

    console.log("[ScrollablePdfViewer] About to call _initializeViewer.");
    this._initializeViewer();
    console.log("[ScrollablePdfViewer] Constructor finished.");
  }

  static defaultOptions = {
    scale: window.devicePixelRatio || 1.8,
    maxCachedPages: undefined,
    visibleRange: undefined,
    renderBufferFactor: 1.0,
    pageMargin: 0,
    scrollDebounceTime: 50,
    resizeDebounceTime: 150,
    enablePageCleanup: true,
    debug: false,
    renderMaxConcurrentTasks: 1,
  };

  _createDOM() {
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "pdfagogo-scroll-container";
    this.app.appendChild(this.scrollContainer);

    this.pagesContainer = document.createElement("div");
    this.pagesContainer.className = "pdfagogo-pages-container";
    this.pagesContainer.style.display = "flex";
    this.pagesContainer.style.flexDirection = "row";
    this.pagesContainer.style.alignItems = "center";
    this.pagesContainer.style.minWidth = "100%";
    this.pagesContainer.style.height = "100%";
    this.scrollContainer.appendChild(this.pagesContainer);
  }

  async _initializeViewer() {
    console.log("[ScrollablePdfViewer] _initializeViewer called.");
    if (this.debug) {
      this.metrics.initialRenderStart = performance.now();
      console.log('[PDF-A-go-go Debug] Starting viewer initialization via PageManager');
    }
    try {
      await this.pageManager.initializePages();
      console.log("[ScrollablePdfViewer] pageManager.initializePages() awaited successfully.");
    } catch (e) {
      console.error("[ScrollablePdfViewer] ERROR during pageManager.initializePages():", e);
    }
    if (this.debug) {
      this.metrics.initialRenderEnd = performance.now();
      console.log(`[PDF-A-go-go Debug] Viewer main initialization flow complete in ${this.metrics.initialRenderEnd - this.metrics.initialRenderStart}ms`);
    }
    this.eventBus.emit('initialRenderComplete');
  }

  _setupEventHandlers() {
    this._setupResizeHandler();
    this._setupScrollHandler();
    this._setupGrabAndScroll();
    this._setupWheelScrollHandler();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.options.enablePageCleanup && this.pageManager) {
          this.pageManager.cleanupPages(Array.from(this.pageManager._visiblePages).filter(p => !this.pageManager._calculateVisiblePages().has(p)));
          this.eventBus.emit('documentHidden');
        }
      } else {
        this.eventBus.emit('documentVisible');
      }
    });

    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', () => {
        if (this.options.enablePageCleanup && this.pageManager) {
          this.pageManager.cleanupPages(Array.from(this.pageManager._visiblePages));
          this.eventBus.emit('memoryPressure');
        }
      });
    }

    this.eventBus.on('pagechanged', ({ currentPage }) => {
      this.currentPage = currentPage - 1;
    });
  }

  async _renderPageInternal(pageIndex, resolution = 'high') {
    console.log(`[Viewer] _renderPageInternal called for pageIndex: ${pageIndex}, resolution: ${resolution}`);
    const canvas = this.pageManager.pageCanvases[pageIndex];
    if (!canvas) {
      console.warn(`[Viewer] _renderPageInternal: Canvas not found for page index ${pageIndex}`);
      this.eventBus.emit('pageRenderFailed', { pageIndex, error: 'Canvas not found' });
      return Promise.reject('Canvas not found');
    }

    const startTime = this.debug ? performance.now() : 0;

    // Overall desired resolution scale (combines user option and device pixel ratio)
    const optionsDisplayScale = this.options.scale || window.devicePixelRatio || 1.8;
    // Adjustment for low/high resolution pass
    const qualityMultiplier = resolution === 'low' ? 0.5 : 1.0;
    // Effective PPM (pixels per CSS point) for the backing store
    const effectiveBackingStorePPM = optionsDisplayScale * qualityMultiplier;

    console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, optionsDisplayScale: ${optionsDisplayScale}, qualityMultiplier: ${qualityMultiplier}, effectiveBackingStorePPM: ${effectiveBackingStorePPM}`); 

    const highlights = this.options.getHighlightsForPage ? this.options.getHighlightsForPage(pageIndex) : [];

    this.eventBus.emit('pageRenderStart', { pageIndex, resolution });

    return new Promise((resolve, reject) => {
      this.book.getPage(pageIndex, (err, pg) => {
        if (err) {
          console.error(`[Viewer] Error getting page ${pageIndex} from book:`, err);
          if (this.pageManager.pageData[pageIndex]) this.pageManager.pageData[pageIndex].state = 'error';
          this.eventBus.emit('pageRenderFailed', { pageIndex, error: err.message });
          reject(err);
          return;
        }

        const targetHeight = this._getPageHeight();
        const pageData = this.pageManager.pageData[pageIndex];
        let aspect;
        if (pageData && pageData.aspectRatio) {
            aspect = pageData.aspectRatio;
        } else if (pg && pg.width && pg.height) {
            aspect = pg.width / pg.height;
        } else {
            console.warn(`[Viewer] _renderPageInternal: Cannot determine aspect ratio for page ${pageIndex}. pg:`, pg, 'pageData:', pageData);
            aspect = 3/4;
        }

        const targetWidth = targetHeight * aspect;
        console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, targetHeight: ${targetHeight}, targetWidth: ${targetWidth}, aspect: ${aspect}`);

        const wrapper = this.pageManager.pageWrappers[pageIndex];
        if (wrapper) {
          wrapper.style.width = targetWidth + "px";
          wrapper.style.height = targetHeight + "px";
        }
        
        canvas.style.width = targetWidth + "px";
        canvas.style.height = targetHeight + "px";
        // Calculate backing store dimensions
        canvas.width = Math.round(targetWidth * effectiveBackingStorePPM);
        canvas.height = Math.round(targetHeight * effectiveBackingStorePPM);

        canvas.setAttribute('data-rendered-scale', effectiveBackingStorePPM); // Store the effective PPM
        canvas.setAttribute('data-resolution', resolution);

        const ctx = canvas.getContext("2d", {
          alpha: !this.options.disableTransparency,
          willReadFrequently: true
        });
        if (this.options.backgroundColor) {
          ctx.fillStyle = this.options.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Get the PDF page's native viewport at scale 1 to understand its natural size
        const nativePageViewport = pg.getViewport({ scale: 1.0, rotation: this.options.rotation || 0 });

        // Calculate the scale required to make the native page dimensions fit into the canvas backing store dimensions
        const scaleX = canvas.width / nativePageViewport.width;
        const scaleY = canvas.height / nativePageViewport.height;
        const finalPdfJsRenderScale = Math.min(scaleX, scaleY);
        
        const viewport = pg.getViewport({ scale: finalPdfJsRenderScale, rotation: this.options.rotation || 0 });
        console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, Canvas WxH: ${canvas.width}x${canvas.height}, PDF.js Viewport WxH: ${viewport.width.toFixed(2)}x${viewport.height.toFixed(2)}, finalPdfJsRenderScale: ${finalPdfJsRenderScale.toFixed(3)}`);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        pg.render(renderContext).promise.then(() => {
          console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, pg.render().promise resolved.`);
          if (this.debug) {
            const endTime = performance.now();
            const duration = endTime - startTime;
            if (resolution === 'high') {
              this.metrics.highResUpgradeTimes[pageIndex] = duration;
              this.metrics.totalHighResUpgrades++;
            } else {
              this.metrics.pageRenderTimes[pageIndex] = duration;
              this.metrics.totalPagesRendered++;
            }
            this._updateDebugInfo();
          }
          this.eventBus.emit('pageRenderComplete', { pageIndex, resolution, duration: this.debug ? (performance.now() - startTime) : undefined });
          resolve();
        }).catch(renderErr => {
          console.error(`[Viewer] Error rendering page ${pageIndex} (${resolution}):`, renderErr);
          if (this.pageManager.pageData[pageIndex]) this.pageManager.pageData[pageIndex].state = 'error';
          this.eventBus.emit('pageRenderFailed', { pageIndex, resolution, error: renderErr.message });
          reject(renderErr);
        });
      }, highlights);
    });
  }

  _setupResizeHandler() {
    let resizeTimeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(async () => {
        if (this.pageManager) {
          this.eventBus.emit('viewerResizeStart');
          await this.pageManager.handleResize();
          this.eventBus.emit('viewerResizeComplete');
        }
      }, this.options.resizeDebounceTime);
    };
    window.addEventListener("resize", onResize, false);
    
    const originalDestroy = this.destroy;
    this.destroy = () => {
      if (originalDestroy) originalDestroy.call(this);
      window.removeEventListener("resize", onResize);
      if (this.pageManager) this.pageManager.destroy();
      if (this.renderQueue) this.renderQueue.clear();
      if (this.eventBus) this.eventBus.clear();
      if (this._debugInterval) clearInterval(this._debugInterval);
      if (this.debugElement && this.debugElement.parentElement) this.debugElement.parentElement.removeChild(this.debugElement);
      console.log('[ScrollablePdfViewer] Destroyed');
    };
  }

  _setupScrollHandler() {
    let scrollTimeout;
    const onScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(async () => {
        if (this.pageManager) {
          this.eventBus.emit('viewerScrollStart');
          await this.pageManager.handleScroll();
          this.eventBus.emit('viewerScrollComplete');
        }
      }, this.options.scrollDebounceTime);
    };
    this.scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    
    const originalDestroy = this.destroy;
    this.destroy = () => {
      if (originalDestroy) originalDestroy.call(this);
      this.scrollContainer.removeEventListener("scroll", onScroll);
    }
  }

  _setupGrabAndScroll() {
    const scrollContainer = this.scrollContainer;
    if (!scrollContainer) return;

    let isDown = false;
    let startX;
    let scrollLeftStart;

    scrollContainer.addEventListener('mousedown', (e) => {
      // Only activate for left mouse button and if not clicking on a scrollbar (if visible)
      if (e.button !== 0 || e.target === scrollContainer && (e.offsetX >= scrollContainer.clientWidth || e.offsetY >= scrollContainer.clientHeight)) {
        return;
      }
      isDown = true;
      scrollContainer.classList.add('pdfagogo-grabbing');
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollLeftStart = scrollContainer.scrollLeft;
      e.preventDefault(); // Prevent text selection/image dragging
    });

    const mouseUpOrLeaveHandler = () => {
      if (!isDown) return;
      isDown = false;
      scrollContainer.classList.remove('pdfagogo-grabbing');
    };

    // Add listeners to document to capture mouseup/mouseleave even outside the container
    document.addEventListener('mouseup', mouseUpOrLeaveHandler);
    document.addEventListener('mouseleave', (e) => { // Also handle mouse leaving browser window
        if (e.relatedTarget === null && isDown) { // If mouse left window entirely
            mouseUpOrLeaveHandler();
        }
    });


    document.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX); // Multiply by a factor if scroll speed adjustment is needed
      scrollContainer.scrollLeft = scrollLeftStart - walk;
    });

    // Basic styling for cursor - consider moving to CSS file
    const styleId = 'pdfagogo-grab-scroll-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .pdfagogo-scroll-container { cursor: grab; }
            .pdfagogo-scroll-container.pdfagogo-grabbing { cursor: grabbing; }
        `;
        document.head.appendChild(style);
    }
    
    // Cleanup on destroy
    const originalDestroy = this.destroy;
    this.destroy = () => {
      if (originalDestroy) originalDestroy.call(this);
      // scrollContainer.removeEventListener('mousedown', ...); // Need to store handlers to remove them
      // document.removeEventListener('mouseup', mouseUpOrLeaveHandler);
      // document.removeEventListener('mousemove', ...);
      // document.removeEventListener('mouseleave', ...);
      // We should store these handlers and remove them properly.
      // For now, this simple implementation might leave listeners if not careful with multiple instances.
      // A more robust way is to bind `this` and store the bound functions.
      console.log('[ScrollablePdfViewer] Grab and scroll listeners potentially not fully cleaned up on destroy (basic impl).');
    };
  }

  _setupWheelScrollHandler() {
    // Basic horizontal scroll with mouse wheel (could be made optional)
    // ... existing code ...
  }

  _getPageWidth() {
    return this.scrollContainer.clientWidth;
  }

  _getPageHeight() {
    return this.scrollContainer.clientHeight;
  }

  rerenderPage(pageIndex) {
    if (this.pageManager) {
      this.pageManager.rerenderPage(pageIndex);
    }
  }

  getPerformanceMetrics() {
    return {
      ...this.metrics,
      renderQueue: this.renderQueue.getMetrics(),
      pageManager: this.pageManager ? this.pageManager.getMetrics() : {},
      eventBusListeners: this.eventBus ? Object.keys(this.eventBus.listeners).reduce((acc, key) => {
        acc[key] = this.eventBus.listeners[key].length;
        return acc;
      }, {}) : {}
    };
  }

  _setupDebugDisplay() {
    if (this.debugElement) return;
    this.debugElement = document.createElement("div");
    this.debugElement.className = "pdfagogo-debug-info";
    document.body.appendChild(this.debugElement);
    this._debugInterval = setInterval(() => this._updateDebugInfo(), this.options.debugUpdateInterval || 500);
  }

  _updateDebugInfo() {
    if (!this.debug || !this.debugElement || !this.pageManager) return;
    const metrics = this.getPerformanceMetrics();
    const avgHighResTime = metrics.totalHighResUpgrades > 0 ? (Object.values(metrics.highResUpgradeTimes).reduce((a, b) => a + b, 0) / metrics.totalHighResUpgrades) : 0;
    const avgLowResTime = metrics.totalPagesRendered > 0 ? (Object.values(metrics.pageRenderTimes).reduce((a, b) => a + b, 0) / metrics.totalPagesRendered) : 0;

    const visiblePageIndices = this.pageManager._visiblePages ? Array.from(this.pageManager._visiblePages).map(p => p + 1).join(', ') : 'N/A';
    
    this.debugElement.innerHTML = `
      <strong>PDF-A-go-go Debug Info</strong><br>
      Current Page: ${this.pageManager.currentPage + 1} / ${this.pageManager.pageCount}<br>
      Visible Pages (Indices): ${visiblePageIndices}<br>
      Render Queue Length: ${metrics.renderQueue.queueLength}<br>
      Tasks Completed: ${metrics.renderQueue.tasksCompleted} | Failed: ${metrics.renderQueue.tasksFailed}<br>
      Avg Low-Res Render: ${avgLowResTime.toFixed(1)}ms (Total: ${metrics.totalPagesRendered})<br>
      Avg High-Res Render: ${avgHighResTime.toFixed(1)}ms (Total: ${metrics.totalHighResUpgrades})<br>
      Event Listeners: ${Object.entries(metrics.eventBusListeners).map(([k,v]) => `${k}(${v})`).join(', ') || 'None'}
    `;
  }

  flip_forward() {
    const newPage = Math.min(this.pageManager.currentPage + 1, this.pageCount - 1);
    if (newPage !== this.pageManager.currentPage) {
      this.pageManager.goToPage(newPage + 1);
    }
  }

  flip_back() {
    const newPage = Math.max(this.pageManager.currentPage - 1, 0);
    if (newPage !== this.pageManager.currentPage) {
      this.pageManager.goToPage(newPage + 1);
    }
  }

  scrollBy(pages) {
    const newPage = this.pageManager.currentPage + pages;
    const targetPage = Math.max(0, Math.min(newPage, this.pageCount - 1));
    if (targetPage !== this.pageManager.currentPage) {
      this.pageManager.goToPage(targetPage + 1);
    }
  }

  go_to_page(pageNum) {
    if (this.pageManager) {
      this.pageManager.goToPage(pageNum);
    }
  }

  on(eventName, callback) {
    return this.eventBus.on(eventName, callback);
  }

  off(eventName, callback) {
    this.eventBus.off(eventName, callback);
  }
}
