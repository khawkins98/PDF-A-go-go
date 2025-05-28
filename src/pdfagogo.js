/**
 * @file PDF-A-go-go: Main entry point for the accessible PDF viewer application.
 * 
 * This module provides the core initialization and configuration parsing for the PDF-A-go-go viewer.
 * It handles PDF loading with progress tracking, HTML download detection, and viewer setup with
 * comprehensive accessibility support.
 * 
 * @author PDF-A-go-go Contributors
 * @version 1.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

import { loadPdfWithProgress } from "./pdfLoader.js";
import { createLoadingBar, updateLoadingBar, removeLoadingBar, showError, setupControls } from "./ui.js";
import { getH } from "@tpp/htm-x";
import { ScrollablePdfViewer } from "./scrollablePdfViewer.js";

/** @type {Object|null} The loaded PDF.js document instance */
let pdf = null;

/** @type {ScrollablePdfViewer|null} The active PDF viewer instance */
let viewer = null;

/**
 * Initialize the PDF-A-go-go viewer with comprehensive error handling and accessibility support.
 * 
 * This function creates a new ScrollablePdfViewer instance within the specified container,
 * configures it with the provided options, and sets up all necessary event handlers.
 * 
 * @param {Object} book - PDF book object with numPages() and getPage() methods
 * @param {Function} book.numPages - Returns the total number of pages in the PDF
 * @param {Function} book.getPage - Retrieves a specific page with rendering capabilities
 * @param {string} id - DOM element ID for the viewer container
 * @param {Object} [opts={}] - Viewer configuration options
 * @param {boolean} [opts.showPrevNext=true] - Show previous/next navigation buttons
 * @param {boolean} [opts.showPageSelector=true] - Show page number input field
 * @param {boolean} [opts.showCurrentPage=true] - Show current page indicator
 * @param {boolean} [opts.showSearch=true] - Show search functionality
 * @param {boolean} [opts.showDownload=true] - Show download button
 * @param {boolean} [opts.showResizeGrip=true] - Show resize handle
 * @param {number} [opts.defaultPage=1] - Default page to display on load
 * @param {number} [opts.momentum=1.5] - Scroll momentum factor for smooth scrolling
 * @param {boolean} [opts.debug=false] - Enable debug mode with performance metrics
 * @param {string} [opts.backgroundColor] - Background color for the viewer
 * @param {number} [opts.boxBorder] - Border size in pixels
 * @param {number} [opts.margin] - General margin setting
 * @param {number} [opts.marginTop] - Top margin setting
 * @param {number} [opts.marginLeft] - Left margin setting
 * @param {Function} [cb] - Callback function called with (error, viewer) upon completion
 * @returns {void}
 * 
 * @example
 * // Basic initialization
 * init(pdfBook, 'viewer-container', {
 *   showSearch: true,
 *   debug: false
 * }, (err, viewer) => {
 *   if (err) {
 *     console.error('Failed to initialize viewer:', err);
 *     return;
 *   }
 *   console.log('Viewer ready:', viewer);
 * });
 * 
 * @example
 * // Advanced configuration
 * init(pdfBook, 'viewer-container', {
 *   showPrevNext: true,
 *   showPageSelector: true,
 *   showSearch: true,
 *   defaultPage: 5,
 *   momentum: 2.0,
 *   debug: true,
 *   backgroundColor: '#f5f5f5'
 * });
 */
function init(book, id, opts, cb) {
  // Handle function overloading - if opts is a function, it's actually the callback
  if (typeof opts === "function") {
    cb = opts;
    opts = {};
  }
  if (!opts) opts = {};
  if (!cb) cb = () => 1;
  
  const app = getH(id);
  if (!app) {
    const emsg = "scrollable-pdf-viewer: Failed to find container for viewer: " + id;
    console.error(emsg);
    cb(emsg);
    return;
  }

  // Remove any existing children to ensure clean initialization
  while (app.firstChild) app.removeChild(app.firstChild);

  // Create the scrollable PDF viewer with provided configuration
  viewer = new ScrollablePdfViewer({
    app,
    book,
    options: opts,
  });
  cb(null, viewer);
}

/**
 * Main entry point for PDF-A-go-go application.
 * 
 * This IIFE (Immediately Invoked Function Expression) handles the complete application lifecycle:
 * - Parses configuration from data attributes
 * - Sets up loading progress indicators
 * - Loads the PDF with HTML download handling
 * - Initializes the viewer with accessibility features
 * - Sets up all UI controls and event handlers
 * 
 * The function automatically detects and handles:
 * - Direct PDF URLs
 * - HTML pages that redirect to PDFs (institutional repositories)
 * - WebGL configuration for optimal rendering
 * - Mobile vs desktop optimization
 * 
 * @function
 * @name MainApplication
 * @memberof module:pdfagogo
 */
