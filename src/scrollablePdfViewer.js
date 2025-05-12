import EventEmitter from "events";

export class ScrollablePdfViewer extends EventEmitter {
  constructor({ app, book, options }) {
    super();
    this.app = app;
    this.book = book;
    this.options = options || {};
    this.pageCount = book.numPages();
    this.currentPage = 0;
    this.pageCanvases = {};
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "pdfagogo-scroll-container";
    this.app.appendChild(this.scrollContainer);

    /**
     * Debug mode for performance metrics
     * Set via options.debug (from data-debug attribute)
     */
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

    /**
     * Memory management configuration
     */
    this.isMobile = window.innerWidth <= 768;
    this.maxCachedPages = this.isMobile ? 3 : 5; // Fewer cached pages on mobile
    this.renderQueue = [];
    this.isRendering = false;
    this.cleanupInterval = this.isMobile ? 15000 : 30000; // More frequent cleanup on mobile

    /**
     * Configurable momentum for grab-and-scroll (default: 1)
     * Set via options.momentum (from data-momentum attribute)
     * Higher values = faster scrolling when dragging.
     */
    this.momentum = typeof this.options.momentum === 'number' ? this.options.momentum : 1.5;

    // Add visible pages indicator
    // this.visiblePagesIndicator = document.createElement("div");
    // this.visiblePagesIndicator.className = "pdfagogo-visible-pages-indicator";
    // this.visiblePagesIndicator.style.margin = "8px 0";
    // this.visiblePagesIndicator.style.fontSize = "16px";
    // this.visiblePagesIndicator.style.color = "#1976d2";
    // this.app.insertBefore(this.visiblePagesIndicator, this.scrollContainer);

    this._visiblePages = new Set();
    this.initialRenderComplete = false;

    this._setupResizeHandler();
    this._renderAllPages().then(() => {
      // After all pages are rendered in low-res, wait 200ms then upgrade visible pages
      setTimeout(() => {
        this.initialRenderComplete = true;
        this._upgradeVisiblePagesToHighRes();
        this.emit('initialRenderComplete');
      }, 200);
    });
    this._setupScrollHandler();
    this._intersectionObserver = this._createIntersectionObserver();
    this._observeAllPages();
    this._setupGrabAndScroll();
    this._setupWheelScrollHandler();

    // Set up periodic cleanup
    this._cleanupInterval = setInterval(() => this._cleanupOffscreenPages(), this.cleanupInterval);

    // Listen for visibility changes to manage memory
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._cleanupOffscreenPages(true); // Force cleanup when tab is hidden
      }
    });

    // Listen for memory pressure
    if ('onmemorypressure' in window) {
      window.addEventListener('memorypressure', () => {
        this._cleanupOffscreenPages(true);
      });
    }
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
        this._resizeAllPages();
        this._updateVisiblePages();
        resizeTimeout = null;
      }, 300);
    });
  }

  _setupScrollHandler() {
    let scrollTimeout;
    this.scrollContainer.addEventListener("scroll", () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      scrollTimeout = setTimeout(() => {
        this._updateVisiblePages();
        this._updateCurrentPage();
        scrollTimeout = null;
      }, 100);
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

  _createIntersectionObserver() {
    const container = document.querySelector('body');
    return new window.IntersectionObserver(
      (entries) => {
        // Update the set of visible pages
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.getAttribute('data-page'), 10);
          const canvas = this.pageCanvases[pageNum - 1];

          if (entry.isIntersecting) {
            this._visiblePages.add(pageNum);
            // Only upgrade to high-res if initial render is complete
            if (this.initialRenderComplete && canvas && canvas.getAttribute('data-resolution') !== 'high') {
              this._renderPageWithResolution(pageNum - 1, 'high');
            }
          } else {
            this._visiblePages.delete(pageNum);
            // Always downgrade to low-res when moving out of view
            if (canvas && canvas.getAttribute('data-resolution') !== 'low') {
              this._renderPageWithResolution(pageNum - 1, 'low');
            }
          }
        });

        // Emit visible pages
        const visiblePagesArr = Array.from(this._visiblePages).sort((a, b) => a - b);
        this.emit('visiblePages', visiblePagesArr);

        // Find most visible page for 'seen' event
        let maxRatio = -1;
        let mostVisiblePage = null;
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisiblePage = parseInt(entry.target.getAttribute('data-page'), 10);
          }
        });
        if (mostVisiblePage !== null) {
          this.emit('seen', mostVisiblePage);
        }
      },
      {
        root: container,
        threshold: 0.1,
        rootMargin: '100px 0px'
      }
    );
  }

  _observeAllPages() {
    if (!this._intersectionObserver) return;
    // Unobserve all first
    this._intersectionObserver.disconnect();
    for (let i = 0; i < this.pageCount; i++) {
      const canvas = this.pageCanvases[i];
      if (canvas) {
        this._intersectionObserver.observe(canvas);
      }
    }
  }

  _renderAllPages() {
    if (this.debug) {
      this.metrics.initialRenderStart = performance.now();
      console.log('[PDF-A-go-go Debug] Starting initial render of all pages');
    }

    // Remove any existing canvases
    this.scrollContainer.innerHTML = "";
    this.pageCanvases = {};

    // Create a promise for each page render
    const renderPromises = [];
    for (let i = 0; i < this.pageCount; i++) {
      const promise = new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.className = "pdfagogo-page-canvas";
        canvas.setAttribute("tabindex", "0");
        canvas.setAttribute("data-page", i + 1);
        canvas.setAttribute("data-resolution", "low");

        // Set initial geometry immediately
        this.book.getPage(i, (err, pg) => {
          if (err) {
            resolve();
            return;
          }
          const targetHeight = this._getPageHeight();
          const aspect = pg.width / pg.height;
          const width = targetHeight * aspect;

          // Set canvas style dimensions immediately
          canvas.style.height = targetHeight + "px";
          canvas.style.width = width + "px";

          // Now proceed with actual rendering
          const scale = 0.25; // Start with low resolution
          canvas.width = width * scale;
          canvas.height = targetHeight * scale;
          // renderPdfPageToCanvas(canvas, pg, targetHeight, scale);
          resolve();
        });

        this.pageCanvases[i] = canvas;
        this.scrollContainer.appendChild(canvas);
      });
      renderPromises.push(promise);
    }

    return Promise.all(renderPromises).then(() => {
      if (this.debug) {
        this.metrics.initialRenderEnd = performance.now();
        const duration = this.metrics.initialRenderEnd - this.metrics.initialRenderStart;
        console.log(`[PDF-A-go-go Debug] Initial render complete in ${duration.toFixed(2)}ms`);
      }
    });
  }

  _resizeAllPages() {
    this.initialRenderComplete = false;
    const renderPromises = [];

    // First render all pages in low res
    for (let i = 0; i < this.pageCount; i++) {
      const canvas = this.pageCanvases[i];
      if (canvas) {
        const p = new Promise((resolve) => {
          this._renderPageWithResolution(i, 'low', resolve);
        });
        renderPromises.push(p);
      }
    }

    // After all pages are rendered in low res, upgrade visible pages
    Promise.all(renderPromises).then(() => {
      setTimeout(() => {
        this.initialRenderComplete = true;
        this._upgradeVisiblePagesToHighRes();
      }, 200);
    });

    if (this._intersectionObserver) {
      this._observeAllPages();
    }

    return Promise.all(renderPromises);
  }

  _renderPageWithResolution(ndx, resolution, callback = null) {
    const startTime = this.debug ? performance.now() : 0;
    const canvas = this.pageCanvases[ndx];
    if (!canvas) return;

    // Adjust scale based on device pixel ratio and screen size
    const baseScale = resolution === 'high' ? (this.options.scale || 1.8) : 0.25;
    const isMobile = window.innerWidth <= 768;
    const scale = isMobile ? baseScale * 0.75 : baseScale; // Reduce scale on mobile
    
    const highlights = window.__pdfagogo__highlights ? window.__pdfagogo__highlights[ndx] : undefined;

    this.book.getPage(ndx, (err, pg) => {
      if (err) {
        if (callback) callback();
        return;
      }
      const targetHeight = this._getPageHeight();
      const aspect = pg.width / pg.height;
      const width = targetHeight * aspect;

      // Canvas style dimensions should already be set, but ensure they are correct
      canvas.style.height = targetHeight + "px";
      canvas.style.width = width + "px";
      canvas.width = width * scale;
      canvas.height = targetHeight * scale;

      // Use lower quality settings on mobile for better performance
      const ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: false
      });
      
      if (isMobile) {
        ctx.imageSmoothingQuality = 'low';
      }

      // Clear canvas before drawing
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw the page
      if (pg.img) {
        ctx.drawImage(pg.img, 0, 0, canvas.width, canvas.height);
      }

      // Draw highlights if present
      if (Array.isArray(highlights) && highlights.length > 0) {
        ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
        highlights.forEach((h) => {
          ctx.fillRect(
            h.x * canvas.width,
            h.y * canvas.height,
            h.w * canvas.width,
            h.h * canvas.height
          );
        });
      }

      if (this.debug) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        if (resolution === 'high') {
          this.metrics.highResUpgradeTimes[ndx] = duration;
          this.metrics.totalHighResUpgrades++;
        } else {
          this.metrics.pageRenderTimes[ndx] = duration;
          this.metrics.totalPagesRendered++;
        }
        this._updateDebugInfo(); // Update immediately after render
      }

      canvas.setAttribute('data-resolution', resolution);
      if (callback) callback();
    }, highlights);
  }

  _upgradeVisiblePagesToHighRes() {
    if (!this.initialRenderComplete) return;

    // Sort visible pages by distance from current page
    const currentPage = this.currentPage;
    const visiblePages = Array.from(this._visiblePages)
      .sort((a, b) => Math.abs(a - currentPage) - Math.abs(b - currentPage));

    // Only upgrade up to maxCachedPages
    visiblePages.slice(0, this.maxCachedPages).forEach(pageNum => {
      const canvas = this.pageCanvases[pageNum - 1];
      if (canvas && canvas.getAttribute('data-resolution') !== 'high') {
        // Queue the render if already rendering
        if (this.isRendering) {
          this.renderQueue.push({ ndx: pageNum - 1, resolution: 'high' });
          if (this.debug) console.log(`[PDF-A-go-go Debug] Queued high-res upgrade for page ${pageNum}`);
          return;
        }
        this._renderPageWithResolution(pageNum - 1, 'high');
      }
    });
  }

  _updateVisiblePages() {
    // Find which pages are visible in the scroll container
    const container = this.scrollContainer;
    const containerRect = container.getBoundingClientRect();
    const visiblePages = [];
    for (let i = 0; i < this.pageCount; i++) {
      const canvas = this.pageCanvases[i];
      if (!canvas) continue;
      const rect = canvas.getBoundingClientRect();
      // Check if the canvas is visible in the container (horizontal scroll)
      if (
        rect.right > containerRect.left &&
        rect.left < containerRect.right
      ) {
        visiblePages.push(i + 1); // 1-based
      }
    }
    // Output visible page numbers to the indicator
    // if (visiblePages.length > 0) {
    //   this.visiblePagesIndicator.textContent =
    //     "Visible pages: " + visiblePages.join(", ");
    // } else {
    //   this.visiblePagesIndicator.textContent = "Visible pages: (none)";
    // }
    this.emit("visiblePages", visiblePages);
  }

  _updateCurrentPage() {
    // todo: remove this, i believe it's not needed
    // Find the page whose left edge is closest to the center of the container
    // const container = this.scrollContainer;
    // const center = container.scrollLeft - 2000 + (container.clientWidth - 2000) / 2;
    // console.log('center', center);
    // let minDist = Infinity;
    // let closest = 0;
    // for (let i = 0; i < this.pageCount; i++) {
    //   const canvas = this.pageCanvases[i];
    //   if (!canvas) continue;
    //   const rect = canvas.getBoundingClientRect();
    //   const pageCenter = rect.left + rect.width / 2 + container.scrollLeft - container.getBoundingClientRect().left;
    //   const dist = Math.abs(pageCenter - center);
    //   if (dist < minDist) {
    //     minDist = dist;
    //     closest = i;
    //   }
    // }
    // if (this.currentPage !== closest) {
    //   this.currentPage = closest;
    //   this.emit("seen", closest + 1);
    // }
  }

  flip_forward() {
    this.scrollBy(0.8);
  }

  flip_back() {
    this.scrollBy(-0.8);
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
    const pageWidth = this._getPageWidth() + 24;
    const left = Math.max(0, pageWidth * pageNum);
    // console.log('left', left);
    this.scrollContainer.scrollTo({
      left,
      behavior: "smooth"
    });
    this.currentPage = pageNum;
    this.emit("seen", pageNum);
  }

  on(event, handler) {
    super.on(event, handler);
  }

  _setupGrabAndScroll() {
    const container = this.scrollContainer;
    let isDown = false;
    let startX, startY;
    let scrollLeft;
    let isHorizontalDrag = false;
    let lastX, lastY;
    let velocity = 0;
    let lastTime = 0;

    container.style.cursor = 'grab';

    const onStart = (e) => {
      isDown = true;
      isHorizontalDrag = false;
      container.classList.add('grabbing');
      container.style.cursor = 'grabbing';
      startX = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
      startY = e.type.startsWith('touch') ? e.touches[0].pageY : e.pageY;
      lastX = startX;
      lastY = startY;
      scrollLeft = container.scrollLeft;
      lastTime = Date.now();
      velocity = 0;
    };

    const onMove = (e) => {
      if (!isDown) return;
      
      const x = e.type.startsWith('touch') ? e.touches[0].pageX : e.pageX;
      const y = e.type.startsWith('touch') ? e.touches[0].pageY : e.pageY;
      const dx = x - lastX;
      const dy = y - lastY;
      const now = Date.now();
      const dt = now - lastTime;
      
      if (!isHorizontalDrag && Math.abs(dx) > 5) {
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalDrag = true;
        }
      }

      if (isHorizontalDrag) {
        e.preventDefault();
        velocity = dx / dt; // pixels per millisecond
        const walk = dx * this.momentum;
        container.scrollLeft = scrollLeft - walk;
        scrollLeft = container.scrollLeft;
      }

      lastX = x;
      lastY = y;
      lastTime = now;
    };

    const onEnd = () => {
      if (!isDown) return;
      isDown = false;
      isHorizontalDrag = false;
      container.classList.remove('grabbing');
      container.style.cursor = 'grab';

      // Apply inertia if velocity is significant
      if (Math.abs(velocity) > 0.2) {
        const startVelocity = velocity;
        const startScroll = container.scrollLeft;
        const startTime = Date.now();
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const deceleration = 0.002; // pixels per ms^2
          const remaining = startVelocity * Math.exp(-deceleration * elapsed);
          
          if (Math.abs(remaining) > 0.01 && elapsed < 500) {
            container.scrollLeft = startScroll - (startVelocity / deceleration) * (1 - Math.exp(-deceleration * elapsed));
            requestAnimationFrame(animate);
          }
        };
        requestAnimationFrame(animate);
      }
    };

    // Mouse events
    container.addEventListener('mousedown', onStart);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseup', onEnd);
    container.addEventListener('mouseleave', onEnd);

    // Touch events
    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd);
    container.addEventListener('touchcancel', onEnd);
  }

  _setupWheelScrollHandler() {
    // Only intercept horizontal wheel events; let vertical scroll bubble up
    this.scrollContainer.addEventListener('wheel', (e) => {
      // If horizontal scroll (deltaX), scroll the container and preventDefault
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.scrollContainer.scrollLeft += e.deltaX * (this.momentum * 1.5); // We add a 50% boost to the momentum as scroll wheels seem slower
        e.preventDefault();
      }
      // Otherwise, let vertical scroll bubble up (do not preventDefault)
    }, { passive: false });
  }

  rerenderPage(ndx) {
    const canvas = this.pageCanvases[ndx];
    if (!canvas) return;

    // Always start with low res, then upgrade if visible and initial render is complete
    this._renderPageWithResolution(ndx, 'low', () => {
      if (this.initialRenderComplete && this._visiblePages.has(ndx + 1)) {
        setTimeout(() => {
          this._renderPageWithResolution(ndx, 'high');
        }, 200);
      }
    });
  }

  // Add a method to get performance metrics
  getPerformanceMetrics() {
    if (!this.debug) return null;

    const avgLowResTime = Object.values(this.metrics.pageRenderTimes).reduce((a, b) => a + b, 0) / this.metrics.totalPagesRendered;
    const avgHighResTime = Object.values(this.metrics.highResUpgradeTimes).reduce((a, b) => a + b, 0) / this.metrics.totalHighResUpgrades;

    return {
      initialRenderTime: this.metrics.initialRenderEnd - this.metrics.initialRenderStart,
      averageLowResRenderTime: avgLowResTime,
      averageHighResRenderTime: avgHighResTime,
      totalPagesRendered: this.metrics.totalPagesRendered,
      totalHighResUpgrades: this.metrics.totalHighResUpgrades,
      pageRenderTimes: this.metrics.pageRenderTimes,
      highResUpgradeTimes: this.metrics.highResUpgradeTimes
    };
  }

  _cleanupOffscreenPages(force = false) {
    if (this.debug) console.log('[PDF-A-go-go Debug] Running memory cleanup');
    
    const visiblePages = Array.from(this._visiblePages);
    const start = Math.min(...visiblePages);
    const end = Math.max(...visiblePages);
    
    // Keep a buffer of pages in each direction (smaller on mobile)
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
          
          // Measure memory before cleanup
          if (this.debug) {
            const memoryBefore = canvas.width * canvas.height * 4;
            this.metrics.memoryUsage[pageNum] = {
              freed: memoryBefore,
              timestamp: Date.now()
            };
          }
          
          // Clear canvas and reduce its size
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = canvas.height = 32; // Minimal size to maintain layout
          
          // Remove from render queue if present
          this.renderQueue = this.renderQueue.filter(item => item.ndx !== pageNum);
          
          if (this.debug) {
            console.log(`[PDF-A-go-go Debug] Cleaned up page ${pageNum + 1}, freed ~${Math.round(this.metrics.memoryUsage[pageNum].freed / 1024 / 1024)}MB`);
          }
        }
      }
    });
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
      <div class="timing">Avg Low-Res: ${avgLowResTime}ms</div>
      <div class="timing">Avg High-Res: ${avgHighResTime}ms</div>
      <div>Pages Rendered: ${this.metrics.totalPagesRendered}</div>
      <div>High-Res Updates: ${this.metrics.totalHighResUpgrades}</div>
      <div class="memory">Memory Freed: ${(totalMemoryFreed / 1024 / 1024).toFixed(2)}MB</div>
      <div>Visible Pages: ${visiblePages}</div>
      <div>Resolution Changes: ${Object.keys(this.metrics.highResUpgradeTimes).length}</div>
    `;

    this.metrics.lastUpdate = now;
  }
}

// Utility function to render a PDF page to a canvas with scaling
function renderPdfPageToCanvas(canvas, pg, targetHeight, scale) {
  const aspect = pg.width / pg.height;
  const height = targetHeight;
  const width = height * aspect;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.height = height + "px";
  canvas.style.width = width + "px";
  const ctx = canvas.getContext("2d");
  ctx.drawImage(pg.img, 0, 0, width * scale, height * scale);
}