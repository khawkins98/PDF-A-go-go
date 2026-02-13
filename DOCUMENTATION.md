# PDF-A-go-go: Comprehensive Application Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Core Modules](#core-modules)
4. [API Reference](#api-reference)
5. [Configuration Options](#configuration-options)
6. [CSS Theming](#css-theming)
7. [Multi-Instance Support](#multi-instance-support)
8. [Memory Management](#memory-management)
9. [Performance](#performance)
10. [Accessibility](#accessibility)
11. [Testing](#testing)
12. [Build & Deployment](#build--deployment)

## Project Overview

**PDF-A-go-go** is a lightweight, accessible, embeddable PDF viewer built on PDF.js. It requires no initialization code -- just include one JS file and one CSS file, then configure via `data-*` attributes on a container element.

### Key Features

- Vertical scroll PDF viewing with smooth native momentum scrolling
- Tile-based rendering with multiple resolution tiers for efficient memory usage
- Pinch-to-zoom, keyboard shortcuts, mouse wheel zoom (25%-500%)
- Full-text search with highlighting and match navigation
- Multiple independent viewer instances on the same page
- Text layer with copy/paste support
- Full accessibility support (ARIA labels, keyboard navigation, screen reader)
- CSS custom property theming with built-in dark theme
- Smart HTML download handling for institutional repositories
- Performance monitoring with debug overlay
- Shareable page links with URL fragment support
- Mobile-responsive with touch-optimized interactions

### Technology Stack

- **Core**: Vanilla JavaScript (ES6+), no framework dependencies
- **PDF Engine**: `pdfjs-dist` v5.4.530 (Mozilla PDF.js)
- **Build Tool**: Webpack 5
- **Testing**: Playwright for E2E testing
- **Styling**: Pure CSS with CSS Grid/Flexbox and CSS custom properties

## Architecture Overview

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

## Core Modules

All modules are located in `src/assets/js/`.

### 1. `pdfagogo.js` -- Entry Point

Application initialization and orchestration. Contains the `ViewerRegistry` class for managing multiple viewer instances. Auto-initializes all `.pdfagogo-container` elements on DOM load. Parses `data-*` attributes into typed configuration via `getOptionsFromDataAttrs()`.

**Exports**: `init()`, `registry`, `initializeContainer()`, `ViewerInstance`, `SearchController`

### 2. `scrollablePdfViewer.js` -- Core Viewer

The main rendering and interaction engine. Extends `EventEmitter` for event-driven communication.

**Key responsibilities**:
- PDF page rendering via tile-based `TileRenderer`
- Priority-based `RenderQueue` using `requestAnimationFrame`
- Zoom management (pinch, keyboard, mouse wheel) with resolution tier switching
- Scroll handling, page navigation, visible page tracking
- Text layer rendering and LRU caching
- Performance metrics collection and debug overlay
- Mobile and desktop optimization

### 3. `tileRenderer.js` -- Tile-Based Page Renderer

Renders PDF pages by dividing them into a grid of tiles. Renders only visible tiles at the resolution tier appropriate for the current zoom level and composites them onto display canvases.

**Key features**:
- Page-to-tile grid calculation
- Resolution tier rendering (0.5x, 1.0x, 2.0x, 4.0x scale)
- Smooth transitions between resolution tiers
- Direct PDF.js page access for high-quality rendering

### 4. `tileManager.js` -- Tile Cache Management

Implements LRU caching for rendered tiles with support for multiple resolution tiers.

**Exports**: `TileManager`, `getTierForZoom()`, `getTileKey()`, `parseTileKey()`, `RESOLUTION_TIERS`

**Resolution tiers**:
| Tier | Min Zoom | Max Zoom | Render Scale |
|------|----------|----------|-------------|
| 0    | 0.25     | 0.5      | 0.5x        |
| 1    | 0.5      | 1.0      | 1.0x        |
| 2    | 1.0      | 2.0      | 2.0x        |
| 3    | 2.0      | 5.0      | 4.0x        |

### 5. `ui.js` -- UI Controls

Comprehensive UI module providing:
- Loading progress bar with percentage display
- Toolbar with search, share, download, fullscreen, and page selector controls
- Resize grip for container height adjustment
- Accessibility instructions (collapsible `<details>` element)
- Error display with actionable links
- Screen reader announcements via ARIA live regions

**Key exports**: `createLoadingBar()`, `updateLoadingBar()`, `removeLoadingBar()`, `showError()`, `setupControls()`

### 6. `pdfLoader.js` -- PDF Loading

Handles PDF loading with progress tracking and automatic HTML content detection.

**Key features**:
- Direct PDF loading via PDF.js with progress callbacks
- Content-type detection (automatically routes HTML responses to `HTMLDownloadHandler`)
- Configurable PDF.js worker URL via `setWorkerUrl()` / `getWorkerUrl()`
- Integration with the bundled worker (`pdf-a-go-go.dependencies.js`)

### 7. `search.js` -- Search UI Setup

Sets up the search UI controls in the toolbar (input field, navigation buttons, result count). Pairs with `SearchController` for actual search logic.

### 8. `searchController.js` -- Instance-Scoped Search

Manages search functionality per viewer instance. Uses parallel batch processing for performance on large documents.

**Key features**:
- Case-insensitive full-text search across all pages
- Parallel batch processing (10 pages per batch)
- Per-page highlight bounding box calculation
- Match navigation with wrap-around
- Integration with `TileManager` for highlight rendering

### 9. `viewerInstance.js` -- Per-Viewer State

Encapsulates all state for a single PDF viewer instance. Enables multiple independent viewers on the same page without global state pollution.

**Manages**: PDF document, `ScrollablePdfViewer`, book object, `SearchController`, theme, page navigation source tracking.

### 10. `htmlDownloadHandler.js` -- HTML Redirect Handling

Handles PDFs served through HTML redirect pages, common in institutional repositories, academic websites, and document management systems.

**Key features**:
- Meta refresh tag detection and parsing
- Iframe-based proxy system for safe redirect interception
- Content type checking before download
- Cookie preservation for authenticated downloads
- Configurable timeout management

## API Reference

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

### Accessing Viewer Instances

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

## Configuration Options

All viewer options are read from `data-*` attributes on the container element. No JavaScript initialization required.

### URL & Content

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-pdf-url` | string | `"./example.pdf"` | URL of the PDF to load |
| `data-default-page` | number | `1` | Initial page to display |

### UI Feature Toggles

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

### Memory & Performance

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-fullpage-cache-size` | number | 10 (desktop) / 5 (mobile) | Max full-page canvases to cache |
| `data-text-layer-cache-size` | number | 10 (desktop) / 5 (mobile) | Max text layers to keep in DOM |

### Worker & Downloads

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

## CSS Theming

All visual properties use CSS custom properties, enabling full theme customization.

### Available CSS Variables

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

### Built-in Dark Theme

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

### Creating Custom Themes

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

### Applying Themes

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

## Multi-Instance Support

Multiple independent PDF viewers can coexist on the same page. Each viewer has fully isolated state.

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

### Container Access

```javascript
// Direct access via container element
const container = document.getElementById('viewer1');
const instance = container._pdfagogoInstance;  // ViewerInstance
const viewer = container.pdfViewer;            // ScrollablePdfViewer (backward compat)
```

## Memory Management

### Tile Cache

The `TileManager` maintains an LRU cache of rendered tiles:

- **Desktop**: 100 tiles, 512px tile size
- **Mobile**: 50 tiles, 256px tile size

Tiles are cached per resolution tier, enabling smooth zoom transitions. When the cache reaches capacity, the least recently used tiles are evicted.

### Full-Page Cache

Cached full-page canvases for rapid display during scrolling:

- **Desktop default**: 10 pages
- **Mobile default**: 5 pages
- **Configurable via**: `data-fullpage-cache-size`

### Text Layer Cache

The `ScrollablePdfViewer` limits text layers in the DOM using LRU eviction:

- **Desktop default**: 10 text layers
- **Mobile default**: 5 text layers
- **Configurable via**: `data-text-layer-cache-size`

When the limit is reached, the least recently used text layer is removed from the DOM. It can be re-rendered when the page becomes visible again.

## Performance

### Tile-Based Rendering

Instead of rendering entire pages at full resolution, PDF-A-go-go divides pages into fixed-size tiles. Only visible tiles are rendered at the resolution appropriate for the current zoom level. This approach:

- Reduces memory usage by not rendering off-screen content
- Enables smooth zooming by pre-caching tiles at adjacent resolution tiers
- Allows progressive loading with fallback to lower-res tiles while high-res tiles render

### Render Queue

A priority-based `RenderQueue` uses `requestAnimationFrame` for optimal scheduling:

- **High priority**: Visible page tiles are rendered first
- **Normal priority**: Off-screen pages queued for pre-rendering
- Race condition protection ensures tasks execute safely even during rapid navigation

### Zoom Performance

Zoom uses CSS transforms for instant visual feedback, then re-renders tiles at the appropriate resolution tier asynchronously:

1. User initiates zoom (pinch/keyboard/wheel)
2. CSS `transform: scale()` applied immediately for visual feedback
3. Resolution tier is determined from new zoom level
4. Tiles rendered at new tier in background
5. Display canvases composited with high-res tiles

Zoom changes are debounced to avoid excessive re-rendering during rapid zoom.

### Performance Metrics

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

### Keyboard Navigation

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

### Screen Reader Support

- Canvas elements are labeled with page numbers via `data-page` attributes
- A live region (`aria-live="polite"`) announces page changes: "Page X of Y"
- Search results are announced via a separate live region
- Loading state is communicated with progress percentage

### Visible Accessibility Controls

When `data-show-accessibility-controls-visibly="true"` (default), a collapsible `<details>` element below the viewer provides keyboard shortcut instructions. This can be hidden while keeping full keyboard/screen reader support intact.

### Focus Management

The container element receives `tabindex="0"` and shows a visible focus ring (`outline: 3px solid var(--pdfagogo-primary)`) when focused via keyboard.

## Testing

Tests use Playwright and are located in `src/tests/*.spec.ts`.

### Test Suites

| File | Description |
|------|-------------|
| `zoom.spec.ts` | Pinch, keyboard, mouse wheel zoom |
| `performance.spec.ts` | Desktop/mobile render times, scroll behavior |
| `memory-performance.spec.ts` | Tile cache efficiency, memory usage patterns |
| `stress-test.spec.ts` | Large document handling (827-page PDF) |
| `fullscreen.spec.ts` | Fullscreen UI behavior |
| `text-selection.spec.ts` | Text layer rendering and copy/paste |
| `playground.spec.ts` | Full integration tests (navigation, search, toolbar, clipboard, download, share, fullscreen) |

### Test HTML Pages

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

### Running Tests

```bash
# Run all tests (builds first, starts server, runs Playwright)
npm test

# Debug tests interactively
npm run test:debug

# Run specific test file (requires dev server running separately)
npm run test:serve  # Terminal 1
npx playwright test src/tests/zoom.spec.ts  # Terminal 2
```

## Build & Deployment

### Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 9000 with live reload
npm run build        # Production build to /dist
```

### Webpack Configuration

- **Entry**: `src/assets/js/pdfagogo.js` (UMD library, global name `flipbook`)
- **Output**: `dist/pdf-a-go-go.js` (main bundle) + `dist/pdf-a-go-go.css` (styles) + `dist/pdf-a-go-go.dependencies.js` (PDF.js worker)
- **HTML**: Example pages are copied to dist with nav/head partial injection
- **Dev server**: Port 9000, live reload, no HMR, write files to disk

### Output Files

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

### File Structure

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
