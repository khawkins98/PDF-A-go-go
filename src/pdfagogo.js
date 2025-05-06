import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs";
import { getH } from "@tpp/htm-x";
import { flipbookViewer } from "./flipbookviewer.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
        boxw: opts.width || 800,
        boxh: opts.height || 600,
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

// Main PDF loading and viewer logic
(function () {
  // Ensure loading indicator exists
  if (!document.querySelector(".pdfagogo-loading")) {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "pdfagogo-loading";
    loadingDiv.style.width = "800px";
    loadingDiv.style.margin = "2rem auto";
    loadingDiv.style.textAlign = "center";
    loadingDiv.innerHTML = "<span>Loading PDF...</span>";
    // Always insert immediately before the pdfagogo-container if possible
    const flipbook = document.querySelector(".pdfagogo-container");
    if (flipbook && flipbook.parentNode) {
      flipbook.parentNode.insertBefore(loadingDiv, flipbook);
    } else {
      document.body.insertBefore(loadingDiv, document.body.firstChild);
    }
  }

  // --- BEGIN: Option defaults ---
  const defaultOptions = {
    showPrevNext: true,
    showPageSelector: true,
    showCurrentPage: true,
    showSearch: true,
    pdfUrl: "https://api.printnode.com/static/test/pdf/multipage.pdf",
  };
  // --- END: Option defaults ---

  // Merge options from user (if any)
  const userOptions = {
    width: 800,
    height: 600,
    backgroundColor: "#353535",
  };
  if (window.PDFaGoGoOptions) {
    Object.assign(userOptions, window.PDFaGoGoOptions);
  }
  // Merge feature toggles
  const featureOptions = Object.assign({}, defaultOptions, userOptions);

  // Dynamically create and insert controls based on options
  const pdfagogoContainer = document.querySelector(".pdfagogo-container");
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

  // Search controls
  if (featureOptions.showSearch) {
    const searchControls = document.createElement("div");
    searchControls.className = "pdfagogo-search-controls";
    searchControls.innerHTML = `
      <input class="pdfagogo-search-box" type="text" placeholder="Search text..." aria-label="Search text" />
      <button class="pdfagogo-search-btn">Search</button>
      <span class="pdfagogo-search-result"></span>
    `;
    pdfagogoContainer.parentNode.insertBefore(
      searchControls,
      pdfagogoContainer
    );
  }

  // Main controls
  const controls = document.createElement("div");
  controls.className = "pdfagogo-controls";
  let controlsHTML = "";
  if (featureOptions.showPrevNext) {
    controlsHTML +=
      '<button class="pdfagogo-prev" aria-label="Previous page">Previous</button>';
    controlsHTML +=
      '<button class="pdfagogo-next" aria-label="Next page">Next</button>';
  }
  controlsHTML +=
    '<button class="pdfagogo-share" aria-label="Share current page">Share</button>';
  if (featureOptions.showPageSelector) {
    controlsHTML +=
      '<input class="pdfagogo-goto-page" type="number" min="1" style="width:60px;" placeholder="Page #" aria-label="Go to page" />';
    controlsHTML += '<button class="pdfagogo-goto-btn">Go</button>';
  }
  if (featureOptions.showCurrentPage) {
    controlsHTML +=
      '<span class="pdfagogo-page-indicator" aria-live="polite"></span>';
  }
  // Add Spread Mode toggle
  // Only for debugging
  // controlsHTML +=
  //   '<label style="margin-left:20px;font-size:15px;cursor:pointer;user-select:none;">'
  //   + '<input type="checkbox" class="pdfagogo-spread-toggle" style="vertical-align:middle;margin-right:4px;"'
  //   + (featureOptions.spreadMode ? ' checked' : '')
  //   + '>Spread Mode</label>';
  controls.innerHTML = controlsHTML;
  pdfagogoContainer.parentNode.insertBefore(
    controls,
    pdfagogoContainer.nextSibling
  );

  // Page announcement for screen readers
  let pageAnnouncement = document.querySelector(".pdfagogo-page-announcement");
  if (!pageAnnouncement) {
    pageAnnouncement = document.createElement("div");
    pageAnnouncement.className = "pdfagogo-page-announcement";
    pageAnnouncement.style.position = "absolute";
    pageAnnouncement.style.left = "-9999px";
    pageAnnouncement.style.top = "auto";
    pageAnnouncement.style.width = "1px";
    pageAnnouncement.style.height = "1px";
    pageAnnouncement.style.overflow = "hidden";
    pageAnnouncement.setAttribute("aria-live", "polite");
    pdfagogoContainer.parentNode.insertBefore(
      pageAnnouncement,
      controls.nextSibling
    );
  }

  // Accessibility instructions
  let a11yInstructions = document.querySelector(".pdfagogo-a11y-instructions");
  if (!a11yInstructions) {
    a11yInstructions = document.createElement("div");
    a11yInstructions.className = "pdfagogo-a11y-instructions";
    a11yInstructions.setAttribute("aria-live", "polite");
    a11yInstructions.innerHTML = `
      <strong>Accessibility:</strong><br>
      - Use <kbd>Tab</kbd> to focus the reader.<br>
      - Use <kbd>Left Arrow</kbd> or click/tap the left side to go to the previous page.<br>
      - Use <kbd>Right Arrow</kbd> or click/tap the right side to go to the next page.<br>
      - Use <kbd>+</kbd> or <kbd>-</kbd> to zoom in/out.<br>
      - Use the buttons below for navigation, sharing, and searching.<br>
      - The current page is announced for screen readers.
    `;
    pdfagogoContainer.parentNode.insertBefore(
      a11yInstructions,
      pageAnnouncement.nextSibling
    );
  }

  // Use the pdfUrl from options
  const pdfUrl = featureOptions.pdfUrl;

  pdfjsLib
    .getDocument(pdfUrl)
    .promise.then(async function (loadedPdf) {
      // Hide loading indicator
      pdf = loadedPdf;
      // --- SPREAD MODE DETECTION ---
      let spreadMode = false;
      if (typeof featureOptions.spreadMode === 'boolean') {
        spreadMode = featureOptions.spreadMode;
        console.log('[PDF-A-go-go] Spread mode (from options):', spreadMode);
      } else {
        // Try to auto-detect: check first page aspect ratio
        try {
          const firstPage = await pdf.getPage(2);
          const vp = firstPage.getViewport({ scale: 1 });
          console.log('[PDF-A-go-go] Spread mode autodetect:', vp.width, vp.height);
          if (vp.width / vp.height > 1.3) spreadMode = true;
          console.log('[PDF-A-go-go] Spread mode autodetect:', spreadMode, 'aspect ratio:', (vp.width / vp.height).toFixed(2));
        } catch (e) { console.warn('[PDF-A-go-go] Spread mode detection error:', e); }
      }
      // console.log("PDF total pages:", pdf.numPages);
      const book = {
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
              const viewport = page.getViewport({ scale: 1 });
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              page
                .render({ canvasContext: context, viewport: viewport })
                .promise.then(function () {
                  cb(null, {
                    img: canvas,
                    width: viewport.width,
                    height: viewport.height,
                  });
                });
            })
            .catch(function (err) {
              cb(err);
            });
        },
      };

      // Pass spreadMode to options
      featureOptions.spreadMode = spreadMode;
      console.log('[PDF-A-go-go] Initializing viewer with spreadMode:', spreadMode);
      init(book, "pdfagogo-container", featureOptions, function (err, v) {
        if (err) {
          alert("Failed to load PDF: " + err);
          return;
        }
        viewer = v;
        const container = document.querySelector(".pdfagogo-container");
        // Wait for the canvas to be added to the DOM
        const waitForCanvas = setInterval(() => {
          const canvas = container.querySelector("canvas");
          if (canvas) {
            clearInterval(waitForCanvas);
            canvas.style.cursor = "pointer";
            canvas.setAttribute("aria-label", "Flipbook page display");
            canvas.setAttribute("role", "img");
            canvas.setAttribute("tabindex", "-1");
            canvas.addEventListener("click", function (event) {
              const rect = canvas.getBoundingClientRect();
              const x = event.clientX - rect.left;
              if (x < rect.width / 2) {
                viewer.flip_back();
              } else {
                viewer.flip_forward();
              }
            });

            // Dynamically add overlay hint zones
            const leftZone = document.createElement("div");
            leftZone.className = "pdfagogo-hint-zone pdfagogo-hint-left";
            const leftArrow = document.createElement("span");
            leftArrow.className = "pdfagogo-hint-arrow";
            leftArrow.setAttribute("aria-hidden", "true");
            leftArrow.innerHTML = "&#8592;";
            leftZone.appendChild(leftArrow);

            const rightZone = document.createElement("div");
            rightZone.className = "pdfagogo-hint-zone pdfagogo-hint-right";
            const rightArrow = document.createElement("span");
            rightArrow.className = "pdfagogo-hint-arrow";
            rightArrow.setAttribute("aria-hidden", "true");
            rightArrow.innerHTML = "&#8594;";
            rightZone.appendChild(rightArrow);

            container.appendChild(leftZone);
            container.appendChild(rightZone);

            leftZone.addEventListener("mouseenter", () =>
              leftZone.classList.add("active")
            );
            leftZone.addEventListener("mouseleave", () =>
              leftZone.classList.remove("active")
            );
            rightZone.addEventListener("mouseenter", () =>
              rightZone.classList.add("active")
            );
            rightZone.addEventListener("mouseleave", () =>
              rightZone.classList.remove("active")
            );
            leftZone.addEventListener("click", () => viewer.flip_back());
            rightZone.addEventListener("click", () => viewer.flip_forward());

            // updateNavArrows();

          }
        }, 100);

        // Keyboard navigation for accessibility
        container.addEventListener("keydown", function (event) {
          if (event.key === "ArrowLeft") {
            viewer.flip_back();
            event.preventDefault();
          } else if (event.key === "ArrowRight") {
            viewer.flip_forward();
            event.preventDefault();
          } else if (event.key === "+" || event.key === "=") {
            viewer.zoom(viewer.zoomLevel ? viewer.zoomLevel + 1 : 1);
            event.preventDefault();
          } else if (event.key === "-") {
            viewer.zoom(viewer.zoomLevel ? viewer.zoomLevel - 1 : -1);
            event.preventDefault();
          }
        });

        // Buttons for navigation and sharing
        const prevBtn = document.querySelector(".pdfagogo-prev");
        const nextBtn = document.querySelector(".pdfagogo-next");
        const shareBtn = document.querySelector(".pdfagogo-share");
        if (!featureOptions.showPrevNext) {
          if (prevBtn) prevBtn.style.display = "none";
          if (nextBtn) nextBtn.style.display = "none";
        }
        if (nextBtn) nextBtn.onclick = () => viewer.flip_forward();
        if (prevBtn) prevBtn.onclick = () => viewer.flip_back();
        if (shareBtn)
          shareBtn.onclick = () => {
            const page = viewer.showNdx ? viewer.showNdx + 1 : 1;
            const shareUrl = `${window.location.origin}${window.location.pathname}#page=${page}`;
            navigator.clipboard.writeText(shareUrl);
            alert("Share link copied to clipboard:\n" + shareUrl);
          };

        // Hide/show navigation arrows on first/last page
        function updateNavArrows() {
          // console.log('updateNavArrows called:',prevBtn, nextBtn, viewer.showNdx, pdf.numPages, featureOptions.spreadMode);
          if (!prevBtn || !nextBtn) return;
          let isFirst, isLast;
          if (featureOptions.spreadMode) {
            isFirst = viewer.showNdx === 0;
            isLast = viewer.showNdx === (pdf.numPages - 1);
          } else {
            isFirst = viewer.showNdx === 0;
            isLast = (viewer.showNdx * 2 + 1) >= pdf.numPages;
          }
          prevBtn.style.visibility = isFirst ? 'hidden' : '';
          nextBtn.style.visibility = isLast ? 'hidden' : '';
          // Also hide/show pdfagogo-hint zones
          // delay to ensure DOM is updated
          setTimeout(() => {
            const leftHint = document.querySelector('.pdfagogo-hint-left');
            const rightHint = document.querySelector('.pdfagogo-hint-right');
            if (leftHint) leftHint.style.display = isFirst ? 'none' : '';
            if (rightHint) rightHint.style.display = isLast ? 'none' : '';
          }, 100);
        }
        viewer.on("seen", updateNavArrows);
        updateNavArrows();

        // Page indicator and screen reader announcement
        const pageIndicator = document.querySelector(
          ".pdfagogo-page-indicator"
        );
        const pageAnnouncement = document.querySelector(
          ".pdfagogo-page-announcement"
        );
        function updatePage(n) {
          const totalPages = pdf.numPages;
          const leftPage = parseInt(n);
          const rightPage = Math.min(leftPage + 1, totalPages);
          if (pageIndicator)
            pageIndicator.textContent = `Page: ${leftPage}-${rightPage} / ${totalPages}`;
          if (pageAnnouncement)
            pageAnnouncement.textContent = `Pages ${leftPage} to ${rightPage} of ${totalPages}`;
        }
        viewer.on("seen", updatePage);
        updatePage(0);

        // SEARCH FUNCTIONALITY
        const searchBox = document.querySelector(".pdfagogo-search-box");
        const searchBtn = document.querySelector(".pdfagogo-search-btn");
        const searchResult = document.querySelector(".pdfagogo-search-result");
        // Add next/prev match buttons
        const searchControls = document.querySelector(
          ".pdfagogo-search-controls"
        );
        let nextMatchBtn, prevMatchBtn;
        if (searchControls) {
          nextMatchBtn = document.createElement("button");
          nextMatchBtn.textContent = "Next Match";
          nextMatchBtn.className = "pdfagogo-next-match-btn";
          prevMatchBtn = document.createElement("button");
          prevMatchBtn.textContent = "Prev Match";
          prevMatchBtn.className = "pdfagogo-prev-match-btn";
          searchControls.appendChild(prevMatchBtn);
          searchControls.appendChild(nextMatchBtn);
        }

        let matchPages = [];
        let currentMatchIdx = 0;

        async function searchPdf(query) {
          matchPages = [];
          currentMatchIdx = 0;
          for (let i = 0; i < pdf.numPages; i++) {
            const page = await pdf.getPage(i + 1);
            const textContent = await page.getTextContent();
            const text = textContent.items
              .map((item) => item.str)
              .join(" ")
              .toLowerCase();
            if (text.includes(query)) {
              matchPages.push(i);
            }
          }
        }

        // Central function to set and track the current page (1-based)
        function setPageByNumber(pageNum) {
          if (!viewer || !pdf) return;
          if (
            typeof pageNum !== "number" ||
            isNaN(pageNum / 2) ||
            pageNum < 1 ||
            pageNum / 2 > pdf.numPages
          ) {
            alert("Invalid page number");
            return;
          }
          // Use the new go_to_page method if available
          if (typeof viewer.go_to_page === "function") {
            viewer.go_to_page(pageNum - 1); // zero-based
            return;
          }
          const targetShowNdx = Math.floor(pageNum / 2);

          // Reset any ongoing animation
          if (viewer.flipNdx !== undefined && viewer.flipNdx !== null) {
            viewer.flipNdx = null;
          }

          viewer.flipNdx = targetShowNdx;

          if (viewer.showNdx !== targetShowNdx) {
            viewer.showNdx = targetShowNdx;
            viewer.emit("seen", targetShowNdx * 2);
            if (targetShowNdx < viewer.page_count - 1) {
              viewer.flip_forward();
              viewer.flip_back();
            } else if (targetShowNdx > 0) {
              viewer.flip_back();
              viewer.flip_forward();
            }
          } else {
            viewer.emit("seen", targetShowNdx * 2);
          }
        }

        function showMatch(idx) {
          if (matchPages.length === 0) return;
          currentMatchIdx =
            ((idx % matchPages.length) + matchPages.length) % matchPages.length; // wrap around
          const pageNum = matchPages[currentMatchIdx] + 1; // 1-based
          setPageByNumber(pageNum);
          if (searchResult)
            searchResult.textContent = `Match ${currentMatchIdx + 1} of ${
              matchPages.length
            } (page ${pageNum})`;
        }

        if (searchBtn)
          searchBtn.onclick = async function () {
            const query = searchBox ? searchBox.value.trim().toLowerCase() : "";
            if (!query) return;
            if (searchResult) searchResult.textContent = "Searching...";
            await searchPdf(query);
            if (matchPages.length > 0) {
              showMatch(0);
            } else {
              if (searchResult) searchResult.textContent = "Not found";
            }
          };

        if (nextMatchBtn)
          nextMatchBtn.onclick = function () {
            if (matchPages.length > 0) {
              showMatch(currentMatchIdx + 1);
            }
          };
        if (prevMatchBtn)
          prevMatchBtn.onclick = function () {
            if (matchPages.length > 0) {
              showMatch(currentMatchIdx - 1);
            }
          };

        if (searchBox)
          searchBox.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && searchBtn) searchBtn.click();
          });

        // Go to Page functionality
        const gotoPageInput = document.querySelector(".pdfagogo-goto-page");
        const gotoBtn = document.querySelector(".pdfagogo-goto-btn");
        if (gotoBtn)
          gotoBtn.onclick = function () {
            const val = gotoPageInput ? parseInt(gotoPageInput.value, 10) : NaN;
            setPageByNumber(val);
          };

        // Page selector
        if (!featureOptions.showPageSelector) {
          if (gotoPageInput) gotoPageInput.style.display = "none";
          if (gotoBtn) gotoBtn.style.display = "none";
        }

        // Current page indicator
        if (!featureOptions.showCurrentPage) {
          if (pageIndicator) pageIndicator.style.display = "none";
        }

        // Search controls
        if (!featureOptions.showSearch) {
          if (searchControls) searchControls.style.display = "none";
        }

        // --- BEGIN: Hash-based page navigation ---
        function getPageFromHash() {
          const match = window.location.hash.match(/page=(\d+)/);
          if (match) {
            const pageNum = parseInt(match[1], 10);
            if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdf.numPages) {
              return pageNum;
            }
          }
          return null;
        }
        function goToHashPage() {
          const pageNum = getPageFromHash();
          if (pageNum) {
            setPageByNumber(pageNum);
            window.__pdfagogo__pageSetBy = 'hash';
          }
        }
        // Go to page on load if hash is present
        goToHashPage();
        // Listen for hash changes
        window.addEventListener("hashchange", goToHashPage);
        // If no hash, use defaultPage from options
        if (!getPageFromHash() && featureOptions.defaultPage) {
          const defPage = parseInt(featureOptions.defaultPage, 10);
          if (!isNaN(defPage) && defPage >= 1 && defPage <= pdf.numPages) {
            setPageByNumber(defPage);
            window.__pdfagogo__pageSetBy = 'defaultPage';
          }
        }
        // --- END: Hash-based page navigation ---

        // Spread Mode toggle
        const spreadToggle = document.querySelector('.pdfagogo-spread-toggle');
        if (spreadToggle) {
          spreadToggle.checked = !!featureOptions.spreadMode;
          spreadToggle.onchange = function () {
            // Try to preserve current logical page
            let currentPage = 1;
            if (viewer && typeof viewer.showNdx === 'number') {
              if (featureOptions.spreadMode) {
                // Was in spread mode, so showNdx is 1-based
                currentPage = viewer.showNdx + 1;
              } else {
                // Was in normal mode, so showNdx is 0-based spread index
                currentPage = viewer.showNdx * 2 + 1;
              }
            }
            featureOptions.spreadMode = spreadToggle.checked;
            console.log('[PDF-A-go-go] Spread mode toggle changed:', featureOptions.spreadMode, 'Current page:', currentPage);
            // Re-initialize viewer with new mode
            init(book, "pdfagogo-container", featureOptions, function (err, v) {
              if (!err && v) {
                viewer = v;
                // Try to go to the same logical page
                if (typeof viewer.go_to_page === 'function') {
                  console.log('[PDF-A-go-go] After toggle, going to page:', currentPage, 'Spread mode:', featureOptions.spreadMode);
                  viewer.go_to_page(currentPage - 1);
                }
              }
            });
          };
        }

        document.querySelector(".pdfagogo-loading").remove();
      });
    })
    .catch(function (err) {
      const loadingDiv = document.querySelector(".pdfagogo-loading");
      if (loadingDiv) loadingDiv.textContent = "Failed to load PDF: " + err;
      alert("Failed to load PDF: " + err);
    });
})();

// Expose flipbook.init globally
export default { init };
