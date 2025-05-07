// This is a modified version of the flipbook.js file from the PDF-A-go-go project
// https://github.com/theproductiveprogrammer/flipbook-viewer

"use strict";
import { h } from "@tpp/htm-x";
import * as EventEmitter from "events";

/**
 * FlipbookViewer class for PDF-A-go-go.
 * @extends EventEmitter
 */
class FlipbookViewer extends EventEmitter {}

export const outputScale = Math.min((window.devicePixelRatio || 1) * 2, 3); // HiDPI, but clamp to 3x for perf

/**
 * Main entry point for the flipbook viewer.
 * @param {Object} ctx - Context object with book, app, sz, etc.
 * @param {Function} cb - Callback function(err, viewer)
 * @returns {void}
 */
export function flipbookViewer(ctx, cb) {
  const viewer = new FlipbookViewer();
  viewer.page_count = ctx.book.numPages();

  // --- Add page image cache ---
  const pageImageCache = new Map();
  ctx.getCachedPage = function(pageNum, cb, highlights) {
    if (!highlights && pageImageCache.has(pageNum)) {
      cb(null, pageImageCache.get(pageNum));
      return;
    }
    ctx.book.getPage(pageNum, (err, pg) => {
      if (!err && pg && !highlights) pageImageCache.set(pageNum, pg);
      cb(err, pg);
    }, highlights);
  };
  // --- End page image cache ---

  // Always use ctx.spreadMode (now always set by caller)
  // console.log('[FlipbookViewer] spreadMode:', ctx.spreadMode);

  setupCanvas(ctx, (err) => {
    if (err) return cb(err);

    calcLayoutParameters(ctx, (err) => {
      if (err) return cb(err);

      ctx.app.c(ctx.canvas.e);

      setupMouseHandler(ctx, viewer);

      // This may not be helpful for mobile devices
      // // --- Touch event support for mobile ---
      // if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      //   let touchStartX = 0, touchStartY = 0, touchStartDist = 0, pinchZooming = false;
      //   ctx.canvas.e.addEventListener('touchstart', function(e) {
      //     if (e.touches.length === 1) {
      //       touchStartX = e.touches[0].clientX;
      //       touchStartY = e.touches[0].clientY;
      //       pinchZooming = false;
      //     } else if (e.touches.length === 2) {
      //       pinchZooming = true;
      //       const dx = e.touches[0].clientX - e.touches[1].clientX;
      //       const dy = e.touches[0].clientY - e.touches[1].clientY;
      //       touchStartDist = Math.sqrt(dx*dx + dy*dy);
      //     }
      //   }, { passive: true });
      //   ctx.canvas.e.addEventListener('touchmove', function(e) {
      //     if (pinchZooming && e.touches.length === 2) {
      //       const dx = e.touches[0].clientX - e.touches[1].clientX;
      //       const dy = e.touches[0].clientY - e.touches[1].clientY;
      //       const dist = Math.sqrt(dx*dx + dy*dy);
      //       if (Math.abs(dist - touchStartDist) > 20) {
      //         if (dist > touchStartDist) {
      //           viewer.zoom((ctx.zoom || 1) + 1);
      //         } else {
      //           viewer.zoom((ctx.zoom || 1) - 1);
      //         }
      //         touchStartDist = dist;
      //       }
      //     }
      //   }, { passive: true });
      //   ctx.canvas.e.addEventListener('touchend', function(e) {
      //     if (!pinchZooming && e.changedTouches.length === 1) {
      //       const dx = e.changedTouches[0].clientX - touchStartX;
      //       const dy = e.changedTouches[0].clientY - touchStartY;
      //       if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      //         if (dx < 0) viewer.flip_forward();
      //         else viewer.flip_back();
      //       }
      //     }
      //   }, { passive: true });
      // }
      // // --- End touch event support ---

      ctx.zoom = 0;
      ctx.showNdx = 0;

      setupControls(ctx, viewer);

      cb(null, viewer);

      showPages(ctx, viewer);
    });
  });
}

