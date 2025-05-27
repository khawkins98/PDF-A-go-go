/**
 * @file ConfigManager.js
 * Manages configuration options for the PDF viewer.
 * Provides a centralized way to access and modify viewer settings.
 */

/**
 * @typedef {object} ViewerOptions
 * @property {string} [pdfUrl] - URL of the PDF file to load.
 * @property {number} [defaultPage=1] - The page number to display initially (1-indexed).
 * @property {number} [initialScale='auto'] - Initial zoom level. Can be a number (e.g., 1.5 for 150%) or 'auto', 'page-width', 'page-height', 'page-fit'.
 * @property {number} [minScale=0.25] - Minimum allowed zoom level.
 * @property {number} [maxScale=10] - Maximum allowed zoom level.
 * @property {number} [zoomStep=0.25] - Increment/decrement step for zoom controls.
 * @property {boolean} [showToolbar=true] - Whether to display the main toolbar.
 * @property {boolean} [showSearch=true] - Whether to display the search controls.
 * @property {boolean} [showPrevNext=true] - Whether to display previous/next page buttons.
 * @property {boolean} [showPageSelector=true] - Whether to display the page number input and go button.
 * @property {boolean} [showCurrentPage=true] - Whether to display the current page/total pages indicator.
 * @property {boolean} [showZoomControls=true] - Whether to display zoom in/out buttons.
 * @property {boolean} [showRotateControls=true] - Whether to display rotate clockwise/counter-clockwise buttons.
 * @property {boolean} [showDownload=true] - Whether to display the download button.
 * @property {boolean} [showPrint=true] - Whether to display the print button.
 * @property {boolean} [showFullScreen=true] - Whether to display the fullscreen button.
 * @property {boolean} [showPresentationMode=true] - Whether to display the presentation mode button.
 * @property {boolean} [showOpenFile=true] - Whether to display the open file button.
 * @property {boolean} [showSidebar=true] - Whether to show the sidebar (thumbnails, outline, attachments) by default.
 * @property {boolean} [showResizeGrip=true] - Whether to show the resize grip at the bottom of the viewer.
 * @property {boolean} [enableTextSelection=true] - Whether text selection is enabled.
 * @property {boolean} [enableGrabAndScroll=true] - Whether grab-and-scroll (pan) functionality is enabled.
 * @property {number} [viewerCssPPM=window.devicePixelRatio] - Pixels per "CSS millimeter" for rendering, effectively a DPI setting.
 * @property {number} [maxImageSize=-1] - Maximum image size in megapixels to render, -1 for no limit.
 * @property {string} [workerSrc='./pdf.worker.min.js'] - Path to the PDF.js worker script.
 * @property {string} [cMapUrl='./cmaps/'] - URL for character map files (for some Asian languages).
 * @property {boolean} [cMapPacked=true] - Whether CMaps are packed.
 * @property {boolean} [debug=false] - Enable debug logging for the viewer core.
 * @property {object} [httpHeaders={}] - Custom HTTP headers for PDF requests.
 * @property {boolean} [withCredentials=false] - Whether to include credentials (cookies) with PDF requests.
 * @property {number} [renderDebounceMs=100] - Debounce time in milliseconds for re-rendering on scroll/resize.
 * @property {number} [scrollDebounceMs=50] - Debounce time for scroll event handling.
 * @property {number} [resizeDebounceMs=150] - Debounce time for resize event handling.
 * @property {number} [pageCacheSize=10] - Number of rendered pages to keep in an off-screen cache.
 * @property {number} [lowResRenderQuality=0.5] - Multiplier for rendering low-resolution previews (0.1 to 1.0).
 * @property {number} [highResRenderDelayMs=250] - Delay in ms before rendering a high-resolution version of a page after scrolling stops.
 * @property {string} [containerId='pdfagogo-container'] - Default ID for the main viewer container if created dynamically.
 */

/**
 * Default configuration options for the PDF viewer.
 * These values are used if not overridden by user-provided options.
 * @type {Readonly<ViewerOptions>}
 */
