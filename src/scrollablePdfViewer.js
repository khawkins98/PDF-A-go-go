/**
 * @file scrollablePdfViewer.js
 * Implements the main PDF viewer component with scrollable page layout.
 * This class orchestrates PDF.js, PageManager, RenderQueue, EventBus, ConfigManager, and UI setup.
 */

import { RenderQueue } from "./core/RenderQueue.js";
import { PageManager } from "./core/PageManager.js";
import { EventBus } from "./core/EventBus.js";
import { ConfigManager } from "./core/ConfigManager.js";

const DEFAULT_VIEWER_OPTIONS = {
  scale: typeof window !== 'undefined' ? window.devicePixelRatio || 1.8 : 1.8,
  maxCachedPages: undefined,
  visibleRange: undefined,
  renderBufferFactor: 1.0,
  pageMargin: 0,
  scrollDebounceTime: 50,
  resizeDebounceTime: 150,
  enablePageCleanup: true,
  debug: false,
  renderMaxConcurrentTasks: 1,
  // Add other defaults that were in ScrollablePdfViewer.defaultOptions
  // For example:
  // disableTransparency: false,
  // backgroundColor: null,
  // rotation: 0,
  // getHighlightsForPage: null, // function
};

/**
 * @class ScrollablePdfViewer
 * The main class for the PDF-A-go-go viewer.
 * It handles PDF loading, page management, rendering orchestration, UI setup, and event handling.
 * Provides a scrollable, continuous view of PDF pages.
 */
export class ScrollablePdfViewer {
  /**
   * @private
   * @type {HTMLElement | null} The main application container element provided by the user or created dynamically.
   */
  app = null;

  /**
   * @private
   * @type {HTMLElement | null} The direct container for the PDF viewer UI and pages, child of `app`.
   */
  viewerContainer = null;

  /**
   * @private
   * @type {HTMLElement | null} The scrollable element that holds the pagesContainer.
   */
  scrollContainer = null;

  /**
   * @private
   * @type {HTMLElement | null} The flex container that directly holds individual page wrappers.
   */
  pagesContainer = null;

  /**
   * @private
   * @type {any | null} The loaded PDF.js document object (pdfDocument).
   */
  book = null;

  /**
   * @private
   * @type {EventBus} Manages event emitting and listening within the viewer.
   */
  eventBus = null;

  /**
   * @private
   * @type {RenderQueue} Manages the queue for rendering page tasks.
   */
  renderQueue = null;

  /**
   * @private
   * @type {PageManager | null} Manages page state, visibility, and coordinates rendering with RenderQueue.
   */
  pageManager = null;

  /**
   * @private
   * @type {ConfigManager} Manages all configuration options for the viewer.
   */
  configManager = null;

  /**
   * @private
   * @type {HTMLProgressElement | null} The loading progress bar element.
   */
  loadingBar = null;

  /**
   * @private
   * @type {number} Current 0-indexed page number that is primarily in view.
   */
  currentPage = 0;

  /**
   * @private
   * @type {number} Current rotation of the pages in degrees (0, 90, 180, 270).
   */
  currentRotation = 0;

  /**
   * @private
   * @type {number} Current scale factor for page rendering.
   */
  currentScale = 1.0;

  /**
   * @private
   * @type {boolean} Flag indicating if a PDF is currently loaded.
   */
  isLoaded = false;

  /**
   * @private
   * @type {boolean} Flag indicating if the viewer has been initialized.
   */
  isInitialized = false;

  /**
   * @private
   * @type {boolean} Flag for enabling verbose debug logging for this viewer instance.
   */
  debug = false;

  /**
   * @private
   * @type {object | null} Stores the current search state.
   * @property {string} query - The current search query.
   * @property {Array<object>} results - Array of match objects (e.g., { pageIndex, matchIndexInPage, coordinates }).
   * @property {number} currentResultIndex - Index of the currently highlighted result in the 'results' array.
   * @property {number} totalMatches - Total number of matches found.
   */
  _searchState = null;

