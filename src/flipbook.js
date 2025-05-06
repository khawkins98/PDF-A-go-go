import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs';
import { getH } from '@tpp/htm-x';
import { flipbookViewer } from './flipbookviewer.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const pdfUrl = "https://api.printnode.com/static/test/pdf/multipage.pdf";

let pdf = null;
let viewer = null;

function init(book, id, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if(!opts) opts = {};
  if(!cb) cb = () => 1;
  const app = getH(id);
  if(!app) {
    const emsg = ("flipbook-viewer: Failed to find container for viewer: " + id);
    console.error(emsg);
    cb(emsg);
    return;
  }

  if(opts.singlepage) {
    console.log("This implementation of flipbook-viewer does not support single page viewing. For single page viewing, please use the upstream https://github.com/theproductiveprogrammer/flipbook-viewer");
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
    };
    const margin = opts.margin || 1;
    if(opts.marginTop || opts.marginTop === 0) ctx.sz.marginTop = opts.marginTop;
    else ctx.sz.marginTop = margin;
    if(opts.marginLeft || opts.marginLeft === 0) ctx.sz.marginLeft = opts.marginLeft;
    else ctx.sz.marginLeft = margin;
    flipbookViewer(ctx, ret_1);
  }
  function ret_1(err, v) {
    if(opts.popup) history.pushState({}, "", "#");
    return cb(err, v);
  }
}

