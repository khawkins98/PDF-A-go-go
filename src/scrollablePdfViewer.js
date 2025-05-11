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

    this._setupResizeHandler();
    this._renderAllPages();
    this._setupScrollHandler();
    this._updateVisiblePages();
    this._setupGrabAndScroll();
    this._setupWheelScrollHandler();
  }

  _setupResizeHandler() {
    let resizeTimeout = null;
    window.addEventListener("resize", () => {
      if (resizeTimeout) return;
      resizeTimeout = setTimeout(() => {
        this._resizeAllPages();
        this._updateVisiblePages();
        resizeTimeout = null;
      }, 300);
    });
  }

  _setupScrollHandler() {
    this.scrollContainer.addEventListener("scroll", () => {
      this._updateVisiblePages();
      this._updateCurrentPage();
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

  _renderAllPages() {
    // Remove any existing canvases
    this.scrollContainer.innerHTML = "";
    this.pageCanvases = {};
    for (let i = 0; i < this.pageCount; i++) {
      this._renderPage(i);
    }
  }

  _resizeAllPages() {
    // Refactored: returns a Promise that resolves when all pages are redrawn
    const renderPromises = [];
    for (let i = 0; i < this.pageCount; i++) {
      const canvas = this.pageCanvases[i];
      if (canvas) {
        const highlights = window.__pdfagogo__highlights ? window.__pdfagogo__highlights[i] : undefined;
        // Wrap each render in a Promise
        const p = new Promise((resolve) => {
          this.book.getPage(i, (err, pg) => {
            if (err) return resolve();
            const scale = this.options.scale || 2;
            renderPdfPageToCanvas(canvas, pg, this._getPageHeight(), scale);
            resolve();
          }, highlights);
        });
        renderPromises.push(p);
      }
    }
    return Promise.all(renderPromises);
  }

  _renderPage(ndx) {
    const canvas = document.createElement("canvas");
    canvas.className = "pdfagogo-page-canvas";
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("data-page", ndx + 1);
    this.pageCanvases[ndx] = canvas;
    this.scrollContainer.appendChild(canvas);
    // Render PDF page
    const highlights = window.__pdfagogo__highlights ? window.__pdfagogo__highlights[ndx] : undefined;
    this.book.getPage(ndx, (err, pg) => {
      if (err) return;
      const scale = this.options.scale || 2;
      renderPdfPageToCanvas(canvas, pg, this._getPageHeight(), scale);
    }, highlights);
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
    // Find the page whose left edge is closest to the center of the container
    const container = this.scrollContainer;
    const center = container.scrollLeft + container.clientWidth / 2;
    let minDist = Infinity;
    let closest = 0;
    for (let i = 0; i < this.pageCount; i++) {
      const canvas = this.pageCanvases[i];
      if (!canvas) continue;
      const rect = canvas.getBoundingClientRect();
      const pageCenter = rect.left + rect.width / 2 + container.scrollLeft - container.getBoundingClientRect().left;
      const dist = Math.abs(pageCenter - center);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    if (this.currentPage !== closest) {
      this.currentPage = closest;
      this.emit("seen", closest + 1);
    }
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

  go_to_page(pageNum) {
    // Center the given page
    const pageWidth = this._getPageWidth() + 24;
    const left = Math.max(0, pageWidth * pageNum - this.scrollContainer.clientWidth / 2 + pageWidth / 2);
    this.scrollContainer.scrollTo({
      left,
      behavior: "smooth"
    });
    this.currentPage = pageNum;
    this.emit("seen", pageNum + 1);
  }

  get showNdx() {
    return this.currentPage;
  }

  set showNdx(val) {
    this.go_to_page(val);
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