/**
 * @file Scrollable PDF Viewer: Core rendering and interaction engine for PDF-A-go-go.
 *
 * This module provides the main ScrollablePdfViewer class that handles:
 * - PDF page rendering with render queue management
 * - Memory management and performance optimization
 * - User interaction (scrolling, navigation, touch/mouse events)
 * - Accessibility features and keyboard navigation
 * - Performance monitoring and debug capabilities
 * - Mobile and desktop optimization
 *
 * The viewer uses a sophisticated render queue system to manage page rendering
 * efficiently, with automatic memory cleanup and performance tracking.
 *
 * @author PDF-A-go-go Contributors
 * @version 1.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

import EventEmitter from "events";

/**
 * Render queue system for managing PDF page rendering tasks.
 *
 * This class implements a priority-based task queue that processes rendering
 * operations using requestAnimationFrame for optimal performance. It ensures
 * that high-priority tasks (visible pages) are rendered before lower-priority
 * tasks (off-screen pages).
 *
 * @class RenderQueue
 * @example
 * const queue = new RenderQueue();
 *
 * // Add a high-priority task
 * queue.add(() => renderVisiblePage(1), true);
 *
 * // Add a normal priority task
 * queue.add(() => renderOffscreenPage(5));
 *
 * // Clear all pending tasks
 * queue.clear();
 */
class RenderQueue {
  /**
   * Create a new render queue instance.
   *
   * @constructor
   */
  constructor() {
    /** @type {Array<Function>} Array of pending render tasks */
    this.queue = [];

    /** @type {boolean} Whether the queue is currently processing tasks */
    this.isProcessing = false;

    /** @type {Function|null} The currently executing task */
    this.currentTask = null;
  }

  /**
   * Add a rendering task to the queue.
   *
   * Tasks can be added with normal or high priority. High-priority tasks
   * are added to the front of the queue and will be processed before
   * normal priority tasks.
   *
   * @param {Function} task - The rendering task function to execute
   * @param {boolean} [priority=false] - Whether this is a high-priority task
   *
   * @example
   * // Add a normal priority task
   * queue.add(() => renderPage(5));
   *
   * // Add a high-priority task (will be processed first)
   * queue.add(() => renderVisiblePage(2), true);
   */
  add(task, priority = false) {
    if (priority) {
      // High-priority tasks go to the front of the queue
      this.queue.unshift(task);
    } else {
      // Normal priority tasks go to the back
      this.queue.push(task);
    }

    // Start processing if not already running
    if (!this.isProcessing) {
      this.process();
    }
  }

  /**
   * Clear all pending tasks from the queue.
   *
   * This method removes all queued tasks but does not interrupt
   * the currently executing task.
   *
   * @example
   * // Clear all pending renders when user navigates away
   * queue.clear();
   */
  clear() {
    this.queue = [];
    this.currentTask = null;
  }

  /**
   * Process the next task in the queue using requestAnimationFrame.
   *
   * This method uses requestAnimationFrame to ensure rendering tasks
   * are executed at the optimal time for smooth performance. It handles
   * errors gracefully and continues processing even if individual tasks fail.
   *
   * @private
   */
  process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    this.currentTask = this.queue.shift();

    requestAnimationFrame(() => {
      Promise.resolve(this.currentTask())
        .then(() => {
          this.currentTask = null;
          this.process(); // Process next task
        })
        .catch(err => {
          console.error('Render task failed:', err);
          this.currentTask = null;
          this.process(); // Continue with next task even if current fails
        });
    });
  }
}

/**
 * Main scrollable PDF viewer class with comprehensive rendering and interaction capabilities.
 *
 * This class extends EventEmitter to provide a rich event-driven interface for PDF viewing.
 * It handles all aspects of PDF rendering, user interaction, performance optimization,
 * and accessibility features.
 *
 * Key features:
 * - Horizontal scrolling PDF viewer with smooth navigation
 * - Render queue system for optimal performance
 * - Memory management with automatic cleanup
 * - Mobile and desktop optimization
 * - Accessibility support (ARIA labels, keyboard navigation)
 * - Performance monitoring and debug capabilities
 * - Touch and mouse interaction support
 *
 * @class ScrollablePdfViewer
 * @extends EventEmitter
 *
 * @fires ScrollablePdfViewer#initialRenderComplete - When initial page rendering is complete
 * @fires ScrollablePdfViewer#pageChange - When the current page changes
 * @fires ScrollablePdfViewer#seen - When a page becomes visible
 *
 * @example
 * const viewer = new ScrollablePdfViewer({
 *   app: document.getElementById('pdf-container'),
 *   book: {
 *     numPages: () => 10,
 *     getPage: (index, callback) => {
 *       // render page implementation
 *     }
 *   },
 *   options: {
 *     debug: true,
 *     momentum: 2.0,
 *     scale: 1.5
 *   }
 * });
 */
