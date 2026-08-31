/**
 * @file PDF-A-go-go: Main entry point for the accessible PDF viewer application.
 *
 * This module provides the core initialization and configuration parsing for the PDF-A-go-go viewer.
 * It handles PDF loading with progress tracking, HTML download detection, and viewer setup with
 * comprehensive accessibility support. Supports multiple independent viewer instances on the same page.
 *
 * @author PDF-A-go-go Contributors
 * @version 2.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

import { loadPdfWithProgress, setWorkerUrl } from "./pdfLoader.js";
import { createLoadingBar, updateLoadingBar, removeLoadingBar, showError, setupControls } from "./ui.js";
import { ScrollablePdfViewer } from "./scrollablePdfViewer.js";
import { ViewerInstance } from "./viewerInstance.js";
import { SearchController } from "./searchController.js";
import { resolveStrings } from "./strings.js";
import { locales } from "./locales.js";

/**
 * Registry for managing multiple PDF viewer instances.
 * Enables multiple independent viewers on the same page.
 *
 * @class ViewerRegistry
 */
class ViewerRegistry {
  constructor() {
    /** @type {Map<string, ViewerInstance>} Map of container ID to ViewerInstance */
    this.instances = new Map();
  }

  /**
   * Create and register a new viewer instance.
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   * @returns {ViewerInstance}
   */
  createInstance(container, options = {}) {
    const instance = new ViewerInstance(container, options);
    this.instances.set(instance.id, instance);
    return instance;
  }

  /**
   * Get an instance by container ID or element.
   * @param {string|HTMLElement} containerOrId - Container ID or element
   * @returns {ViewerInstance|undefined}
   */
  getInstance(containerOrId) {
    if (typeof containerOrId === 'string') {
      return this.instances.get(containerOrId);
    }
    // Search by container element
    for (const instance of this.instances.values()) {
      if (instance.container === containerOrId) {
        return instance;
      }
    }
    return undefined;
  }

  /**
   * Destroy and unregister a viewer instance.
   * @param {string|HTMLElement|ViewerInstance} instanceOrId - Instance, container ID, or element
   */
  destroyInstance(instanceOrId) {
    let instance;
    if (instanceOrId instanceof ViewerInstance) {
      instance = instanceOrId;
    } else {
      instance = this.getInstance(instanceOrId);
    }

    if (instance) {
      this.instances.delete(instance.id);
      instance.destroy();
    }
  }

  /**
   * Get all registered instances.
   * @returns {ViewerInstance[]}
   */
  getAllInstances() {
    return Array.from(this.instances.values());
  }

  /**
   * Destroy all instances.
   */
  destroyAll() {
    for (const instance of this.instances.values()) {
      instance.destroy();
    }
    this.instances.clear();
  }

  /**
   * Get the number of registered instances.
   * @returns {number}
   */
  get size() {
    return this.instances.size;
  }
}

/** @type {ViewerRegistry} Global registry for all viewer instances */
const registry = new ViewerRegistry();

/**
 * Default configuration options for the PDF viewer.
 * These can be overridden via data attributes on the container element.
 */
const defaultOptions = {
  showPageSelector: true,
  showCurrentPage: true,
  showSearch: true,
  showOutline: true,
  showResizeGrip: true,
  pdfUrl: "./example.pdf",
  showDownload: true,
  showShare: true,
  showFullscreen: true,
  showAccessibilityControlsVisibly: true,
};

/**
 * Robust boolean parser that handles various input formats.
 *
 * @param {string|boolean|undefined} val - Value to parse as boolean
 * @param {boolean} fallback - Fallback value if parsing fails
 * @returns {boolean} Parsed boolean value or fallback
 */
function parseBool(val, fallback) {
  if (val === undefined) return fallback;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return val === 'true' || val === '';
  return fallback;
}

/**
 * Extracts and parses configuration options from data attributes on the container element.
 *
 * @param {HTMLElement} container - The container element with data attributes
 * @returns {Object} Parsed options object with typed values
 */