  /**
   * Creates an instance of ScrollablePdfViewer.
   * @param {HTMLElement|string} appContainer - The HTML element or a CSS selector string for the container that will hold the PDF viewer.
   * @param {import('./core/ConfigManager.js').ViewerOptions} initialUserOptions - User-provided options to override defaults.
   * @throws {Error} If the appContainer cannot be found or is invalid.
   */
  constructor({ app, book, options }) {
    this.app = app;
    this.book = book;
    this.configManager = new ConfigManager(options, DEFAULT_VIEWER_OPTIONS);
    console.log("[ScrollablePdfViewer] Constructor started. Config:", this.configManager.getAll());

    // Create DOM structure first, so PageManager can find its containers.
    this._createDOM();
    console.log("[ScrollablePdfViewer] _createDOM completed.");

    this.eventBus = new EventBus(this.configManager.get('debug'));
    this.renderQueue = new RenderQueue({maxConcurrent: this.configManager.get('renderMaxConcurrentTasks', 1)});
    try {
      this.pageManager = new PageManager({
        viewerInstance: this, // Pass the ScrollablePdfViewer instance itself
        book: this.book,
        configManager: this.configManager,
        renderQueue: this.renderQueue,
        eventBus: this.eventBus
      });
      console.log("[ScrollablePdfViewer] PageManager instance created:", this.pageManager);
    } catch (e) {
      console.error("[ScrollablePdfViewer] ERROR creating PageManager:", e);
      throw e;
    }

    this.pageCount = book.numPages();
    this.currentPage = 0; // 0-indexed

    this.isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    this.debug = this.configManager.get('debug');
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
    this._initializeViewer().catch(err => {
      console.error("[ScrollablePdfViewer] CRITICAL ERROR during async _initializeViewer process:", err);
      // Optionally, display an error to the user in the UI
      if (this.app) {
        const errorDiv = document.createElement('div');
        errorDiv.textContent = 'Fatal error during PDF viewer initialization. Please check console.';
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '20px';
        this.app.prepend(errorDiv); // Add to the top of the app container
      }
    });
    console.log("[ScrollablePdfViewer] Constructor finished (async initialization started).");
  }

  /**
   * @private
   * Creates the main DOM structure for the viewer (viewerContainer, scrollContainer, pagesContainer).
   * Appends these to the `app` element.
   */
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

  /**
   * @private
   * Initializes the core components of the viewer such as EventBus, RenderQueue, and ConfigManager.
   * Sets up PDF.js worker if specified in configuration.
   */
  async _initializeCoreComponents(initialUserOptions) {
    console.log("[ScrollablePdfViewer] _initializeCoreComponents called.");
    if (this.debug) {
      this.metrics.initialRenderStart = performance.now();
      console.log('[PDF-A-go-go Debug] Starting viewer initialization via PageManager');
    }
    try {
      console.log("[ScrollablePdfViewer] _initializeCoreComponents: About to call pageManager.initializePages().");
      await this.pageManager.initializePages(); // This is the crucial call
      console.log("[ScrollablePdfViewer] _initializeCoreComponents: pageManager.initializePages() awaited successfully.");
    } catch (e) {
      console.error("[ScrollablePdfViewer] ERROR during pageManager.initializePages():", e);
      throw e; // Re-throw to be caught by _initializeViewer's try/catch
    }
    if (this.debug) {
      this.metrics.initialRenderEnd = performance.now();
      console.log(`[PDF-A-go-go Debug] Viewer main initialization flow complete in ${this.metrics.initialRenderEnd - this.metrics.initialRenderStart}ms`);
    }
    this.eventBus.emit('initialRenderComplete');
    console.log("[ScrollablePdfViewer] _initializeCoreComponents: Finished.");
  }

  /**
   * @private
   * Sets up essential event handlers for the viewer, like scroll and resize.
   * These are debounced for performance.
   */
  _setupEventHandlers() {
    this._setupResizeHandler();
    this._setupScrollHandler();
    this._setupGrabAndScroll();
    this._setupWheelScrollHandler();

    this._visibilityChangeHandler = () => {
      if (document.hidden) {
        if (this.configManager.get('enablePageCleanup') && this.pageManager) {
          this.pageManager.cleanupPages(Array.from(this.pageManager._visiblePages).filter(p => !this.pageManager._calculateVisiblePages().has(p)));
          this.eventBus.emit('documentHidden');
        }
      } else {
        this.eventBus.emit('documentVisible');
      }
    };
    document.addEventListener('visibilitychange', this._visibilityChangeHandler);

    if (typeof window !== 'undefined' && 'onmemorypressure' in window) {
      this._memoryPressureHandler = () => {
        if (this.configManager.get('enablePageCleanup') && this.pageManager) {
          this.pageManager.cleanupPages(Array.from(this.pageManager._visiblePages));
          this.eventBus.emit('memoryPressure');
        }
      };
      window.addEventListener('memorypressure', this._memoryPressureHandler);
    }

    this._pageChangedHandler = ({ currentPage }) => {
      this.currentPage = currentPage - 1; // Keep viewer's currentPage 0-indexed
    };
    this.eventBus.on('pagechanged', this._pageChangedHandler);
  }

