import { loadPdfWithProgress } from "./pdfLoader.js";
import { createLoadingBar, updateLoadingBar, removeLoadingBar, showError, setupControls } from "./ui.js";
import { getH } from "@tpp/htm-x";
import { ScrollablePdfViewer } from "./scrollablePdfViewer.js";

let pdf = null;
let viewer = null;

/**
 * Initialize the PDF-A-go-go viewer.
 * @param {Object} book - PDF book object with numPages() and getPage().
 * @param {string} id - DOM element id for the viewer container.
 * @param {Object} [opts] - Viewer options.
 * @param {Function} [cb] - Callback function(err, viewer)
 * @returns {void}
 */
function init(book, id, opts, cb) {
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

  // Remove any existing children
  while (app.firstChild) app.removeChild(app.firstChild);

  // Create the scrollable PDF viewer
  viewer = new ScrollablePdfViewer({
    app,
    book,
    options: opts,
  });
  cb(null, viewer);
}

/**
 * Main entry point for PDF-A-go-go. Sets up UI, loads PDF, and initializes viewer.
 */
(function () {
  const pdfagogoContainer = document.querySelector(".pdfagogo-container");
  // Create loading bar
  const progressBar = createLoadingBar(pdfagogoContainer);

  // --- BEGIN: Option defaults ---
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

  // Helper: parse boolean or fallback
  function parseBool(val, fallback) {
    if (val === undefined) return fallback;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val === 'true' || val === '';
    return fallback;
  }

  // Read options from data attributes
  function getOptionsFromDataAttrs(container) {
    const opts = {};
    if (!container) return opts;
    const map = container.dataset;
    if (map.pdfUrl) opts.pdfUrl = map.pdfUrl;
    if (map.defaultPage) opts.defaultPage = parseInt(map.defaultPage, 10);
    if (map.backgroundColor) opts.backgroundColor = map.backgroundColor;
    if (map.boxBorder) opts.boxBorder = parseInt(map.boxBorder, 10);
    if (map.margin) opts.margin = parseFloat(map.margin);
    if (map.marginTop) opts.marginTop = parseFloat(map.marginTop);
    if (map.marginLeft) opts.marginLeft = parseFloat(map.marginLeft);
    if (map.showPrevNext !== undefined) opts.showPrevNext = parseBool(map.showPrevNext, undefined);
    if (map.showPageSelector !== undefined) opts.showPageSelector = parseBool(map.showPageSelector, undefined);
    if (map.showCurrentPage !== undefined) opts.showCurrentPage = parseBool(map.showCurrentPage, undefined);
    if (map.showSearch !== undefined) opts.showSearch = parseBool(map.showSearch, undefined);
    if (map.showResizeGrip !== undefined) opts.showResizeGrip = parseBool(map.showResizeGrip, undefined);
    if (map.showDownload !== undefined) opts.showDownload = parseBool(map.showDownload, undefined);
    if (map.momentum !== undefined) opts.momentum = parseFloat(map.momentum) || 1.5;
    if (map.debug !== undefined) opts.debug = parseBool(map.debug, false);
    return opts;
  }

  // Merge options from data attributes
  const dataOptions = getOptionsFromDataAttrs(pdfagogoContainer);
  const featureOptions = Object.assign({}, defaultOptions, dataOptions);

  // Remove any existing controls
  [
    "pdfagogo-search-controls",
    "pdfagogo-controls",
    "pdfagogo-page-announcement",
    "pdfagogo-a11y-instructions",
  ].forEach((cls) => {
    const el = document.querySelector("." + cls);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  // Set pdfjsDisableWebGL based on data attribute (default: true)
  function getDisableWebGLFromDataAttrs(container) {
    if (!container) return true; // default: disable WebGL
    const val = container.getAttribute('data-disable-webgl');
    if (val === null) return true; // default: disable WebGL
    if (val === 'false') return false;
    return true;
  }

  if (typeof window !== "undefined") {
    window.pdfjsDisableWebGL = getDisableWebGLFromDataAttrs(pdfagogoContainer);
  }

  // Load PDF with progress
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
      const book = {
        numPages: () => pdf.numPages,
        getPage: (pageIndex, cb) => {
          const pageNum = pageIndex + 1;
          if (pageNum < 1 || pageNum > pdf.numPages) {
            cb(new Error("Page out of range. Requested: " + pageNum + " Total: " + pdf.numPages));
            return;
          }
          pdf
            .getPage(pageNum)
            .then(function (pageProxy) {
              cb(null, pageProxy);
            })
            .catch(function (err) {
              console.error(`[pdfagogo.js] Error in book.getPage for pageNum ${pageNum}:`, err);
              cb(err);
            });
        },
      };
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
      showError("Failed to load PDF: " + err);
    });
})();

export default { init };
