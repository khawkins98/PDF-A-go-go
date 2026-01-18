/**
 * @file SearchController: Encapsulates search state for a PDF viewer instance.
 *
 * This class manages search functionality without polluting the global namespace.
 * Each viewer instance has its own SearchController, enabling independent search
 * across multiple viewers on the same page.
 *
 * @author PDF-A-go-go Contributors
 * @version 2.0.0
 */

/**
 * SearchController manages search state and highlighting for a PDF viewer.
 *
 * This class encapsulates:
 * - Search query and results
 * - Match navigation (current index)
 * - Highlight coordinates per page
 * - Integration with TileManager for rendering highlights
 *
 * @class SearchController
 */
export class SearchController {
  /**
   * Create a new SearchController.
   *
   * @param {Object} options - Configuration options
   * @param {Object} [options.pdf] - PDF.js document for searching
   * @param {Object} [options.viewer] - ScrollablePdfViewer instance
   * @param {Object} [options.tileManager] - TileManager for highlight rendering
   */
  constructor(options = {}) {
    /** @type {Object|null} PDF.js document */
    this.pdf = options.pdf || null;

    /** @type {Object|null} ScrollablePdfViewer instance */
    this.viewer = options.viewer || null;

    /** @type {Object|null} TileManager for highlight integration */
    this.tileManager = options.tileManager || null;

    // Search state
    /** @type {Array<number>} Array of page indices (0-based) with matches */
    this.matchPages = [];

    /** @type {number} Current match index in matchPages array */
    this.currentMatchIdx = 0;

    /** @type {Object<number, Array<Object>>} Highlights per page: { pageIndex: [{ x, y, width, height }, ...] } */
    this.matchHighlights = {};

    /** @type {number|null} Previous match page index (for clearing old highlights) */
    this.prevMatchPage = null;

    /** @type {string} Last search query */
    this.lastQuery = '';
  }

  /**
   * Set the PDF document for searching.
   * @param {Object} pdf - PDF.js document
   */
  setPdf(pdf) {
    this.pdf = pdf;
  }

  /**
   * Set the viewer instance.
   * @param {Object} viewer - ScrollablePdfViewer instance
   */
  setViewer(viewer) {
    this.viewer = viewer;
  }

  /**
   * Set the TileManager for highlight integration.
   * @param {Object} tileManager - TileManager instance
   */
  setTileManager(tileManager) {
    this.tileManager = tileManager;
  }

  /**
   * Search the PDF for a query string.
   * Uses parallel batch processing for better performance on large documents.
   *
   * @param {string} query - Search query (case-insensitive)
   * @returns {Promise<void>}
   */
  async search(query) {
    this.matchPages = [];
    this.currentMatchIdx = 0;
    this.matchHighlights = {};
    this.lastQuery = query;

    if (!this.pdf || !query) return;

    const normalizedQuery = query.toLowerCase();
    const numPages = this.pdf.numPages;
    const batchSize = 10; // Process pages in batches for parallel loading

    // Process a single page and return results
    const searchPage = async (pageIndex) => {
      const page = await this.pdf.getPage(pageIndex + 1);
      const textContent = await page.getTextContent();
      const items = textContent.items;
      const text = items.map((item) => item.str).join(' ').toLowerCase();

      if (text.includes(normalizedQuery)) {
        // Compute bounding boxes for matches on this page
        const boxes = [];
        for (let j = 0; j < items.length; j++) {
          const item = items[j];
          const itemText = item.str.toLowerCase();
          const idx = itemText.indexOf(normalizedQuery);
          if (idx !== -1) {
            const x = item.transform[4];
            const y = item.transform[5];
            const h = item.height || 12;
            boxes.push({ x, y, width: item.width, height: h });
          }
        }
        return { pageIndex, boxes };
      }
      return null;
    };

    // Process pages in parallel batches
    for (let batchStart = 0; batchStart < numPages; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, numPages);
      const batchPromises = [];

      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(searchPage(i));
      }

      const batchResults = await Promise.all(batchPromises);