export class ScrollablePdfViewer extends EventEmitter {
  /**
   * Create a new ScrollablePdfViewer instance.
   *
   * Initializes the PDF viewer with the provided configuration, sets up the DOM structure,
   * configures device-specific optimizations, and begins the initial page rendering process.
   *
   * @param {Object} config - Configuration object for the viewer
   * @param {HTMLElement} config.app - The container element for the viewer
   * @param {Object} config.book - PDF book object with page access methods
   * @param {Function} config.book.numPages - Returns the total number of pages
   * @param {Function} config.book.getPage - Retrieves a specific page for rendering
   * @param {Object} [config.options={}] - Viewer options and settings
   * @param {number} [config.options.scale] - Rendering scale factor
   * @param {number} [config.options.momentum=1.5] - Scroll momentum factor
   * @param {boolean} [config.options.debug=false] - Enable debug mode with performance metrics
   * @param {string} [config.options.backgroundColor] - Background color for pages
   * @param {number} [config.options.margin] - Page margin settings
   *
   * @constructor
   * @example
   * const viewer = new ScrollablePdfViewer({
   *   app: document.getElementById('pdf-container'),
   *   book: {
   *     numPages: () => 10,
   *     getPage: (index, callback) => {
   *       // render page implementation
   *     }
   *   },
   *   options: {
   *     debug: true,
   *     momentum: 2.0,
   *     scale: 1.5
   *   }
   * });
   */
  constructor({ app, book, options }) {
    super();

    /** @type {HTMLElement} The main container element */
    this.app = app;

    /** @type {Object} PDF book object providing page access */
    this.book = book;

    /** @type {Object} Configuration options for the viewer */
    this.options = options || {};

    /** @type {number} Total number of pages in the PDF */
    this.pageCount = book.numPages();

    /** @type {number} Currently visible/active page (0-based index) */
    this.currentPage = 0;

    /** @type {Object<number, HTMLCanvasElement>} Cache of rendered page canvases */
    this.pageCanvases = {};

    /** @type {RenderQueue} Queue for managing rendering tasks */
    this.renderQueue = new RenderQueue();

    // Device detection and optimization settings
    /** @type {boolean} Whether the device is detected as mobile */
    this.isMobile = window.innerWidth <= 768;

    /** @type {number} Maximum number of pages to keep in memory cache */
    this.maxCachedPages = this.isMobile ? 3 : 5;

    /** @type {number} Range of pages to render around the current view */
    this.visibleRange = this.isMobile ? 1 : 2; // Pages to render around current view

    // Create main scroll container
    /** @type {HTMLElement} Main scrolling container element */
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "pdfagogo-scroll-container";
    this.app.appendChild(this.scrollContainer);

    // Create pages container with flexbox layout
    /** @type {HTMLElement} Container for all PDF pages */
    this.pagesContainer = document.createElement("div");
    this.pagesContainer.className = "pdfagogo-pages-container";
    this.pagesContainer.style.display = "flex";
    this.pagesContainer.style.flexDirection = "column";
    this.pagesContainer.style.alignItems = "center";
    this.pagesContainer.style.minWidth = "100%";
    this.pagesContainer.style.height = "100%";
    this.scrollContainer.appendChild(this.pagesContainer);

    // Debug and performance monitoring setup
    /** @type {boolean} Whether debug mode is enabled */
    this.debug = typeof this.options.debug === 'boolean' ? this.options.debug : false;

    /**
     * Performance metrics collection object.
     * @type {Object}
     * @property {number} initialRenderStart - Timestamp when initial render started
     * @property {number} initialRenderEnd - Timestamp when initial render completed
     * @property {Object<number, number>} pageRenderTimes - Render times for each page
     * @property {Object<number, number>} highResUpgradeTimes - High-res upgrade times
     * @property {number} totalPagesRendered - Total number of pages rendered
     * @property {number} totalHighResUpgrades - Total number of high-res upgrades
     * @property {Object} memoryUsage - Memory usage tracking data
     * @property {number} lastUpdate - Timestamp of last metrics update
     */
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

    if (this.debug) {
      this._setupDebugDisplay();
    }

    /** @type {Set<number>} Set of currently visible page indices */
    this._visiblePages = new Set();

    // Initialize event handlers and begin rendering
    this._setupEventHandlers();
    this._initializePages();
  }