export const DEFAULT_OPTIONS = Object.freeze({
  pdfUrl: null,
  defaultPage: 1,
  initialScale: 'auto', // 'auto', 'page-width', 'page-height', 'page-fit', or a number
  minScale: 0.25,
  maxScale: 10,
  zoomStep: 0.25,
  showToolbar: true,
  showSearch: true,
  showPrevNext: true,
  showPageSelector: true,
  showCurrentPage: true,
  showZoomControls: true,
  showRotateControls: true,
  showDownload: true,
  showPrint: true,
  showFullScreen: true,
  showPresentationMode: true,
  showOpenFile: true,
  showSidebar: true, // Initial state of the sidebar
  showResizeGrip: true,
  enableTextSelection: true,
  enableGrabAndScroll: true,
  viewerCssPPM: typeof window !== 'undefined' ? window.devicePixelRatio : 1, // Pixels per "CSS millimeter" for rendering.
  maxImageSize: -1, // No limit on image size by default.
  workerSrc: './pdf.worker.min.js', // Default path to PDF.js worker
  cMapUrl: './cmaps/', // Default path to CMaps
  cMapPacked: true, // Assume CMaps are packed by default
  debug: false,
  httpHeaders: {},
  withCredentials: false,
  renderDebounceMs: 100, // Debounce for rendering pages during scroll/resize
  scrollDebounceMs: 50,
  resizeDebounceMs: 150,
  pageCacheSize: 10,      // How many rendered pages to keep around (approx)
  lowResRenderQuality: 0.5, // For quick previews during scroll, 0.1 (worst) to 1.0 (best, but slower)
  highResRenderDelayMs: 250, // After scroll stops, how long to wait before rendering high-res
  containerId: 'pdfagogo-container'
});

/**
 * Manages configuration options for the PDF viewer.
 * It merges user-provided options with defaults and provides methods to access them.
 */
export class ConfigManager {
  /**
   * @private
   * @type {ViewerOptions}
   * Stores the merged configuration options (defaults + user overrides).
   */
  _options;

  /**
   * Creates a new ConfigManager instance.
   * Merges user-provided options with the default options.
   * @param {Partial<ViewerOptions>} [userOptions={}] - User-provided configuration options to override defaults.
   */
  constructor(userOptions = {}) {
    this._options = { ...DEFAULT_OPTIONS, ...userOptions };
    if (this._options.debug) {
      console.log('[ConfigManager] Initialized with options:', this._options);
    }
  }

  /**
   * Retrieves the value of a specific configuration option.
   * @param {keyof ViewerOptions} key - The key of the option to retrieve.
   * @param {*} [defaultValue] - An optional default value to return if the key is not found (though all DEFAULT_OPTIONS keys should exist).
   * @returns {*} The value of the configuration option, or the defaultValue if not found.
   */
  get(key, defaultValue) {
    if (this._options.hasOwnProperty(key)) {
      return this._options[key];
    }
    if (this._options.debug) {
      console.warn(`[ConfigManager] Option "${String(key)}" not found, returning provided default or undefined.`);
    }
    return defaultValue;
  }

  /**
   * Retrieves all configuration options.
   * @returns {Readonly<ViewerOptions>} A read-only copy of all current configuration options.
   */
  getAll() {
    return Object.freeze({ ...this._options });
  }

  /**
   * Sets the value of a specific configuration option.
   * Note: This is generally used for dynamic updates post-initialization if supported by the consuming components.
   * Some options might require re-initialization of the viewer or specific components to take effect.
   * @param {keyof ViewerOptions} key - The key of the option to set.
   * @param {*} value - The new value for the option.
   */
  set(key, value) {
    // Potentially add validation or type checking here in the future if needed.
    this._options[key] = value;
    if (this._options.debug) {
      console.log(`[ConfigManager] Option "${String(key)}" set to:`, value);
    }
    // Consider emitting an event if other modules need to react to config changes dynamically.
    // For example: this.eventBus.emit('configChanged', { key, value });
  }

  // Potentially add methods for specific option types or groups if needed in the future.
  // e.g., isFeatureEnabled(featureKey), getNumericOption(key, defaultVal)
} 