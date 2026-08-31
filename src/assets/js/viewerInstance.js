/**
 * @file ViewerInstance: Encapsulates state for a single PDF viewer instance.
 *
 * This class manages all the state for a single PDF viewer, enabling multiple
 * independent viewers on the same page without global state pollution.
 *
 * @author PDF-A-go-go Contributors
 * @version 2.0.0
 */

/**
 * Represents a single PDF viewer instance with isolated state.
 *
 * This class encapsulates:
 * - PDF document reference
 * - Viewer instance (ScrollablePdfViewer)
 * - Book object (page access abstraction)
 * - Search controller
 * - Configuration options
 * - Page tracking state
 *
 * @class ViewerInstance
 */
export class ViewerInstance {
  /**
   * Create a new ViewerInstance.
   *
   * @param {HTMLElement} container - The container element for this viewer
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.id] - Unique ID for this instance (auto-generated if not provided)
   */
  constructor(container, options = {}) {
    /** @type {string} Unique identifier for this instance */
    this.id = options.id || container.id || `pdfagogo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    /** @type {HTMLElement} The container element */
    this.container = container;

    /** @type {Object|null} The loaded PDF.js document */
    this.pdf = null;

    /** @type {import('./scrollablePdfViewer').ScrollablePdfViewer|null} The viewer instance */
    this.viewer = null;

    /** @type {Object|null} The book object (page access abstraction) */
    this.book = null;

    /** @type {import('./searchController').SearchController|null} Search controller */
    this.searchController = null;

    /** @type {Object} Configuration options for this instance */
    this.options = options;

    /** @type {string|null} Tracks what caused the last page navigation */
    this.pageSetBy = null;

    /** @type {boolean} Whether this instance has been destroyed */
    this.destroyed = false;

    /** @type {string|null} Current theme name */
    this.theme = options.theme || null;

    // Store reference on container for external access
    container._pdfagogoInstance = this;
  }

  /**
   * Set the PDF document for this instance.
   * @param {Object} pdf - The PDF.js document
   */
  setPdf(pdf) {
    this.pdf = pdf;
  }

  /**
   * Set the viewer for this instance.
   * @param {import('./scrollablePdfViewer').ScrollablePdfViewer} viewer - The viewer instance
   */
  setViewer(viewer) {
    this.viewer = viewer;
    // Also expose on container for backward compatibility
    this.container.pdfViewer = viewer;
  }

  /**
   * Set the book object for this instance.
   * @param {Object} book - The book object
   */
  setBook(book) {
    this.book = book;
  }

  /**
   * Set the search controller for this instance.
   * @param {import('./searchController').SearchController} controller - The search controller
   */
  setSearchController(controller) {
    this.searchController = controller;
  }

  /**
   * Apply a theme to this viewer instance.
   * @param {string} themeName - Name of the theme (e.g., 'dark', 'light', or 'default')
   */
  setTheme(themeName) {
    this.theme = themeName;
    if (themeName && themeName !== 'default') {
      this.container.setAttribute('data-theme', themeName);
    } else {
      this.container.removeAttribute('data-theme');
    }
  }

  /**
   * Get the current theme.
   * @returns {string|null} Current theme name
   */
  getTheme() {
    return this.theme;
  }

  /**
   * Track what caused the page navigation.
   * @param {string} source - Source of navigation (e.g., 'hash', 'defaultPage', 'user')
   */
  setPageSource(source) {
    this.pageSetBy = source;
  }

  /**
   * Get what caused the last page navigation.
   * @returns {string|null}
   */
  getPageSource() {
    return this.pageSetBy;
  }

  /**
   * Destroy this viewer instance and clean up resources.
   * Should be called when removing a viewer from the page.
   */
  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    // Run UI-layer cleanup (removes document/window listeners added by setupControls)
    if (typeof this._uiCleanup === 'function') {
      try {
        this._uiCleanup();
      } catch (e) {
        // ignore cleanup errors during teardown
      }
      this._uiCleanup = null;
    }

    // Clear search highlights
    if (this.searchController) {
      this.searchController.clearHighlights();
      this.searchController = null;
    }

    // Clean up viewer resources. Prefer the viewer's own destroy() so its
    // global (window/document) listeners are removed; fall back to the
    // piecemeal cleanup if destroy() is unavailable.
    if (this.viewer) {
      if (typeof this.viewer.destroy === 'function') {
        try {
          this.viewer.destroy();
        } catch (e) {
          // ignore teardown errors
        }
      } else {
        // Clear render queue
        if (this.viewer.renderQueue && typeof this.viewer.renderQueue.clear === 'function') {
          this.viewer.renderQueue.clear();
        }
        // Clear tile renderer if present
        if (this.viewer.tileRenderer) {
          if (typeof this.viewer.tileRenderer.clearQueue === 'function') {
            this.viewer.tileRenderer.clearQueue();
          }
          if (this.viewer.tileRenderer.cache && typeof this.viewer.tileRenderer.cache.clear === 'function') {
            this.viewer.tileRenderer.cache.clear();
          }
          if (this.viewer.tileRenderer.fullPageCache && typeof this.viewer.tileRenderer.fullPageCache.clear === 'function') {
            this.viewer.tileRenderer.fullPageCache.clear();
          }
        }
      }
      this.viewer = null;
    }

    // Clear PDF document. The viewer's destroy() may already have destroyed
    // the underlying PDF.js document, so guard against a double-destroy.
    if (this.pdf) {
      if (typeof this.pdf.destroy === 'function') {
        try {
          this.pdf.destroy();
        } catch (e) {
          // already destroyed by the viewer — safe to ignore
        }
      }
      this.pdf = null;
    }

    // Clear book reference
    this.book = null;

    // Remove references from container
    if (this.container) {
      delete this.container._pdfagogoInstance;
      delete this.container.pdfViewer;
    }

    // Clear container content
    if (this.container && this.container.innerHTML) {
      // Only remove the wrapper if it was dynamically created by the library
      // (preserves user's manually added wrappers)
      const wrapper = this.container.closest('.pdfagogo-viewer-wrapper');
      if (wrapper && wrapper.parentNode && wrapper.getAttribute('data-pdfagogo-created') === 'true') {
        // Move container out of wrapper
        wrapper.parentNode.insertBefore(this.container, wrapper);
        wrapper.parentNode.removeChild(wrapper);
      }
      this.container.innerHTML = '';
    }

    this.container = null;
  }

  /**
   * Check if this instance is still valid (not destroyed).
   * @returns {boolean}
   */
  isValid() {
    return !this.destroyed && this.container !== null;
  }

  /**
   * Get the page count for this PDF.
   * @returns {number} Number of pages, or 0 if no PDF loaded
   */
  getPageCount() {
    if (this.book && typeof this.book.numPages === 'function') {
      return this.book.numPages();
    }
    if (this.pdf && this.pdf.numPages) {
      return this.pdf.numPages;
    }
    return 0;
  }

  /**
   * Get the current page number (1-based).
   * @returns {number} Current page number, or 1 if no viewer
   */
  getCurrentPage() {
    if (this.viewer) {
      return (this.viewer.currentPage || 0) + 1;
    }
    return 1;
  }

  /**
   * Navigate to a specific page.
   * @param {number} pageNum - Page number (1-based)
   */
  goToPage(pageNum) {
    if (this.viewer && typeof this.viewer.goToPage === 'function') {
      this.viewer.goToPage(pageNum);
    }
  }
}