function getOptionsFromDataAttrs(container) {
  const opts = {};
  if (!container) return opts;

  const map = container.dataset;

  // URL and content options
  if (map.pdfUrl) opts.pdfUrl = map.pdfUrl;
  if (map.defaultPage) opts.defaultPage = parseInt(map.defaultPage, 10);

  // Appearance options
  if (map.backgroundColor) opts.backgroundColor = map.backgroundColor;
  if (map.boxBorder) opts.boxBorder = parseInt(map.boxBorder, 10);
  if (map.margin) opts.margin = parseFloat(map.margin);
  if (map.marginTop) opts.marginTop = parseFloat(map.marginTop);
  if (map.marginLeft) opts.marginLeft = parseFloat(map.marginLeft);

  // UI feature toggles
  if (map.showToolbar !== undefined) opts.showToolbar = parseBool(map.showToolbar, undefined);
  if (map.showPageSelector !== undefined) opts.showPageSelector = parseBool(map.showPageSelector, undefined);
  if (map.showCurrentPage !== undefined) opts.showCurrentPage = parseBool(map.showCurrentPage, undefined);
  if (map.showSearch !== undefined) opts.showSearch = parseBool(map.showSearch, undefined);
  if (map.showOutline !== undefined) opts.showOutline = parseBool(map.showOutline, undefined);
  if (map.showResizeGrip !== undefined) opts.showResizeGrip = parseBool(map.showResizeGrip, undefined);
  if (map.showFullscreen !== undefined) opts.showFullscreen = parseBool(map.showFullscreen, undefined);
  if (map.showDownload !== undefined) opts.showDownload = parseBool(map.showDownload, undefined);
  if (map.showShare !== undefined) opts.showShare = parseBool(map.showShare, undefined);
  if (map.showAccessibilityControlsVisibly !== undefined) {
    opts.showAccessibilityControlsVisibly = parseBool(map.showAccessibilityControlsVisibly, undefined);
  }

  // Behavioral options
  if (map.momentum !== undefined) {
    const parsedMomentum = parseFloat(map.momentum);
    opts.momentum = Number.isNaN(parsedMomentum) ? 1.5 : parsedMomentum;
  }
  if (map.debug !== undefined) opts.debug = parseBool(map.debug, false);

  // Worker URL configuration
  if (map.workerUrl) opts.workerUrl = map.workerUrl;

  // Memory/performance configuration
  if (map.fullpageCacheSize !== undefined) opts.fullpageCacheSize = parseInt(map.fullpageCacheSize, 10);
  if (map.textLayerCacheSize !== undefined) opts.textLayerCacheSize = parseInt(map.textLayerCacheSize, 10);

  // Theme configuration
  if (map.theme) opts.theme = map.theme;

  // i18n: a bundled locale pack to start from (e.g. "de"). Individual
  // data-strings keys still override it.
  if (map.locale) opts.locale = map.locale;

  // i18n: a JSON object of UI string overrides. Invalid JSON is ignored (with a
  // warning) so a malformed attribute degrades to the English defaults rather
  // than breaking initialization.
  if (map.strings) {
    try {
      const parsed = JSON.parse(map.strings);
      if (parsed && typeof parsed === 'object') opts.strings = parsed;
    } catch (e) {
      console.warn('PDF-A-go-go: could not parse data-strings as JSON; using default UI strings.', e);
    }
  }

  return opts;
}

/**
 * Determines WebGL configuration from data attributes.
 *
 * @param {HTMLElement} container - Container element to check for WebGL settings
 * @returns {boolean} True if WebGL should be disabled, false otherwise
 */
function getDisableWebGLFromDataAttrs(container) {
  if (!container) return true;
  const val = container.getAttribute('data-disable-webgl');
  if (val === null) return true;
  if (val === 'false') return false;
  return true;
}

/**
 * Create a book object that provides a standardized interface to the PDF document.
 *
 * @param {Object} pdf - PDF.js document
 * @returns {Object} Book object with numPages() and getPage() methods
 */
function createBookObject(pdf) {
  return {
    numPages: () => pdf.numPages,

    getPage: (num, cb) => {
      const pageNum = num + 1;

      if (pageNum < 1 || pageNum > pdf.numPages) {
        cb(new Error("Page out of range"));
        return;
      }

      pdf
        .getPage(pageNum)
        .then(function (page) {
          // Only expose page dimensions and lazy text/viewport accessors.
          // Tile rendering rasterizes on its own (via TileRenderer + the raw
          // PDF.js document), so we deliberately avoid producing a full-page
          // canvas here — it was previously rendered and then discarded.
          const viewport = page.getViewport({ scale: 1 });

          cb(null, {
            width: viewport.width,
            height: viewport.height,
            getTextContent: () => page.getTextContent(),
            getViewport: (opts) => page.getViewport(opts)
          });
        })
        .catch(function (err) {
          cb(err);
        });
    },
  };
}

/**
 * Initialize a single PDF viewer container.
 *
 * @param {HTMLElement} container - The container element
 * @param {Object} [options] - Override options (merged with data attributes)
 * @returns {Promise<ViewerInstance>}
 */
