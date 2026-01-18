/**
 * @file Tile-based page renderer for PDF-A-go-go.
 *
 * This module provides a tile-based rendering system that:
 * - Renders pages as grids of tiles for efficient memory usage
 * - Supports multiple resolution tiers for zoom-aware rendering
 * - Composites visible tiles onto display canvases
 * - Handles smooth transitions between resolution tiers
 *
 * @author PDF-A-go-go Contributors
 * @version 2.0.0
 */

import { TileManager, getTierForZoom, getTileKey, RESOLUTION_TIERS } from './tileManager.js';

/**
 * Renders PDF pages using a tile-based approach.
 *
 * This class manages the rendering of PDF pages by dividing them into tiles,
 * rendering only visible tiles at the appropriate resolution for the current
 * zoom level, and compositing them onto display canvases.
 */
export class TileRenderer {
  /**
   * @param {Object} options - Configuration options
   * @param {Object} options.book - PDF book object with getPage method
   * @param {Object} [options.pdfDocument] - Raw PDF.js document for direct page access
   * @param {number} options.pageCount - Total number of pages
   * @param {boolean} [options.debug=false] - Enable debug mode
   * @param {boolean} [options.isMobile=false] - Whether running on mobile
   * @param {number} [options.tileSize=512] - Size of tiles in pixels
   * @param {number} [options.maxFullPageCacheSize] - Maximum full-page canvases to cache
   */
  constructor(options) {
    this.book = options.book;
    this.pdfDocument = options.pdfDocument || null; // Raw PDF.js document
    this.pageCount = options.pageCount;
    this.debug = options.debug || false;
    this.isMobile = options.isMobile || false;

    // Tile configuration
    this.tileSize = options.tileSize || (this.isMobile ? 256 : 512);
    const cacheSize = this.isMobile ? 50 : 100;

    // Create tile manager
    this.tileManager = new TileManager({
      tileSize: this.tileSize,
      cacheSize,
      debug: this.debug,
      isMobile: this.isMobile,
      maxFullPageCacheSize: options.maxFullPageCacheSize,
    });

    // Page metadata
    this.pageMetadata = new Map(); // Map<pageIndex, { width, height, pdfPage }>

    // Display canvases (one per page)
    this.displayCanvases = new Map(); // Map<pageIndex, HTMLCanvasElement>

    // Current state - initialize tier based on default zoom of 1.0
    this.currentZoom = 1.0;
    const { tier: initialTier } = getTierForZoom(this.currentZoom);
    this.currentTier = initialTier;

    // Debounce timers
    this._zoomDebounceTimer = null;
    this._renderDebounceTimer = null;

    // Callbacks
    this.onPageReady = null;
    this.onTileProgress = null;

    // Set up tile manager callback
    this.tileManager.onTileReady = (pageIndex, tileX, tileY, tier, canvas) => {
      this._onTileRendered(pageIndex, tileX, tileY, tier, canvas);
    };

    // Metrics
    this.metrics = {
      tilesRendered: 0,
      compositeOperations: 0,
      tierChanges: 0,
    };

    // Tile fade-in animation tracking
    // Map of tileKey -> { startTime, duration }
    this._tileAnimations = new Map();
    this._fadeInDuration = 150; // ms
    this._animationFrame = null;
  }

