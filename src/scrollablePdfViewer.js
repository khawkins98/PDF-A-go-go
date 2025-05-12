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
      totalHighResUpgrades: 0
    };

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

    const scale = resolution === 'high' ? (this.options.scale || 1.8) : 0.25;
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

      // Update canvas buffer dimensions and render
      canvas.width = width * scale;
      canvas.height = targetHeight * scale;
      renderPdfPageToCanvas(canvas, pg, targetHeight, scale);
      canvas.setAttribute('data-resolution', resolution);

      if (this.debug) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        if (resolution === 'high') {
          this.metrics.highResUpgradeTimes[ndx] = duration;
          this.metrics.totalHighResUpgrades++;
          console.log(`[PDF-A-go-go Debug] Page ${ndx + 1} upgraded to high-res in ${duration.toFixed(2)}ms`);
        } else {
          this.metrics.pageRenderTimes[ndx] = duration;
          this.metrics.totalPagesRendered++;
          console.log(`[PDF-A-go-go Debug] Page ${ndx + 1} rendered in low-res in ${duration.toFixed(2)}ms`);
        }
      }

      if (callback) callback();
    }, highlights);
  }

  _upgradeVisiblePagesToHighRes() {
    // Upgrade visible pages to high res
    this._visiblePages.forEach(pageNum => {
      const canvas = this.pageCanvases[pageNum - 1];
      if (canvas && canvas.getAttribute('data-resolution') !== 'high') {
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

    container.style.cursor = 'grab';

    container.addEventListener('mousedown', (e) => {
      isDown = true;
      isHorizontalDrag = false;
      container.classList.add('grabbing');
      container.style.cursor = 'grabbing';
      startX = e.pageX - container.offsetLeft;
      startY = e.pageY;
      scrollLeft = container.scrollLeft;
      // Do not preventDefault here; wait for movement direction
    });

    container.addEventListener('mouseleave', () => {
      isDown = false;
      isHorizontalDrag = false;
      container.classList.remove('grabbing');
      container.style.cursor = 'grab';
    });

    container.addEventListener('mouseup', () => {
      isDown = false;
      isHorizontalDrag = false;
      container.classList.remove('grabbing');
      container.style.cursor = 'grab';
    });

    container.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY;
      const dx = x - startX;
      const dy = y - startY;
      if (!isHorizontalDrag && Math.abs(dx) > 5) {
        // Only start horizontal drag if horizontal movement is dominant
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalDrag = true;
        }
      }
      if (isHorizontalDrag) {
        e.preventDefault();
        const walk = dx * this.momentum;
        container.scrollLeft = scrollLeft - walk;
      }
    });

    // Touch support for mobile
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      isDown = true;
      isHorizontalDrag = false;
      container.classList.add('grabbing');
      container.style.cursor = 'grabbing';
      startX = e.touches[0].pageX - container.offsetLeft;
      startY = e.touches[0].pageY;
      scrollLeft = container.scrollLeft;
    }, { passive: false });

    container.addEventListener('touchend', () => {
      isDown = false;
      isHorizontalDrag = false;
      container.classList.remove('grabbing');
      container.style.cursor = 'grab';
    });

    container.addEventListener('touchcancel', () => {
      isDown = false;
      isHorizontalDrag = false;
      container.classList.remove('grabbing');
      container.style.cursor = 'grab';
    });

    container.addEventListener('touchmove', (e) => {
      if (!isDown || e.touches.length !== 1) return;
      const x = e.touches[0].pageX - container.offsetLeft;
      const y = e.touches[0].pageY;
      const dx = x - startX;
      const dy = y - startY;
      if (!isHorizontalDrag && Math.abs(dx) > 5) {
        if (Math.abs(dx) > Math.abs(dy)) {
          isHorizontalDrag = true;
        }
      }
      if (isHorizontalDrag) {
        e.preventDefault();
        const walk = dx * this.momentum;
        container.scrollLeft = scrollLeft - walk;
      }
    }, { passive: false });
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