function setupControls(ctx, viewer) {
  viewer.zoom = (zoom) => {
    zoom = Number(zoom);
    if (isNaN(zoom)) {
      zoom = ctx.zoom * 2 + 1;
      if (zoom > 4) zoom = 0;
    }
    if (!zoom) {
      ctx.zoom = 0;
      ctx.pan = null;
      showPages(ctx, viewer);
    } else {
      animate({
        draw: (curr) => {
          ctx.zoom = curr.zoom;
          showPages(ctx, viewer);
        },
        duration: 500,
        from: { zoom: ctx.zoom },
        to: { zoom },
        timing: (t) => t * t * (3.0 - 2.0 * t),
      });
    }
  };

  viewer.flip_forward = () => {
    if (ctx.flipNdx || ctx.flipNdx === 0) return;
    if (ctx.book.numPages() <= 1) return;
    if (ctx.spreadMode) {
      if (ctx.showNdx + 1 >= ctx.book.numPages()) return;
      ctx.flipNdx = ctx.showNdx + 1;
    } else {
      if (ctx.showNdx * 2 + 1 >= ctx.book.numPages()) return;
      ctx.flipNdx = ctx.showNdx + 1;
    }
    ctx.zoom = 0;
    ctx.pan = null;
    flip_1(ctx);
  };
  viewer.flip_back = () => {
    if (ctx.flipNdx || ctx.flipNdx === 0) return;
    if (ctx.book.numPages() <= 1) return;
    if (!ctx.showNdx) return;
    ctx.flipNdx = ctx.showNdx - 1;
    ctx.zoom = 0;
    ctx.pan = null;
    flip_1(ctx);
  };

  // this is a new function in PDF-A-go-go that allows you to go to a specific page
  viewer.go_to_page = (pageNum) => {
    pageNum = Math.floor(Number(pageNum));
    if (isNaN(pageNum) || pageNum < 0 || pageNum >= ctx.book.numPages()) return;
    if (ctx.spreadMode) {
      ctx.showNdx = pageNum;
    } else {
      ctx.showNdx = Math.floor(pageNum / 2);
    }
    ctx.flipNdx = null;
    ctx.zoom = 0;
    ctx.pan = null;
    showPages(ctx, viewer);
  };

  function flip_1(ctx) {
    const fromNdx = ctx.showNdx;
    const toNdx = ctx.flipNdx;
    const direction = toNdx > fromNdx ? 1 : -1;
    const duration = 400;
    const canvas = ctx.canvas;
    if (ctx.spreadMode) {
      // Spread mode: animate a single page
      slidePagesAnimation({
        ctx,
        viewer,
        canvas,
        direction,
        duration,
        fromPages: [{ ndx: fromNdx }],
        toPages: [{ ndx: toNdx }],
        layoutFn: (layout) => [{ ...layout }],
        ondone: () => {
          ctx.showNdx = ctx.flipNdx;
          ctx.flipNdx = null;
          showPages(ctx, viewer);
        },
      });
    } else {
      // Dual-page mode: animate two pages
      const fromLeftNdx = fromNdx * 2;
      const fromRightNdx = fromLeftNdx + 1;
      const toLeftNdx = toNdx * 2;
      const toRightNdx = toLeftNdx + 1;
      slidePagesAnimation({
        ctx,
        viewer,
        canvas,
        direction,
        duration,
        fromPages: [
          { ndx: fromLeftNdx, isLeft: true },
          { ndx: fromRightNdx, isLeft: false },
        ],
        toPages: [
          { ndx: toLeftNdx, isLeft: true },
          { ndx: toRightNdx, isLeft: false },
        ],
        layoutFn: (layout) => [
          { ...layout, width: layout.width / 2 },
          { ...layout, width: layout.width / 2, left: layout.mid },
        ],
        ondone: () => {
          ctx.showNdx = ctx.flipNdx;
          ctx.flipNdx = null;
          showPages(ctx, viewer);
        },
      });
    }
  }

  // Consolidated slide animation for both spread and dual-page
  function slidePagesAnimation({ ctx, viewer, canvas, direction, duration, fromPages, toPages, layoutFn, ondone }) {
    const start = Date.now();
    let fromImgs = [];
    let toImgs = [];
    let layout; // cache layout for the whole animation

    // GPU acceleration hint
    if (canvas.e && canvas.e.style) {
      canvas.e.style.willChange = 'transform';
    }

    // Helper to get all pages, then animate
    function getPages(pages, cb) {
      let results = [];
      let count = 0;
      if (!pages.length) return cb([]);
      pages.forEach((p, i) => {
        ctx.getCachedPage(p.ndx, (err, pg) => {
          results[i] = pg;
          count++;
          if (count === pages.length) cb(results);
        });
      });
    }
    getPages(fromPages, (fromResults) => {
      fromImgs = fromResults;
      getPages(toPages, (toResults) => {
        toImgs = toResults;
        layout = calcLayout(ctx); // Only once!
        animateSlide();
      });
    });
    function animateSlide() {
      let frac = (Date.now() - start) / duration;
      if (frac > 1) frac = 1;
      // Only clear the region if possible, or keep as is if background is opaque
      canvas.ctx.save();
      canvas.ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.ctx.clearRect(0, 0, canvas.e.width, canvas.e.height);

      let offset = layout.width * frac * direction;
      const layouts = layoutFn(layout);

      // Draw fromPages sliding out
      let lastAlpha = null;
      fromImgs.forEach((img, i) => {
        if (!img) return;
        const loc = { ...layouts[i] };
        loc.left = (loc.left || 0) - offset;
        const alpha = 1 - frac * 0.5;
        if (lastAlpha !== alpha) {
          canvas.ctx.globalAlpha = alpha;
          lastAlpha = alpha;
        }
        canvas.ctx.drawImage(img.img, loc.left, loc.top, loc.width, loc.height);
      });
      // Draw toPages sliding in
      toImgs.forEach((img, i) => {
        if (!img) return;
        const loc = { ...layouts[i] };
        loc.left = (loc.left || 0) + layout.width * direction - offset;
        const alpha = 0.5 + frac * 0.5;
        if (lastAlpha !== alpha) {
          canvas.ctx.globalAlpha = alpha;
          lastAlpha = alpha;
        }
        canvas.ctx.drawImage(img.img, loc.left, loc.top, loc.width, loc.height);
      });
      if (lastAlpha !== 1) canvas.ctx.globalAlpha = 1;
      canvas.ctx.restore();
      if (frac < 1) {
        requestAnimationFrame(animateSlide);
      } else {
        ondone();
      }
    }
    // NOTE: For further performance, consider lowering outputScale on slow devices.
  }
}

