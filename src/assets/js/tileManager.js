/**
 * @file Tile-based rendering system for PDF pages.
 *
 * This module implements a tile-based rendering approach that:
 * - Divides pages into fixed-size tiles
 * - Renders only visible tiles at appropriate resolution
 * - Caches tiles with LRU eviction
 * - Supports multiple resolution tiers for different zoom levels
 */

/**
 * Resolution tiers for different zoom levels.
 * Each tier defines the render scale for optimal quality/memory trade-off.
 */
export const RESOLUTION_TIERS = [
  { tier: 0, minZoom: 0.25, maxZoom: 0.5, scale: 0.5 },
  { tier: 1, minZoom: 0.5, maxZoom: 1.0, scale: 1.0 },
  { tier: 2, minZoom: 1.0, maxZoom: 2.0, scale: 2.0 },
  { tier: 3, minZoom: 2.0, maxZoom: 5.0, scale: 4.0 },
];

/**
 * Get the appropriate resolution tier for a zoom level.
 * @param {number} zoom - Current zoom level (1.0 = 100%)
 * @returns {{ tier: number, scale: number }} The tier info
 */
export function getTierForZoom(zoom) {
  for (const tierInfo of RESOLUTION_TIERS) {
    if (zoom >= tierInfo.minZoom && zoom < tierInfo.maxZoom) {
      return { tier: tierInfo.tier, scale: tierInfo.scale };
    }
  }
  // Default to highest tier for zoom >= 5.0
  return { tier: 3, scale: 4.0 };
}

/**
 * Generate a unique key for a tile.
 * @param {number} pageIndex - 0-based page index
 * @param {number} tileX - Tile X coordinate
 * @param {number} tileY - Tile Y coordinate
 * @param {number} tier - Resolution tier
 * @returns {string} Unique tile key
 */
export function getTileKey(pageIndex, tileX, tileY, tier) {
  return `${pageIndex}:${tileX}:${tileY}:${tier}`;
}

/**
 * Parse a tile key back to its components.
 * @param {string} key - Tile key
 * @returns {{ pageIndex: number, tileX: number, tileY: number, tier: number }}
 */
export function parseTileKey(key) {
  const [pageIndex, tileX, tileY, tier] = key.split(':').map(Number);
  return { pageIndex, tileX, tileY, tier };
}

/**
 * LRU Cache for rendered tiles.
 */
export class TileCache {
  /**
   * @param {number} maxSize - Maximum number of tiles to cache
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map(); // Map<string, { canvas: HTMLCanvasElement, lastAccess: number }>
  }

  /**
   * Get a tile from cache.
   * @param {string} key - Tile key
   * @returns {HTMLCanvasElement|null} The cached canvas or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.canvas;
    }
    return null;
  }

  /**
   * Add a tile to cache.
   * @param {string} key - Tile key
   * @param {HTMLCanvasElement} canvas - Rendered tile canvas
   */
  set(key, canvas) {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    this.cache.set(key, {
      canvas,
      lastAccess: Date.now(),
    });
  }