async function initializeContainer(container, options = {}) {
  // Parse options from data attributes and merge with provided options
  const dataOptions = getOptionsFromDataAttrs(container);
  const featureOptions = Object.assign({}, defaultOptions, dataOptions, options);

  // Resolve the UI string table by layering, lowest precedence first:
  //   English defaults  <  bundled locale pack  <  data-strings  <  strings option
  // so `data-locale="de"` gives a full German UI in one attribute while
  // per-key overrides still win. An unknown locale warns and contributes
  // nothing (staying English). featureOptions.strings is always complete.
  const localeName = options.locale || dataOptions.locale;
  let localePack = {};
  if (localeName) {
    if (locales[localeName]) {
      localePack = locales[localeName];
    } else {
      console.warn(`PDF-A-go-go: unknown locale "${localeName}"; using default UI strings. Available: ${Object.keys(locales).join(', ')}.`);
    }
  }
  featureOptions.strings = resolveStrings(
    Object.assign({}, localePack, dataOptions.strings, options.strings)
  );

  // Create viewer instance
  const instance = registry.createInstance(container, featureOptions);

  // Clean up any existing UI controls for this container's wrapper
  const wrapper = container.closest('.pdfagogo-viewer-wrapper');
  if (wrapper) {
    [
      "pdfagogo-toolbar",
      "pdfagogo-page-announcement",
      "pdfagogo-a11y-instructions",
    ].forEach((cls) => {
      const el = wrapper.querySelector("." + cls);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  // Configure custom worker URL if specified (only once globally)
  if (featureOptions.workerUrl) {
    setWorkerUrl(featureOptions.workerUrl);
  }

  // Apply theme if specified
  if (featureOptions.theme) {
    container.setAttribute('data-theme', featureOptions.theme);
  }

  // Create loading bar
  const progressBar = createLoadingBar(container, featureOptions.strings);

  try {
    // Load PDF
    const loadedPdf = await loadPdfWithProgress(
      featureOptions.pdfUrl,
      (progress) => {
        updateLoadingBar(progressBar, progress);
      },
      {
        container: container,
        downloadTimeout: parseInt(container.dataset.downloadTimeout, 10) || 30000
      }
    );

    instance.setPdf(loadedPdf);

    // Create book object
    const book = createBookObject(loadedPdf);
    instance.setBook(book);

    // Pass the PDF document directly to the viewer for tile-based rendering
    featureOptions.pdfDocument = loadedPdf;

    // Remove any existing children to ensure clean initialization
    while (container.firstChild) container.removeChild(container.firstChild);

    // Create the scrollable PDF viewer
    const viewer = new ScrollablePdfViewer({
      app: container,
      book,
      options: featureOptions,
    });
    instance.setViewer(viewer);

    // Create search controller
    const searchController = new SearchController({
      pdf: loadedPdf,
      viewer: viewer,
      tileManager: viewer.tileRenderer ? viewer.tileRenderer.tileManager : null,
    });
    instance.setSearchController(searchController);

    // Store instance reference on container for external access
    container.pdfViewer = viewer;
    container._pdfagogoInstance = instance;

    // Remove loading bar
    removeLoadingBar(container);

    // Setup controls
    setupControls(container, featureOptions, viewer, book, loadedPdf, instance);

    return instance;
  } catch (err) {
    showError("Failed to load PDF: " + err, container, featureOptions.strings);
    throw err;
  }
}

/**
 * Main entry point for PDF-A-go-go application.
 * Automatically initializes all .pdfagogo-container elements on the page.
 */
(function () {
  // Find all PDF viewer containers
  const containers = document.querySelectorAll(".pdfagogo-container");

  if (containers.length === 0) {
    return;
  }

  // Configure PDF.js WebGL settings (once globally, using first container)
  if (typeof window !== "undefined") {
    window.pdfjsDisableWebGL = getDisableWebGLFromDataAttrs(containers[0]);
  }

  // Initialize each container
  containers.forEach((container, index) => {
    // Ensure container has an ID for registry
    if (!container.id) {
      container.id = `pdfagogo-container-${index}`;
    }

    // Initialize asynchronously to not block the page
    initializeContainer(container).catch((err) => {
      console.error(`[PDF-A-go-go] Failed to initialize container ${container.id}:`, err);
    });
  });
})();

/**
 * Default export object providing the registry and initializer for external use.
 */
export default {
  registry,
  initializeContainer,
  ViewerInstance,
  SearchController,
};