// Main PDF loading and viewer logic
pdfjsLib.getDocument(pdfUrl).promise.then(function(loadedPdf) {
  pdf = loadedPdf;
  console.log("PDF total pages:", pdf.numPages);
  const book = {
    numPages: () => pdf.numPages,
    getPage: (num, cb) => {
      const pageNum = num + 1;
      if (pageNum < 1 || pageNum > pdf.numPages) {
        cb(new Error("Page out of range"));
        return;
      }
      pdf.getPage(pageNum).then(function(page) {
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        page.render({ canvasContext: context, viewport: viewport }).promise.then(function() {
          cb(null, { img: canvas, width: viewport.width, height: viewport.height });
        });
      }).catch(function(err) {
        cb(err);
      });
    }
  };

  // Use the merged init function
  // --- BEGIN: Option defaults ---
  const defaultOptions = {
    showPrevNext: true,
    showPageSelector: true,
    showCurrentPage: true,
    showSearch: true,
  };
  // --- END: Option defaults ---

  // Merge options from user (if any)
  const userOptions = {
    width: 800,
    height: 600,
    backgroundColor: "#353535"
  };
  if (window.PDFaGoGoOptions) {
    Object.assign(userOptions, window.PDFaGoGoOptions);
  }
  // Merge feature toggles
  const featureOptions = Object.assign({}, defaultOptions, userOptions);

  init(
    book,
    "flipbook-container",
    featureOptions,
    function(err, v) {
      if (err) {
        alert("Failed to load PDF: " + err);
        return;
      }
      viewer = v;
      const container = document.getElementById('flipbook-container');
      // Wait for the canvas to be added to the DOM
      const waitForCanvas = setInterval(() => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          clearInterval(waitForCanvas);
          canvas.style.cursor = "pointer";
          canvas.setAttribute('aria-label', 'Flipbook page display');
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('tabindex', '-1');
          canvas.addEventListener('click', function(event) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            if (x < rect.width / 2) {
              viewer.flip_back();
            } else {
              viewer.flip_forward();
            }
          });

          // Dynamically add overlay hint zones
          const leftZone = document.createElement('div');
          leftZone.className = 'flipbook-hint-zone flipbook-hint-left';
          const leftArrow = document.createElement('span');
          leftArrow.className = 'flipbook-hint-arrow';
          leftArrow.setAttribute('aria-hidden', 'true');
          leftArrow.innerHTML = '&#8592;';
          leftZone.appendChild(leftArrow);

          const rightZone = document.createElement('div');
          rightZone.className = 'flipbook-hint-zone flipbook-hint-right';
          const rightArrow = document.createElement('span');
          rightArrow.className = 'flipbook-hint-arrow';
          rightArrow.setAttribute('aria-hidden', 'true');
          rightArrow.innerHTML = '&#8594;';
          rightZone.appendChild(rightArrow);

          container.appendChild(leftZone);
          container.appendChild(rightZone);

          leftZone.addEventListener('mouseenter', () => leftZone.classList.add('active'));
          leftZone.addEventListener('mouseleave', () => leftZone.classList.remove('active'));
          rightZone.addEventListener('mouseenter', () => rightZone.classList.add('active'));
          rightZone.addEventListener('mouseleave', () => rightZone.classList.remove('active'));
          leftZone.addEventListener('click', () => viewer.flip_back());
          rightZone.addEventListener('click', () => viewer.flip_forward());
        }
      }, 100);

      // Keyboard navigation for accessibility
      container.addEventListener('keydown', function(event) {
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
      if (!featureOptions.showPrevNext) {
        document.getElementById('prev').style.display = 'none';
        document.getElementById('next').style.display = 'none';
      }
      document.getElementById('next').onclick = () => viewer.flip_forward();
      document.getElementById('prev').onclick = () => viewer.flip_back();
      document.getElementById('share').onclick = () => {
        const page = viewer.showNdx ? viewer.showNdx + 1 : 1;
        const shareUrl = `${window.location.origin}${window.location.pathname}#page=${page}`;
        navigator.clipboard.writeText(shareUrl);
        alert("Share link copied to clipboard:\n" + shareUrl);
      };

      // Page indicator and screen reader announcement
      const pageIndicator = document.getElementById('page-indicator');
      const pageAnnouncement = document.getElementById('page-announcement');
      function updatePage(n) {
        const totalPages = pdf.numPages;
        const leftPage = parseInt(n);
        const rightPage = Math.min(leftPage + 1, totalPages);
        pageIndicator.textContent = `Page: ${leftPage}-${rightPage} / ${totalPages}`;
        pageAnnouncement.textContent = `Pages ${leftPage} to ${rightPage} of ${totalPages}`;
      }
      viewer.on('seen', updatePage);
      updatePage(0);

      // SEARCH FUNCTIONALITY
      const searchBox = document.getElementById('search-box');
      const searchBtn = document.getElementById('search-btn');
      const searchResult = document.getElementById('search-result');
      // Add next/prev match buttons
      const searchControls = document.getElementById('search-controls');
      const nextMatchBtn = document.createElement('button');
      nextMatchBtn.textContent = 'Next Match';
      nextMatchBtn.id = 'next-match-btn';
      const prevMatchBtn = document.createElement('button');
      prevMatchBtn.textContent = 'Prev Match';
      prevMatchBtn.id = 'prev-match-btn';
      searchControls.appendChild(prevMatchBtn);
      searchControls.appendChild(nextMatchBtn);

      let matchPages = [];
      let currentMatchIdx = 0;

      async function searchPdf(query) {
        matchPages = [];
        currentMatchIdx = 0;
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1);
          const textContent = await page.getTextContent();
          const text = textContent.items.map(item => item.str).join(" ").toLowerCase();
          if (text.includes(query)) {
            matchPages.push(i);
          }
        }
      }

      // Central function to set and track the current page (1-based)
      function setPageByNumber(pageNum) {
        if (!viewer || !pdf) return;
        if (typeof pageNum !== 'number' || isNaN(pageNum / 2) || pageNum < 1 || (pageNum / 2) > pdf.numPages) {
          alert('Invalid page number');
          return;
        }
        const targetShowNdx = Math.floor((pageNum) / 2);

        // Reset any ongoing animation
        if (viewer.flipNdx !== undefined && viewer.flipNdx !== null) {
          viewer.flipNdx = null;
        }

        viewer.flipNdx = targetShowNdx;

        if (viewer.showNdx !== targetShowNdx) {
          viewer.showNdx = targetShowNdx;
          viewer.emit('seen', targetShowNdx * 2);
          if (targetShowNdx < viewer.page_count - 1) {
            viewer.flip_forward();
            viewer.flip_back();
          } else if (targetShowNdx > 0) {
            viewer.flip_back();
            viewer.flip_forward();
          }
        } else {
          viewer.emit('seen', targetShowNdx * 2);
        }
      }

      function showMatch(idx) {
        if (matchPages.length === 0) return;
        currentMatchIdx = ((idx % matchPages.length) + matchPages.length) % matchPages.length; // wrap around
        const pageNum = matchPages[currentMatchIdx] + 1; // 1-based
        setPageByNumber(pageNum);
        searchResult.textContent = `Match ${currentMatchIdx + 1} of ${matchPages.length} (page ${pageNum})`;
      }

      searchBtn.onclick = async function() {
        const query = searchBox.value.trim().toLowerCase();
        if (!query) return;
        searchResult.textContent = "Searching...";
        await searchPdf(query);
        if (matchPages.length > 0) {
          showMatch(0);
        } else {
          searchResult.textContent = "Not found";
        }
      };

      nextMatchBtn.onclick = function() {
        if (matchPages.length > 0) {
          showMatch(currentMatchIdx + 1);
        }
      };
      prevMatchBtn.onclick = function() {
        if (matchPages.length > 0) {
          showMatch(currentMatchIdx - 1);
        }
      };

      searchBox.addEventListener('keydown', function(e) {
        if (e.key === "Enter") searchBtn.click();
      });

      // Go to Page functionality
      const gotoPageInput = document.getElementById('goto-page');
      const gotoBtn = document.getElementById('goto-btn');
      gotoBtn.onclick = function() {
        const val = parseInt(gotoPageInput.value, 10);
        setPageByNumber(val);
      };

      // Page selector
      if (!featureOptions.showPageSelector) {
        document.getElementById('goto-page').style.display = 'none';
        document.getElementById('goto-btn').style.display = 'none';
      }

      // Current page indicator
      if (!featureOptions.showCurrentPage) {
        document.getElementById('page-indicator').style.display = 'none';
      }

      // Search controls
      if (!featureOptions.showSearch) {
        document.getElementById('search-controls').style.display = 'none';
      }
    }
  );
}).catch(function(err) {
  alert("Failed to load PDF: " + err);
});

// Expose flipbook.init globally
window.flipbook = { init };