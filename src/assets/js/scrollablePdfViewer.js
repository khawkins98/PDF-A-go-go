/**
 * @file Scrollable PDF Viewer: Core rendering and interaction engine for PDF-A-go-go.
 *
 * This module provides the main ScrollablePdfViewer class that handles:
 * - PDF page rendering with tile-based render queue management
 * - Zoom-aware rendering with multiple resolution tiers
 * - Memory management and performance optimization
 * - User interaction (scrolling, navigation, touch/mouse events)
 * - Accessibility features and keyboard navigation
 * - Performance monitoring and debug capabilities
 * - Mobile and desktop optimization
 *
 * The viewer uses a tile-based rendering system that:
 * - Divides pages into fixed-size tiles for efficient memory usage
 * - Renders tiles at resolution appropriate for current zoom level
 * - Caches tiles with LRU eviction for smooth zooming
 * - Supports progressive loading with fallback to lower-res tiles
 *
 * @author PDF-A-go-go Contributors
 * @version 2.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

import EventEmitter from "events";
import { TileRenderer } from "./tileRenderer.js";
import { getTierForZoom } from "./tileManager.js";

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

    /** @type {Object<number, HTMLDivElement>} Cache of text layer elements */
    this.textLayers = {};

    /** @type {Array<number>} LRU tracking for text layers (page indices, oldest first) */
    this.textLayerOrder = [];

    /** @type {number} Maximum number of text layers to keep (configurable) */
    this.maxTextLayers = options.textLayerCacheSize || (this.isMobile ? 5 : 10);

    /** @type {RenderQueue} Queue for managing rendering tasks (legacy, used as fallback) */
    this.renderQueue = new RenderQueue();

    /** @type {Object|null} Raw PDF.js document for tile rendering */
    this.pdfDocument = options.pdfDocument || null;

    /** @type {TileRenderer|null} Tile-based renderer instance */
    this.tileRenderer = null;

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

    // Ensure the right overlay never overlaps the vertical scrollbar area
    this._updateOverlayPositions();

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

    /** @type {Set<number>} Set of currently visible page numbers (1-based) */
    this._visiblePages = new Set();

    /** @type {Map<number, number>} Map of page number (1-based) to intersection ratio */
    this._pageVisibilityRatios = new Map();

    /** @type {IntersectionObserver|null} Observer for page visibility detection */
    this._visibilityObserver = null;

    // Zoom functionality
    /** @type {number} Current zoom level (1.0 = 100%) */
    this.zoomLevel = 1.0;

    /** @type {number} Minimum zoom level */
    this.minZoom = 0.25;

    /** @type {number} Maximum zoom level */
    this.maxZoom = 5.0;

    /** @type {number} Zoom increment for keyboard shortcuts */
    this.zoomStep = 0.1;

    // Initialize tile renderer (requires pdfDocument to be passed in options)
    if (this.pdfDocument) {
      this.tileRenderer = new TileRenderer({
        book: this.book,
        pdfDocument: this.pdfDocument,
        pageCount: this.pageCount,
        debug: this.debug,
        isMobile: this.isMobile,
        tileSize: this.isMobile ? 256 : 512,
        maxFullPageCacheSize: options.fullpageCacheSize,
      });

      // Set up tile renderer callbacks
      this.tileRenderer.onTileProgress = (pageIndex, tileX, tileY, tier) => {
        if (this.debug) {
          console.log(`[PDF-A-go-go] Tile ready: page ${pageIndex}, tile (${tileX},${tileY}), tier ${tier}`);
        }
      };

      if (this.debug) {
        console.log('[PDF-A-go-go] Tile-based rendering enabled');
      }
    }

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

        // Create text layer for text selection
        const textLayer = document.createElement("div");
        textLayer.className = "pdfagogo-text-layer";
        textLayer.setAttribute("data-page", i + 1);

        wrapper.appendChild(canvas);
        wrapper.appendChild(textLayer);
        this.pageCanvases[i] = canvas;
        this.textLayers[i] = textLayer;
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

    // Second pass: Determine visible pages synchronously and start observer
    this._getVisiblePagesSync();
    this._setupVisibilityObserver();

    // Queue renders for the initially visible pages
    for (const pageNum of this._visiblePages) {
      this.renderQueue.add(() => this._renderPage(pageNum - 1));
    }

    // Emit initialRenderComplete event
    // After layout is established, recalculate overlay positions in case scrollbars appeared
    this._updateOverlayPositions();
    this.emit('initialRenderComplete');

    if (this.debug) {
      this.metrics.initialRenderEnd = performance.now();
      console.log(`[PDF-A-go-go Debug] Initial render complete in ${this.metrics.initialRenderEnd - this.metrics.initialRenderStart}ms`);
    }
  }

  /**
   * Render a page using either tile-based or legacy rendering.
   *
   * @param {number} ndx - Page index (0-based)
   * @param {Function} [callback] - Optional callback when rendering completes
   */
  _renderPage(ndx, callback = null) {
    const canvas = this.pageCanvases[ndx];
    if (!canvas) return;

    // Use tile-based rendering
    this._renderPageWithTiles(ndx, callback);
  }

  /**
   * Render a page using the tile-based rendering system.
   * This provides zoom-aware rendering with efficient memory usage.
   *
   * @param {number} ndx - Page index (0-based)
   * @param {Function} [callback] - Optional callback when rendering completes
   * @private
   */
  async _renderPageWithTiles(ndx, callback = null) {
    const canvas = this.pageCanvases[ndx];
    if (!canvas) {
      if (callback) callback();
      return;
    }

    const startTime = this.debug ? performance.now() : 0;

    try {
      // Get target dimensions
      const targetWidth = this._getPageWidth();

      // Initialize page in tile renderer if not already done
      if (!this.tileRenderer.pageMetadata.has(ndx)) {
        await new Promise((resolve, reject) => {
          this.book.getPage(ndx, (err, pg) => {
            if (err) {
              reject(err);
              return;
            }

            const aspect = pg.width / pg.height;
            const height = targetWidth / aspect;

            // Set wrapper and canvas CSS dimensions
            const wrapper = canvas.parentElement;
            wrapper.style.width = targetWidth + "px";
            wrapper.style.height = height + "px";
            canvas.style.width = targetWidth + "px";
            canvas.style.height = height + "px";

            // Initialize page in tile renderer
            this.tileRenderer.initializePage(ndx, targetWidth, height).then(() => {
              // Set the display canvas
              this.tileRenderer.setDisplayCanvas(ndx, canvas);

              // Render text layer
              this._renderTextLayer(ndx, pg, targetWidth, height);

              resolve();
            }).catch(reject);
          });
        });
      }

      // Trigger tile rendering for this page (immediate for initial render)
      this.tileRenderer.renderVisiblePages(new Set([ndx + 1]), {}, true);

      if (this.debug) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        this.metrics.highResUpgradeTimes[ndx] = duration;
        this.metrics.totalHighResUpgrades++;
        this._updateDebugInfo();

        const { tier, scale } = getTierForZoom(this.zoomLevel);
        console.log(`%c🎨 Tile render initiated for page ${ndx + 1} (tier ${tier}, scale ${scale}x)`,
          'color: #4CAF50; font-weight: bold;');
      }

      // Mark canvas as rendered
      canvas.setAttribute('data-resolution', 'tiles');

      if (callback) callback();
    } catch (error) {
      console.error(`[PDF-A-go-go] Failed to render page ${ndx + 1}:`, error);
      if (callback) callback();
    }
  }

  /**
   * Render text layer for a page to enable text selection and copy.
   * Implements LRU eviction when the text layer cache exceeds maxTextLayers.
   * @param {number} ndx - Page index (0-based)
   * @param {Object} pg - Page object with getTextContent and getViewport methods
   * @param {number} displayWidth - Display width in CSS pixels
   * @param {number} displayHeight - Display height in CSS pixels
   */
  async _renderTextLayer(ndx, pg, displayWidth, displayHeight) {
    const textLayer = this.textLayers[ndx];
    if (!textLayer || !pg.getTextContent) return;

    // Evict old text layers before rendering a new one
    this._enforceTextLayerLimit(ndx);

    // Update LRU order
    this._updateTextLayerLRU(ndx);

    // Clear existing text content
    textLayer.innerHTML = '';

    try {
      const textContent = await pg.getTextContent();
      if (!textContent || !textContent.items || textContent.items.length === 0) return;

      // Get viewport for coordinate transformation
      const viewport = pg.getViewport({ scale: 1 });
      const scaleX = displayWidth / viewport.width;
      const scaleY = displayHeight / viewport.height;

      // Create spans for each text item
      for (const item of textContent.items) {
        if (!item.str || item.str.trim() === '') continue;

        const span = document.createElement('span');
        span.textContent = item.str;

        // Calculate position from transform matrix
        // PDF.js transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
        const tx = item.transform[4];
        const ty = item.transform[5];
        const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);

        // Convert PDF coordinates to display coordinates
        // PDF origin is bottom-left, we need top-left
        const left = tx * scaleX;
        const top = (viewport.height - ty) * scaleY - (fontSize * scaleY);

        span.style.left = `${left}px`;
        span.style.top = `${top}px`;
        span.style.fontSize = `${fontSize * scaleY}px`;

        // Handle text direction and width
        if (item.width) {
          span.style.width = `${item.width * scaleX}px`;
        }

        textLayer.appendChild(span);
      }
    } catch (err) {
      if (this.debug) {
        console.warn(`[PDF-A-go-go] Failed to render text layer for page ${ndx + 1}:`, err);
      }
    }
  }

  /**
   * Update LRU order for a text layer (move to end = most recently used).
   * @param {number} ndx - Page index (0-based)
   * @private
   */
  _updateTextLayerLRU(ndx) {
    const idx = this.textLayerOrder.indexOf(ndx);
    if (idx !== -1) {
      this.textLayerOrder.splice(idx, 1);
    }
    this.textLayerOrder.push(ndx);
  }

  /**
   * Enforce the text layer cache size limit using LRU eviction.
   * Clears content of oldest text layers until cache is within limit.
   * @param {number} [currentPage] - Current page being rendered (exempt from eviction)
   * @private
   */
  _enforceTextLayerLimit(currentPage) {
    // Count populated text layers (those with content)
    const populatedLayers = this.textLayerOrder.filter(ndx => {
      const layer = this.textLayers[ndx];
      return layer && layer.innerHTML.length > 0;
    });

    // Guard: need at least 2 items to avoid infinite loop when only currentPage remains
    while (populatedLayers.length >= this.maxTextLayers && this.textLayerOrder.length > 1) {
      // Get oldest layer
      const oldestIdx = this.textLayerOrder.shift();

      // Don't evict the current page being rendered
      if (oldestIdx === currentPage) {
        this.textLayerOrder.push(oldestIdx);
        continue;
      }

      // Clear the text layer content (but keep the DOM element)
      const oldLayer = this.textLayers[oldestIdx];
      if (oldLayer && oldLayer.innerHTML.length > 0) {
        oldLayer.innerHTML = '';
        // Remove from populated count
        const popIdx = populatedLayers.indexOf(oldestIdx);
        if (popIdx !== -1) {
          populatedLayers.splice(popIdx, 1);
        }

        if (this.debug) {
          console.log(`[PDF-A-go-go] Evicted text layer for page ${oldestIdx + 1} (active: ${populatedLayers.length})`);
        }
      }
    }
  }

  /**
   * Set up an IntersectionObserver to track which pages are visible.
   * Replaces the old scroll-based getBoundingClientRect() approach to
   * avoid layout thrashing on every scroll frame.
   * @private
   */
  _setupVisibilityObserver() {
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect();
    }

    this._visibilityObserver = new IntersectionObserver(
      (entries) => this._handleVisibilityChanges(entries),
      {
        root: this.scrollContainer,
        // Match existing 50% pre-render buffer above and below
        rootMargin: '50% 0px',
        // Fire at 0% (enters/exits) and 25% (most-visible threshold)
        threshold: [0, 0.25, 0.5, 0.75]
      }
    );

    this.pagesContainer.querySelectorAll('.pdfagogo-page-wrapper').forEach(wrapper => {
      this._visibilityObserver.observe(wrapper);
    });
  }

  /**
   * Handle IntersectionObserver callbacks to maintain visible page state.
   * @param {IntersectionObserverEntry[]} entries
   * @private
   */
  _handleVisibilityChanges(entries) {
    let changed = false;

    for (const entry of entries) {
      const canvas = entry.target.querySelector('canvas');
      const pageNum = parseInt(canvas?.getAttribute('data-page'), 10);
      if (isNaN(pageNum) || pageNum < 1) continue;

      if (entry.isIntersecting) {
        if (!this._visiblePages.has(pageNum)) {
          this._visiblePages.add(pageNum);
          changed = true;
        }
        this._pageVisibilityRatios.set(pageNum, entry.intersectionRatio);
      } else {
        if (this._visiblePages.delete(pageNum)) {
          changed = true;
        }
        this._pageVisibilityRatios.delete(pageNum);
      }
    }

    this._updateMostVisiblePage();

    if (changed) {
      this.emit("visiblePages", Array.from(this._visiblePages));

      // Queue renders for newly visible pages
      for (const pageNum of this._visiblePages) {
        this.renderQueue.add(() => this._renderPage(pageNum - 1));
      }
    }
  }

  /**
   * Determine the most visible page from stored intersection ratios
   * and update currentPage / emit "seen" event accordingly.
   * @private
   */
  _updateMostVisiblePage() {
    let maxRatio = 0;
    let maxPage = null;

    for (const [pageNum, ratio] of this._pageVisibilityRatios) {
      if (ratio > maxRatio) {
        maxRatio = ratio;
        maxPage = pageNum;
      }
    }

    if (maxPage !== null && maxRatio > 0.25) {
      const newPage = maxPage - 1;
      if (this.currentPage !== newPage) {
        this.currentPage = newPage;
        this.emit("seen", maxPage);
      }
    }
  }

  /**
   * Synchronously determine visible pages using getBoundingClientRect.
   * Used only once during initial render before the IntersectionObserver
   * has had a chance to fire its first callback.
   * @private
   */
  _getVisiblePagesSync() {
    const containerRect = this.scrollContainer.getBoundingClientRect();
    const extendedTop = containerRect.top - containerRect.height * 0.5;
    const extendedBottom = containerRect.bottom + containerRect.height * 0.5;

    this.pagesContainer.querySelectorAll('.pdfagogo-page-wrapper').forEach(wrapper => {
      const canvas = wrapper.querySelector('canvas');
      const pageNum = parseInt(canvas?.getAttribute('data-page'), 10);
      if (isNaN(pageNum) || pageNum < 1) return;

      const rect = wrapper.getBoundingClientRect();
      if (rect.bottom > extendedTop && rect.top < extendedBottom) {
        this._visiblePages.add(pageNum);
        const visibleHeight = Math.min(rect.bottom, containerRect.bottom) -
                              Math.max(rect.top, containerRect.top);
        this._pageVisibilityRatios.set(pageNum, visibleHeight / rect.height);
      }
    });

    this._updateMostVisiblePage();
  }

  /**
   * Disconnect and re-create the visibility observer.
   * Called after resize when the observer's root element dimensions have changed.
   * @private
   */
  _refreshVisibilityObserver() {
    this._visibilityObserver?.disconnect();
    this._setupVisibilityObserver();
  }

  _cleanupOffscreenPages(force = false) {
    if (this.debug) console.log('[PDF-A-go-go Debug] Running memory cleanup');

    const visiblePages = Array.from(this._visiblePages);
    if (visiblePages.length === 0) return;

    const start = Math.min(...visiblePages);
    const end = Math.max(...visiblePages);

    // Use tile renderer cleanup
    if (this.tileRenderer) {
      const currentPage = Math.floor((start + end) / 2) - 1; // 0-based
      this.tileRenderer.cleanup(currentPage, this.isMobile ? 2 : 3);

      if (this.debug) {
        const stats = this.tileRenderer.getStats();
        console.log(`[PDF-A-go-go Debug] Tile cache: ${stats.cacheSize} tiles, ${stats.pendingCount} pending`);
      }
      return;
    }

    // Legacy cleanup path
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

          // Clear corresponding text layer
          const textLayer = this.textLayers[pageNum];
          if (textLayer) {
            textLayer.innerHTML = '';
          }

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
        // Recalculate overlay positions after layout changes
        this._updateOverlayPositions();
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

    // Reconnect visibility observer (rootMargin may need recalc)
    this._refreshVisibilityObserver();
  }

  _setupScrollHandler() {
    let scrollTimeout;

    this.scrollContainer.addEventListener("scroll", () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);

      // Visibility is tracked by IntersectionObserver — only schedule cleanup
      const cleanupDelay = Math.min(1000, 150 + Math.ceil(this.pageCount / 10));

      scrollTimeout = setTimeout(() => {
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

    // Mouse wheel zoom with Ctrl/Cmd held (primary handler on container)
    this.scrollContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        const zoomChange = delta > 0 ? -this.zoomStep : this.zoomStep;
        this.setZoom(this.zoomLevel + zoomChange);
      }
    }, { passive: false });

    // Fallback: If the viewer is focused, allow Ctrl/Cmd + wheel to zoom even if the pointer
    // is not currently over the scroll container (helps automated tests and usability).
    const isViewerFocused = () => {
      const active = document.activeElement;
      return active === this.app || (active && this.app.contains(active));
    };
    window.addEventListener('wheel', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (!isViewerFocused()) return;
      e.preventDefault();
      const delta = e.deltaY;
      const zoomChange = delta > 0 ? -this.zoomStep : this.zoomStep;
      this.setZoom(this.zoomLevel + zoomChange);
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
   *
   * With tile-based rendering, this method:
   * 1. Applies immediate CSS transform for visual feedback
   * 2. Triggers re-rendering at appropriate resolution tier after debounce
   *
   * @param {number} zoom - Target zoom level (1.0 = 100%)
   * @param {boolean} [animate=true] - Whether to animate the zoom change
   */
  setZoom(zoom, animate = true) {
    // Clamp zoom level to valid range
    zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));

    if (zoom === this.zoomLevel) return;

    const oldZoom = this.zoomLevel;
    this.zoomLevel = zoom;

    // Apply transform to pages container for immediate visual feedback
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
      const { tier: oldTier } = getTierForZoom(oldZoom);
      const { tier: newTier, scale } = getTierForZoom(zoom);
      console.log(`[PDF-A-go-go Debug] Zoom: ${(oldZoom * 100).toFixed(0)}% -> ${(zoom * 100).toFixed(0)}% (tier ${oldTier} -> ${newTier}, render scale ${scale}x)`);
    }

    // Update tile renderer with new zoom level (debounced internally)
    if (this.tileRenderer) {
      this.tileRenderer.setZoom(zoom, this._visiblePages);
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

  /**
   * Set the PDF.js document for tile-based rendering.
   * Note: For best results, pass pdfDocument in the options during construction.
   * This method is kept for backward compatibility.
   *
   * @param {Object} pdfDocument - The PDF.js document object
   * @deprecated Pass pdfDocument in constructor options instead
   */
  setPdfDocument(pdfDocument) {
    if (this.pdfDocument === pdfDocument) return;

    this.pdfDocument = pdfDocument;

    // Update tile renderer if it exists
    if (this.tileRenderer) {
      this.tileRenderer.pdfDocument = pdfDocument;

      if (this.debug) {
        console.log('[PDF-A-go-go] PDF document updated for tile rendering');
      }
    }
  }



  rerenderPage(ndx) {
    const canvas = this.pageCanvases[ndx];
    if (!canvas) return;

    // Clear both full page cache AND tile cache to force re-render with updated highlights
    if (this.tileRenderer && this.tileRenderer.tileManager) {
      this.tileRenderer.tileManager.clearFullPageCache(ndx);
      this.tileRenderer.tileManager.cache.clearPage(ndx);
    }

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
      <div class="debug-header">PDF-A-go-go debug</div>
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

    // Scroll the internal container only, avoiding automatic window scroll on page load
    const containerRect = this.scrollContainer.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const currentScrollTop = this.scrollContainer.scrollTop;
    const targetTop = currentScrollTop + (wrapperRect.top - containerRect.top);
    this.scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' });

    // Update current page state immediately
    this.currentPage = pageNum;
    this.emit("seen", pageNum + 1); // Emit 1-based page number

    if (this.debug) {
      console.log(`[PDF-A-go-go Debug] Navigated to page ${pageNum + 1}`);
    }
  }

  // Navigate to a specific page (1-based page number)
  goToPage(pageNum) {
    this.go_to_page(pageNum - 1);
  }

  /**
   * Update overlay positions so the right overlay does not cover the scrollbar.
   * Calculates the native scrollbar width and offsets the right overlay by that amount.
   * Safe on platforms with overlay or zero-width scrollbars (offset = 0).
   * @private
   */
  _updateOverlayPositions() {
    try {
      if (!this.rightEdgeOverlay || !this.scrollContainer) return;
      const scrollbarWidth = Math.max(0, this.scrollContainer.offsetWidth - this.scrollContainer.clientWidth);
      this.rightEdgeOverlay.style.right = `${scrollbarWidth}px`;
    } catch (_) {
      // no-op: best-effort adjustment
    }
  }

  /**
   * Destroy the viewer and release all resources.
   * Should be called when the viewer is being removed from the DOM or the page is unloading.
   * This properly releases PDF.js resources including calling pdfDocument.destroy().
   */
  destroy() {
    if (this.debug) {
      console.log('[PDF-A-go-go] Destroying viewer...');
    }

    // Clear debug interval
    if (this._debugInterval) {
      clearInterval(this._debugInterval);
      this._debugInterval = null;
    }

    // Remove debug element
    if (this.debugElement && this.debugElement.parentNode) {
      this.debugElement.parentNode.removeChild(this.debugElement);
      this.debugElement = null;
    }

    // Clear render queue
    this.renderQueue.clear();

    // Destroy tile renderer (this will also destroy the PDF document)
    if (this.tileRenderer) {
      this.tileRenderer.destroy();
      this.tileRenderer = null;
    } else if (this.pdfDocument && typeof this.pdfDocument.destroy === 'function') {
      // If no tile renderer, still destroy the PDF document
      try {
        this.pdfDocument.destroy();
        if (this.debug) {
          console.log('[PDF-A-go-go] PDF document destroyed');
        }
      } catch (err) {
        if (this.debug) {
          console.warn('[PDF-A-go-go] pdfDocument.destroy() failed:', err);
        }
      }
    }
    this.pdfDocument = null;

    // Clean up DOM elements
    if (this.leftEdgeOverlay && this.leftEdgeOverlay.parentNode) {
      this.leftEdgeOverlay.parentNode.removeChild(this.leftEdgeOverlay);
    }
    if (this.rightEdgeOverlay && this.rightEdgeOverlay.parentNode) {
      this.rightEdgeOverlay.parentNode.removeChild(this.rightEdgeOverlay);
    }
    if (this.pagesContainer && this.pagesContainer.parentNode) {
      this.pagesContainer.parentNode.removeChild(this.pagesContainer);
    }
    if (this.scrollContainer && this.scrollContainer.parentNode) {
      this.scrollContainer.parentNode.removeChild(this.scrollContainer);
    }

    // Disconnect visibility observer
    if (this._visibilityObserver) {
      this._visibilityObserver.disconnect();
      this._visibilityObserver = null;
    }

    // Clear canvas and text layer references
    this.pageCanvases = {};
    this.textLayers = {};
    this.textLayerOrder = [];
    this._visiblePages.clear();
    this._pageVisibilityRatios.clear();

    // Clear metrics
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

    // Remove all event listeners by removing references
    this.removeAllListeners();

    // Clear remaining references
    this.book = null;
    this.app = null;
    this.scrollContainer = null;
    this.pagesContainer = null;
    this.leftEdgeOverlay = null;
    this.rightEdgeOverlay = null;

    if (this.debug) {
      console.log('[PDF-A-go-go] Viewer destroyed and all resources released');
    }
  }
}
