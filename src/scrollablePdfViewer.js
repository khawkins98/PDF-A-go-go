import EventEmitter from "events";

class RenderQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentTask = null;
  }

  add(task, priority = false) {
    if (priority) {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }

    if (!this.isProcessing) {
      this.process();
    }
  }

  clear() {
    this.queue = [];
    this.currentTask = null;
  }

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

export class ScrollablePdfViewer extends EventEmitter {
  constructor({ app, book, options }) {
    super();
    this.app = app;
    this.book = book;
    this.options = options || {};
    this.pageCount = book.numPages();
    this.currentPage = 0;
    this.pageCanvases = {};
    this.renderQueue = new RenderQueue();

    // Device detection
    this.isMobile = window.innerWidth <= 768;
    this.maxCachedPages = this.isMobile ? 3 : 5;
    this.visibleRange = this.isMobile ? 1 : 2; // Pages to render around current view

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

    this.debug = typeof this.options.debug === 'boolean' ? this.options.debug : false;
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

    this._visiblePages = new Set();

    this._setupEventHandlers();
    this._initializePages();
  }

  _setupEventHandlers() {
    this._setupResizeHandler();
    this._setupScrollHandler();
    this._setupGrabAndScroll();
    this._setupWheelScrollHandler();

    // Memory management
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._cleanupOffscreenPages(true);
      }
    });

    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', () => {
        this._cleanupOffscreenPages(true);
      });
    }
  }

  async _initializePages() {
    if (this.debug) {
      this.metrics.initialRenderStart = performance.now();
      console.log('[PDF-A-go-go Debug] Starting initial render');
    }

    // Create an off-screen container for initial setup
    const offscreenContainer = document.createElement('div');
    offscreenContainer.style.position = 'absolute';
    offscreenContainer.style.visibility = 'hidden';
    offscreenContainer.style.pointerEvents = 'none';
    offscreenContainer.style.left = '-9999px';
    offscreenContainer.style.top = '0';
    offscreenContainer.style.zIndex = '-1';
    offscreenContainer.className = 'pdfagogo-pages-container';
    offscreenContainer.style.display = 'flex';
    offscreenContainer.style.flexDirection = 'row';
    offscreenContainer.style.alignItems = 'center';
    offscreenContainer.style.minWidth = '100%';
    offscreenContainer.style.height = '100%';
    this.app.appendChild(offscreenContainer);

    // First pass: Create placeholder canvases for all pages
    const pageSetupPromises = [];
    for (let i = 0; i < this.pageCount; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdfagogo-page-wrapper';

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
    });
  }

  _updateVisiblePages() {
    console.log("Updating visible pages");
    const container = this.scrollContainer;
    const containerRect = container.getBoundingClientRect();
    const visiblePages = new Set();
    let maxVisiblePage = null;
    let maxVisibleRatio = 0;

    // Extend the visible area to include pages that are nearly visible
    const extendedLeft = containerRect.left - containerRect.width * 0.5;
    const extendedRight = containerRect.right + containerRect.width * 0.5;

    const wrappers = container.querySelectorAll('.pdfagogo-page-wrapper');
    wrappers.forEach(wrapper => {
      const pageNum = parseInt(wrapper.querySelector('canvas')?.getAttribute('data-page'), 10);
      if (!pageNum) return;

      const rect = wrapper.getBoundingClientRect();
      if (rect.right > extendedLeft && rect.left < extendedRight) {

        const visibleWidth = Math.min(rect.right, containerRect.right) -
                           Math.max(rect.left, containerRect.left);
        const percentVisible = visibleWidth / rect.width;
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

  _setupGrabAndScroll() {
    const container = this.scrollContainer;
    let isDown = false;
    let startX;
    let scrollLeft;
    let velocity = 0;
    let lastX;
    let lastTime;
    let animationFrame;
    let lastY = null;
    let startY = null;

    const momentum = typeof this.options.momentum === 'number' ? this.options.momentum : 1.5;

    container.style.cursor = 'grab';

    const onStart = (e) => {
      isDown = true;
      container.style.cursor = 'grabbing';
      container.classList.add('grabbing');

      startX = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
      scrollLeft = container.scrollLeft;
      lastX = startX;
      lastTime = Date.now();
      velocity = 0;

      // Initialize touch Y position on start
      if (e.type.startsWith('touch')) {
        startY = e.touches[0].pageY;
        lastY = startY;
      }

      // Cancel any ongoing animation
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };

    const onMove = (e) => {
      if (!isDown) return;
      e.preventDefault();

      const x = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
      const now = Date.now();
      const dt = now - lastTime;

      if (dt > 0) {
        const dx = x - lastX;
        velocity = dx / dt; // pixels per millisecond
        const walk = dx * momentum;
        container.scrollLeft = scrollLeft - walk;
        scrollLeft = container.scrollLeft;
        lastX = x;
        lastTime = now;
      }
    };

    const onEnd = () => {
      if (!isDown) return;
      isDown = false;
      container.style.cursor = 'grab';
      container.classList.remove('grabbing');

      // Apply inertia if velocity is significant
      if (Math.abs(velocity) > 0.2) {
        const startVelocity = velocity * momentum;
        const startTime = Date.now();
        const startScroll = container.scrollLeft;

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const deceleration = 0.001; // pixels per ms^2
          const remaining = startVelocity * Math.exp(-deceleration * elapsed);

          if (Math.abs(remaining) > 0.01 && elapsed < 500) {
            container.scrollLeft = startScroll - (startVelocity / deceleration) *
              (1 - Math.exp(-deceleration * elapsed));
            animationFrame = requestAnimationFrame(animate);
          }
        };
        animationFrame = requestAnimationFrame(animate);
      }
    };

    // Mouse events
    container.addEventListener('mousedown', onStart);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseup', onEnd);
    container.addEventListener('mouseleave', onEnd);

    // Touch events
    // container.addEventListener('touchstart', onStart, { passive: true });
    // container.addEventListener('touchmove', onMove, { passive: false });
    // container.addEventListener('touchend', onEnd);
    // container.addEventListener('touchcancel', onEnd);
  }

  _setupWheelScrollHandler() {
    let lastWheelTime = Date.now();
    let wheelVelocity = 0;
    let wheelAnimationFrame;
    const momentum = typeof this.options.momentum === 'number' ? this.options.momentum : 1.5;

    this.scrollContainer.addEventListener('wheel', (e) => {
      const now = Date.now();
      const dt = now - lastWheelTime;

      // Cancel any existing animation
      if (wheelAnimationFrame) {
        cancelAnimationFrame(wheelAnimationFrame);
        wheelAnimationFrame = null;
      }

      // Handle both vertical and horizontal scrolling
      let deltaX = e.deltaX;
      let deltaY = e.deltaY;

      // If shift is held, treat vertical scroll as horizontal
      if (e.shiftKey) {
        deltaX = deltaY;
        deltaY = 0;
      }

      // If it's primarily horizontal scrolling or touchpad gesture
      // if (Math.abs(deltaX) > Math.abs(deltaY) || e.deltaMode === 0) {

      // Only handle horizontal scrolling here - let vertical scroll pass through
      if (Math.abs(deltaX) > Math.abs(deltaY)) {

        e.preventDefault();

        // Calculate new velocity
        const delta = deltaX * momentum;
        wheelVelocity = dt > 0 ? delta / dt : 0;

        // Apply immediate scroll
        this.scrollContainer.scrollLeft += delta;

        // Apply momentum if the scroll was fast enough
        if (Math.abs(wheelVelocity) > 0.1) {
          const startVelocity = wheelVelocity;
          const startTime = now;
          const startScroll = this.scrollContainer.scrollLeft;

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const deceleration = 0.002; // pixels per ms^2
            const remaining = startVelocity * Math.exp(-deceleration * elapsed);

            if (Math.abs(remaining) > 0.01 && elapsed < 300) {
              this.scrollContainer.scrollLeft = startScroll +
                (startVelocity / deceleration) * (1 - Math.exp(-deceleration * elapsed));
              wheelAnimationFrame = requestAnimationFrame(animate);
            }
          };
          wheelAnimationFrame = requestAnimationFrame(animate);
        }
      }

      lastWheelTime = now;
    }, { passive: false });
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
    const pageWidth = this._getPageWidth() + 24;
    this.scrollContainer.scrollBy({
      left: pageWidth * pages,
      behavior: "smooth"
    });
  }

  // Change the view to show a specific page
  go_to_page(pageNum) {
    // Center the given page
    const wrapper = this.pageCanvases[pageNum]?.parentElement;
    if (!wrapper) return;

    const containerWidth = this.scrollContainer.clientWidth;
    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = this.scrollContainer.getBoundingClientRect();

    // Calculate scroll position to center the page
    const scrollLeft = wrapper.offsetLeft - (containerWidth - wrapperRect.width) / 2;

    this.scrollContainer.scrollTo({
      left: Math.max(0, scrollLeft),
      behavior: "smooth"
    });

    // Update current page immediately
    this.currentPage = pageNum;
    this.emit("seen", pageNum + 1); // Emit 1-based page number

    if (this.debug) {
      console.log(`[PDF-A-go-go Debug] Navigated to page ${pageNum + 1}`);
    }
  }
}