/*    way/
 * set up a canvas element with some width
 * and height and use the first page to
 * calculate the display.
 */
function setupCanvas(ctx, cb) {
  const canvas = {
    e: h("canvas"),
  };

  canvas.ctx = canvas.e.getContext("2d");
  canvas.e.width = Math.floor(ctx.sz.boxw * outputScale);
  canvas.e.height = Math.floor(ctx.sz.boxh * outputScale);
  canvas.e.style.width = Math.floor(ctx.sz.boxw) + "px";
  canvas.e.style.height = Math.floor(ctx.sz.boxh) + "px";

  ctx.canvas = canvas;
  cb();
}

/*    way/
 * use the first page to calculate enough space
 * for showing a double-page view.
 */
function calcLayoutParameters(ctx, cb) {
  const w = ctx.sz.boxw * outputScale;
  const h = ctx.sz.boxh * outputScale;

  ctx.book.getPage(1, (err, pg) => {
    if (err) return cb(err);

    const usableH = 1 - ctx.sz.marginTop / 100;
    let height = h * usableH;
    const usableW = 1 - ctx.sz.marginLeft / 100;
    let width;
    if (ctx.spreadMode) {
      // Use the page's natural aspect ratio
      width = pg.width * (height / pg.height);
    } else {
      // Double-page view
      width = pg.width * 2 * (height / pg.height);
    }
    const maxwidth = w * usableW;
    if (width > maxwidth) {
      width = maxwidth;
      if (ctx.spreadMode) {
        height = pg.height * (width / pg.width);
      } else {
        height = pg.height * (width / (pg.width * 2));
      }
    }

    ctx.layout = {
      top: (h - height) / 2,
      left: (w - width) / 2,
      mid: w / 2,
      width: width,
      height,
    };

    cb();
  });
}

