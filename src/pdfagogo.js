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
    if (map.momentum !== undefined) opts.momentum = parseFloat(map.momentum) || 1;
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
  loadPdfWithProgress(featureOptions.pdfUrl, (progress) => {
    updateLoadingBar(progressBar, progress);
  })
    .then(async function (loadedPdf) {
      pdf = loadedPdf;
      const book = {
        numPages: () => pdf.numPages,
        getPage: (num, cb, highlights) => {
          const pageNum = num + 1;
          if (pageNum < 1 || pageNum > pdf.numPages) {
            cb(new Error("Page out of range"));
            return;
          }
          pdf
            .getPage(pageNum)
            .then(async function (page) {
              const scale = window.devicePixelRatio || 2;
              // const scale = 3;
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              // Draw highlights if provided
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
                  top -= 8;
                  const width = Math.abs(rect[2] - rect[0]);
                  const height = Math.abs(rect[3] - rect[1]);
                  context.fillRect(left, top, width, height);
                }
                context.globalCompositeOperation = prevComp;
                context.restore();
              }
              cb(null, {
                img: canvas,
                width: viewport.width,
                height: viewport.height,
              });
            })
            .catch(function (err) {
              cb(err);
            });
        },
      };
      // Pass scale to ScrollablePdfViewer
      featureOptions.scale = 3;
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