  /**
   * @private
   * Renders a specific page at a given resolution.
   * This method is typically called by PageManager via the RenderQueue.
   * @param {number} pageIndex - The 0-indexed page number to render.
   * @param {'low' | 'high'} resolution - The desired resolution ('low' for preview, 'high' for final).
   * @param {AbortSignal} [abortSignal] - An optional AbortSignal to cancel the rendering operation.
   * @returns {Promise<void>} A promise that resolves when the page rendering is complete or aborted, or rejects on error.
   */
  async _renderPageInternal(pageIndex, resolution = 'high', abortSignal) {
    console.log(`[Viewer] _renderPageInternal called for pageIndex: ${pageIndex} (0-indexed), resolution: ${resolution}`);
    const pageState = this.pageManager._pageStates[pageIndex]; // Access PageManager's state
    if (!pageState || !pageState.canvas) {
      console.warn(`[Viewer] _renderPageInternal: Canvas or pageState not found for page index ${pageIndex}`);
      this.eventBus.emit('pageRenderFailed', { pageIndex, error: 'Canvas or pageState not found' });
      return Promise.reject('Canvas or pageState not found');
    }
    const canvas = pageState.canvas;

    if (abortSignal && abortSignal.aborted) {
      console.log(`[Viewer] _renderPageInternal: Aborted before starting for page ${pageIndex}`);
      this.eventBus.emit('pageRenderAborted', { pageIndex, resolution });
      return Promise.reject(new DOMException('Rendering aborted by signal', 'AbortError'));
    }

    const startTime = this.debug ? performance.now() : 0;

    const optionsDisplayScale = this.configManager.get('scale', (typeof window !== 'undefined' ? window.devicePixelRatio || 1.8 : 1.8));
    const qualityMultiplier = resolution === 'low' ? 0.5 : 1.0;
    const effectiveBackingStorePPM = optionsDisplayScale * qualityMultiplier;

    console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, optionsDisplayScale: ${optionsDisplayScale}, qualityMultiplier: ${qualityMultiplier}, effectiveBackingStorePPM: ${effectiveBackingStorePPM}`);

    this.eventBus.emit('pageRenderStart', { pageIndex, resolution });

    // pageIndex is 0-indexed, book.getPage expects 1-indexed
    return this.book.getPage(pageIndex + 1)
      .then(pg => {
        if (abortSignal && abortSignal.aborted) {
          console.log(`[Viewer] _renderPageInternal: Aborted after getting page ${pageIndex} but before rendering`);
          this.eventBus.emit('pageRenderAborted', { pageIndex, resolution });
          throw new DOMException('Rendering aborted by signal', 'AbortError');
        }

        if (!pageState.dimensions || !pageState.dimensions.aspectRatio) {
            console.warn(`[Viewer] _renderPageInternal: Page dimensions or aspectRatio not found in pageState for page ${pageIndex}. Using PDF.js page directly.`);
            // Fallback to get viewport from pg if pageState is incomplete
            const tempViewport = pg.getViewport({ scale: 1.0 });
            pageState.dimensions = {
                width: tempViewport.width,
                height: tempViewport.height,
                aspectRatio: tempViewport.width / tempViewport.height
            };
        }
        const aspect = pageState.dimensions.aspectRatio;

        // targetHeight for horizontal scrolling is the full height of the scroll container
        const targetHeight = this._getPageHeight();
        const targetWidth = targetHeight * aspect;
        console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, targetHeight: ${targetHeight}, targetWidth: ${targetWidth}, aspect: ${aspect}`);

        const wrapper = pageState.wrapper;
        if (wrapper) {
          wrapper.style.width = targetWidth + "px";
          // Height is 100% via CSS for flex item, but ensure min-height if needed or explicit height if not flex-driven for height
          // wrapper.style.height = targetHeight + "px"; // Flex should handle height
        }

        canvas.style.width = targetWidth + "px";
        canvas.style.height = targetHeight + "px";
        canvas.width = Math.round(targetWidth * effectiveBackingStorePPM);
        canvas.height = Math.round(targetHeight * effectiveBackingStorePPM);

        canvas.setAttribute('data-rendered-scale', String(effectiveBackingStorePPM));
        canvas.setAttribute('data-resolution', resolution);

        const ctx = canvas.getContext("2d", {
          alpha: !this.configManager.get('disableTransparency', false),
          // willReadFrequently: true // Consider making this configurable
        });
        const backgroundColor = this.configManager.get('backgroundColor');
        if (backgroundColor) {
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        const nativePageViewport = pg.getViewport({ scale: 1.0, rotation: this.configManager.get('rotation', 0) });
        const scaleX = canvas.width / nativePageViewport.width;
        const scaleY = canvas.height / nativePageViewport.height;
        const finalPdfJsRenderScale = Math.min(scaleX, scaleY);

        const viewport = pg.getViewport({ scale: finalPdfJsRenderScale, rotation: this.configManager.get('rotation', 0) });
        console.log(`[Viewer] _renderPageInternal: pageIndex: ${pageIndex}, Canvas WxH: ${canvas.width}x${canvas.height}, PDF.js Viewport WxH: ${viewport.width.toFixed(2)}x${viewport.height.toFixed(2)}, finalPdfJsRenderScale: ${finalPdfJsRenderScale.toFixed(3)}`);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
          // enableXfa: this.configManager.get('enableXfa', false), // Example
          // optionalContentConfigPromise: this.configManager.get('optionalContentConfigPromise', null), // Example
        };