/*    way/
 * capture mouse events, passing them to the
 * actual handlers if set up
 */
function setupMouseHandler(ctx, viewer) {
  const handlers = [setupPanning(ctx, viewer)];

  const events = [
    "onmouseenter",
    "onmouseleave",
    "onmousemove",
    "onclick",
    "onmousedown",
    "onmouseup",
  ];

  const attr = {};
  events.map((e) => {
    attr[e] = (evt) => {
      handlers.map((h) => {
        if (h[e]) h[e](evt);
      });
    };
  });

  ctx.app.attr(attr);
}

/*    way/
 * set up the ctx.pan offsets (only when zooming),
 * starting on the first mouse click and ending when
 * mouse up or we leave the box
 */
function setupPanning(ctx, viewer) {
  let start;

  function onmouseleave(evt) {
    start = null;
  }

  function onmousedown(evt) {
    if (!ctx.zoom) return;
    start = mousePt(ctx, evt);
    if (ctx.pan) {
      start.x -= ctx.pan.x;
      start.y -= ctx.pan.y;
    }
  }

  function onmouseup(evt) {
    start = null;
  }

  function onmousemove(evt) {
    const pt = mousePt(ctx, evt);
    if (start && inBox(ctx, pt)) {
      ctx.pan = {
        x: pt.x - start.x,
        y: pt.y - start.y,
      };
      showPages(ctx, viewer);
    } else {
      start = null;
    }
  }

  return {
    onmouseleave,
    onmousedown,
    onmouseup,
    onmousemove,
  };
}

/*    way/
 * return true if the point is in the current box
 */
function inBox(ctx, pt) {
  const rt = currBox(ctx);
  return (
    rt.top <= pt.y && rt.bottom >= pt.y && rt.left <= pt.x && rt.right >= pt.x
  );
}

/*    way/
 * return the location of the mouse relative to the app area
 */
function mousePt(ctx, evt) {
  const rect = ctx.app.getBoundingClientRect();
  return {
    x: evt.clientX - rect.x,
    y: evt.clientY - rect.y,
  };
}

/*    way/
 * return the current rectangle
 */
function currBox(ctx) {
  const l = calcLayout(ctx);
  return {
    top: l.top,
    left: l.left,
    bottom: l.top + l.height,
    right: l.left + l.width,
  };
}

/*    understand/
 * return the layout, adjusted for zoom and panning
 */
function calcLayout(ctx) {
  let layout = ctx.layout;

  if (ctx.zoom > 0) {
    layout = Object.assign({}, layout);
    if (ctx.zoom) {
      const zoom = ctx.zoom * 0.5;
      layout.left = layout.left - (layout.width * zoom) / 2;
      layout.top = layout.top - (layout.height * zoom) / 2;
      layout.width = layout.width * (1 + zoom);
      layout.height = layout.height * (1 + zoom);
    }
    if (ctx.pan) {
      layout.left += ctx.pan.x;
      layout.top += ctx.pan.y;
      layout.mid += ctx.pan.x;
    }
  }

  return layout;
}

/*    way/
 * show the background and the pages on the viewer
 */