  /**
   * Initialize a page for tile-based rendering.
   * Must be called before rendering tiles for a page.
   *
   * @param {number} pageIndex - 0-based page index
   * @param {number} displayWidth - Display width in CSS pixels
   * @param {number} displayHeight - Display height in CSS pixels
   * @returns {Promise<void>}
   */
  async initializePage(pageIndex, displayWidth, displayHeight) {
    // If we have direct access to the PDF.js document, use it for tile rendering
    if (this.pdfDocument) {
      try {
        const pdfPage = await this.pdfDocument.getPage(pageIndex + 1); // PDF.js uses 1-based indexing

        // Store page metadata with the actual PDF.js page
        this.pageMetadata.set(pageIndex, {
          width: displayWidth,
          height: displayHeight,
          pdfPage, // This is the actual PDF.js page with render() method
          nativeWidth: pdfPage.getViewport({ scale: 1 }).width,
          nativeHeight: pdfPage.getViewport({ scale: 1 }).height,
        });

        // Register with tile manager
        this.tileManager.registerPage(pageIndex, pdfPage, displayWidth, displayHeight);

        if (this.debug) {
          const tileInfo = this.tileManager.getPageTileInfo(pageIndex);
          console.log(`[TileRenderer] Initialized page ${pageIndex} with PDF.js page: ${tileInfo.tilesX}x${tileInfo.tilesY} tiles`);
        }

        return;
      } catch (err) {
        console.error(`[TileRenderer] Failed to get PDF.js page ${pageIndex}:`, err);
        throw err;
      }
    }

    // Fallback: use book.getPage (won't support tile rendering)
    return new Promise((resolve, reject) => {
      this.book.getPage(pageIndex, (err, pageData) => {
        if (err) {
          reject(err);
          return;
        }

        // Store page metadata (note: this won't have render() method)
        this.pageMetadata.set(pageIndex, {
          width: displayWidth,
          height: displayHeight,
          pdfPage: pageData, // This is the wrapper, not the actual PDF.js page
          nativeWidth: pageData.width,
          nativeHeight: pageData.height,
          isWrapper: true, // Flag that this is not a real PDF.js page
        });

        // Register with tile manager
        this.tileManager.registerPage(pageIndex, pageData, displayWidth, displayHeight);

        if (this.debug) {
          const tileInfo = this.tileManager.getPageTileInfo(pageIndex);
          console.log(`[TileRenderer] Initialized page ${pageIndex} with wrapper: ${tileInfo.tilesX}x${tileInfo.tilesY} tiles (tile rendering limited)`);
        }

        resolve();
      });
    });
  }

  /**
   * Set the display canvas for a page.
   *
   * @param {number} pageIndex - Page index
   * @param {HTMLCanvasElement} canvas - Display canvas element
   */
  setDisplayCanvas(pageIndex, canvas) {
    this.displayCanvases.set(pageIndex, canvas);
  }

  /**
   * Update the zoom level and trigger re-rendering if tier changed.
   *
   * @param {number} zoom - New zoom level (1.0 = 100%)
   * @param {Set<number>} visiblePages - Set of visible page indices
   */
  setZoom(zoom, visiblePages) {
    const oldTier = this.currentTier;
    const { tier: newTier } = getTierForZoom(zoom);

    this.currentZoom = zoom;
    this.currentTier = newTier;

    // Debounce the re-render to avoid excessive updates during zoom gestures
    if (this._zoomDebounceTimer) {
      clearTimeout(this._zoomDebounceTimer);
    }

    this._zoomDebounceTimer = setTimeout(() => {
      if (newTier !== oldTier) {
        this.metrics.tierChanges++;

        if (this.debug) {
          console.log(`[TileRenderer] Tier changed: ${oldTier} -> ${newTier} (zoom: ${(zoom * 100).toFixed(0)}%)`);
        }

        // Re-render visible pages at new tier
        this.renderVisiblePages(visiblePages);
      }

      this._zoomDebounceTimer = null;
    }, 150);
  }

  /**
   * Render visible tiles for a set of pages.
   *
   * @param {Set<number>} visiblePages - Set of visible page indices (1-based)
   * @param {Object} [viewport] - Viewport information
   * @param {number} [viewport.scrollTop] - Scroll position
   * @param {number} [viewport.viewportHeight] - Viewport height
   * @param {boolean} [immediate=false] - If true, skip debounce for immediate render
   */
  renderVisiblePages(visiblePages, viewport = {}, immediate = false) {
    // Store visible pages for re-compositing when tiles complete
    this._lastVisiblePages = visiblePages;

    if (immediate) {
      // Skip debounce for initial/critical renders
      // Pass skipCancel=true to avoid cancelling tiles from other pages during initial load
      this._doRenderVisiblePages(visiblePages, viewport, true);
      return;
    }

    // Debounce rapid calls
    if (this._renderDebounceTimer) {
      clearTimeout(this._renderDebounceTimer);
    }

    this._renderDebounceTimer = setTimeout(() => {
      this._doRenderVisiblePages(visiblePages, viewport, false);
      this._renderDebounceTimer = null;
    }, 16); // ~60fps
  }