(function () {
  const pdfagogoContainer = document.querySelector(".pdfagogo-container");
  
  // Create loading bar with progress tracking
  const progressBar = createLoadingBar(pdfagogoContainer);

  // --- BEGIN: Option defaults ---
  /**
   * Default configuration options for the PDF viewer.
   * These can be overridden via data attributes on the container element.
   * 
   * @type {Object}
   * @property {boolean} showPrevNext - Show previous/next navigation buttons
   * @property {boolean} showPageSelector - Show page number input field
   * @property {boolean} showCurrentPage - Show current page indicator
   * @property {boolean} showSearch - Show search functionality
   * @property {boolean} showResizeGrip - Show resize handle
   * @property {string} pdfUrl - Default PDF URL to load
   * @property {boolean} showDownload - Show download button
   */
  const defaultOptions = {
    showPrevNext: true,
    showPageSelector: true,
    showCurrentPage: true,
    showSearch: true,
    showResizeGrip: true,
    pdfUrl: "./example.pdf",
    showDownload: true,
  };
  // --- END: Option defaults ---

  /**
   * Robust boolean parser that handles various input formats.
   * 
   * This helper function safely converts string and boolean values to boolean,
   * with proper fallback handling for undefined or invalid values.
   * 
   * @param {string|boolean|undefined} val - Value to parse as boolean
   * @param {boolean} fallback - Fallback value if parsing fails
   * @returns {boolean} Parsed boolean value or fallback
   * 
   * @example
   * parseBool('true', false);     // returns true
   * parseBool('false', true);     // returns false
   * parseBool('', false);         // returns true (empty string is truthy)
   * parseBool(undefined, true);   // returns true (fallback)
   * parseBool(null, false);       // returns false (fallback)
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
   * This function reads all supported data attributes and converts them to the appropriate
   * types (string, number, boolean) for use in viewer configuration. It handles both
   * display options and behavioral settings.
   * 
   * @param {HTMLElement} container - The container element with data attributes
   * @returns {Object} Parsed options object with typed values
   * 
   * @example
   * // HTML: <div data-pdf-url="./doc.pdf" data-show-search="true" data-default-page="5">
   * const options = getOptionsFromDataAttrs(container);
   * // Returns: { pdfUrl: './doc.pdf', showSearch: true, defaultPage: 5 }
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
    if (map.showPrevNext !== undefined) opts.showPrevNext = parseBool(map.showPrevNext, undefined);
    if (map.showPageSelector !== undefined) opts.showPageSelector = parseBool(map.showPageSelector, undefined);
    if (map.showCurrentPage !== undefined) opts.showCurrentPage = parseBool(map.showCurrentPage, undefined);
    if (map.showSearch !== undefined) opts.showSearch = parseBool(map.showSearch, undefined);
    if (map.showResizeGrip !== undefined) opts.showResizeGrip = parseBool(map.showResizeGrip, undefined);
    if (map.showDownload !== undefined) opts.showDownload = parseBool(map.showDownload, undefined);
    
    // Behavioral options
    if (map.momentum !== undefined) opts.momentum = parseFloat(map.momentum) || 1.5;
    if (map.debug !== undefined) opts.debug = parseBool(map.debug, false);
    
    return opts;
  }

  // Merge default options with data attribute options
  const dataOptions = getOptionsFromDataAttrs(pdfagogoContainer);
  const featureOptions = Object.assign({}, defaultOptions, dataOptions);

  // Clean up any existing UI controls to prevent duplicates
  [
    "pdfagogo-search-controls",
    "pdfagogo-controls",
    "pdfagogo-page-announcement",
    "pdfagogo-a11y-instructions",
  ].forEach((cls) => {
    const el = document.querySelector("." + cls);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  /**
   * Determines WebGL configuration from data attributes.
   * 
   * WebGL is disabled by default for better compatibility and stability.
   * This can be overridden by setting data-disable-webgl="false".
   * 
   * @param {HTMLElement} container - Container element to check for WebGL settings
   * @returns {boolean} True if WebGL should be disabled, false otherwise
   */
  function getDisableWebGLFromDataAttrs(container) {
    if (!container) return true; // default: disable WebGL
    const val = container.getAttribute('data-disable-webgl');
    if (val === null) return true; // default: disable WebGL
    if (val === 'false') return false;
    return true;
  }

  // Configure PDF.js WebGL settings
  if (typeof window !== "undefined") {
    window.pdfjsDisableWebGL = getDisableWebGLFromDataAttrs(pdfagogoContainer);
  }

  // Load PDF with comprehensive progress tracking and error handling
  loadPdfWithProgress(
    featureOptions.pdfUrl, 
    (progress) => {
      updateLoadingBar(progressBar, progress);
    },
    {
      container: pdfagogoContainer,
      downloadTimeout: parseInt(pdfagogoContainer.dataset.downloadTimeout, 10) || 30000
    }
  )
    .then(async function (loadedPdf) {
      pdf = loadedPdf;
      
      /**
       * Book object that provides a standardized interface to the PDF document.
       * 
       * This object abstracts PDF.js functionality and provides methods for
       * page counting, page retrieval, and rendering with highlight support.
       * 
       * @type {Object}
       * @property {Function} numPages - Returns total number of pages
       * @property {Function} getPage - Retrieves and renders a specific page
       */
      const book = {
        /**
         * Get the total number of pages in the PDF.
         * @returns {number} Total page count
         */
        numPages: () => pdf.numPages,
        
        /**
         * Retrieve and render a specific page with optional highlights.
         * 
         * @param {number} num - Zero-based page index
         * @param {Function} cb - Callback function(error, pageData)
         * @param {Array<Object>} [highlights] - Array of highlight objects to render
         * @param {number} highlights[].x - X coordinate of highlight
         * @param {number} highlights[].y - Y coordinate of highlight  
         * @param {number} highlights[].width - Width of highlight
         * @param {number} highlights[].height - Height of highlight
         */
        getPage: (num, cb, highlights) => {
          const pageNum = num + 1; // Convert to 1-based indexing
          
          if (pageNum < 1 || pageNum > pdf.numPages) {
            cb(new Error("Page out of range"));
            return;
          }
          
          pdf
            .getPage(pageNum)
            .then(async function (page) {
              // Use device pixel ratio for crisp rendering
              const scale = window.devicePixelRatio || 1.8;
              const viewport = page.getViewport({ scale });
              
              // Create canvas for rendering
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              
              // Render the page
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              
              // Draw highlights if provided (for search results)
              if (Array.isArray(highlights) && highlights.length > 0) {
                context.save();
                const prevComp = context.globalCompositeOperation;
                context.globalCompositeOperation = 'multiply';
                context.globalAlpha = 1.0;
                context.fillStyle = "rgba(255,255,0,1)";
                
                for (const hl of highlights) {
                  const rect = viewport.convertToViewportRectangle([
                    hl.x,
                    hl.y,
                    hl.x + hl.width,
                    hl.y + hl.height
                  ]);
                  const left = Math.min(rect[0], rect[2]);
                  let top = Math.min(rect[1], rect[3]);
                  top -= 8; // Slight vertical adjustment for better visibility
                  const width = Math.abs(rect[2] - rect[0]);
                  const height = Math.abs(rect[3] - rect[1]);
                  context.fillRect(left, top, width, height);
                }
                
                context.globalCompositeOperation = prevComp;
                context.restore();
              }
              
              // Return page data with rendering capabilities
              cb(null, {
                img: canvas,
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
      
      // Initialize the viewer with the book object
      init(book, "pdfagogo-container", featureOptions, function (err, v) {
        removeLoadingBar();
        if (err) {
          showError("Failed to load PDF: " + err);
          return;
        }
        viewer = v;
        setupControls(pdfagogoContainer, featureOptions, viewer, book, pdf);
      });
    })
    .catch(function (err) {
      /**
       * Handle PDF loading errors with user-friendly error messages.
       * 
       * This catch block handles various types of loading failures:
       * - Network errors (PDF not found, server issues)
       * - PDF parsing errors (corrupted or invalid PDF files)
       * - HTML download handler failures (timeout, redirect issues)
       * - PDF.js rendering errors
       * 
       * @param {Error} err - The error that occurred during PDF loading
       */
      showError("Failed to load PDF: " + err);
    });
})();

/**
 * Default export object providing the init function for external use.
 * 
 * This allows the module to be used programmatically by other applications
 * that want to embed the PDF viewer with custom configuration.
 * 
 * @type {Object}
 * @property {Function} init - The main initialization function
 * 
 * @example
 * import pdfagogo from './pdfagogo.js';
 * 
 * // Use programmatically
 * pdfagogo.init(bookObject, 'container-id', {
 *   showSearch: true,
 *   debug: true
 * }, (err, viewer) => {
 *   if (!err) {
 *     console.log('PDF viewer initialized successfully');
 *   }
 * });
 */
export default { init };