  /**
   * Check if a tile is in cache.
   * @param {string} key - Tile key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Remove a specific tile from cache.
   * @param {string} key - Tile key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all tiles for a specific page.
   * @param {number} pageIndex - Page index to clear
   */
  clearPage(pageIndex) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${pageIndex}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all tiles at a specific tier.
   * @param {number} tier - Tier to clear
   */
  clearTier(tier) {
    for (const key of this.cache.keys()) {
      if (key.endsWith(`:${tier}`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get current cache size.
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Evict least recently used tile.
   * @private
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Evict tiles far from current viewport.
   * @param {number} currentPage - Current page index
   * @param {number} currentTier - Current resolution tier
   * @param {number} pageBuffer - Number of pages to keep around current
   */
  evictDistant(currentPage, currentTier, pageBuffer = 3) {
    const keysToDelete = [];

    for (const key of this.cache.keys()) {
      const { pageIndex, tier } = parseTileKey(key);

      // Evict tiles from distant pages
      if (Math.abs(pageIndex - currentPage) > pageBuffer) {
        keysToDelete.push(key);
        continue;
      }

      // Evict tiles from non-adjacent tiers (keep current ± 1)
      if (Math.abs(tier - currentTier) > 1) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
}

/**
 * Manages tile-based rendering for PDF pages.
 */
export class TileManager {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.tileSize=512] - Size of each tile in pixels (at 1x scale)
   * @param {number} [options.cacheSize=100] - Maximum tiles to cache
   * @param {number} [options.maxFullPageCacheSize] - Maximum full-page canvases to cache (default: 10 desktop, 5 mobile)
   * @param {boolean} [options.isMobile=false] - Whether running on a mobile device
   * @param {boolean} [options.debug=false] - Enable debug logging
   */
  constructor(options = {}) {
    this.tileSize = options.tileSize || 512;
    this.cacheSize = options.cacheSize || 100;
    this.debug = options.debug || false;

    // Detect mobile for memory limits
    const isMobile = options.isMobile !== undefined
      ? options.isMobile
      : (typeof window !== 'undefined' && window.innerWidth <= 768);

    // Full-page cache size limit (configurable, with sensible defaults)
    this.maxFullPageCacheSize = options.maxFullPageCacheSize || (isMobile ? 5 : 10);

    this.cache = new TileCache(this.cacheSize);
    this.pending = new Set(); // Tile keys currently being rendered
    this.pageInfo = new Map(); // Map<pageIndex, { width, height, pdfPage }>

    // Full-page render cache to avoid re-rendering the same page for each tile
    // Key: "pageIndex:tier", Value: { canvas, inProgress: Promise|null, lastAccess: number }
    this.fullPageCache = new Map();

    // LRU tracking for full-page cache
    this.fullPageCacheOrder = []; // Array of cache keys in access order (oldest first)

    this.renderQueue = [];
    this.isProcessingQueue = false;

    // Instance-scoped highlights (replaces window.__pdfagogo__highlights)
    this._highlights = {};

    // Callbacks
    this.onTileReady = null; // Called when a tile finishes rendering
  }

  /**
   * Set search highlights for rendering.
   * @param {Object} highlights - Map of pageIndex to array of highlight boxes
   */
  setHighlights(highlights) {
    this._highlights = highlights || {};
  }

  /**
   * Clear all highlights.
   */
  clearHighlights() {
    this._highlights = {};
  }

  /**
   * Get highlights for a specific page.
   * @param {number} pageIndex - Page index (0-based)
   * @returns {Array} Array of highlight boxes or empty array
   */
  getHighlights(pageIndex) {
    // Check instance-scoped highlights first
    if (this._highlights[pageIndex] && this._highlights[pageIndex].length > 0) {
      return this._highlights[pageIndex];
    }
    // Fallback to window global for backward compatibility with search.js
    if (typeof window !== 'undefined' && window.__pdfagogo__highlights) {
      return window.__pdfagogo__highlights[pageIndex] || [];
    }
    return [];
  }

  /**
   * Register a PDF page with the tile manager.
   * @param {number} pageIndex - 0-based page index
   * @param {Object} pdfPage - PDF.js page object
   * @param {number} width - Page width in CSS pixels
   * @param {number} height - Page height in CSS pixels
   */
  registerPage(pageIndex, pdfPage, width, height) {
    this.pageInfo.set(pageIndex, { width, height, pdfPage });

    if (this.debug) {
      const tilesX = Math.ceil(width / this.tileSize);
      const tilesY = Math.ceil(height / this.tileSize);
      console.log(`[TileManager] Registered page ${pageIndex}: ${width}x${height}, ${tilesX}x${tilesY} tiles`);
    }
  }

  /**
   * Get tile grid info for a page.
   * @param {number} pageIndex - Page index
   * @returns {{ tilesX: number, tilesY: number, width: number, height: number }|null}
   */
  getPageTileInfo(pageIndex) {
    const info = this.pageInfo.get(pageIndex);
    if (!info) return null;

    return {
      tilesX: Math.ceil(info.width / this.tileSize),
      tilesY: Math.ceil(info.height / this.tileSize),
      width: info.width,
      height: info.height,
    };
  }

  /**
   * Calculate which tiles are visible in the current viewport.
   * @param {number} pageIndex - Page index
   * @param {number} scrollX - Horizontal scroll offset within page
   * @param {number} scrollY - Vertical scroll offset within page
   * @param {number} viewportWidth - Viewport width in CSS pixels
   * @param {number} viewportHeight - Viewport height in CSS pixels
   * @param {number} zoom - Current zoom level
   * @param {number} [buffer=1] - Extra tiles to include around visible area
   * @returns {Array<{ pageIndex: number, tileX: number, tileY: number, tier: number, priority: number }>}
   */
  getVisibleTiles(pageIndex, scrollX, scrollY, viewportWidth, viewportHeight, zoom, buffer = 1) {
    const info = this.pageInfo.get(pageIndex);
    if (!info) return [];

    const { tier } = getTierForZoom(zoom);

    // Calculate visible area in page coordinates (accounting for zoom)
    const visibleLeft = scrollX / zoom;
    const visibleTop = scrollY / zoom;
    const visibleRight = visibleLeft + viewportWidth / zoom;
    const visibleBottom = visibleTop + viewportHeight / zoom;

    // Calculate tile range
    const startTileX = Math.max(0, Math.floor(visibleLeft / this.tileSize) - buffer);
    const endTileX = Math.min(
      Math.ceil(info.width / this.tileSize) - 1,
      Math.ceil(visibleRight / this.tileSize) + buffer
    );
    const startTileY = Math.max(0, Math.floor(visibleTop / this.tileSize) - buffer);
    const endTileY = Math.min(
      Math.ceil(info.height / this.tileSize) - 1,
      Math.ceil(visibleBottom / this.tileSize) + buffer
    );

    const tiles = [];
    const centerX = (startTileX + endTileX) / 2;
    const centerY = (startTileY + endTileY) / 2;

    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        // Priority based on distance from center (lower = higher priority)
        const distance = Math.sqrt(
          Math.pow(tileX - centerX, 2) + Math.pow(tileY - centerY, 2)
        );

        tiles.push({
          pageIndex,
          tileX,
          tileY,
          tier,
          priority: distance,
        });
      }
    }

    // Sort by priority (center tiles first)
    tiles.sort((a, b) => a.priority - b.priority);

    return tiles;
  }

  /**
   * Get a tile canvas, either from cache or queue for rendering.
   * @param {number} pageIndex - Page index
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {number} tier - Resolution tier
   * @returns {{ canvas: HTMLCanvasElement|null, status: 'cached'|'pending'|'queued' }}
   */
  getTile(pageIndex, tileX, tileY, tier) {
    const key = getTileKey(pageIndex, tileX, tileY, tier);

    // Check cache first
    const cached = this.cache.get(key);
    if (cached) {
      return { canvas: cached, status: 'cached' };
    }

    // Check if already pending
    if (this.pending.has(key)) {
      return { canvas: null, status: 'pending' };
    }

    // Queue for rendering
    this._queueTileRender(pageIndex, tileX, tileY, tier);
    return { canvas: null, status: 'queued' };
  }

  /**
   * Get a tile from cache or a lower-resolution fallback.
   * @param {number} pageIndex - Page index
   * @param {number} tileX - Tile X coordinate
   * @param {number} tileY - Tile Y coordinate
   * @param {number} tier - Desired resolution tier
   * @returns {{ canvas: HTMLCanvasElement|null, actualTier: number, status: 'exact'|'fallback'|'none' }}
   */
  getTileWithFallback(pageIndex, tileX, tileY, tier) {
    // Try exact tier first
    const exactKey = getTileKey(pageIndex, tileX, tileY, tier);
    const exactCached = this.cache.get(exactKey);
    if (exactCached) {
      return { canvas: exactCached, actualTier: tier, status: 'exact' };
    }

    // Try adjacent tiers as fallback
    for (const fallbackTier of [tier - 1, tier + 1, tier - 2, tier + 2]) {
      if (fallbackTier < 0 || fallbackTier > 3) continue;

      const fallbackKey = getTileKey(pageIndex, tileX, tileY, fallbackTier);
      const fallbackCached = this.cache.get(fallbackKey);
      if (fallbackCached) {
        return { canvas: fallbackCached, actualTier: fallbackTier, status: 'fallback' };
      }
    }

    return { canvas: null, actualTier: tier, status: 'none' };
  }

  /**
   * Queue a tile for rendering.
   * @private
   */
  _queueTileRender(pageIndex, tileX, tileY, tier, priority = 0) {
    const key = getTileKey(pageIndex, tileX, tileY, tier);

    if (this.pending.has(key) || this.cache.has(key)) {
      return;
    }

    this.pending.add(key);
    this.renderQueue.push({ pageIndex, tileX, tileY, tier, key, priority });

    // Sort queue by priority
    this.renderQueue.sort((a, b) => a.priority - b.priority);

    this._processQueue();
  }

  /**
   * Process the render queue.
   * @private
   */
  _processQueue() {
    if (this.isProcessingQueue || this.renderQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    const processNext = () => {
      if (this.renderQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      const task = this.renderQueue.shift();

      // Skip if no longer pending (was cancelled)
      if (!this.pending.has(task.key)) {
        requestAnimationFrame(processNext);
        return;
      }

      this._renderTile(task.pageIndex, task.tileX, task.tileY, task.tier)
        .then((canvas) => {
          this.pending.delete(task.key);

          if (canvas) {
            this.cache.set(task.key, canvas);

            if (this.onTileReady) {
              this.onTileReady(task.pageIndex, task.tileX, task.tileY, task.tier, canvas);
            }
          }

          requestAnimationFrame(processNext);
        })
        .catch((error) => {
          console.error(`[TileManager] Failed to render tile ${task.key}:`, error);
          this.pending.delete(task.key);
          requestAnimationFrame(processNext);
        });
    };

    requestAnimationFrame(processNext);
  }

  /**
   * Get or render the full page canvas for a given page and tier.
   * Caches the result to avoid re-rendering for each tile.
   * Enforces LRU eviction when cache exceeds maxFullPageCacheSize.
   * @private
   */
  async _getFullPageCanvas(pageIndex, tier) {
    const cacheKey = `${pageIndex}:${tier}`;

    // Check if we have a cached canvas
    const cached = this.fullPageCache.get(cacheKey);
    if (cached) {
      // If there's an in-progress render, wait for it
      if (cached.inProgress) {
        return cached.inProgress;
      }
      // Update LRU order (move to end = most recently used)
      this._updateFullPageCacheLRU(cacheKey);
      // Return cached canvas
      return cached.canvas;
    }

    // Enforce cache limit before adding new entry
    this._enforceFullPageCacheLimit();

    // Start rendering and cache the promise to prevent duplicate renders
    const renderPromise = this._renderFullPage(pageIndex, tier);

    // Store the in-progress promise
    this.fullPageCache.set(cacheKey, { canvas: null, inProgress: renderPromise, lastAccess: Date.now() });
    this.fullPageCacheOrder.push(cacheKey);

    try {
      const canvas = await renderPromise;
      // Update cache with completed canvas
      this.fullPageCache.set(cacheKey, { canvas, inProgress: null, lastAccess: Date.now() });
      return canvas;
    } catch (error) {
      // Remove from cache on error
      this.fullPageCache.delete(cacheKey);
      this.fullPageCacheOrder = this.fullPageCacheOrder.filter(k => k !== cacheKey);
      throw error;
    }
  }

  /**
   * Update LRU order for a cache key (move to end = most recently used).
   * @param {string} cacheKey - The cache key to update
   * @private
   */
  _updateFullPageCacheLRU(cacheKey) {
    const idx = this.fullPageCacheOrder.indexOf(cacheKey);
    if (idx !== -1) {
      this.fullPageCacheOrder.splice(idx, 1);
      this.fullPageCacheOrder.push(cacheKey);
    }
    // Update lastAccess timestamp
    const entry = this.fullPageCache.get(cacheKey);
    if (entry) {
      entry.lastAccess = Date.now();
    }
  }

  /**
   * Enforce the full-page cache size limit using LRU eviction.
   * Removes oldest entries until cache is within limit.
   * @private
   */
  _enforceFullPageCacheLimit() {
    let skipped = 0;
    const maxSkips = this.fullPageCacheOrder.length;

    while (this.fullPageCache.size >= this.maxFullPageCacheSize && this.fullPageCacheOrder.length > 0) {
      // Guard: if we've skipped all entries (all in-progress), break to avoid infinite loop
      if (skipped >= maxSkips) {
        if (this.debug) {
          console.log(`[TileManager] All ${maxSkips} cache entries are in-progress, cannot evict`);
        }
        break;
      }

      // Remove oldest entry (first in order array)
      const oldestKey = this.fullPageCacheOrder.shift();
      if (oldestKey) {
        const entry = this.fullPageCache.get(oldestKey);
        // Don't evict entries with in-progress renders
        if (entry && entry.inProgress) {
          // Put it back at the end and try the next one
          this.fullPageCacheOrder.push(oldestKey);
          skipped++;
          continue;
        }
        this.fullPageCache.delete(oldestKey);
        if (this.debug) {
          console.log(`[TileManager] Evicted full-page cache: ${oldestKey} (size now: ${this.fullPageCache.size})`);
        }
      }
    }
  }

  /**
   * Render a full PDF page at the given tier scale.
   * @private
   */
  async _renderFullPage(pageIndex, tier) {
    const info = this.pageInfo.get(pageIndex);
    if (!info || !info.pdfPage) {
      throw new Error(`No page info for page ${pageIndex}`);
    }

    // Get the tier's render scale multiplier
    const { scale: tierScale } = getTierForZoom(RESOLUTION_TIERS[tier].minZoom);
    const dpr = window.devicePixelRatio || 1;

    // Calculate the base scale needed to fit PDF to display dimensions
    const nativeViewport = info.pdfPage.getViewport({ scale: 1 });
    const baseScale = info.width / nativeViewport.width;

    // Final render scale combines: base scale * tier multiplier * device pixel ratio
    const renderScale = baseScale * tierScale * dpr;

    // Get the PDF page viewport at render scale
    const viewport = info.pdfPage.getViewport({ scale: renderScale });

    // Create full-page canvas
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = Math.ceil(viewport.width);
    fullCanvas.height = Math.ceil(viewport.height);

    const fullCtx = fullCanvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    });

    // Fill with white background
    fullCtx.fillStyle = '#ffffff';
    fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);

    // Render the full page
    await info.pdfPage.render({
      canvasContext: fullCtx,
      viewport: viewport,
    }).promise;

    // Draw search highlights if present for this page
    const highlights = this.getHighlights(pageIndex);
    if (Array.isArray(highlights) && highlights.length > 0) {
      fullCtx.save();
      fullCtx.globalCompositeOperation = 'multiply';
      fullCtx.globalAlpha = 1.0;
      fullCtx.fillStyle = 'rgba(255, 255, 0, 1)';

      for (const hl of highlights) {
        // Convert highlight coordinates from PDF space to viewport space
        const rect = viewport.convertToViewportRectangle([
          hl.x,
          hl.y,
          hl.x + hl.width,
          hl.y + hl.height
        ]);
        const left = Math.min(rect[0], rect[2]);
        const top = Math.min(rect[1], rect[3]);
        const width = Math.abs(rect[2] - rect[0]);
        const height = Math.abs(rect[3] - rect[1]);
        fullCtx.fillRect(left, top, width, height);
      }

      fullCtx.restore();
    }

    if (this.debug) {
      console.log(`[TileManager] Rendered full page ${pageIndex} at tier ${tier} (${fullCanvas.width}x${fullCanvas.height})`);
    }

    return fullCanvas;
  }

  /**
   * Render a single tile by extracting from the cached full-page render.
   * @private
   */
  async _renderTile(pageIndex, tileX, tileY, tier) {
    const info = this.pageInfo.get(pageIndex);
    if (!info || !info.pdfPage) {
      console.warn(`[TileManager] No page info for page ${pageIndex}`);
      return null;
    }

    // Get the tier's render scale multiplier
    const { scale: tierScale } = getTierForZoom(RESOLUTION_TIERS[tier].minZoom);
    const dpr = window.devicePixelRatio || 1;

    // Calculate tile bounds in display coordinates (CSS pixels)
    const tileLeft = tileX * this.tileSize;
    const tileTop = tileY * this.tileSize;
    const tileWidth = Math.min(this.tileSize, info.width - tileLeft);
    const tileHeight = Math.min(this.tileSize, info.height - tileTop);

    if (tileWidth <= 0 || tileHeight <= 0) {
      return null;
    }

    // Get the full-page canvas (cached or rendered)
    const fullCanvas = await this._getFullPageCanvas(pageIndex, tier);

    // Convert tile position from display coordinates to render coordinates
    const renderTileLeft = tileLeft * tierScale * dpr;
    const renderTileTop = tileTop * tierScale * dpr;

    // Create the tile canvas and extract the tile portion
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(tileWidth * tierScale * dpr);
    canvas.height = Math.ceil(tileHeight * tierScale * dpr);

    const ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    });

    // Fill tile with white background first
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Copy the tile portion from the full page canvas
    ctx.drawImage(
      fullCanvas,
      renderTileLeft, renderTileTop, canvas.width, canvas.height, // Source rectangle
      0, 0, canvas.width, canvas.height // Destination rectangle
    );

    if (this.debug) {
      // Draw tile debug border
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Draw tile coordinates
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.font = '12px monospace';
      ctx.fillText(`${tileX},${tileY} T${tier}`, 5, 15);
    }

    return canvas;
  }

