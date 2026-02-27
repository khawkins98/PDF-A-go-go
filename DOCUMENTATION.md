# PDF-A-go-go documentation

## Table of contents

1. [Overview](#overview)
2. [Architecture overview](#architecture-overview)
3. [Core modules](#core-modules)
4. [API reference](#api-reference)
5. [Configuration options](#configuration-options)
6. [CSS theming](#css-theming)
7. [Multi-instance support](#multi-instance-support)
8. [Memory management](#memory-management)
9. [Performance](#performance)
10. [Accessibility](#accessibility)
11. [Testing](#testing)
12. [Build & deployment](#build--deployment)

## Overview

PDF-A-go-go is a PDF viewer built on PDF.js. Include one JS file and one CSS file, configure via `data-*` attributes on a container element, and it works. No init code needed.

### What it does

- Vertical scroll viewing with momentum scrolling
- Tile-based rendering at multiple resolution tiers (saves memory)
- Pinch-to-zoom, keyboard shortcuts, mouse wheel zoom (25%-500%)
- Full-text search with highlighting and match navigation
- Multiple independent viewer instances on one page
- Text layer with copy/paste
- Keyboard and screen reader accessible (ARIA labels, focus management)
- CSS custom property theming (dark theme included)
- Handles HTML redirect pages (common in academic repositories)
- Debug overlay for performance monitoring
- Shareable page links via URL fragments
- Touch-optimized for mobile

### Technology

- **Core**: Vanilla JavaScript (ES6+), no framework
- **PDF Engine**: `pdfjs-dist` v5.4.530 (Mozilla PDF.js)
- **Build**: Webpack 5
- **Tests**: Playwright (E2E)
- **Styling**: CSS with Grid/Flexbox and custom properties

## Architecture overview

```
PDF-A-go-go Application Architecture

┌─────────────────────────────────────────────────────────────────┐
│                    Entry Point (pdfagogo.js)                    │
│  • Auto-init on DOM load                                       │
│  • Config parsing from data-* attributes                       │
│  • ViewerRegistry for multi-instance management                │
└──────────────┬─────────────────────────────────────┬────────────┘
               │                                     │
┌──────────────▼──────────────┐    ┌─────────────────▼────────────┐
│   ViewerInstance             │    │   pdfLoader.js               │
│   • Per-viewer state         │    │   • PDF loading + progress   │
│   • PDF, viewer, book refs   │    │   • Content-type detection   │
│   • SearchController         │    │   • Configurable worker URL  │
│   • Theme management         │    │   • HTMLDownloadHandler       │
└──────────────┬──────────────┘    └──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────────┐
│              ScrollablePdfViewer                                 │
│  • Core rendering + interaction engine                          │
│  • RenderQueue (priority-based, RAF)                            │
│  • Zoom, navigation, scroll, touch/mouse events                 │
│  • Text layer management with LRU cache                         │
│  • Performance monitoring + debug overlay                       │
└──────────────┬──────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────┐    ┌──────────────────────────────┐
│   TileRenderer               │    │   UI Controls (ui.js)        │
│   • Page → tile grid          │    │   • Toolbar (search, share,  │
│   • Resolution tier rendering │    │     download, fullscreen,    │
│   • Tile compositing          │    │     page selector)           │
└──────────────┬──────────────┘    │   • Loading progress          │
               │                    │   • Resize grip               │
┌──────────────▼──────────────┐    │   • Accessibility controls    │
│   TileManager                │    └──────────────────────────────┘
│   • LRU tile cache           │
│   • Resolution tier defs     │    ┌──────────────────────────────┐
│   • Full-page cache           │    │   SearchController           │
│   • Highlight management     │    │   • Instance-scoped search   │
└──────────────────────────────┘    │   • Batch page processing    │
                                    │   • Highlight coordinates     │
                                    └──────────────────────────────┘
```

**Data Flow**: `pdfagogo.js` → `pdfLoader.js` loads PDF → creates book object → `ScrollablePdfViewer` → `TileRenderer` → `TileManager` for rendering. UI controls in `ui.js` interact with the viewer instance. Search is managed per-instance by `SearchController`.

## Core modules

All modules are located in `src/assets/js/`.

### 1. `pdfagogo.js` -- Entry Point

Entry point. Contains `ViewerRegistry` for managing multiple viewer instances. Auto-initializes all `.pdfagogo-container` elements on DOM load. Parses `data-*` attributes into typed config via `getOptionsFromDataAttrs()`.

**Exports**: `init()`, `registry`, `initializeContainer()`, `ViewerInstance`, `SearchController`

### 2. `scrollablePdfViewer.js` -- Core Viewer

The main rendering and interaction engine. Extends `EventEmitter`.

Does the heavy lifting: page rendering via `TileRenderer`, priority-based `RenderQueue` (using `requestAnimationFrame`), zoom (pinch, keyboard, mouse wheel), scroll handling, page navigation, text layer rendering with LRU caching, and the debug overlay.

### 3. `tileRenderer.js` -- Tile-Based Page Renderer

Divides PDF pages into a grid of tiles and renders only the visible ones at the appropriate resolution tier. Composites tiles onto display canvases. Handles four resolution tiers (0.5x, 1.0x, 2.0x, 4.0x) with smooth transitions between them.

### 4. `tileManager.js` -- Tile Cache Management

LRU cache for rendered tiles, with per-tier storage.

**Exports**: `TileManager`, `getTierForZoom()`, `getTileKey()`, `parseTileKey()`, `RESOLUTION_TIERS`

**Resolution tiers**:
| Tier | Min Zoom | Max Zoom | Render Scale |
|------|----------|----------|-------------|
| 0    | 0.25     | 0.5      | 0.5x        |
| 1    | 0.5      | 1.0      | 1.0x        |
| 2    | 1.0      | 2.0      | 2.0x        |
| 3    | 2.0      | 5.0      | 4.0x        |

### 5. `ui.js` -- UI Controls

Builds the toolbar (search, share, download, fullscreen, page selector), loading progress bar, resize grip, error display, and accessibility instructions. Screen reader announcements go through ARIA live regions.

**Key exports**: `createLoadingBar()`, `updateLoadingBar()`, `removeLoadingBar()`, `showError()`, `setupControls()`

### 6. `pdfLoader.js` -- PDF Loading

Loads PDFs via PDF.js with progress callbacks. Checks the response content-type and routes HTML responses to `HTMLDownloadHandler` automatically. Worker URL is configurable via `setWorkerUrl()` / `getWorkerUrl()`, defaulting to the bundled worker (`pdf-a-go-go.dependencies.js`).

### 7. `search.js` -- Search UI Setup

Sets up the search UI controls in the toolbar (input field, navigation buttons, result count). Pairs with `SearchController` for actual search logic.

### 8. `searchController.js` -- Instance-Scoped Search

Manages search for a single viewer instance. Case-insensitive full-text search across all pages, with parallel batch processing (10 pages per batch). Calculates per-page highlight bounding boxes, handles match navigation with wrap-around, and passes highlights to `TileManager` for rendering.

### 9. `viewerInstance.js` -- Per-Viewer State

Holds all state for one PDF viewer instance, so multiple viewers on a page don't share globals.

**Manages**: PDF document, `ScrollablePdfViewer`, book object, `SearchController`, theme, page navigation source tracking.

### 10. `htmlDownloadHandler.js` -- HTML Redirect Handling

Handles PDFs served through HTML redirect pages (common in academic repositories and document management systems). Detects meta refresh tags, uses an iframe-based proxy for safe redirect interception, checks content types before downloading, preserves cookies for authenticated downloads, and supports configurable timeouts.

## API reference

### ViewerRegistry

The global registry manages all viewer instances. Accessed via `pdfagogo.registry`.

```javascript
class ViewerRegistry {
  instances: Map<string, ViewerInstance>  // Map of ID → instance
  size: number                           // Number of registered instances

  createInstance(container, options): ViewerInstance
  getInstance(containerOrId): ViewerInstance | undefined
  destroyInstance(instanceOrId): void
  getAllInstances(): ViewerInstance[]
  destroyAll(): void
}
```

### ViewerInstance

Each PDF viewer is wrapped in a `ViewerInstance` that encapsulates all state.

```javascript
class ViewerInstance {
  // Properties
  id: string                    // Unique instance identifier
  container: HTMLElement         // Container element
  pdf: Object                    // PDF.js document
  viewer: ScrollablePdfViewer    // Viewer instance
  book: Object                   // Book abstraction for page access
  searchController: SearchController
  theme: string | null           // Current theme name
  options: Object                // Configuration options

  // Methods
  setPdf(pdf): void
  setViewer(viewer): void
  setBook(book): void
  setSearchController(controller): void
  setTheme(themeName): void      // 'dark', 'default', or custom
  getTheme(): string | null
  setPageSource(source): void    // Track navigation source ('hash', 'user', etc.)
  getPageSource(): string | null
  destroy(): void                // Clean up all resources
  isValid(): boolean             // Check if not destroyed
  getPageCount(): number
  getCurrentPage(): number       // 1-based
  goToPage(pageNum): void        // 1-based
}
```

### SearchController

Each instance has its own `SearchController` for isolated search.

```javascript
class SearchController {
  // Properties
  pdf: Object                    // PDF.js document
  viewer: Object                 // Viewer instance
  tileManager: Object            // For highlight rendering
  matchPages: number[]           // Pages with matches (0-based)
  currentMatchIdx: number        // Current match index
  matchHighlights: Object        // { pageIndex: [{ x, y, width, height }] }
  lastQuery: string

  // Methods
  setPdf(pdf): void
  setViewer(viewer): void
  setTileManager(tileManager): void
  search(query): Promise<void>              // Full-text search
  getMatchCount(): number
  getCurrentMatchNumber(): number           // 1-based for display
  goToMatch(idx): { pageNum, highlights } | null
  nextMatch(): { pageNum, highlights } | null
  prevMatch(): { pageNum, highlights } | null
  clearSearch(): void
  getHighlights(pageIndex): Array
  setHighlights(pageIndex, highlights): void
  clearHighlights(): void
  hasMatches(): boolean
  getLastQuery(): string
}
```

### ScrollablePdfViewer

The core viewer class. Extends `EventEmitter`.

```javascript
// Navigation
viewer.flip_forward()           // Go to next page
viewer.flip_back()              // Go to previous page
viewer.go_to_page(pageNum)      // Go to specific page (0-based)
viewer.scrollBy(pages)          // Scroll by number of pages

// Zoom
viewer.setZoom(level, animate)  // Set zoom level (0.25-5.0)
viewer.zoomIn()                 // Zoom in by 10%
viewer.zoomOut()                // Zoom out by 10%
viewer.resetZoom()              // Reset to 100%
viewer.getZoom()                // Get current zoom level

// Rendering
viewer.rerenderPage(ndx)        // Force re-render of specific page

// Performance (returns null unless debug mode is enabled)
viewer.getPerformanceMetrics()
```

**Events**:

```javascript
// First set of visible pages finished rendering
viewer.on('initialRenderComplete', () => {})

// Most visible page changed (1-based page number)
viewer.on('seen', (pageNumber) => {})

// Set of visible pages changed (array of 1-based page numbers)
viewer.on('visiblePages', (pages) => {})

// Zoom level changed
viewer.on('zoom', ({ level, percentage }) => {})
```

### Accessing viewer instances

```javascript
// Via container element
const container = document.getElementById('viewer1');
const instance = container._pdfagogoInstance;
const viewer = container.pdfViewer;  // backward-compatible shortcut

// Via registry
import pdfagogo from 'pdf-a-go-go';
const instance = pdfagogo.registry.getInstance('viewer1');
const allInstances = pdfagogo.registry.getAllInstances();

// Destroy
pdfagogo.registry.destroyInstance('viewer1');
pdfagogo.registry.destroyAll();
```

## Configuration options

Set via `data-*` attributes on the container element. No JavaScript initialization needed.

### URL & Content

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-pdf-url` | string | `"./example.pdf"` | URL of the PDF to load |
| `data-default-page` | number | `1` | Initial page to display |

### UI feature toggles

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-show-toolbar` | boolean | `true` | Toggle entire toolbar visibility |
| `data-show-page-selector` | boolean | `true` | Show page number input field |
| `data-show-current-page` | boolean | `true` | Show current page indicator |
| `data-show-search` | boolean | `true` | Show search controls |
| `data-show-share` | boolean | `true` | Show share button |
| `data-show-download` | boolean | `true` | Show download button |
| `data-show-fullscreen` | boolean | `true` | Show fullscreen button |
| `data-show-resize-grip` | boolean | `true` | Show resize handle at bottom of viewer |
| `data-show-accessibility-controls-visibly` | boolean | `true` | Show visible accessibility instructions below viewer |

### Appearance

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-theme` | string | (none) | Theme name (e.g., `"dark"`) |
| `data-background-color` | string | -- | Page background color |
| `data-box-border` | integer | -- | Border width around pages (px) |
| `data-margin` | float | -- | General page margin |
| `data-margin-top` | float | -- | Top margin override |
| `data-margin-left` | float | -- | Left margin override |

### Behavior

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-momentum` | float | `1.5` | Scroll momentum factor |
| `data-disable-webgl` | boolean | `true` | Disable WebGL rendering in PDF.js |
| `data-debug` | boolean | `false` | Enable debug mode with performance overlay |

### Memory & performance

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-fullpage-cache-size` | number | 10 (desktop) / 5 (mobile) | Max full-page canvases to cache |
| `data-text-layer-cache-size` | number | 10 (desktop) / 5 (mobile) | Max text layers to keep in DOM |

### Worker & downloads

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-worker-url` | string | (bundled) | Custom PDF.js worker URL |
| `data-download-timeout` | number | `30000` | HTML download handler timeout in ms |

### Example

```html
<div class="pdfagogo-container"
     data-pdf-url="./document.pdf"
     data-show-search="true"
     data-show-share="true"
     data-show-page-selector="true"
     data-show-download="true"
     data-show-fullscreen="true"
     data-show-resize-grip="true"
     data-show-accessibility-controls-visibly="false"
     data-default-page="1"
     data-theme="dark"
     data-debug="false"
     data-worker-url="./custom-pdf.worker.js"
     data-fullpage-cache-size="10"
     data-text-layer-cache-size="10"></div>
```

## CSS theming

All visual properties use CSS custom properties, so you can retheme the whole viewer from your own stylesheet.

### CSS variables

```css
:root {
  /* Primary colors */
  --pdfagogo-primary: #1976d2;
  --pdfagogo-primary-light: #e3f2fd;
  --pdfagogo-primary-rgb: 25, 118, 210;

  /* Text colors */
  --pdfagogo-text-primary: #333;
  --pdfagogo-text-secondary: #555;
  --pdfagogo-text-muted: #666;
  --pdfagogo-text-hint: #999;
  --pdfagogo-text-light: #fff;

  /* Background colors */
  --pdfagogo-bg-page: #fff;
  --pdfagogo-bg-container: #e4e4e4;
  --pdfagogo-bg-toolbar: #fff;
  --pdfagogo-bg-hover: #e8e8e8;
  --pdfagogo-bg-active: #e0e0e0;
  --pdfagogo-bg-subtle: #f5f5f5;
  --pdfagogo-bg-input: #fff;
  --pdfagogo-bg-overlay: rgba(0, 0, 0, 0.7);
  --pdfagogo-bg-overlay-light: rgba(255, 255, 255, 0.9);

  /* Border colors */
  --pdfagogo-border: #ccc;
  --pdfagogo-border-light: #ddd;
  --pdfagogo-border-active: #bbb;
  --pdfagogo-border-input: #aaa;

  /* State colors */
  --pdfagogo-success: #4caf50;
  --pdfagogo-error: #d32f2f;
  --pdfagogo-error-light: #ffebee;
  --pdfagogo-error-bg: rgba(255, 0, 0, 0.15);
  --pdfagogo-error-border: rgba(255, 0, 0, 0.35);
  --pdfagogo-warning: #ff9800;

  /* Selection colors */
  --pdfagogo-selection: rgba(0, 100, 255, 0.35);

  /* Shadow colors */
  --pdfagogo-shadow: rgba(0, 0, 0, 0.18);
  --pdfagogo-shadow-strong: rgba(0, 0, 0, 0.2);

  /* Progress bar */
  --pdfagogo-progress-bg: rgba(255, 255, 255, 0.2);
  --pdfagogo-progress-fill: #4CAF50;

  /* Resize grip */
  --pdfagogo-grip-bg-start: #e0e0e0;
  --pdfagogo-grip-bg-end: #bdbdbd;
  --pdfagogo-grip-handle: #888;

  /* Debug panel */
  --pdfagogo-debug-bg: rgba(0, 0, 0, 0.8);
  --pdfagogo-debug-text: #00ff00;
  --pdfagogo-debug-timing: #00ffff;
  --pdfagogo-debug-memory: #ff9900;
  --pdfagogo-debug-border: #444;

  /* Scrollbar */
  --pdfagogo-scrollbar-thumb: rgba(0, 0, 0, 0.2);

  /* Fullscreen */
  --pdfagogo-bg-fullscreen: #111;

  /* Error text */
  --pdfagogo-error-text: #ffd2d2;
}
```

### Built-in dark theme

Activate via `data-theme="dark"` on the container element:

```css
[data-theme="dark"] {
  --pdfagogo-primary: #64b5f6;
  --pdfagogo-primary-light: #1e3a5f;
  --pdfagogo-primary-rgb: 100, 181, 246;

  --pdfagogo-text-primary: #e0e0e0;
  --pdfagogo-text-secondary: #bdbdbd;
  --pdfagogo-text-muted: #9e9e9e;
  --pdfagogo-text-hint: #757575;
  --pdfagogo-text-light: #fff;

  --pdfagogo-bg-page: #2d2d2d;
  --pdfagogo-bg-container: #1a1a1a;
  --pdfagogo-bg-toolbar: #2d2d2d;
  --pdfagogo-bg-hover: #3d3d3d;
  --pdfagogo-bg-active: #4d4d4d;
  --pdfagogo-bg-subtle: #252525;
  --pdfagogo-bg-input: #3d3d3d;
  --pdfagogo-bg-overlay: rgba(0, 0, 0, 0.85);
  --pdfagogo-bg-overlay-light: rgba(45, 45, 45, 0.95);

  --pdfagogo-border: #4d4d4d;
  --pdfagogo-border-light: #3d3d3d;
  --pdfagogo-border-active: #5d5d5d;
  --pdfagogo-border-input: #5d5d5d;

  --pdfagogo-shadow: rgba(0, 0, 0, 0.4);
  --pdfagogo-shadow-strong: rgba(0, 0, 0, 0.5);

  --pdfagogo-grip-bg-start: #3d3d3d;
  --pdfagogo-grip-bg-end: #2d2d2d;
  --pdfagogo-grip-handle: #666;

  --pdfagogo-debug-border: #666;
  --pdfagogo-scrollbar-thumb: rgba(255, 255, 255, 0.25);
  --pdfagogo-bg-fullscreen: #000;
  --pdfagogo-error-text: #ffa8a8;
}
```

### Custom themes

Override CSS custom properties in your own stylesheet:

```css
/* Custom "sepia" theme */
[data-theme="sepia"] {
  --pdfagogo-bg-page: #f4ecd8;
  --pdfagogo-bg-container: #e8dcc8;
  --pdfagogo-bg-toolbar: #f4ecd8;
  --pdfagogo-text-primary: #5b4636;
  --pdfagogo-text-secondary: #7a6652;
}
```

### Applying themes

Via HTML:
```html
<div class="pdfagogo-container" data-theme="dark" data-pdf-url="./doc.pdf"></div>
```

Via JavaScript:
```javascript
const instance = container._pdfagogoInstance;
instance.setTheme('dark');
instance.setTheme('default'); // remove theme
```

## Multi-instance support

You can put multiple PDF viewers on one page. Each one has its own state.

### Usage

```html
<div class="pdfagogo-container" id="viewer1" data-pdf-url="./doc1.pdf"></div>
<div class="pdfagogo-container" id="viewer2" data-pdf-url="./doc2.pdf" data-theme="dark"></div>
```

Each viewer has its own:
- PDF document
- Search state and highlights
- Page navigation state
- Memory caches (tiles, full-page canvases, text layers)
- Theme settings

### Registry API


```javascript
import pdfagogo from 'pdf-a-go-go';

// Get a specific instance
const instance = pdfagogo.registry.getInstance('viewer1');

// Get all instances
const all = pdfagogo.registry.getAllInstances();

// Destroy a specific instance (cleans up all resources)
pdfagogo.registry.destroyInstance('viewer1');

// Destroy all instances
pdfagogo.registry.destroyAll();
```

### Container access

```javascript
// Direct access via container element
const container = document.getElementById('viewer1');
const instance = container._pdfagogoInstance;  // ViewerInstance
const viewer = container.pdfViewer;            // ScrollablePdfViewer (backward compat)
```

## Memory management

### Tile cache

`TileManager` keeps an LRU cache of rendered tiles:

- **Desktop**: 100 tiles, 512px tile size
- **Mobile**: 50 tiles, 256px tile size

Tiles are cached per resolution tier for smooth zoom transitions. When the cache fills up, the least recently used tiles get evicted.

### Full-page cache

Full-page canvases cached for fast display while scrolling:

- **Desktop default**: 10 pages
- **Mobile default**: 5 pages
- **Configurable via**: `data-fullpage-cache-size`

### Text layer cache

`ScrollablePdfViewer` caps text layers in the DOM with LRU eviction:

- **Desktop default**: 10 text layers
- **Mobile default**: 5 text layers
- **Configurable via**: `data-text-layer-cache-size`

When the limit is hit, the oldest text layer is removed from the DOM and re-rendered if the page becomes visible again.

## Performance

### Tile-based rendering

Pages are divided into fixed-size tiles, and only visible ones get rendered at a resolution matching the current zoom level. Off-screen content isn't rendered, which keeps memory usage low. Tiles at adjacent resolution tiers are pre-cached for smooth zooming, and lower-res tiles act as fallbacks while high-res tiles render.

### Render queue

The `RenderQueue` uses `requestAnimationFrame` with two priority levels: visible page tiles render first, then off-screen pages get pre-rendered. Race condition guards prevent issues during rapid navigation.

### Zoom performance

Zoom applies a CSS transform immediately for visual feedback, then re-renders tiles at the right resolution tier in the background:

1. User initiates zoom (pinch/keyboard/wheel)
2. CSS `transform: scale()` applied immediately for visual feedback
3. Resolution tier is determined from new zoom level
4. Tiles rendered at new tier in background
5. Display canvases composited with high-res tiles

Zoom changes are debounced so rapid pinching or scrolling doesn't trigger a pile of re-renders.

### Performance metrics

Enable `data-debug="true"` for a floating metrics overlay:

```javascript
const metrics = viewer.getPerformanceMetrics();
// Returns:
{
  initialRenderTime: 1234,           // ms
  averageHighResRenderTime: 120,     // ms
  totalPagesRendered: 10,
  totalHighResUpgrades: 8,
  pageRenderTimes: { ... },
  highResUpgradeTimes: { ... }
}
// Returns null when debug mode is disabled
```

Performance thresholds for tests: Desktop < 5s initial render, Mobile < 10s (with CPU throttling).

## Accessibility

### Keyboard navigation

| Key | Action |
|-----|--------|
| `Tab` | Focus the viewer |
| `Left Arrow` | Previous page |
| `Right Arrow` | Next page |
| `Ctrl/Cmd +` | Zoom in |
| `Ctrl/Cmd -` | Zoom out |
| `Ctrl/Cmd 0` | Reset zoom to 100% |
| `Enter` | Activate focused element |

**Note**: Keyboard zoom requires the viewer container to be focused. The container has `tabindex="0"` set automatically.

### Screen reader support

- Canvas elements have page numbers via `data-page` attributes
- A live region (`aria-live="polite"`) announces page changes: "Page X of Y"
- Search results get their own live region
- Loading progress is announced as a percentage

### Visible accessibility controls

When `data-show-accessibility-controls-visibly="true"` (default), a collapsible `<details>` element below the viewer lists keyboard shortcuts. You can hide it without affecting keyboard or screen reader support.

### Focus management

The container gets `tabindex="0"` and shows a focus ring (`outline: 3px solid var(--pdfagogo-primary)`) on keyboard focus.

## Testing

Tests use Playwright and are located in `src/tests/*.spec.ts`.

### Test suites

| File | Description |
|------|-------------|
| `zoom.spec.ts` | Pinch, keyboard, mouse wheel zoom |
| `performance.spec.ts` | Desktop/mobile render times, scroll behavior |
| `memory-performance.spec.ts` | Tile cache efficiency, memory usage patterns |
| `stress-test.spec.ts` | Large document handling (827-page PDF) |
| `fullscreen.spec.ts` | Fullscreen UI behavior |
| `text-selection.spec.ts` | Text layer rendering and copy/paste |
| `playground.spec.ts` | Full integration tests (navigation, search, toolbar, clipboard, download, share, fullscreen) |

### Test HTML pages

Located in `src/examples/` and `src/tests/`:

| Page | Purpose |
|------|---------|
| `index.html` | Basic viewer with standard PDF |
| `double-spread.html` | Large 12MB PDF for spread testing |
| `stress-test-large-pdf.html` | 827-page document for stress tests |
| `html-download-example.html` | HTML redirect/proxy handling |
| `html-download-example-iframe.html` | Simulated institutional repository redirect |
| `remote-pdf-allowed.html` | CORS-enabled remote PDF loading |
| `remote-pdf-cors-fail.html` | CORS failure error handling |
| `test-small.html` | Small-format viewer for focused tests |

### Running tests

```bash
# Run all tests (builds first, starts server, runs Playwright)
yarn test

# Debug tests interactively
yarn test:debug

# Run specific test file (requires dev server running separately)
yarn test:serve  # Terminal 1
npx playwright test src/tests/zoom.spec.ts  # Terminal 2
```

## Build & deployment

### Build commands

```bash
yarn install          # Install dependencies
yarn dev              # Dev server on port 9000 with live reload
yarn build            # Production build to /dist
```

### Webpack config

- **Entry**: `src/assets/js/pdfagogo.js` (UMD library, global name `flipbook`)
- **Output**: `dist/pdf-a-go-go.js` (main bundle) + `dist/pdf-a-go-go.css` (styles) + `dist/pdf-a-go-go.dependencies.js` (PDF.js worker)
- **HTML**: Example pages are copied to dist with nav/head partial injection
- **Dev server**: Port 9000, live reload, no HMR, write files to disk

### Output files

| File | Description |
|------|-------------|
| `dist/pdf-a-go-go.js` | Main viewer bundle (UMD) |
| `dist/pdf-a-go-go.css` | Styles with CSS custom properties |
| `dist/pdf-a-go-go.dependencies.js` | PDF.js worker (loaded automatically) |

### GitHub Pages CI

The `gh-pages.yml` workflow automatically deploys to GitHub Pages on push to `main`:

1. Checkout repository
2. Install dependencies (`yarn install --frozen-lockfile`)
3. Install Playwright browsers (Chromium)
4. Build and test (`yarn test` -- builds, starts server, runs Playwright)
5. Deploy `dist/` to `gh-pages` branch

### File structure

```
src/
├── index.html                          # Main demo page
├── assets/
│   ├── css/
│   │   └── pdf-a-go-go.css            # Styles + CSS custom properties
│   └── js/
│       ├── pdfagogo.js                 # Entry point, ViewerRegistry, auto-init
│       ├── scrollablePdfViewer.js      # Core viewer + RenderQueue
│       ├── tileRenderer.js             # Tile-based page rendering
│       ├── tileManager.js              # LRU tile cache + resolution tiers
│       ├── ui.js                       # Toolbar, controls, accessibility
│       ├── pdfLoader.js                # PDF loading + progress + worker config
│       ├── search.js                   # Search UI setup
│       ├── searchController.js         # Instance-scoped search logic
│       ├── viewerInstance.js           # Per-viewer state encapsulation
│       └── htmlDownloadHandler.js      # HTML redirect handling
├── examples/
│   ├── *.html                          # Example/demo pages
│   └── *.pdf                           # Example PDF files
├── partials/
│   ├── nav.html                        # Navigation partial (injected at build)
│   └── head.html                       # Head partial (injected at build)
└── tests/
    ├── *.spec.ts                       # Playwright test files
    └── test-small.html                 # Small-format test page
```