function showPages(ctx, viewer) {
  viewer.showNdx = ctx.showNdx;
  const canvas = ctx.canvas;
  let left_, right_;
  let isSingleSpread = false;
  if (ctx.spreadMode) {
    left_ = ctx.showNdx;
    right_ = null;
    if (ctx.showNdx === 0 || ctx.showNdx === ctx.book.numPages() - 1) {
      isSingleSpread = true;
    }
  } else {
    left_ = ctx.showNdx * 2;
    right_ = left_ + 1;
  }
  canvas.ctx.save();
  const globalHighlights = (window.__pdfagogo__highlights || {});
  ctx.getCachedPage(left_, (err, left) => {
    if (err) return console.error(err);
    if (!ctx.flipNdx && ctx.flipNdx !== 0 && left) viewer.emit("seen", left_);
    if (ctx.spreadMode || right_ === null) {
      show_bg_1();
      show_pgs_1(left, null, () => canvas.ctx.restore(), isSingleSpread);
    } else {
      ctx.getCachedPage(right_, (err, right) => {
        if (err) return console.error(err);
        if (!ctx.flipNdx && ctx.flipNdx !== 0 && right)
          viewer.emit("seen", right_);
        show_bg_1();
        show_pgs_1(left, right, () => canvas.ctx.restore(), false);
      }, globalHighlights[right_] || []);
    }
  }, globalHighlights[left_] || []);

  /*    way/
   * get the current layout and, if no zoom, show the
   * surrounding box. Otherwise show the left and right
   * pages on the correct positions
   */
  function show_pgs_1(left, right, cb, isSingleSpread) {
    let layout = calcLayout(ctx);

    if (ctx.zoom == 0) show_bx_1(layout);

    if (ctx.spreadMode) {
      if (left) {
        if (isSingleSpread) {
          // Center the single page using the largest size that fits, preserving aspect ratio
          const boxW = ctx.sz.boxw * outputScale;
          const boxH = ctx.sz.boxh * outputScale;
          const usableH = 1 - ctx.sz.marginTop / 100;
          const usableW = 1 - ctx.sz.marginLeft / 100;
          let maxW = boxW * usableW;
          let maxH = boxH * usableH;
          let pageAR = left.width / left.height;
          let dispW = maxW;
          let dispH = dispW / pageAR;
          if (dispH > maxH) {
            dispH = maxH;
            dispW = dispH * pageAR;
          }
          const centeredLayout = {
            left: (boxW - dispW) / 2,
            top: (boxH - dispH) / 2,
            width: dispW,
            height: dispH,
          };
          show_pg_1(left, centeredLayout);
        } else {
          // Normal spread mode: show the page as is
          show_pg_1(left, layout);
        }
      }
    } else {
      const page_l = Object.assign({}, layout);
      const page_r = Object.assign({}, layout);
      page_l.width /= 2;
      page_r.width /= 2;
      page_r.left = layout.mid;
      if (left) show_pg_1(left, page_l);
      if (right) show_pg_1(right, page_r);
    }
    cb();
  }

  function show_pg_1(pg, loc) {
    canvas.ctx.drawImage(pg.img, loc.left, loc.top, loc.width, loc.height);
  }

  function show_bx_1(loc) {
    canvas.ctx.fillStyle = ctx.color.bx;
    const border = ctx.sz.bx_border;
    canvas.ctx.fillRect(
      loc.left - border,
      loc.top - border,
      loc.width + border * 2,
      loc.height + 2 * border
    );
  }

  function show_bg_1() {
    canvas.ctx.fillStyle = ctx.color.bg;
    canvas.ctx.fillRect(
      0,
      0,
      ctx.sz.boxw * outputScale,
      ctx.sz.boxh * outputScale
    );
  }
}

/*    understand/
 * animate the properties {from -> to} , calling ondone when ends
 */
function animate({ draw, duration, from, to, timing, ondone }) {
  if (!ondone) ondone = () => 1;
  if (!timing) timing = (t) => t;

  const start = Date.now();

  animate_1();

  function animate_1() {
    let frac = (Date.now() - start) / duration;
    if (frac > 1) frac = 1;
    const curr = progress_1(frac);
    draw(curr);
    if (frac === 1) ondone();
    else requestAnimationFrame(animate_1);
  }

  function progress_1(frac) {
    frac = timing(frac);
    const ret = Object.assign({}, from);
    for (let k in from) {
      const s = Number(from[k]);
      const e = Number(to[k]);
      ret[k] = s + (e - s) * frac;
    }
    return ret;
  }
}