  /**
   * Set up all event handlers for user interaction and system events.
   *
   * This method configures handlers for:
   * - Window resize events
   * - Scroll events for page tracking
   * - Mouse and touch interaction
   * - Wheel scrolling with momentum
   * - Memory management events
   *
   * @private
   */
  _setupEventHandlers() {
    this._setupResizeHandler();
    this._setupScrollHandler();
    this._setupBasicScrolling();

    // Memory management event handlers
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Clean up memory when page becomes hidden
        this._cleanupOffscreenPages(true);
      }
    });

    // Handle memory pressure events (if supported by browser)
    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', () => {
        this._cleanupOffscreenPages(true);
      });
    }
  }

  /**
   * Initialize all PDF pages with placeholder canvases and begin rendering.
   *
   * This method performs a two-phase initialization:
   * 1. Creates placeholder canvases for all pages off-screen
   * 2. Moves them to the visible container and renders visible pages
   *
   * This approach ensures smooth initial loading without layout shifts.
   *
   * @private
   * @async
   * @fires ScrollablePdfViewer#initialRenderComplete
   */
  async _initializePages() {
    if (this.debug) {
      this.metrics.initialRenderStart = performance.now();
      console.log('[PDF-A-go-go Debug] Starting initial render');
    }

    // Create an off-screen container for initial setup to prevent layout shifts
    const offscreenContainer = document.createElement('div');
    offscreenContainer.style.position = 'absolute';
    offscreenContainer.style.visibility = 'hidden';
    offscreenContainer.style.pointerEvents = 'none';
    offscreenContainer.style.left = '-9999px';
    offscreenContainer.style.top = '0';
    offscreenContainer.style.zIndex = '-1';
    offscreenContainer.className = 'pdfagogo-pages-container';
    offscreenContainer.style.display = 'flex';
    offscreenContainer.style.flexDirection = 'column';
    offscreenContainer.style.alignItems = 'center';
    offscreenContainer.style.minWidth = '100%';
    offscreenContainer.style.height = '100%';
    this.app.appendChild(offscreenContainer);

    // First pass: Create placeholder canvases for all pages
    const pageSetupPromises = [];
    for (let i = 0; i < this.pageCount; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdfagogo-page-wrapper';
      wrapper.id = `pdf-page-${i + 1}`;

      const canvas = document.createElement("canvas");
      canvas.className = "pdfagogo-page-canvas";
      canvas.setAttribute("tabindex", "0");
      canvas.setAttribute("data-page", i + 1);
      canvas.setAttribute("data-resolution", "placeholder");

      wrapper.appendChild(canvas);
      this.pageCanvases[i] = canvas;
      offscreenContainer.appendChild(wrapper);
    }

    // Wait for all page dimensions to be calculated
    await Promise.all(pageSetupPromises);

    // Move all prepared pages to the visible container at once
    while (offscreenContainer.firstChild) {
      this.pagesContainer.appendChild(offscreenContainer.firstChild);
    }
    this.app.removeChild(offscreenContainer);

    // Second pass: Render only visible pages
    await this._updateVisiblePages();
    const visiblePages = Array.from(this._visiblePages);

    // Emit initialRenderComplete event
    this.emit('initialRenderComplete');

    if (this.debug) {
      this.metrics.initialRenderEnd = performance.now();
      console.log(`[PDF-A-go-go Debug] Initial render complete in ${this.metrics.initialRenderEnd - this.metrics.initialRenderStart}ms`);
    }
  }

  _renderPage(ndx, callback = null) {
    const canvas = this.pageCanvases[ndx];
    if (!canvas) return;

    const startTime = this.debug ? performance.now() : 0;
    const scale = this.options.scale || window.devicePixelRatio || 1.8;

    // Add visual debug indicator for rendering start
    if (this.debug) {
      console.log(`%c🎨 Rendering page ${ndx + 1}`, 'color: #4CAF50; font-weight: bold;');
      const debugOverlay = document.createElement('div');
      debugOverlay.style.position = 'absolute';
      debugOverlay.style.top = '0';
      debugOverlay.style.right = '0';
      debugOverlay.style.background = '#4CAF50';
      debugOverlay.style.color = 'white';
      debugOverlay.style.padding = '4px 8px';
      debugOverlay.style.borderRadius = '0 8px 0 8px';
      debugOverlay.style.fontSize = '12px';
      debugOverlay.style.zIndex = '100';
      debugOverlay.textContent = `Rendering ${ndx + 1}`;
      canvas.parentElement.appendChild(debugOverlay);
      setTimeout(() => debugOverlay.remove(), 1000);
    }

    // Get highlights for this page from global state
    const highlights = window.__pdfagogo__highlights?.[ndx] || [];

    this.book.getPage(ndx, (err, pg) => {
      if (err) {
        if (callback) callback();
        return;
      }

      const targetHeight = this._getPageHeight();
      const aspect = pg.width / pg.height;
      const width = targetHeight * aspect;

      // Set canvas dimensions and styles in one go
      const wrapper = canvas.parentElement;
      wrapper.style.width = width + "px";
      wrapper.style.height = targetHeight + "px";
      canvas.style.width = width + "px";
      canvas.style.height = targetHeight + "px";
      canvas.width = width * scale;
      canvas.height = targetHeight * scale;

      // Render directly to the canvas
      const ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true
      });

      if (pg.img) {
        ctx.drawImage(pg.img, 0, 0, canvas.width, canvas.height);
      }

      if (this.debug) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.metrics.highResUpgradeTimes[ndx] = duration;
        this.metrics.totalHighResUpgrades++;
        this._updateDebugInfo();
        console.log(`%c✨ Rendered page ${ndx + 1} in ${duration.toFixed(1)}ms`, 'color: #4CAF50; font-weight: bold;');
      }

      if (callback) callback();
    }, highlights);
  }

  _updateVisiblePages() {
    console.log("Updating visible pages");
    const container = this.scrollContainer;
    const containerRect = container.getBoundingClientRect();
    const visiblePages = new Set();
    let maxVisiblePage = null;
    let maxVisibleRatio = 0;

    // Extend the visible area vertically to include pages that are nearly visible
    const extendedTop = containerRect.top - containerRect.height * 0.5;
    const extendedBottom = containerRect.bottom + containerRect.height * 0.5;

    const wrappers = container.querySelectorAll('.pdfagogo-page-wrapper');
    wrappers.forEach(wrapper => {
      const pageNum = parseInt(wrapper.querySelector('canvas')?.getAttribute('data-page'), 10);
      if (!pageNum) return;

      const rect = wrapper.getBoundingClientRect();
      if (rect.bottom > extendedTop && rect.top < extendedBottom) {

        const visibleHeight = Math.min(rect.bottom, containerRect.bottom) -
                              Math.max(rect.top, containerRect.top);
        const percentVisible = visibleHeight / rect.height;
        visiblePages.add(pageNum);

        if (percentVisible > maxVisibleRatio) {
          maxVisibleRatio = percentVisible;
          maxVisiblePage = pageNum;
        }
      }
    });

    // Update current page if we found a most visible page
    if (maxVisiblePage !== null && maxVisibleRatio > 0.5) {
      const newPage = maxVisiblePage - 1;
      if (this.currentPage !== newPage) {
        this.currentPage = newPage;
        this.emit("seen", maxVisiblePage);
      }
    }

    // Check if visible pages changed
    const oldVisible = Array.from(this._visiblePages).sort().join(',');
    const newVisible = Array.from(visiblePages).sort().join(',');

    if (oldVisible !== newVisible) {
      this._visiblePages = visiblePages;
      this.emit("visiblePages", Array.from(visiblePages));

      // Render newly visible pages in high resolution
      const newPages = Array.from(visiblePages).filter(pageNum => !oldVisible.includes(pageNum.toString()));
      for (const pageNum of newPages) {
        this.renderQueue.add(() => this._renderPage(pageNum - 1));
      }
    }
  }

  _cleanupOffscreenPages(force = false) {
    if (this.debug) console.log('[PDF-A-go-go Debug] Running memory cleanup');

    const visiblePages = Array.from(this._visiblePages);
    const start = Math.min(...visiblePages);
    const end = Math.max(...visiblePages);
    const buffer = this.isMobile ? 1 : 2;

    const keepRange = new Set();
    for (let i = start - buffer; i <= end + buffer; i++) {
      if (i >= 1 && i <= this.pageCount) {
        keepRange.add(i);
      }
    }

    Object.keys(this.pageCanvases).forEach(pageNum => {
      pageNum = parseInt(pageNum);
      if (!keepRange.has(pageNum + 1) || force) {
        const canvas = this.pageCanvases[pageNum];
        if (canvas && canvas.getContext) {
          const ctx = canvas.getContext('2d');
          const memoryBefore = canvas.width * canvas.height * 4;

          // Add visual debug indicator for cleanup
          if (this.debug) {
            console.log(`%c🗑️ Releasing page ${pageNum + 1}`, 'color: #F44336; font-weight: bold;');
            const debugOverlay = document.createElement('div');
            debugOverlay.style.position = 'absolute';
            debugOverlay.style.top = '0';
            debugOverlay.style.right = '0';
            debugOverlay.style.background = '#F44336';
            debugOverlay.style.color = 'white';
            debugOverlay.style.padding = '4px 8px';
            debugOverlay.style.borderRadius = '0 8px 0 8px';
            debugOverlay.style.fontSize = '12px';
            debugOverlay.style.zIndex = '100';
            debugOverlay.textContent = `Releasing ${pageNum + 1}`;
            canvas.parentElement.appendChild(debugOverlay);
            setTimeout(() => debugOverlay.remove(), 1000);
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = canvas.height = 32;
          canvas.setAttribute('data-resolution', 'placeholder');

          if (this.debug) {
            this.metrics.memoryUsage[pageNum] = {
              freed: memoryBefore,
              timestamp: Date.now()
            };
            console.log(`%c♻️ Released page ${pageNum + 1} (Freed: ${(memoryBefore / 1024 / 1024).toFixed(1)}MB)`,
              'color: #F44336; font-weight: bold;');
          }
        }
      }
    });

    // Clear render queue for off-screen pages
    this.renderQueue.clear();

    // Re-queue visible pages if needed
    this._updateVisiblePages();
  }

  _setupResizeHandler() {
    let resizeTimeout = null;
    window.addEventListener("resize", () => {
      // Clear any existing timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      // Set new timeout to wait for resize to finish
      resizeTimeout = setTimeout(() => {
        this._handleResize();
        resizeTimeout = null;
      }, 300);
    });
  }

  async _handleResize() {
    this.isMobile = window.innerWidth <= 768;

    // Update dimensions for all pages
    const resizePromises = [];
    // for (let i = 0; i < this.pageCount; i++) {
    //   resizePromises.push(this._setPageDimensions(i));
    // }

    await Promise.all(resizePromises);

    // Clear the render queue
    this.renderQueue.clear();

    // Update visible pages and re-render them
    await this._updateVisiblePages();
    const visiblePages = Array.from(this._visiblePages);

    // Render visible pages in low res
    // const renderPromises = [];
    // for (const pageNum of visiblePages) {
    //   renderPromises.push(
    //     new Promise(resolve => {
    //       this.renderQueue.add(
    //         () => this._renderPage(pageNum - 1, resolve),
    //         true // Priority render for visible pages
    //       );
    //     })
    //   );
    // }

    // await Promise.all(renderPromises);

    // Queue high-res renders for visible pages
    visiblePages.forEach(pageNum => {
      // const canvas = this.pageCanvases[pageNum - 1];
      this.renderQueue.add(() => this._renderPage(pageNum - 1));
    });
  }

  _setupScrollHandler() {
    let scrollTimeout;
    let lastScrollTime = Date.now();

    this.scrollContainer.addEventListener("scroll", () => {
      const now = Date.now();

      // Clear any existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Update visible pages immediately if enough time has passed
      // if (now - lastScrollTime > 32) { // ~30fps
      //   this._updateVisiblePages();
      //   lastScrollTime = now;
      // }

      // // Set a new timeout for final update
      // scrollTimeout = setTimeout(() => {
      //   this._updateVisiblePages();
      //   scrollTimeout = null;
      // }, 100);
    });
  }

  _getPageWidth() {
    // Try to get the width of the second page's rendered image (or first if not available)
    let pageIdx = 1;
    if (this.pageCount < 2) pageIdx = 0;
    const canvas = this.pageCanvases[pageIdx];
    if (canvas && canvas.clientWidth) {
      return canvas.clientWidth;
    }
    // Fallback: estimate based on container height and aspect ratio
    const containerHeight = this.scrollContainer.clientHeight || 600;
    return containerHeight * 0.7;
  }

  _getPageHeight() {
    return this.scrollContainer.clientHeight || 600;
  }

  /**
   * Sets up basic scroll container styling.
   * Native scrolling behavior is now preferred over custom drag mechanics.
   */
  _setupBasicScrolling() {
    const container = this.scrollContainer;
    container.style.cursor = 'default';
    
    // Remove any grab-related classes that might exist
    container.classList.remove('grabbing');
  }



  rerenderPage(ndx) {
    console.log("rerenderPage",ndx);
    const canvas = this.pageCanvases[ndx];
    if (!canvas) return;

    this._renderPage(ndx);
  }

  // Add a method to get performance metrics
  getPerformanceMetrics() {
    if (!this.debug) return null;

    const avgHighResTime = Object.values(this.metrics.highResUpgradeTimes).reduce((a, b) => a + b, 0) / this.metrics.totalHighResUpgrades;

    return {
      initialRenderTime: this.metrics.initialRenderEnd - this.metrics.initialRenderStart,
      averageHighResRenderTime: avgHighResTime,
      totalPagesRendered: this.metrics.totalPagesRendered,
      totalHighResUpgrades: this.metrics.totalHighResUpgrades,
      pageRenderTimes: this.metrics.pageRenderTimes,
      highResUpgradeTimes: this.metrics.highResUpgradeTimes
    };
  }

  _setupDebugDisplay() {
    this.debugElement = document.createElement('div');
    this.debugElement.className = 'pdfagogo-debug-info';
    document.body.appendChild(this.debugElement);

    // Update debug info every 500ms
    this._debugInterval = setInterval(() => this._updateDebugInfo(), 500);

    // Clean up on page unload
    window.addEventListener('unload', () => {
      if (this._debugInterval) {
        clearInterval(this._debugInterval);
      }
      if (this.debugElement && this.debugElement.parentNode) {
        this.debugElement.parentNode.removeChild(this.debugElement);
      }
    });
  }

  _updateDebugInfo() {
    if (!this.debug || !this.debugElement) return;

    const now = Date.now();
    const timeSinceStart = this.metrics.initialRenderEnd ?
      (this.metrics.initialRenderEnd - this.metrics.initialRenderStart).toFixed(2) :
      (now - this.metrics.initialRenderStart).toFixed(2);

    const avgLowResTime = Object.values(this.metrics.pageRenderTimes).length ?
      (Object.values(this.metrics.pageRenderTimes).reduce((a, b) => a + b, 0) /
       Object.values(this.metrics.pageRenderTimes).length).toFixed(2) :
      'N/A';

    const avgHighResTime = Object.values(this.metrics.highResUpgradeTimes).length ?
      (Object.values(this.metrics.highResUpgradeTimes).reduce((a, b) => a + b, 0) /
       Object.values(this.metrics.highResUpgradeTimes).length).toFixed(2) :
      'N/A';

    const totalMemoryFreed = Object.values(this.metrics.memoryUsage)
      .reduce((total, item) => total + (item.freed || 0), 0);

    const visiblePages = Array.from(this._visiblePages).join(', ');

    this.debugElement.innerHTML = `
      <div class="timing">Initial Render: ${timeSinceStart}ms</div>
      <div class="timing">Avg High-Res: ${avgHighResTime}ms</div>
      <div>Pages Rendered: ${this.metrics.totalPagesRendered}</div>
      <div>High-Res Updates: ${this.metrics.totalHighResUpgrades}</div>
      <div class="memory">Memory Freed: ${(totalMemoryFreed / 1024 / 1024).toFixed(2)}MB</div>
      <div>Visible Pages: ${visiblePages}</div>
      <div>Resolution Changes: ${Object.keys(this.metrics.highResUpgradeTimes).length}</div>
    `;

    this.metrics.lastUpdate = now;
  }

  flip_forward() {
    const nextPage = this.currentPage + 1;
    if (nextPage < this.pageCount) {
      this.go_to_page(nextPage);
    }
  }

  flip_back() {
    const prevPage = this.currentPage - 1;
    if (prevPage >= 0) {
      this.go_to_page(prevPage);
    }
  }

  scrollBy(pages) {
    const pageHeight = this._getPageHeight() + 24;
    this.scrollContainer.scrollBy({
      top: pageHeight * pages,
      behavior: "smooth"
    });
  }

  // Change the view to show a specific page
  go_to_page(pageNum) {
    const wrapper = this.pageCanvases[pageNum]?.parentElement;
    if (!wrapper) return;

    // Use the browser's native scrolling to bring the page into view instead of calculating coordinates
    // This pairs naturally with hash-based navigation (e.g. #pdf-page-2)
    wrapper.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    // Update current page state immediately
    this.currentPage = pageNum;
    this.emit("seen", pageNum + 1); // Emit 1-based page number

    if (this.debug) {
      console.log(`[PDF-A-go-go Debug] Navigated to page ${pageNum + 1}`);
    }
  }
}
