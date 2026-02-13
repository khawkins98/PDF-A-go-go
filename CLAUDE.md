# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF-A-go-go is a lightweight, accessible, embeddable PDF viewer built on PDF.js. It requires no initialization code—just include one JS file and configure via `data-*` attributes on a container element.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Start dev server (port 9000, live reload)
npm run dev

# Production build (outputs to /dist)
npm run build

# Run all tests (builds first, starts server, runs Playwright)
npm test

# Debug tests interactively
npm run test:debug

# Run specific test file (requires dev server running separately)
npm run test:serve  # Terminal 1
npx playwright test src/tests/zoom.spec.ts  # Terminal 2
```

## Architecture

**Entry Point**: `src/assets/js/pdfagogo.js` - Auto-initializes on DOM load, parses `data-*` attributes from `.pdfagogo-container` elements.

**Core Modules** (all in `src/assets/js/`):
- `scrollablePdfViewer.js` - Main viewer class with render queue, zoom, navigation, and user interaction
- `tileRenderer.js` - Tile-based page rendering with resolution tiers and compositing
- `tileManager.js` - Tile cache management with LRU eviction, resolution tier definitions
- `ui.js` - Controls (search, share, download, fullscreen, page selector, resize grip)
- `pdfLoader.js` - PDF loading with progress tracking, content-type detection, and configurable worker URL
- `htmlDownloadHandler.js` - Handles PDFs served through HTML redirect pages (institutional repositories)
- `search.js` - Full-text search with highlighting
- `viewerInstance.js` - Encapsulates state for a single PDF viewer instance
- `searchController.js` - Instance-scoped search state and highlight management

**Data Flow**: `pdfagogo.js` → `pdfLoader.js` loads PDF → creates book object → `ScrollablePdfViewer` → `TileRenderer` → `TileManager` for rendering. UI controls in `ui.js` interact with the viewer instance.

**Key Dependencies**:
- `pdfjs-dist` v5.4.530 - Mozilla's PDF.js for PDF rendering (v5.x has breaking API changes vs v4.x)

**Build**: Webpack 5 bundles to `dist/pdf-a-go-go.js` and `dist/pdf-a-go-go.css`. The PDF.js worker is bundled as `pdf-a-go-go.dependencies.js`.

## Testing

Tests are in `src/tests/*.spec.ts` using Playwright:
- `zoom.spec.ts` - Pinch, keyboard, mouse wheel zoom
- `performance.spec.ts` - Desktop/mobile render times, scroll behavior
- `memory-performance.spec.ts` - Tile cache efficiency, memory usage patterns
- `stress-test.spec.ts` - Large document handling (827-page PDF)
- `fullscreen.spec.ts` - Fullscreen UI behavior
- `text-selection.spec.ts` - Text layer rendering and copy/paste functionality
- `playground.spec.ts` - Full integration tests (navigation, search, toolbar, clipboard, download, share, fullscreen)

**Test HTML pages** (in `src/examples/` and `src/tests/`):
- `index.html` - Basic viewer with standard PDF
- `double-spread.html` - Large 12MB PDF for spread testing
- `stress-test-large-pdf.html` - 827-page document for stress tests
- `html-download-example.html` - HTML redirect/proxy handling
- `html-download-example-iframe.html` - Simulated institutional repository redirect
- `remote-pdf-allowed.html` - CORS-enabled remote PDF loading
- `remote-pdf-cors-fail.html` - CORS failure error handling
- `test-small.html` - Small-format viewer for focused tests

Performance thresholds: Desktop < 5s initial render, Mobile < 10s (with CPU throttling).

## Key Patterns

**Configuration**: All viewer options are read from `data-*` attributes on the container element. No JavaScript initialization required.

**Tile-Based Rendering**: Pages are divided into fixed-size tiles (512px desktop, 256px mobile). Only visible tiles are rendered at resolution appropriate for the current zoom level. Four resolution tiers (0.5x to 4x scale) cover zoom range 25%-500%.

**Render Queue**: Uses a priority queue with RAF for rendering. High-priority tasks (visible pages) are processed before lower-priority tasks (off-screen pages).

**Memory Management**: LRU tile cache (100 tiles desktop, 50 mobile) automatically evicts old tiles. Tiles are cached per resolution tier for smooth zoom transitions. Full-page cache (10 pages desktop, 5 mobile) and text layer cache (10 layers desktop, 5 mobile) use LRU eviction. Configurable via `data-fullpage-cache-size` and `data-text-layer-cache-size`.

**Multi-Instance Support**: Multiple viewers can exist on the same page with isolated state. Each viewer has its own ViewerInstance, SearchController, and memory caches. Access via `container._pdfagogoInstance` or the global registry.

## Container Configuration Example

```html
<div class="pdfagogo-container"
     data-pdf-url="./document.pdf"
     data-show-toolbar="true"
     data-show-search="true"
     data-show-share="true"
     data-show-page-selector="true"
     data-show-current-page="true"
     data-show-download="true"
     data-show-fullscreen="true"
     data-show-resize-grip="true"
     data-show-accessibility-controls-visibly="false"
     data-default-page="1"
     data-background-color="#e4e4e4"
     data-box-border="1"
     data-margin="1.0"
     data-margin-top="0.5"
     data-margin-left="0.5"
     data-momentum="1.5"
     data-disable-webgl="true"
     data-download-timeout="30000"
     data-debug="false"
     data-theme="dark"
     data-worker-url="./custom-pdf.worker.js"
     data-fullpage-cache-size="10"
     data-text-layer-cache-size="10"></div>
```

## CSS Theming

All colors use CSS custom properties (e.g., `--pdfagogo-primary`, `--pdfagogo-bg-container`). Apply themes via `data-theme` attribute or override variables in your CSS. A built-in dark theme is available with `data-theme="dark"`. See `DOCUMENTATION.md` for full variable list.

## Documentation

- `DOCUMENTATION.md` - Comprehensive application documentation (architecture, API reference, configuration, theming, testing)
- `IMPROVEMENTS.md` - Future improvement backlog (prioritized)