  /**
   * Actually perform the visible page rendering.
   * @param {Set<number>} visiblePages - Set of visible page indices (1-based)
   * @param {Object} viewport - Viewport information
   * @param {boolean} skipCancel - If true, don't cancel unneeded tiles (used during initial load)
   * @private
   */
  _doRenderVisiblePages(visiblePages, viewport, skipCancel = false) {
    const allNeededTiles = [];

    for (const pageNum of visiblePages) {
      const pageIndex = pageNum - 1; // Convert to 0-based

      if (!this.pageMetadata.has(pageIndex)) {
        continue;
      }

      const meta = this.pageMetadata.get(pageIndex);

      // For now, render all tiles for visible pages
      // In a full implementation, we'd calculate which tiles are actually visible
      // based on scroll position and zoom
      const tiles = this.tileManager.getVisibleTiles(
        pageIndex,
        0, // scrollX within page
        0, // scrollY within page
        meta.width,
        meta.height,
        this.currentZoom,
        1 // buffer
      );

      for (const tile of tiles) {
        allNeededTiles.push(getTileKey(tile.pageIndex, tile.tileX, tile.tileY, tile.tier));

        // Request tile (will use cache or queue render)
        this.tileManager.getTile(tile.pageIndex, tile.tileX, tile.tileY, tile.tier);
      }
    }

    // Cancel tiles that are no longer needed (skip during initial load to avoid
    // cancelling tiles from other pages that are being initialized concurrently)
    if (!skipCancel) {
      this.tileManager.cancelUnneeded(allNeededTiles);
    }

    // Composite available tiles for each visible page
    for (const pageNum of visiblePages) {
      this._compositePageTiles(pageNum - 1);
    }
  }

  /**
   * Composite all available tiles onto a page's display canvas.
   *
   * @param {number} pageIndex - Page index
   * @private
   */
  _compositePageTiles(pageIndex) {
    const canvas = this.displayCanvases.get(pageIndex);
    const meta = this.pageMetadata.get(pageIndex);

    if (!canvas || !meta) return;

    const tileInfo = this.tileManager.getPageTileInfo(pageIndex);
    if (!tileInfo) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const dpr = window.devicePixelRatio || 1;

    // Ensure canvas is properly sized
    const displayWidth = meta.width;
    const displayHeight = meta.height;

    // Scale canvas for current zoom and DPR
    const { scale } = getTierForZoom(this.currentZoom);
    const canvasScale = scale * dpr;

    // Only resize if needed
    const targetWidth = Math.ceil(displayWidth * canvasScale);
    const targetHeight = Math.ceil(displayHeight * canvasScale);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each tile
    let tilesDrawn = 0;

    for (let tileY = 0; tileY < tileInfo.tilesY; tileY++) {
      for (let tileX = 0; tileX < tileInfo.tilesX; tileX++) {
        // Try to get tile at current tier, or fallback to another tier
        const { canvas: tileCanvas, actualTier, status } = this.tileManager.getTileWithFallback(
          pageIndex, tileX, tileY, this.currentTier
        );

        if (tileCanvas) {
          // Calculate destination position on display canvas
          const destX = tileX * this.tileSize * canvasScale;
          const destY = tileY * this.tileSize * canvasScale;

          // Calculate tile dimensions
          const tileWidth = Math.min(this.tileSize, meta.width - tileX * this.tileSize);
          const tileHeight = Math.min(this.tileSize, meta.height - tileY * this.tileSize);

          const destWidth = tileWidth * canvasScale;
          const destHeight = tileHeight * canvasScale;

          // Check if this tile is animating (fade-in)
          const tileKey = getTileKey(pageIndex, tileX, tileY, actualTier);
          const anim = this._tileAnimations.get(tileKey);
          let alpha = 1;

          if (anim && actualTier === this.currentTier) {
            const elapsed = performance.now() - anim.startTime;
            alpha = Math.min(1, elapsed / this._fadeInDuration);
          }

          // Apply alpha for fade-in effect
          ctx.globalAlpha = alpha;

          // Draw tile, scaling if from different tier
          ctx.drawImage(
            tileCanvas,
            0, 0, tileCanvas.width, tileCanvas.height,
            destX, destY, destWidth, destHeight
          );

          // Reset alpha
          ctx.globalAlpha = 1;

          tilesDrawn++;

          // Debug: show tile boundaries
          if (this.debug) {
            ctx.strokeStyle = actualTier === this.currentTier ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 165, 0, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(destX, destY, destWidth, destHeight);
          }
        } else {
          // Draw placeholder for missing tile
          const destX = tileX * this.tileSize * canvasScale;
          const destY = tileY * this.tileSize * canvasScale;
          const tileWidth = Math.min(this.tileSize, meta.width - tileX * this.tileSize);
          const tileHeight = Math.min(this.tileSize, meta.height - tileY * this.tileSize);

          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(destX, destY, tileWidth * canvasScale, tileHeight * canvasScale);

          if (this.debug) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(destX, destY, tileWidth * canvasScale, tileHeight * canvasScale);
          }
        }
      }
    }

