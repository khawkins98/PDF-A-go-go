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
    // Validate that the task is a function
    if (typeof task !== 'function') {
      console.error('[RenderQueue] Invalid task added to render queue. Expected function, got:', typeof task, task);
      return;
    }

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

    // Validate that we have a valid function to execute
    if (typeof this.currentTask !== 'function') {
      console.warn('[RenderQueue] Invalid task in render queue:', typeof this.currentTask);
      this.currentTask = null;
      this.process(); // Skip to next task
      return;
    }

    requestAnimationFrame(() => {
      // Double-check that currentTask is still a function (race condition protection)
      if (typeof this.currentTask !== 'function') {
        this.currentTask = null;
        this.process();
        return;
      }

      // Store the task in a local variable to prevent race conditions
      const taskToExecute = this.currentTask;

      try {
        Promise.resolve(taskToExecute())
          .then(() => {
            this.currentTask = null;
            this.process(); // Process next task
          })
          .catch(err => {
            console.error('[RenderQueue] Render task failed:', err);
            this.currentTask = null;
            this.process(); // Continue with next task even if current fails
          });
      } catch (error) {
        console.error('[RenderQueue] Error calling currentTask:', error);
        this.currentTask = null;
        this.process();
      }
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

    // Create left/right edge overlays that allow page-level scrolling
    // when the user scrolls over the extreme left/right areas. This
    // prevents the user from feeling "trapped" inside the PDF container.
    this.leftEdgeOverlay = document.createElement('div');
    this.rightEdgeOverlay = document.createElement('div');
    this.leftEdgeOverlay.className = 'pdfagogo-edge-overlay left';
    this.rightEdgeOverlay.className = 'pdfagogo-edge-overlay right';
    this.leftEdgeOverlay.setAttribute('aria-hidden', 'true');
    this.rightEdgeOverlay.setAttribute('aria-hidden', 'true');
    this.app.appendChild(this.leftEdgeOverlay);
    this.app.appendChild(this.rightEdgeOverlay);

    // Route wheel events on the overlays to the window so the whole page scrolls
    const wheelToWindow = (e) => {
      // Allow zoom gestures to be handled elsewhere
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      // Use deltaY directly for natural scrolling
      window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' });
    };
    this.leftEdgeOverlay.addEventListener('wheel', wheelToWindow, { passive: false });
    this.rightEdgeOverlay.addEventListener('wheel', wheelToWindow, { passive: false });

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

    // Zoom functionality
    /** @type {number} Current zoom level (1.0 = 100%) */
    this.zoomLevel = 1.0;

    /** @type {number} Minimum zoom level */
    this.minZoom = 0.25;

    /** @type {number} Maximum zoom level */
    this.maxZoom = 5.0;

    /** @type {number} Zoom increment for keyboard shortcuts */
    this.zoomStep = 0.1;

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
    this._setupZoomHandlers();

    // Memory management event handlers
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Use normal cleanup that respects buffer for all document sizes
        this._cleanupOffscreenPages(false);
      }
    });

    // Handle memory pressure events (if supported by browser)
    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', () => {
        // On memory pressure, force cleanup for all document sizes
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

    if (this.debug) {
      console.log(`[PDF-A-go-go Debug] Creating ${this.pageCount} page placeholders...`);
    }

    // Use adaptive batching for all documents - scales naturally with document size
    const batchSize = Math.max(10, Math.min(50, Math.ceil(this.pageCount / 10)));
    const totalBatches = Math.ceil(this.pageCount / batchSize);

    for (let batch = 0; batch < totalBatches; batch++) {
      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, this.pageCount);

      if (this.debug) {
        console.log(`[PDF-A-go-go Debug] Creating batch ${batch + 1}/${totalBatches}: pages ${startIdx + 1}-${endIdx} (batch size: ${batchSize})`);
      }

      for (let i = startIdx; i < endIdx; i++) {
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

      // Yield control back to browser between batches (except last batch)
      if (batch < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (this.debug) {
      console.log(`[PDF-A-go-go Debug] Created ${Object.keys(this.pageCanvases).length} page canvases`);
    }

    // Wait for all page dimensions to be calculated
    await Promise.all(pageSetupPromises);

    // Get typical page dimensions from the first page for accurate placeholder sizing
    await this._calculatePlaceholderDimensions();

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

    // Calculate optimal scale for high-quality rendering
    const devicePixelRatio = window.devicePixelRatio || 1;
    const targetWidth = this._getPageWidth();

    // Much more aggressive scaling for desktop displays
    let baseScale;
    if (this.isMobile) {
      // Mobile: conservative scaling to preserve performance
      baseScale = Math.max(2.0, devicePixelRatio * 1.5);
    } else {
      // Desktop: aggressive scaling for crisp text and graphics
      baseScale = Math.max(3.0, devicePixelRatio * 2.0);
    }

    // Scale up significantly for larger page widths
    // Target 3-4+ pixels per CSS pixel for excellent desktop quality
    const sizeMultiplier = Math.max(1.5, Math.min(3.5, targetWidth / 300));

    let scale = this.options.scale || (baseScale * sizeMultiplier);

    // Safety check: cap maximum canvas dimensions to prevent memory issues
    // while still allowing very high quality
    const maxCanvasWidth = 4096; // Maximum reasonable canvas width
    if (targetWidth * scale > maxCanvasWidth) {
      const oldScale = scale;
      scale = maxCanvasWidth / targetWidth;
      if (this.debug) {
        console.log(
          `%c⚠️ Scale capped from ${oldScale.toFixed(2)}x to ${scale.toFixed(2)}x to prevent excessive canvas size`,
          'color: #FF9800;'
        );
      }
    }

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

      // Use width-based sizing for better legibility
      const targetWidth = this._getPageWidth();
      const aspect = pg.width / pg.height;
      const height = targetWidth / aspect;

      // Set canvas dimensions and styles in one go
      const wrapper = canvas.parentElement;
      wrapper.style.width = targetWidth + "px";
      wrapper.style.height = height + "px";
      canvas.style.width = targetWidth + "px";
      canvas.style.height = height + "px";
      canvas.width = targetWidth * scale;
      canvas.height = height * scale;

      // Render directly to the canvas with optimal quality settings
      const ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: true,
        desynchronized: false // Ensure consistent rendering
      });

      // Configure context for high-quality rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Additional high-quality rendering settings
      ctx.textRenderingOptimization = 'optimizeQuality';
      ctx.font = 'inherit'; // Ensure proper font inheritance

      // Enable font smoothing for better text clarity
      if (ctx.fontKerning !== undefined) {
        ctx.fontKerning = 'normal';
      }
      if (ctx.textRendering !== undefined) {
        ctx.textRendering = 'optimizeLegibility';
      }

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
        console.log(`%c   Source: ${pg.width}×${pg.height} (PDF scale: ${scale.toFixed(2)}x)`, 'color: #9C27B0;');
        console.log(`%c   Canvas: ${canvas.width}×${canvas.height} (display scale: ${scale.toFixed(2)}x, DPR: ${devicePixelRatio})`, 'color: #2196F3;');
      }

      if (callback) callback();
    }, highlights, scale);
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

    const wrappers = this.pagesContainer.querySelectorAll('.pdfagogo-page-wrapper');


    wrappers.forEach((wrapper, index) => {
      const pageNum = parseInt(wrapper.querySelector('canvas')?.getAttribute('data-page'), 10);
      if (isNaN(pageNum) || pageNum < 1) return;

      const rect = wrapper.getBoundingClientRect();
      const isVisible = rect.bottom > extendedTop && rect.top < extendedBottom;



      if (isVisible) {
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
    if (maxVisiblePage !== null && maxVisibleRatio > 0.25) {
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

    // Adaptive buffer size - scales naturally with document size and device
    const baseBuffer = this.isMobile ? 2 : 4;
    const scalingFactor = Math.ceil(this.pageCount / 100);
    const buffer = Math.max(baseBuffer, Math.min(baseBuffer * scalingFactor, this.isMobile ? 10 : 20));

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

    await Promise.all(resizePromises);

    // Clear the render queue
    this.renderQueue.clear();

    // Update visible pages and re-render them
    await this._updateVisiblePages();
    const visiblePages = Array.from(this._visiblePages);

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

      // Update visible pages immediately for responsive feedback
      this._updateVisiblePages();

      // Also set a timeout for cleanup and memory management
      // Scale cleanup delay naturally with document size to reduce churn
      const cleanupDelay = Math.min(1000, 150 + Math.ceil(this.pageCount / 10));

      scrollTimeout = setTimeout(() => {
        this._updateVisiblePages();
        this._cleanupOffscreenPages();
        scrollTimeout = null;
      }, cleanupDelay);
    });
  }

  /**
   * Calculate and set proper dimensions for all placeholder pages.
   * This ensures the scroll container has accurate total height from the start.
   */
  async _calculatePlaceholderDimensions() {
    return new Promise((resolve) => {
      // Get first page to calculate typical aspect ratio
      this.book.getPage(0, (err, firstPage) => {
        if (err) {
          console.warn('Could not get first page for dimension calculation:', err);
          resolve();
          return;
        }

        // Calculate target width more reliably during initialization
        const containerWidth = this.scrollContainer.clientWidth || this.scrollContainer.offsetWidth || 800;
        const targetWidth = this.isMobile ? containerWidth * 0.95 : containerWidth * 0.90;

        const aspectRatio = firstPage.width / firstPage.height;
        const expectedHeight = targetWidth / aspectRatio;

        if (this.debug) {
          console.log(`[PDF-A-go-go Debug] Container width: ${containerWidth}px, Target width: ${targetWidth}px, Expected height: ${expectedHeight}px (aspect: ${aspectRatio.toFixed(2)})`);
        }

        // Apply calculated dimensions to all placeholder pages
        Object.keys(this.pageCanvases).forEach(pageIndex => {
          const canvas = this.pageCanvases[pageIndex];
          const wrapper = canvas.parentElement;

          if (canvas.getAttribute('data-resolution') === 'placeholder') {
            wrapper.style.width = targetWidth + 'px';
            wrapper.style.height = expectedHeight + 'px';
            canvas.style.width = targetWidth + 'px';
            canvas.style.height = expectedHeight + 'px';

            // Set small canvas size for placeholder to save memory
            canvas.width = 32;
            canvas.height = 32;
          }
        });

        resolve();
      });
    });
  }

  /**
   * Calculate the target width for PDF pages based on container width.
   * Uses 90% of container width for better legibility, with responsive breakpoints.
   * @returns {number} Target page width in pixels
   */
  _getPageWidth() {
    // Try to get the width of an already rendered page first
    let pageIdx = 1;
    if (this.pageCount < 2) pageIdx = 0;
    const canvas = this.pageCanvases[pageIdx];
    if (canvas && canvas.clientWidth && canvas.clientWidth > 32) {
      return canvas.clientWidth;
    }

    // Calculate based on container width (use same logic as placeholder calculation)
    const containerWidth = this.scrollContainer.clientWidth || this.scrollContainer.offsetWidth || 800;

    // Use different percentages based on screen size for optimal legibility
    if (this.isMobile) {
      return containerWidth * 0.95; // 95% on mobile for better use of limited space
    } else {
      return containerWidth * 0.90; // 90% on desktop as planned
    }
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

  /**
   * Set up zoom event handlers for pinch gestures and keyboard shortcuts.
   * @private
   */
  _setupZoomHandlers() {
    // Make the container focusable for proper zoom control
    if (!this.app.hasAttribute('tabindex')) {
      this.app.setAttribute('tabindex', '0');
    }

    // Keyboard zoom handlers (Ctrl + Plus/Minus) - only when PDF container is focused
    this.app.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey)) {
        switch (e.key) {
          case '+':
          case '=':
            e.preventDefault();
            this.zoomIn();
            break;
          case '-':
            e.preventDefault();
            this.zoomOut();
            break;
          case '0':
            e.preventDefault();
            this.resetZoom();
            break;
        }
      }
    });

    // Touch handlers for pinch zoom
    let lastTouchDistance = 0;
    let isPinching = false;

    this.scrollContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        lastTouchDistance = this._getTouchDistance(e.touches[0], e.touches[1]);
        e.preventDefault();
      }
    }, { passive: false });

    this.scrollContainer.addEventListener('touchmove', (e) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = this._getTouchDistance(e.touches[0], e.touches[1]);
        const distanceChange = currentDistance - lastTouchDistance;

        // Apply zoom based on distance change
        const zoomChange = distanceChange * 0.01; // Sensitivity factor
        this.setZoom(this.zoomLevel + zoomChange);

        lastTouchDistance = currentDistance;
      }
    }, { passive: false });

    this.scrollContainer.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
    });

    // Mouse wheel zoom with Ctrl held
    this.scrollContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        const zoomChange = delta > 0 ? -this.zoomStep : this.zoomStep;
        this.setZoom(this.zoomLevel + zoomChange);
      }
    }, { passive: false });
  }

  /**
   * Calculate distance between two touch points.
   * @param {Touch} touch1 - First touch point
   * @param {Touch} touch2 - Second touch point
   * @returns {number} Distance between touch points
   * @private
   */
  _getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Set the zoom level to a specific value.
   * @param {number} zoom - Target zoom level (1.0 = 100%)
   * @param {boolean} [animate=true] - Whether to animate the zoom change
   */
  setZoom(zoom, animate = true) {
    // Clamp zoom level to valid range
    zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));

    if (zoom === this.zoomLevel) return;

    this.zoomLevel = zoom;

    // Apply transform to pages container
    const transform = `scale(${zoom})`;
    this.pagesContainer.style.transform = transform;
    this.pagesContainer.style.transformOrigin = 'center top';

    if (animate) {
      this.pagesContainer.style.transition = 'transform 0.2s ease-out';
      setTimeout(() => {
        this.pagesContainer.style.transition = '';
      }, 200);
    }

    // Emit zoom change event
    this.emit('zoom', {
      level: this.zoomLevel,
      percentage: Math.round(this.zoomLevel * 100)
    });

    if (this.debug) {
      console.log(`[PDF-A-go-go Debug] Zoom level: ${(this.zoomLevel * 100).toFixed(0)}%`);
    }
  }

  /**
   * Zoom in by one step.
   */
  zoomIn() {
    this.setZoom(this.zoomLevel + this.zoomStep);
  }

  /**
   * Zoom out by one step.
   */
  zoomOut() {
    this.setZoom(this.zoomLevel - this.zoomStep);
  }

  /**
   * Reset zoom to 100%.
   */
  resetZoom() {
    this.setZoom(1.0);
  }

  /**
   * Get the current zoom level.
   * @returns {number} Current zoom level (1.0 = 100%)
   */
  getZoom() {
    return this.zoomLevel;
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
    // Get the actual height of a rendered page wrapper, or estimate based on our width calculation
    const firstPageWrapper = this.pageCanvases[0]?.parentElement;
    let pageHeight;

    if (firstPageWrapper && firstPageWrapper.style.height) {
      // Use actual rendered page height if available
      pageHeight = parseInt(firstPageWrapper.style.height) + 48; // 48px for margins (1.5rem * 2 + extra)
    } else {
      // Fallback: estimate based on typical PDF aspect ratio
      const targetWidth = this._getPageWidth();
      const estimatedHeight = targetWidth / 0.77; // Typical letter size aspect ratio
      pageHeight = estimatedHeight + 48;
    }

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
