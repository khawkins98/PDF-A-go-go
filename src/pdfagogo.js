import { loadPdfWithProgress } from "./pdfLoader.js";
import { createLoadingBar, updateLoadingBar, removeLoadingBar, showError, setupControls } from "./ui.js";
import { getH } from "@tpp/htm-x";
import { flipbookViewer } from "./flipbookviewer.js";
import { outputScale } from "./flipbookviewer.js";

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
    const emsg = "flipbook-viewer: Failed to find container for viewer: " + id;
    console.error(emsg);
    cb(emsg);
    return;
  }

  if (opts.singlepage) {
    console.log(
      "This implementation of flipbook-viewer does not support single page viewing. For single page viewing, please use the upstream https://github.com/theproductiveprogrammer/flipbook-viewer"
    );
    // singlePageViewer({ app, book }, ret_1);
  } else {
    const ctx = {
      color: {
        bg: opts.backgroundColor || "#353535",
      },
      sz: {
        bx_border: opts.boxBorder || 0,
        boxw: Math.min(window.innerWidth, 1200),
        boxh: window.innerWidth < 700 ? window.innerHeight * 0.7 : 800,
        // boxw: opts.width || 1200,
        // boxh: opts.height || 800,
      },
      app,
      book,
      spreadMode: opts.spreadMode,
      options: opts,
    };
    const margin = opts.margin || 1;
    if (opts.marginTop || opts.marginTop === 0)
      ctx.sz.marginTop = opts.marginTop;
    else ctx.sz.marginTop = margin;
    if (opts.marginLeft || opts.marginLeft === 0)
      ctx.sz.marginLeft = opts.marginLeft;
    else ctx.sz.marginLeft = margin;
    flipbookViewer(ctx, ret_1);
  }
  function ret_1(err, v) {
    if (opts.popup) history.pushState({}, "", "#");
    return cb(err, v);
  }
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
    // if (map.height) opts.height = parseInt(map.height, 10);
    // if (map.width) opts.width = parseInt(map.width, 10);
    if (map.backgroundColor) opts.backgroundColor = map.backgroundColor;
    if (map.boxBorder) opts.boxBorder = parseInt(map.boxBorder, 10);
    if (map.margin) opts.margin = parseFloat(map.margin);
    if (map.marginTop) opts.marginTop = parseFloat(map.marginTop);
    if (map.marginLeft) opts.marginLeft = parseFloat(map.marginLeft);
    if (map.spreadMode !== undefined) opts.spreadMode = parseBool(map.spreadMode, undefined);
    if (map.showPrevNext !== undefined) opts.showPrevNext = parseBool(map.showPrevNext, undefined);
    if (map.showPageSelector !== undefined) opts.showPageSelector = parseBool(map.showPageSelector, undefined);
    if (map.showCurrentPage !== undefined) opts.showCurrentPage = parseBool(map.showCurrentPage, undefined);
    if (map.showSearch !== undefined) opts.showSearch = parseBool(map.showSearch, undefined);
    if (map.showDownload !== undefined) opts.showDownload = parseBool(map.showDownload, undefined);
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

  // Load PDF with progress
  loadPdfWithProgress(featureOptions.pdfUrl, (progress) => {
    updateLoadingBar(progressBar, progress);
  })
    .then(async function (loadedPdf) {
      pdf = loadedPdf;
      // --- SPREAD MODE DETECTION ---
      let spreadMode = false;
      if (typeof featureOptions.spreadMode === 'boolean') {
        spreadMode = featureOptions.spreadMode;
      } else {
        // Try to auto-detect: check first page aspect ratio
        try {
          const firstPage = await pdf.getPage(2);
          const vp = firstPage.getViewport({ scale: 1 });
          if (vp.width / vp.height > 1.3) spreadMode = true;
        } catch (e) { console.warn('[PDF-A-go-go] Spread mode detection error:', e); }
      }
      const book = {
        numPages: () => pdf.numPages,
        /**
         * Get a page and optionally highlight search matches.
         * @param {number} num - Zero-based page index.
         * @param {function} cb - Callback (err, {img, width, height}).
         * @param {Array} [highlights] - Optional array of highlight boxes [{x, y, width, height}].
         */
        getPage: (num, cb, highlights) => {
          const pageNum = num + 1;
          if (pageNum < 1 || pageNum > pdf.numPages) {
            cb(new Error("Page out of range"));
            return;
          }
          pdf
            .getPage(pageNum)
            .then(async function (page) {
              const viewport = page.getViewport({ scale: typeof outputScale !== 'undefined' ? outputScale : 2 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              // Draw highlights if provided
              if (Array.isArray(highlights) && highlights.length > 0) {
                console.log('[PDF-A-go-go] Drawing highlights on page', pageNum, highlights);
                context.save();
                const prevComp = context.globalCompositeOperation;
                context.globalCompositeOperation = 'multiply';
                context.globalAlpha = 1.0;
                context.fillStyle = "rgba(255,255,0,1)";
                for (const hl of highlights) {
                  // Use viewport.convertToViewportRectangle for accurate highlight
                  const rect = viewport.convertToViewportRectangle([
                    hl.x,
                    hl.y,
                    hl.x + hl.width,
                    hl.y + hl.height
                  ]);
                  const left = Math.min(rect[0], rect[2]);
                  let top = Math.min(rect[1], rect[3]);
                  top -= 8; // Adjust highlight up by 8px
                  const width = Math.abs(rect[2] - rect[0]);
                  const height = Math.abs(rect[3] - rect[1]);
                  console.log('[PDF-A-go-go] fillRect', {left, top, width, height});
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
      featureOptions.spreadMode = spreadMode;
      init(book, "pdfagogo-container", featureOptions, function (err, v) {
        removeLoadingBar();
        if (err) {
          showError("Failed to load PDF: " + err);
          return;
        }
        viewer = v;
        // Restore all controls and event wiring
        setupControls(pdfagogoContainer, featureOptions, viewer, book, pdf);
      });
    })
    .catch(function (err) {
      showError("Failed to load PDF: " + err);
    });
})();

export default { init };