    this.metrics.compositeOperations++;

    if (this.debug && tilesDrawn > 0) {
      console.log(`[TileRenderer] Composited page ${pageIndex}: ${tilesDrawn}/${tileInfo.tilesX * tileInfo.tilesY} tiles`);
    }
  }

  /**
   * Called when a tile finishes rendering.
   * @private
   */
  _onTileRendered(pageIndex, tileX, tileY, tier, canvas) {
    this.metrics.tilesRendered++;

    // Re-composite the page to show the new tile
    if (tier === this.currentTier) {
      // Track tile for fade-in animation
      const tileKey = getTileKey(pageIndex, tileX, tileY, tier);
      this._tileAnimations.set(tileKey, {
        startTime: performance.now(),
        pageIndex,
      });

      // Immediately composite to show the new tile
      this._compositePageTiles(pageIndex);

      // Start animation loop for fade-in effect
      this._startAnimationLoop();
    }

    if (this.onTileProgress) {
      this.onTileProgress(pageIndex, tileX, tileY, tier);
    }
  }

  /**
   * Start the animation loop for fade-in effects.
   * @private
   */
  _startAnimationLoop() {
    if (this._animationFrame) return;

    const animate = () => {
      const now = performance.now();
      const pagesToComposite = new Set();
      let hasActiveAnimations = false;

      // Check all animations
      for (const [tileKey, anim] of this._tileAnimations) {
        const elapsed = now - anim.startTime;
        if (elapsed < this._fadeInDuration) {
          hasActiveAnimations = true;
          pagesToComposite.add(anim.pageIndex);
        } else {
          // Animation complete, remove from tracking
          this._tileAnimations.delete(tileKey);
          pagesToComposite.add(anim.pageIndex);
        }
      }

      // Composite pages that have animating tiles
      for (const pageIndex of pagesToComposite) {
        this._compositePageTiles(pageIndex);
      }

      // Continue loop if animations are active
      if (hasActiveAnimations) {
        this._animationFrame = requestAnimationFrame(animate);
      } else {
        this._animationFrame = null;
      }
    };

    this._animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Clean up resources for pages that are no longer visible.
   *
   * @param {number} currentPage - Current page index
   * @param {number} [buffer=3] - Number of pages to keep around current
   */
  cleanup(currentPage, buffer = 3) {
    this.tileManager.cleanup(currentPage, this.currentTier);

    if (this.debug) {
      const stats = this.tileManager.getStats();
      console.log(`[TileRenderer] Cleanup complete. Cache: ${stats.cacheSize}, Pending: ${stats.pendingCount}`);
    }
  }

  /**
   * Clear all tiles for a specific page.
   *
   * @param {number} pageIndex - Page index
   */
  clearPage(pageIndex) {
    this.tileManager.cache.clearPage(pageIndex);
  }

  /**
   * Clear all cached tiles and pending renders.
   */
  clearAll() {
    this.tileManager.cache.clear();
    this.tileManager.clearQueue();
  }

  /**
   * Get rendering statistics.
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.metrics,
      ...this.tileManager.getStats(),
      currentTier: this.currentTier,
      currentZoom: this.currentZoom,
    };
  }

  /**
   * Force re-render of a page at current tier.
   *
   * @param {number} pageIndex - Page index
   */
  rerenderPage(pageIndex) {
    // Clear cached tiles for this page at current tier
    const tileInfo = this.tileManager.getPageTileInfo(pageIndex);
    if (!tileInfo) return;

    for (let tileY = 0; tileY < tileInfo.tilesY; tileY++) {
      for (let tileX = 0; tileX < tileInfo.tilesX; tileX++) {
        const key = getTileKey(pageIndex, tileX, tileY, this.currentTier);
        this.tileManager.cache.delete(key);
      }
    }

    // Also clear the full-page cache for this page (needed for search highlights)
    this.tileManager.clearFullPageCache(pageIndex);

    // Re-request tiles
    this.renderVisiblePages(new Set([pageIndex + 1]));
  }
}
