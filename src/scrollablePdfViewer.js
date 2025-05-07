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
    this.pageSizes = [];
    this.scrollContainer = document.createElement("div");
    this.scrollContainer.className = "pdfagogo-scroll-container";
    this.app.appendChild(this.scrollContainer);
    this._setupResizeHandler();
    this._renderVisiblePages();
    this._setupScrollHandler();
  }

  _setupResizeHandler() {
    window.addEventListener("resize", () => {
      this._renderVisiblePages();
    });
  }

  _setupScrollHandler() {
    this.scrollContainer.addEventListener("scroll", () => {
      this._renderVisiblePages();
      this._updateCurrentPage();
    });
  }

  _getPageWidth() {
    // Estimate page width based on container height and aspect ratio
    const containerHeight = this.scrollContainer.clientHeight || 600;
    // Default aspect ratio 0.7 (A4)
    return containerHeight * 0.7;
  }

  _getPageHeight() {
    return this.scrollContainer.clientHeight || 600;
  }

  _renderVisiblePages() {
    const container = this.scrollContainer;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.clientWidth;
    const pageWidth = this._getPageWidth();
    const bufferPages = 2; // render 2 pages before/after viewport
    const firstVisible = Math.max(0, Math.floor(scrollLeft / (pageWidth + 24)) - bufferPages);
    const lastVisible = Math.min(this.pageCount - 1, Math.ceil((scrollLeft + containerWidth) / (pageWidth + 24)) + bufferPages);

    // Remove canvases not in range
    for (const ndx in this.pageCanvases) {
      if (ndx < firstVisible || ndx > lastVisible) {
        const canvas = this.pageCanvases[ndx];
        if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
        delete this.pageCanvases[ndx];
      }
    }

    // Render visible pages
    for (let i = firstVisible; i <= lastVisible; i++) {
      if (!this.pageCanvases[i]) {
        this._renderPage(i);
      }
    }
  }

  _renderPage(ndx) {
    const canvas = document.createElement("canvas");
    canvas.className = "pdfagogo-page-canvas";
    canvas.setAttribute("tabindex", "0");
    canvas.setAttribute("data-page", ndx + 1);
    this.pageCanvases[ndx] = canvas;
    // Insert in correct order
    let inserted = false;
    for (let i = 0; i < this.scrollContainer.children.length; i++) {
      const child = this.scrollContainer.children[i];
      const childNdx = parseInt(child.getAttribute("data-page"), 10) - 1;
      if (childNdx > ndx) {
        this.scrollContainer.insertBefore(canvas, child);
        inserted = true;
        break;
      }
    }
    if (!inserted) this.scrollContainer.appendChild(canvas);
    // Render PDF page
    this.book.getPage(ndx, (err, pg) => {
      if (err) return;
      const aspect = pg.width / pg.height;
      const containerHeight = this._getPageHeight();
      const height = containerHeight;
      const width = height * aspect;
      canvas.width = width;
      canvas.height = height;
      canvas.style.height = height + "px";
      canvas.style.width = width + "px";
      const ctx = canvas.getContext("2d");
      ctx.drawImage(pg.img, 0, 0, width, height);
    });
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
    this._renderVisiblePages();
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
}