  /**
   * Cancel pending renders for tiles that are no longer needed.
   * @param {Array<string>} neededKeys - Tile keys that are still needed
   */
  cancelUnneeded(neededKeys) {
    const neededSet = new Set(neededKeys);

    // Remove from pending
    for (const key of this.pending) {
      if (!neededSet.has(key)) {
        this.pending.delete(key);
      }
    }

    // Remove from queue
    this.renderQueue = this.renderQueue.filter(task => neededSet.has(task.key));
  }

  /**
   * Clear all pending renders.
   */
  clearQueue() {
    this.pending.clear();
    this.renderQueue = [];
  }

  /**
   * Perform memory cleanup based on current viewport.
   * @param {number} currentPage - Current page index
   * @param {number} currentTier - Current resolution tier
   */
  cleanup(currentPage, currentTier) {
    this.cache.evictDistant(currentPage, currentTier);

    // Also clean up full-page cache for distant pages
    const buffer = 3;
    const keysToRemove = [];
    for (const [key, _] of this.fullPageCache) {
      const [pageStr, tierStr] = key.split(':');
      const pageIndex = parseInt(pageStr, 10);
      const tier = parseInt(tierStr, 10);

      // Evict if page is far from current or different tier
      if (Math.abs(pageIndex - currentPage) > buffer || tier !== currentTier) {
        keysToRemove.push(key);
      }
    }

    // Remove keys and sync fullPageCacheOrder
    for (const key of keysToRemove) {
      this.fullPageCache.delete(key);
      const orderIdx = this.fullPageCacheOrder.indexOf(key);
      if (orderIdx !== -1) {
        this.fullPageCacheOrder.splice(orderIdx, 1);
      }
    }

    if (this.debug) {
      console.log(`[TileManager] Cache size after cleanup: ${this.cache.size}, Full page cache: ${this.fullPageCache.size}`);
    }
  }

  /**
   * Clear the full-page cache for a specific page (all tiers).
   * Used when re-rendering a page (e.g., for search highlights).
   * @param {number} pageIndex - Page index to clear
   */
  clearFullPageCache(pageIndex) {
    for (const key of this.fullPageCache.keys()) {
      if (key.startsWith(`${pageIndex}:`)) {
        this.fullPageCache.delete(key);
      }
    }
  }

  /**
   * Get debug statistics.
   * @returns {Object}
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      fullPageCacheSize: this.fullPageCache.size,
      maxFullPageCacheSize: this.maxFullPageCacheSize,
      pendingCount: this.pending.size,
      queueLength: this.renderQueue.length,
      registeredPages: this.pageInfo.size,
    };
  }
}
