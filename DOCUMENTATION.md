# PDF-A-go-go: Comprehensive Application Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Core Modules](#core-modules)
4. [API Reference](#api-reference)
5. [Configuration Options](#configuration-options)
6. [Performance & Optimization](#performance--optimization)
7. [Accessibility Features](#accessibility-features)
8. [Testing Strategy](#testing-strategy)
9. [Build & Development](#build--development)
10. [Advanced Features](#advanced-features)

## Project Overview

**PDF-A-go-go** is a lightweight, accessible, embeddable PDF viewer built on top of PDF.js. It provides a vertical scroll viewing experience with comprehensive accessibility support, performance optimizations, and advanced features like search, HTML download handling, and performance monitoring.

### Key Features

- 📖 **Vertical scroll PDF viewing** with smooth native momentum scrolling
- 🔍 **Advanced zoom functionality** (pinch-to-zoom, keyboard shortcuts, mouse wheel)
- 📏 **Accurate scroll positioning** with proper placeholder dimensions for all document sizes
- 🧠 **Unified scaling algorithms** that adapt automatically from small to massive documents (5-827+ pages)
- 🦾 **Full accessibility support** (ARIA labels, keyboard navigation, screen reader support)
- ⚡ **Performance optimized** with adaptive render queuing and intelligent memory management
- 🎨 **Highly customizable** UI with show/hide controls
- 📱 **Mobile responsive** with touch-optimized interactions
- 🔍 **Full-text search** with highlighting and match navigation
- 🌐 **Smart HTML download handling** for institutional repositories
- 📊 **Comprehensive performance monitoring** with detailed metrics and debug mode
- 🔗 **Shareable page links** with URL fragment support

### Technology Stack

- **Core**: Vanilla JavaScript (ES6+)
- **PDF Engine**: PDF.js (Mozilla)
- **UI Framework**: @tpp/htm-x for DOM manipulation
- **Build Tool**: Webpack 5
- **Testing**: Playwright for E2E testing
- **Styling**: Pure CSS with CSS Grid/Flexbox

## Architecture Overview

```
PDF-A-go-go Application Architecture

┌─────────────────────────────────────────────────────────────┐
│                    Entry Point (assets/js/pdfagogo.js)                │
│  • Application initialization                               │
│  • Configuration parsing                                    │
│  • PDF loading orchestration                               │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  Core Modules                               │
├─────────────────┬───────────────────┬───────────────────────┤
│  PDF Loader     │  Scrollable       │  UI Controls          │
│  • PDF.js       │  PDF Viewer       │  • Navigation         │
│  • Progress     │  • Render Queue   │  • Search             │
│  • HTML Handler │  • Memory Mgmt    │  • Accessibility      │
└─────────────────┴───────────────────┴───────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                Support Systems                              │
├─────────────────┬───────────────────┬───────────────────────┤
│  Performance    │  Accessibility    │  Advanced Features    │
│  • Metrics      │  • ARIA Support   │  • HTML Downloads     │
│  • Debug Mode   │  • Keyboard Nav   │  • URL Fragments      │
│  • Memory Mgmt  │  • Screen Reader  │  • Mobile Support     │
└─────────────────┴───────────────────┴───────────────────────┘
```

## Core Modules

### 1. Main Entry Point (`assets/js/pdfagogo.js`)

**Purpose**: Application initialization and orchestration

**Key Responsibilities**:

- Parse configuration from data attributes
- Initialize PDF loading with progress tracking
- Set up the viewer and UI controls
- Handle WebGL configuration

**Key Functions**:

```javascript
/**
 * Initialize the PDF-A-go-go viewer
 * @param {Object} book - PDF book object with numPages() and getPage().
 * @param {string} id - DOM element id for the viewer container.
 * @param {Object} opts - Viewer options.
 * @param {Function} cb - Callback function(err, viewer)
 */
function init(book, id, opts, cb)
```

**Configuration Parsing**:

```javascript
// Reads data attributes from container element
function getOptionsFromDataAttrs(container)
function parseBool(val, fallback) // Robust boolean parsing
```

### 2. Scrollable PDF Viewer (`scrollablePdfViewer.js`)

**Purpose**: Core PDF rendering and interaction engine

**Key Features**:

- **Render Queue System**: Manages rendering tasks with priority
- **Memory Management**: Automatic cleanup of off-screen pages
- **Performance Monitoring**: Detailed metrics collection
- **Mobile Optimization**: Adaptive rendering for mobile devices

**Class Structure**:

```javascript
export class ScrollablePdfViewer extends EventEmitter {
  constructor({ app, book, options })

  // Core rendering
  _renderPage(ndx, callback)
  _updateVisiblePages()
  _cleanupOffscreenPages(force)

  // Navigation
  flip_forward()
  flip_back()
  go_to_page(pageNum)
  scrollBy(pages)

  // Performance
  getPerformanceMetrics()
  _setupDebugDisplay()
}
```

**Render Queue System**:

```javascript
class RenderQueue {
  add(task, priority = false)    // Add rendering task
  clear()                       // Clear all pending tasks
  process()                     // Process queue with RAF
}
```

### 3. UI Controls (`ui.js`)

**Purpose**: User interface components and interaction handling

**Key Components**:

- **Loading Progress**: Visual feedback during PDF loading
- **Controls**: Share, Download, Fullscreen, Page selector, Current page
- **Search Interface**: Text search with match navigation
- **Accessibility**: Screen reader announcements, keyboard support

**Main Functions**:

```javascript
// Loading UI
export function createLoadingBar(container)
export function updateLoadingBar(progressBar, value)
export function removeLoadingBar()

// Main UI setup
export function setupControls(container, featureOptions, viewer, book, pdf)
```

**Search Functionality**:

```javascript
async function searchPdf(query)     // Full-text search across pages
function showMatch(idx)             // Navigate to search match
```

### 4. PDF Loader (`pdfLoader.js`)

**Purpose**: PDF loading with progress tracking and HTML handling

**Key Features**:

- **Content Type Detection**: Automatically detects HTML vs PDF content
- **Progress Tracking**: Real-time loading progress updates
- **HTML Download Integration**: Seamless handling of HTML-wrapped PDFs

```javascript
/**
 * Loads a PDF with progress updates and HTML handling
 * @param {string} url - PDF URL
 * @param {Function} onProgress - Progress callback (0-1 or null)
 * @param {Object} options - Loading options
 * @returns {Promise<Object>} PDF.js document
 */
export async function loadPdfWithProgress(url, onProgress, options = {})
```

### 5. HTML Download Handler (`htmlDownloadHandler.js`)

**Purpose**: Handle PDFs served through HTML redirect pages

**Use Cases**:

- Institutional repositories
- Document management systems
- Academic websites with download gates

**Key Features**:

- **Meta Refresh Detection**: Parses meta refresh tags
- **Iframe Proxy**: Safe handling of redirects
- **Timeout Management**: Configurable download timeouts

```javascript
export class HTMLDownloadHandler extends EventTarget {
  constructor(options = {})
  initialize(container)
  async handleHTMLDownload(url)

  // Internal methods
  parseMetaRefresh(content)
  checkUrlAndDownload(urlToCheck)
  async downloadPDF(url)
}
```

## API Reference

### Container Configuration

The PDF viewer is configured through data attributes on the container element:

```html
<div
  class="pdfagogo-container"
  id="pdfagogo-container"
  data-pdf-url="./document.pdf"
  data-show-search="true"
  data-show-page-selector="true"
  data-show-current-page="true"
  data-show-download="true"
  data-show-fullscreen="true"
  data-show-resize-grip="true"
  data-default-page="1"
  data-disable-webgl="true"
  data-download-timeout="30000"
  data-debug="false"
></div>
```

### Viewer Instance Methods

```javascript
// Navigation
viewer.flip_forward(); // Go to next page
viewer.flip_back(); // Go to previous page
viewer.go_to_page(pageNum); // Go to specific page (0-based)
viewer.scrollBy(pages); // Scroll by number of pages

// Zoom functionality
viewer.setZoom(level); // Set zoom level (0.25-5.0)
viewer.zoomIn(); // Zoom in by 10%
viewer.zoomOut(); // Zoom out by 10%
viewer.resetZoom(); // Reset to 100% zoom
viewer.getZoom(); // Get current zoom level

// Rendering
viewer.rerenderPage(ndx); // Force re-render of specific page

// Performance (returns null unless debug mode is enabled)
viewer.getPerformanceMetrics();
```

### Accessing the viewer instance

```javascript
// After initialization, the viewer instance is attached to the container element
const container = document.querySelector('.pdfagogo-container');
const viewer = container?.pdfViewer; // ScrollablePdfViewer instance

// Example: programmatically zoom
viewer?.setZoom(1.25);
```

### Events

The viewer emits these events:

```javascript
// Fired once after the first set of visible pages render
viewer.on("initialRenderComplete", () => {
  console.log("Initial render complete");
});

// Fired when a page becomes the most visible (1-based page number)
viewer.on("seen", (pageNumber) => {
  console.log(`Current page: ${pageNumber}`);
});

// Fired when the set of visible pages changes (array of 1-based page numbers)
viewer.on("visiblePages", (pages) => {
  console.log("Visible pages:", pages);
});

// Fired on zoom changes; payload includes level and percentage
viewer.on("zoom", ({ level, percentage }) => {
  console.log(`Zoom changed to ${percentage}% (level: ${level})`);
});
```

## Zoom Functionality

PDF-A-go-go provides comprehensive zoom capabilities across all input methods:

### Zoom Methods

**Touch Devices**:
- **Pinch-to-zoom**: Use two fingers to pinch in/out for intuitive zooming
- Smooth, responsive scaling with momentum

**Desktop/Keyboard**:
- **Ctrl + Plus** (or **Ctrl + =**): Zoom in by 10%
- **Ctrl + Minus**: Zoom out by 10%
- **Ctrl + 0**: Reset zoom to 100%
- **Mouse wheel + Ctrl**: Hold Ctrl while scrolling to zoom

### Zoom Configuration

```javascript
// Zoom levels and behavior
const zoomConfig = {
  minZoom: 0.25,      // 25% minimum zoom
  maxZoom: 5.0,       // 500% maximum zoom
  zoomStep: 0.1,      // 10% increments
  defaultZoom: 1.0    // 100% default
};
```

### CSS Implementation

Zoom uses CSS transforms for optimal performance:

```css
.pdfagogo-pages-container {
  transform-origin: center top;
  transition: transform 0.2s ease-out;
  /* transform: scale(1.5) applied dynamically */
}

.pdfagogo-scroll-container {
  overflow-x: auto; /* Enables horizontal scroll when zoomed */
  touch-action: pan-x pan-y pinch-zoom; /* Native touch support */
}
```

### Focus Requirements

**Important**: For keyboard zoom shortcuts to work, the PDF viewer must be focused:

```javascript
// Programmatically focus the viewer
document.querySelector('.pdfagogo-container').focus();

// Container must have tabindex for focus
container.setAttribute('tabindex', '0');
```

### Zoom Event Handling

```javascript
// Listen for zoom changes
viewer.on('zoomChange', (newZoomLevel) => {
  console.log(`Zoom: ${(newZoomLevel * 100).toFixed(0)}%`);

  // Update UI or perform actions based on zoom level
  if (newZoomLevel > 2.0) {
    console.log('High zoom level - consider showing detail controls');
  }
});

// Programmatic zoom control
viewer.setZoom(1.5); // Set to 150%
const currentZoom = viewer.getZoom(); // Get current level
```

## Configuration Options

### Display Options

| Option                    | Type    | Default           | Description                 |
| ------------------------- | ------- | ----------------- | --------------------------- |
| `data-pdf-url`            | string  | `"./example.pdf"` | PDF URL to load             |
| `data-show-page-selector` | boolean | `true`            | Show page input field       |
| `data-show-current-page`  | boolean | `true`            | Show current page indicator |
| `data-show-search`        | boolean | `true`            | Show search controls        |
| `data-show-download`      | boolean | `true`            | Show download button        |
| `data-show-resize-grip`   | boolean | `true`            | Show resize handle          |

### Appearance Options

| Option                  | Type   | Default | Description           |
| ----------------------- | ------ | ------- | --------------------- |
| `data-background-color` | string | -       | Background color      |
| `data-box-border`       | number | -       | Border size in pixels |
| `data-margin`           | number | -       | General margin        |
| `data-margin-top`       | number | -       | Top margin            |
| `data-margin-left`      | number | -       | Left margin           |

### Behavior Options

| Option               | Type    | Default | Description             |
| -------------------- | ------- | ------- | ----------------------- |
| `data-default-page`  | number  | `1`     | Default page to open    |
| `data-momentum`      | number  | `1.5`   | Scroll momentum factor  |
| `data-disable-webgl` | boolean | `true`  | Disable WebGL rendering |
| `data-debug`         | boolean | `false` | Enable debug mode       |

### HTML Download Options

| Option                  | Type   | Default | Description           |
| ----------------------- | ------ | ------- | --------------------- |
| `data-download-timeout` | number | `30000` | Download timeout (ms) |

## Performance & Optimization

### Unified Scaling Architecture

PDF-A-go-go uses a unified approach that automatically adapts to document size, eliminating special-case code:

**Adaptive Batching**:
```javascript
// Single formula for all document sizes
const batchSize = Math.max(10, Math.min(50, Math.ceil(pageCount / 10)));
// Results: 5 pages = 10 batch, 827 pages = 50 batch
```

**Natural Buffer Scaling**:
```javascript
// Memory buffer scales with document size
const baseBuffer = isMobile ? 2 : 4;
const scalingFactor = Math.ceil(pageCount / 100);
const buffer = Math.max(baseBuffer, Math.min(baseBuffer * scalingFactor, isMobile ? 10 : 20));
// Results: 5 pages = 4 buffer, 827 pages = 20 buffer
```

**Progressive Cleanup Timing**:
```javascript
// Cleanup intervals adapt to document complexity
const cleanupDelay = Math.min(1000, 150 + Math.ceil(pageCount / 10));
// Results: 5 pages = 151ms, 827 pages = 233ms
```

### Render Queue System

Enhanced render queue with race condition protection:

```javascript
class RenderQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentTask = null;
  }

  add(task, priority = false) {
    // Validate task is a function
    if (typeof task !== 'function') {
      console.error('Invalid task added to render queue');
      return;
    }

    // Priority tasks go to front of queue
    if (priority) {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }
  }

  process() {
    // Race condition protection
    if (typeof this.currentTask !== 'function') {
      this.currentTask = null;
      this.process();
      return;
    }

    // Execute with local reference to prevent race conditions
    const taskToExecute = this.currentTask;
    Promise.resolve(taskToExecute())
      .then(() => this.process())
      .catch(() => this.process());
  }
}
```

### Intelligent Memory Management

**Adaptive Buffer Sizes**:
- Small documents (≤100 pages): 4 page buffer
- Medium documents (101-500 pages): 4-20 page buffer
- Large documents (500+ pages): 20 page buffer
- Mobile devices: 50% of desktop buffer sizes

**Smart Cleanup Strategy**:
- `visibilitychange`: Normal cleanup (preserves buffer)
- `memorypressure`: Aggressive cleanup (forces cleanup)
- Scroll-based: Delayed cleanup with adaptive timing

**Placeholder Dimension Calculation**:
```javascript
// Ensures accurate scroll bar positioning for all document sizes
async _calculatePlaceholderDimensions() {
  const firstPage = await this.book.getPage(0);
  const targetWidth = this._getPageWidth();
  const aspectRatio = firstPage.width / firstPage.height;
  const expectedHeight = targetWidth / aspectRatio;

  // Apply to all 827 placeholder pages for accurate total height
  this.pageCanvases.forEach(canvas => {
    if (canvas.getAttribute('data-resolution') === 'placeholder') {
      canvas.parentElement.style.height = expectedHeight + 'px';
    }
  });
}
```

### Performance Metrics

When debug mode is enabled (`data-debug="true"`), a floating metrics overlay appears and the API returns metrics:

```javascript
const metrics = viewer.getPerformanceMetrics();
// Returns:
{
  initialRenderTime: 1234,           // Initial render duration (ms)
  averageHighResRenderTime: 120,     // Average render (ms) for page upgrades
  totalPagesRendered: 10,
  totalHighResUpgrades: 8,
  pageRenderTimes: { ... },
  highResUpgradeTimes: { ... }
}
// Note: returns null when debug mode is disabled
```

## Accessibility Features

### Keyboard Navigation

| Key             | Action                   |
| --------------- | ------------------------ |
| `Tab`           | Focus the viewer         |
| `Left Arrow`    | Previous page            |
| `Right Arrow`   | Next page                |
| `Ctrl/Cmd +`    | Zoom in                  |
| `Ctrl/Cmd -`    | Zoom out                 |
| `Ctrl/Cmd 0`    | Reset zoom to 100%       |
| `Enter`         | Activate focused element |

### Screen Reader Support

**Focus & Live Announcements**:

```javascript
// Canvases are focusable and labeled with data attributes
canvas.setAttribute("tabindex", "0");
canvas.setAttribute("data-page", i + 1);

// Screen reader announcements are provided via a live region
pageAnnouncement.setAttribute("aria-live", "polite");
// Content is updated as pages are seen: "Page X of Y"
```

**Live Regions**:

```javascript
// Page announcements
pageAnnouncement.setAttribute("aria-live", "polite");

// Search results
searchResult.setAttribute("aria-live", "polite");
```

### Visual Accessibility

- High contrast support
- Keyboard focus indicators
- Scalable UI elements
- Screen reader instructions

## Testing Strategy

### Test Structure

```
src/tests/
├── fullscreen.spec.ts      # Fullscreen UI behavior
├── performance.spec.ts     # Desktop/Mobile perf + scroll
├── stress-test.spec.ts     # Large PDF stress tests
└── zoom.spec.ts            # Zoom interactions and boundaries
```

### Performance Testing

The application includes comprehensive performance tests using Playwright:

```typescript
// Desktop performance test
test("should render PDF pages within performance thresholds (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const metrics = await page.evaluate(() => {
    const container = document.querySelector('.pdfagogo-container') as any;
    return container?.pdfViewer?.getPerformanceMetrics();
  });

  // Note: getPerformanceMetrics() returns null unless debug mode is enabled
  expect(metrics.initialRenderTime).toBeLessThan(5000);
});

// Mobile performance test with CPU throttling
test("should render PDF pages within performance thresholds (mobile)", async ({
  page,
  context,
}) => {
  const client = await context.newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.setViewportSize({ width: 375, height: 667 });

  const metrics = await page.evaluate(() => {
    const container = document.querySelector('.pdfagogo-container') as any;
    return container?.pdfViewer?.getPerformanceMetrics();
  });

  // Note: getPerformanceMetrics() returns null unless debug mode is enabled
  expect(metrics.initialRenderTime).toBeLessThan(10000); // 10s threshold for mobile
});
```

### Test Categories

1. **Unit Tests**: Individual function and class testing
2. **Integration Tests**: Module interaction testing
3. **E2E Tests**: Full user workflow testing
4. **Performance Tests**: Render time and memory usage
5. **Accessibility Tests**: Screen reader and keyboard navigation

## Build & Development

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Debug tests
npm run test:debug
```

### Webpack Configuration

The build process uses Webpack 5 with the following key features:

```javascript
// Entry points
entry: {
  'pdf-a-go-go': {
    import: './src/assets/js/pdfagogo.js',
    library: {
      name: 'flipbook',
      type: 'umd',
      umdNamedDefine: true,
    },
  },
}

// Asset handling
module: {
  rules: [
    {
      test: /pdf\.worker(\\.min)?\\.mjs$/,
      type: 'asset/resource',
      generator: {
        filename: 'pdf-a-go-go.dependencies.js'
      }
    },
  ],
}
```

### File Structure

```
src/
├── index.html              # Main demo page
├── assets/
│   ├── css/
│   │   └── pdf-a-go-go.css         # Styles
│   └── js/
│       ├── pdfagogo.js              # Main entry point
│       ├── scrollablePdfViewer.js   # Core viewer class
│       ├── ui.js                    # UI components
│       ├── pdfLoader.js             # PDF loading logic
│       └── htmlDownloadHandler.js  # HTML download handling
├── examples/
│   ├── *.html                      # Example demo pages
│   └── *.pdf                       # Example PDF files
└── tests/                          # Test files
```

## Advanced Features

### HTML Download Handling

For institutional repositories and document management systems that serve PDFs through HTML redirect pages:

```javascript
// Automatic detection and handling
const response = await fetch(url);
const contentType = response.headers.get("content-type");

if (contentType && contentType.includes("text/html")) {
  const handler = new HTMLDownloadHandler({
    downloadTimeout: options.downloadTimeout,
  });
  const pdfBlob = await handler.handleHTMLDownload(url);
  // Continue with PDF.js loading...
}
```

### Meta Refresh Parsing

Robust parsing of meta refresh tags:

```javascript
/**
 * Parses meta refresh content attribute
 * Handles: "5; url=http://example.com/file.pdf"
 *         "0;URL='/file.pdf'"
 *         "3; url=\\"/path/to/file.pdf?foo=bar\\""
 */
function parseMetaRefresh(content) {
  const parts = content.split(";");
  if (parts.length < 2) return null;

  const delay = parseInt(parts[0].trim(), 10) || 0;
  const urlPart = parts.slice(1).join(";").trim();
  const urlMatch = urlPart.match(/url\\s*=\\s*['\\"]?([^'\\"]+)['\\"]?/i);

  if (!urlMatch) return null;
  return { delay, url: urlMatch[1].trim() };
}
```

### URL Fragment Support

Shareable page links with URL fragments:

```javascript
// Generate shareable link
const shareUrl = `${window.location.origin}${window.location.pathname}#pdf-page-${page}`;

// Parse page from URL
function getPageFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/#pdf-page-(\\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
```

### Debug Mode

Comprehensive debugging with visual indicators:

```javascript
if (this.debug) {
  console.log(
    `%c🎨 Rendering page ${ndx + 1}`,
    "color: #4CAF50; font-weight: bold;"
  );

  // Visual debug overlay
  const debugOverlay = document.createElement("div");
  debugOverlay.style.background = "#4CAF50";
  debugOverlay.style.color = "white";
  debugOverlay.textContent = `Rendering...`;
  // Add to page...
}
```