      // Collect results from this batch
      for (const result of batchResults) {
        if (result) {
          this.matchPages.push(result.pageIndex);
          this.matchHighlights[result.pageIndex] = result.boxes;
        }
      }
    }

    // Sort matchPages to ensure they're in page order
    this.matchPages.sort((a, b) => a - b);
  }

  /**
   * Get the number of matches found.
   * @returns {number}
   */
  getMatchCount() {
    return this.matchPages.length;
  }

  /**
   * Get the current match index (1-based for display).
   * @returns {number}
   */
  getCurrentMatchNumber() {
    return this.matchPages.length > 0 ? this.currentMatchIdx + 1 : 0;
  }

  /**
   * Navigate to a specific match by index.
   *
   * @param {number} idx - Match index (will wrap around)
   * @returns {{ pageNum: number, highlights: Array }|null} Match info or null if no matches
   */
  goToMatch(idx) {
    if (this.matchPages.length === 0) {
      this._updateHighlights({});
      return null;
    }

    // Wrap around
    this.currentMatchIdx = ((idx % this.matchPages.length) + this.matchPages.length) % this.matchPages.length;
    const pageIdx = this.matchPages[this.currentMatchIdx];
    const pageNum = pageIdx + 1; // 1-based for display

    // Get highlights for this page
    const highlights = this.matchHighlights[pageIdx] || [];

    // Update highlights (only current match page)
    const highlightMap = {};
    highlightMap[pageIdx] = highlights;
    this._updateHighlights(highlightMap);

    // Clear previous page highlights if different
    if (this.prevMatchPage !== null && this.prevMatchPage !== pageIdx) {
      this._rerenderPage(this.prevMatchPage);
    }
    this.prevMatchPage = pageIdx;

    // Rerender current page with highlights
    this._rerenderPage(pageIdx);

    return { pageNum, highlights };
  }

  /**
   * Go to the next match.
   * @returns {{ pageNum: number, highlights: Array }|null}
   */
  nextMatch() {
    return this.goToMatch(this.currentMatchIdx + 1);
  }

  /**
   * Go to the previous match.
   * @returns {{ pageNum: number, highlights: Array }|null}
   */
  prevMatch() {
    return this.goToMatch(this.currentMatchIdx - 1);
  }

  /**
   * Clear all search state and highlights.
   */
  clearSearch() {
    const pageToClear = this.prevMatchPage;

    this.lastQuery = '';
    this.matchPages = [];
    this.currentMatchIdx = 0;
    this.matchHighlights = {};
    this.prevMatchPage = null;

    // Clear highlights
    this._updateHighlights({});

    // Rerender page that had highlights
    if (pageToClear !== null) {
      this._rerenderPage(pageToClear);
    }
  }

  /**
   * Get highlights for a specific page.
   * @param {number} pageIndex - Page index (0-based)
   * @returns {Array} Array of highlight boxes
   */
  getHighlights(pageIndex) {
    return this.matchHighlights[pageIndex] || [];
  }

  /**
   * Set highlights (called externally if needed).
   * @param {number} pageIndex - Page index (0-based)
   * @param {Array} highlights - Array of highlight boxes
   */
  setHighlights(pageIndex, highlights) {
    this.matchHighlights[pageIndex] = highlights;
    this._updateHighlights({ [pageIndex]: highlights });
  }

  /**
   * Clear all highlights (but keep search results).
   */
  clearHighlights() {
    this._updateHighlights({});
    // Rerender affected pages
    if (this.prevMatchPage !== null) {
      this._rerenderPage(this.prevMatchPage);
    }
  }

  /**
   * Update highlights in TileManager.
   * @param {Object} highlightMap - Map of pageIndex to highlights array
   * @private
   */
  _updateHighlights(highlightMap) {
    // Get tileManager - prefer direct reference, fallback to viewer path
    const tm = this.tileManager ||
               (this.viewer && this.viewer.tileRenderer && this.viewer.tileRenderer.tileManager);
    if (tm) {
      tm.setHighlights(highlightMap);
    }
    // Also maintain backward compatibility with window global
    // (will be removed in future version)
    if (typeof window !== 'undefined') {
      window.__pdfagogo__highlights = highlightMap;
    }
  }

  /**
   * Trigger a page rerender to update highlights.
   * @param {number} pageIdx - Page index (0-based)
   * @private
   */
  _rerenderPage(pageIdx) {
    if (this.viewer) {
      // rerenderPage clears caches and re-renders with updated highlights
      if (typeof this.viewer.rerenderPage === 'function') {
        this.viewer.rerenderPage(pageIdx);
      } else if (typeof this.viewer._renderAllPages === 'function') {
        this.viewer._renderAllPages();
      }
    }
  }

  /**
   * Check if there are any matches.
   * @returns {boolean}
   */
  hasMatches() {
    return this.matchPages.length > 0;
  }

  /**
   * Get the last search query.
   * @returns {string}
   */
  getLastQuery() {
    return this.lastQuery;
  }
}