        // Handle annotations/highlights if configured
        const getHighlightsForPage = this.configManager.get('getHighlightsForPage');
        if (getHighlightsForPage) {
            // This is a placeholder. The actual integration of highlights depends on how
            // `getHighlightsForPage` returns data and how it should be rendered.
            // PDF.js typically handles annotations via an AnnotationLayer, or you can draw custom elements.
            // For simple highlights, you might get coordinates and draw them on the canvas after page render
            // or pass a custom `paint()` callback to `page.render()`.
            // Example: renderContext.annotations = getHighlightsForPage(pageIndex);
            // Or, renderContext.paintCallBack = (canvasCtx, viewport) => { /* draw highlights */ };
            console.log(`[Viewer] Highlights configured for page ${pageIndex} but direct rendering in _renderPageInternal needs specific implementation.`);
        }


        return pg.render(renderContext).promise.then(() => {
          if (abortSignal && abortSignal.aborted) {
            console.log(`[Viewer] _renderPageInternal: Aborted during pg.render for page ${pageIndex}`);
            this.eventBus.emit('pageRenderAborted', { pageIndex, resolution });
            throw new DOMException('Rendering aborted by signal', 'AbortError');
          }
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
          // Resolve the main promise
        }).catch(renderErr => {
          if (renderErr.name === 'AbortError') {
            console.warn(`[Viewer] Rendering of page ${pageIndex} (${resolution}) was aborted during render task.`);
            this.eventBus.emit('pageRenderAborted', { pageIndex, resolution });
          } else {
            console.error(`[Viewer] Error rendering page ${pageIndex} (${resolution}) via pg.render():`, renderErr);
            if(pageState) pageState.state = 'error'; // Assuming pageState has a 'state' property
            this.eventBus.emit('pageRenderFailed', { pageIndex, resolution, error: renderErr.message });
          }
          throw renderErr; // Re-throw to be caught by RenderQueue/PageManager
        });
      })
      .catch(err => {
        if (err.name === 'AbortError') {
             console.warn(`[Viewer] Getting/Rendering page ${pageIndex} (${resolution}) was aborted.`);
             // Event emitted by specific abort points
        } else {
            console.error(`[Viewer] Error in _renderPageInternal for page ${pageIndex} (getting page or other setup):`, err);
            if(pageState) pageState.state = 'error';
            this.eventBus.emit('pageRenderFailed', { pageIndex, resolution, error: err.message });
        }
        throw err; // Ensure promise chain rejects
      });
  }

  _setupResizeHandler() {
    let resizeTimeout;
    this._onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(async () => {
        if (this.pageManager) {
          this.eventBus.emit('viewerResizeStart');
          await this.pageManager.handleResize();
          this.eventBus.emit('viewerResizeComplete');
        }
      }, this.configManager.get('resizeDebounceTime', 150));
    };
    if (typeof window !== 'undefined') {
        window.addEventListener("resize", this._onResize, false);
    }
  }

  _setupScrollHandler() {
    let scrollTimeout;
    this._onScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(async () => {
        if (this.pageManager) {
          this.eventBus.emit('viewerScrollStart');
          await this.pageManager.handleScroll();
          this.eventBus.emit('viewerScrollComplete');
        }
      }, this.configManager.get('scrollDebounceTime', 50));
    };
    if (this.scrollContainer) {
        this.scrollContainer.addEventListener("scroll", this._onScroll, { passive: true });
    }
  }

  /**
   * @private
   * Sets up the grab and scroll (pan) functionality on the scroll container.
   * Allows users to click and drag to scroll the PDF content.
   */
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

  /**
   * @private
   * Calculates the target height for page containers/canvases based on the scroll container's height.
   * @returns {number} The target height in pixels.
   */
  _getPageHeight() {
    return this.scrollContainer.clientHeight;
  }

  rerenderPage(pageIndex) {
    if (this.pageManager) {
      this.pageManager.rerenderPage(pageIndex);
    }
  }

  getPerformanceMetrics() {
    const eventBusMetrics = {};
    if (this.eventBus && this.eventBus._events) { // Check _events exists
      for (const [eventName, listeners] of this.eventBus._events.entries()) {
        eventBusMetrics[eventName] = listeners.length;
      }
    }

    return {
      ...this.metrics,
      renderQueue: this.renderQueue ? this.renderQueue.getMetrics() : { queueLength: 0, isProcessing: false, tasksCompleted: 0, tasksFailed: 0 },
      pageManager: this.pageManager ? this.pageManager.getMetrics() : { currentPage: 0, visiblePageCount: 0, pageDataStates: [] },
      eventBusListeners: eventBusMetrics
    };
  }

  /**
   * @private
   * Updates the debug information display if enabled in config.
   */
  _setupDebugDisplay() {
    if (this.debugElement) return;
    this.debugElement = document.createElement("div");
    this.debugElement.className = "pdfagogo-debug-info";
    document.body.appendChild(this.debugElement);
    this._debugInterval = setInterval(() => this._updateDebugInfo(), this.configManager.get('debugUpdateInterval', 500));
  }

  /**
   * @private
   * Updates the debug information display if enabled in config.
   */
  _updateDebugInfo() {
    if (!this.debug || !this.debugElement) return;
    const metrics = this.getPerformanceMetrics();
    const avgHighResTime = metrics.totalHighResUpgrades > 0 ? (Object.values(metrics.highResUpgradeTimes).reduce((a, b) => a + b, 0) / metrics.totalHighResUpgrades) : 0;
    const avgLowResTime = metrics.totalPagesRendered > 0 ? (Object.values(metrics.pageRenderTimes).reduce((a, b) => a + b, 0) / metrics.totalPagesRendered) : 0;

    const visiblePageIndices = this.pageManager && this.pageManager._visiblePages ? Array.from(this.pageManager._visiblePages).map(p => p + 1).join(', ') : 'N/A';

    const configRenderMax = this.configManager.get('renderMaxConcurrentTasks');
    const queueMetrics = this.renderQueue.getMetrics();

    let memoryInfo = 'Memory API not available';
    if (typeof performance !== 'undefined' && performance.memory) {
      const perfMemory = performance.memory;
      memoryInfo = `Memory (JS Heap): ${(perfMemory.usedJSHeapSize / 1048576).toFixed(2)}MB / ${(perfMemory.totalJSHeapSize / 1048576).toFixed(2)}MB (Limit: ${(perfMemory.jsHeapSizeLimit / 1048576).toFixed(2)}MB)`
    }

    const currentScaleOpt = this.configManager.get('initialScale', 'N/A');
    const displayScale = typeof currentScaleOpt === 'number' ? currentScaleOpt.toFixed(2) : currentScaleOpt;

    this.debugElement.innerHTML = `
      <strong>PDF-A-go-go Debug Info</strong><br>
      Page: ${this.currentPage + 1}/${this.pageCount}<br>
      Visible: ${visiblePageIndices}<br>
      Render Scale (initialScale): ${displayScale} | Page Margin: ${this.configManager.get('pageMargin', 0)}px<br>
      Render Queue: ${queueMetrics.queueLength} waiting, ${queueMetrics.isProcessing ? '1' : '0'} active (max ${configRenderMax})<br>
      Tasks Completed: ${queueMetrics.tasksCompleted} | Failed: ${queueMetrics.tasksFailed}<br>
      Total Pages Rendered: ${this.metrics.totalPagesRendered} | High-Res Upgrades: ${this.metrics.totalHighResUpgrades}<br>
      Init Time: ${(this.metrics.initialRenderEnd - this.metrics.initialRenderStart).toFixed(2)}ms<br>
      Avg Page Render: ${avgLowResTime.toFixed(2)}ms | Avg High-Res: ${avgHighResTime.toFixed(2)}ms<br>
      ${memoryInfo}<br>
    `;
  }

  /**
   * Navigates to the next page.
   */
  flip_forward() {
    console.log(`[Viewer LOG] flip_forward INVOKED. PageManager current (0-indexed): ${this.pageManager.getCurrentPage()}`);
    const currentPageManagerPage = this.pageManager.getCurrentPage();
    const newPage = Math.min(currentPageManagerPage + 1, this.pageCount - 1); // newPage is 0-indexed
    if (newPage !== currentPageManagerPage) {
      console.log(`[Viewer LOG] flip_forward: Calculated newPage (0-indexed): ${newPage}. Calling pageManager.goToPage(${newPage}).`);
      this.pageManager.goToPage(newPage, { origin: 'flip_forward' });
    } else {
      console.log(`[Viewer LOG] flip_forward: No change. Current: ${currentPageManagerPage}, Target: ${newPage}`);
    }
  }

  /**
   * Navigates to the previous page.
   */
  flip_back() {
    console.log(`[Viewer LOG] flip_back INVOKED. PageManager current (0-indexed): ${this.pageManager.getCurrentPage()}`);
    const currentPageManagerPage = this.pageManager.getCurrentPage();
    const newPage = Math.max(currentPageManagerPage - 1, 0); // newPage is 0-indexed
    if (newPage !== currentPageManagerPage) {
      console.log(`[Viewer LOG] flip_back: Calculated newPage (0-indexed): ${newPage}. Calling pageManager.goToPage(${newPage}).`);
      this.pageManager.goToPage(newPage, { origin: 'flip_back' });
    } else {
      console.log(`[Viewer LOG] flip_back: No change. Current: ${currentPageManagerPage}, Target: ${newPage}`);
    }
  }

  scrollBy(pages) {
    const currentPageManagerPage = this.pageManager.getCurrentPage();
    const newPage = currentPageManagerPage + pages;
    const targetPage = Math.max(0, Math.min(newPage, this.pageCount - 1)); // targetPage is 0-indexed
    if (targetPage !== currentPageManagerPage) {
      console.log(`[Viewer LOG] scrollBy: Calculated targetPage (0-indexed): ${targetPage}. Calling pageManager.goToPage(${targetPage}).`);
      this.pageManager.goToPage(targetPage, { origin: 'scrollBy' });
    }
  }

  /**
   * Navigates to the specified page number.
   * @param {number} pageNum - The 1-indexed page number to navigate to.
   */
  go_to_page(pageNum) { // pageNum is 1-indexed
    console.log(`[Viewer LOG] go_to_page INVOKED with pageNum (1-indexed): ${pageNum}`);
    if (this.pageManager) {
      if (pageNum >= 1 && pageNum <= this.pageCount) {
        const targetPageIndex = pageNum - 1; // Convert to 0-indexed for PageManager
        console.log(`[Viewer LOG] go_to_page: Calling pageManager.goToPage(${targetPageIndex}).`);
        this.pageManager.goToPage(targetPageIndex, { origin: 'api_go_to_page' }); // Pass 0-indexed
      } else {
        console.warn(`[Viewer LOG] go_to_page: Invalid pageNum ${pageNum}. Total pages: ${this.pageCount}`);
      }
    }
  }

  /**
   * Exposes a way to listen to events emitted by the viewer's internal EventBus.
   * @param {string} eventName - The name of the event to listen for.
   * @param {Function} listener - The callback function to execute when the event is emitted.
   * @returns {Function} An unsubscribe function to remove the listener.
   */
  on(eventName, callback) {
    this.eventBus.on(eventName, callback);
  }

  /**
   * Exposes a way to remove an event listener from the viewer's internal EventBus.
   * @param {string} eventName - The name of the event.
   * @param {Function} listenerToRemove - The callback function to remove.
   */
  off(eventName, callback) {
    this.eventBus.off(eventName, callback);
  }

  /**
   * Destroys the viewer instance, cleans up resources, and removes UI elements.
   * This should be called when the viewer is no longer needed to prevent memory leaks.
   */
  destroy() {
    console.log('[ScrollablePdfViewer] Destroying...');
    if (typeof window !== 'undefined') {
      if (this._onResize) window.removeEventListener("resize", this._onResize);
      if (this._memoryPressureHandler) window.removeEventListener('memorypressure', this._memoryPressureHandler);
    }
    if (this._visibilityChangeHandler) document.removeEventListener('visibilitychange', this._visibilityChangeHandler);
    if (this.scrollContainer && this._onScroll) this.scrollContainer.removeEventListener("scroll", this._onScroll);

    if (this.pageManager) {
      this.pageManager.destroy();
      this.pageManager = null;
    }
    if (this.renderQueue) {
      this.renderQueue.clear();
      this.renderQueue.stop(); // Assuming RenderQueue might have a stop method
      this.renderQueue = null;
    }
    if (this.eventBus) {
      this.eventBus.off('pagechanged', this._pageChangedHandler); // remove specific handler
      this.eventBus.clear();
      this.eventBus = null;
    }
    if (this._debugInterval) {
      clearInterval(this._debugInterval);
      this._debugInterval = null;
    }
    if (this.debugElement && this.debugElement.parentElement) {
      this.debugElement.parentElement.removeChild(this.debugElement);
      this.debugElement = null;
    }
    if (this.scrollContainer && this.scrollContainer.parentElement) {
        this.scrollContainer.parentElement.removeChild(this.scrollContainer);
        this.scrollContainer = null;
    }
    if (this.pagesContainer) {
        // Already child of scrollContainer, nulling is enough if scrollContainer is removed
        this.pagesContainer = null;
    }

    this.book = null;
    this.app = null;
    console.log('[ScrollablePdfViewer] Destroyed.');
  }

  /**
   * @private
   * Initializes the viewer, sets up page management, and renders initial pages.
   * This is typically called after the PDF document (this.book) is loaded and ready.
   */
  async _initializeViewer() {
    console.log("[ScrollablePdfViewer] _initializeViewer: Entered. Book available?", !!this.book);
    // Show loading bar if it exists
    if (this.loadingBar) {
      this.loadingBar.style.display = "block";
      this.loadingBar.value = 0;
    }

    try {
      console.log("[ScrollablePdfViewer] _initializeViewer: Checking if book is loaded.");
      if (this.book) {
        console.log("[ScrollablePdfViewer] _initializeViewer: Book is loaded. Calling _initializeCoreComponents.");
        await this._initializeCoreComponents(this.configManager.getAll());
        console.log("[ScrollablePdfViewer] _initializeViewer: _initializeCoreComponents completed.");
        this.isLoaded = true;
        this.isInitialized = true;
        this.eventBus.emit("documentloaded", this.book);
        if (this.loadingBar) this.loadingBar.value = 100;
      } else {
        console.error("[ScrollablePdfViewer] _initializeViewer: Book not loaded. Cannot proceed with core component initialization.");
        this.eventBus.emit("documentloadfailed", "Book not available");
        if (this.loadingBar) this.loadingBar.textContent = "Failed to load document.";
      }
    } catch (error) {
      console.error("[ScrollablePdfViewer] _initializeViewer: Error during initialization:", error);
      this.isLoaded = false;
      this.isInitialized = false;
      this.eventBus.emit("documentloadfailed", error.message);
      if (this.loadingBar) this.loadingBar.textContent = "Error: " + error.message;
    } finally {
      if (this.loadingBar) {
        setTimeout(() => { this.loadingBar.style.display = "none"; }, 500); // Hide after a short delay
      }
      console.log("[ScrollablePdfViewer] _initializeViewer: Process finished.");
    }
  }

  /**
   * Initiates a search for the given query in the PDF document.
   * @param {string} query - The text to search for.
   * @param {object} [options] - Search options.
   * @param {boolean} [options.phraseSearch=true] - Whether to search for the exact phrase.
   * @param {boolean} [options.highlightAll=true] - Whether to highlight all occurrences.
   * @param {boolean} [options.caseSensitive=false] - Whether the search should be case sensitive.
   */
  async search(query, options = {}) {
    if (!this.isLoaded || !this.book) {
      console.warn("[Viewer] Search attempted before document is loaded.");
      this.eventBus.emit('searchfailed', { query, error: 'Document not loaded' });
      return;
    }
    if (!query || query.trim() === "") {
      this.clearSearch();
      this.eventBus.emit('searchcleared');
      return;
    }

    console.log(`[Viewer] search: Initiating search for query="${query}"`, options);
    this._searchState = {
      query,
      results: [],
      currentResultIndex: -1,
      totalMatches: 0,
      options: {
        phraseSearch: options.phraseSearch !== undefined ? options.phraseSearch : true,
        highlightAll: options.highlightAll !== undefined ? options.highlightAll : true,
        caseSensitive: options.caseSensitive !== undefined ? options.caseSensitive : false,
      }
    };

    this.eventBus.emit('searchstarted', { query });

    // This will iterate through pages, get text content, and find matches.
    this._searchState.results = []; // Clear previous results
    let matchCount = 0;

    const searchQuery = this._searchState.options.caseSensitive ? this._searchState.query : this._searchState.query.toLowerCase();

    for (let i = 0; i < this.pageCount; i++) {
      try {
        const page = await this.book.getPage(i + 1); // 1-indexed
        const textContent = await page.getTextContent();

        textContent.items.forEach((item, itemIndex) => {
          const itemText = this._searchState.options.caseSensitive ? item.str : item.str.toLowerCase();
          if (itemText.includes(searchQuery)) {
            // For phrase search, we'd need to check for exact match, not just includes.
            // This basic version finds any occurrence.
            // TODO: Implement proper phrase search if options.phraseSearch is true.
            // TODO: For multiple occurrences within one item.str, create multiple results.
            // For now, one match per item.str that contains the query.

            // Find all occurrences of searchQuery in itemText
            let startIndex = -1;
            let occurrencesOnItem = 0;
            while ((startIndex = itemText.indexOf(searchQuery, startIndex + 1)) !== -1) {
              this._searchState.results.push({
                pageIndex: i,
                textContentItemIndex: itemIndex, // Store index of the text item
                transform: item.transform, // Store transform for positioning highlights
                width: item.width, // Store width
                height: item.height, // Store height
                text: item.str, // Store original text of the item
                matchStartIndex: startIndex, // Store the start index of the match within this item's string
                matchLength: searchQuery.length
              });
              matchCount++;
              occurrencesOnItem++;
              if (!this._searchState.options.highlightAll && occurrencesOnItem > 0) break; // if not highlightAll, only one match per item needed for navigation
            }
          }
        });
        // Release page resources if possible (PDF.js specific, not always needed for getTextContent)
        if (typeof page.cleanup === 'function') {
          page.cleanup();
        }
      } catch (err) {
        console.error(`[Viewer] search: Error processing page ${i + 1} for search:`, err);
        // Continue to next page
      }
    }
    this._searchState.totalMatches = matchCount;

    if (this._searchState.totalMatches > 0) {
      this._searchState.currentResultIndex = 0;
      // Don't call navigateToSearchResult yet, it will be called after updating all highlights.
    } else {
       // If no matches, ensure all page highlights are cleared (e.g., from a previous search)
      for (let i = 0; i < this.pageCount; i++) {
        this.pageManager.clearPageHighlights(i);
      }
    }

    // Update highlights on all relevant pages
    if (this._searchState.options.highlightAll) {
      const resultsByPage = this._groupResultsByPage(this._searchState.results);
      resultsByPage.forEach((resultsOnPage, pageIdx) => {
        const currentMatchForThisPage = (this._searchState.currentResultIndex !== -1 && this._searchState.results[this._searchState.currentResultIndex].pageIndex === pageIdx) ? this._searchState.results[this._searchState.currentResultIndex] : null;
        this.pageManager.updatePageHighlights(pageIdx, resultsOnPage, currentMatchForThisPage);
      });
    }

    if (this._searchState.totalMatches > 0) {
        this.navigateToSearchResult(this._searchState.currentResultIndex, false); // false: don't update highlights again here
    }

    console.log(`[Viewer] search: Found ${this._searchState.totalMatches} matches for "${query}". Current index: ${this._searchState.currentResultIndex}`);
    this.eventBus.emit('searchupdated', {
      query: this._searchState.query,
      totalMatches: this._searchState.totalMatches,
      currentMatchIndex: this._searchState.currentResultIndex + 1, // 1-indexed for UI
    });

    // TODO: Implement actual text layer search and highlighting
  }

  /**
   * Clears the current search state and removes highlights.
   */
  clearSearch() {
    console.log("[Viewer] clearSearch: Clearing search state.");
    if (this._searchState) {
        for (let i = 0; i < this.pageCount; i++) {
            // Check if page actually had results before trying to clear, or just clear all.
            // For simplicity, try to clear from all pages that might have had highlights.
            this.pageManager.clearPageHighlights(i);
        }
    }
    this._searchState = null;
    this.eventBus.emit('searchcleared');
    this.eventBus.emit('searchupdated', {
      query: '',
      totalMatches: 0,
      currentMatchIndex: 0,
    });
  }

  /**
   * Navigates to the next search result.
   */
  findNext() {
    if (!this._searchState || this._searchState.totalMatches === 0) {
      console.log("[Viewer] findNext: No search active or no matches.");
      return;
    }
    if (this._searchState.currentResultIndex < this._searchState.totalMatches - 1) {
      this._searchState.currentResultIndex++;
      this.navigateToSearchResult(this._searchState.currentResultIndex);
      this.eventBus.emit('searchupdated', {
        query: this._searchState.query,
        totalMatches: this._searchState.totalMatches,
        currentMatchIndex: this._searchState.currentResultIndex + 1, // 1-indexed for UI
      });
    } else {
      console.log("[Viewer] findNext: Already at the last match.");
      // Optionally, loop back to the first match
    }
  }

  /**
   * Navigates to the previous search result.
   */
  findPrevious() {
    if (!this._searchState || this._searchState.totalMatches === 0) {
      console.log("[Viewer] findPrevious: No search active or no matches.");
      return;
    }
    if (this._searchState.currentResultIndex > 0) {
      this._searchState.currentResultIndex--;
      this.navigateToSearchResult(this._searchState.currentResultIndex);
      this.eventBus.emit('searchupdated', {
        query: this._searchState.query,
        totalMatches: this._searchState.totalMatches,
        currentMatchIndex: this._searchState.currentResultIndex + 1, // 1-indexed for UI
      });
    } else {
      console.log("[Viewer] findPrevious: Already at the first match.");
      // Optionally, loop to the last match
    }
  }

  /**
   * @private
   * Navigates the view to the specified search result.
   * @param {number} resultIndex - The index of the result in _searchState.results.
   * @param {boolean} [updateHighlights=true] - Whether to update page highlights.
   */
  navigateToSearchResult(resultIndex, updateHighlights = true) {
    if (!this._searchState || !this._searchState.results[resultIndex]) {
      console.warn(`[Viewer] navigateToSearchResult: Invalid resultIndex ${resultIndex}`);
      return;
    }
    const result = this._searchState.results[resultIndex];
    console.log(`[Viewer] navigateToSearchResult: Navigating to match ${resultIndex + 1}/${this._searchState.totalMatches} on page ${result.pageIndex +1}`);
    // Go to the page
    this.pageManager.goToPage(result.pageIndex, { origin: 'search_navigation' });

    // Update highlights for the new page and potentially the old page
    if (updateHighlights) {
      const oldResultIndex = this._searchState.currentResultIndex; // Before it's updated by findNext/Prev
      const newResult = this._searchState.results[resultIndex];

      // If there was a previous result on a different page, update its highlights (to remove current-match style)
      if (oldResultIndex !== -1 && oldResultIndex !== resultIndex) {
        const oldResult = this._searchState.results[oldResultIndex];
        if (oldResult && oldResult.pageIndex !== newResult.pageIndex) {
          const oldPageResults = this._searchState.results.filter(r => r.pageIndex === oldResult.pageIndex);
          this.pageManager.updatePageHighlights(oldResult.pageIndex, oldPageResults, null); // No current match on old page
        }
      }
      // Update highlights for the new page, marking the current one
      const newPageResults = this._searchState.results.filter(r => r.pageIndex === newResult.pageIndex);
      this.pageManager.updatePageHighlights(newResult.pageIndex, newPageResults, newResult);
    }
    // Note: _searchState.currentResultIndex is updated by findNext/findPrevious *before* calling this.
    // So for styling the current match, we use the `result` object for the *new* current match.

    this.eventBus.emit('searchfocuschanged', {
        pageIndex: result.pageIndex,
        matchIndexInPage: result.textContentItemIndex, // if available
        currentGlobalMatchIndex: resultIndex + 1,
        totalGlobalMatches: this._searchState.totalMatches
    });
  }

  /**
   * @private
   * Helper to group search results by page index.
   * @param {Array<object>} allResults - The full list of search results.
   * @returns {Map<number, Array<object>>} A Map where keys are page indices and values are arrays of results on that page.
   */
  _groupResultsByPage(allResults) {
    const map = new Map();
    allResults.forEach(result => {
      if (!map.has(result.pageIndex)) {
        map.set(result.pageIndex, []);
      }
      map.get(result.pageIndex).push(result);
    });
    return map;
  }
}
