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

**PDF-A-go-go** is a lightweight, accessible, embeddable PDF viewer built on top of PDF.js. It provides a side-scroll viewing experience with comprehensive accessibility support, performance optimizations, and advanced features like search, HTML download handling, and performance monitoring.

### Key Features
- 📖 **Side-scroll PDF viewing** with smooth navigation
- 🦾 **Full accessibility support** (ARIA labels, keyboard navigation, screen reader support)
- ⚡ **Performance optimized** with render queuing and memory management
- 🎨 **Highly customizable** UI with show/hide controls
- 📱 **Mobile responsive** with touch support
- 🔍 **Text search** with highlighting and match navigation
- 🌐 **Smart HTML download handling** for institutional repositories
- 📊 **Performance monitoring** with detailed metrics
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
│                    Entry Point (pdfagogo.js)                │
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

### 1. Main Entry Point (`pdfagogo.js`)

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
- **Navigation Controls**: Previous/Next buttons, page selector
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
function updateNavArrows()          // Update navigation state
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
<div class="pdfagogo-container" id="pdfagogo-container"
     data-pdf-url="./document.pdf"
     data-show-search="true"
     data-show-prev-next="true"
     data-show-page-selector="true"
     data-show-current-page="true"
     data-show-download="true"
     data-show-resize-grip="true"
     data-default-page="1"
     data-debug="false">
</div>
```

### Viewer Instance Methods

```javascript
// Navigation
viewer.flip_forward()           // Go to next page
viewer.flip_back()             // Go to previous page
viewer.go_to_page(pageNum)     // Go to specific page (0-based)
viewer.scrollBy(pages)         // Scroll by number of pages

// Rendering
viewer.rerenderPage(ndx)       // Force re-render of specific page

// Performance
viewer.getPerformanceMetrics() // Get detailed performance data
```

### Events

The viewer emits events that can be listened to:

```javascript
viewer.on('initialRenderComplete', () => {
  console.log('All pages initially rendered');
});

viewer.on('pageChange', (pageNumber) => {
  console.log(`Current page: ${pageNumber}`);
});
```

## Configuration Options

### Display Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data-pdf-url` | string | `"./example.pdf"` | PDF URL to load |
| `data-show-prev-next` | boolean | `true` | Show navigation buttons |
| `data-show-page-selector` | boolean | `true` | Show page input field |
| `data-show-current-page` | boolean | `true` | Show current page indicator |
| `data-show-search` | boolean | `true` | Show search controls |
| `data-show-download` | boolean | `true` | Show download button |
| `data-show-resize-grip` | boolean | `true` | Show resize handle |

### Appearance Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data-background-color` | string | - | Background color |
| `data-box-border` | number | - | Border size in pixels |
| `data-margin` | number | - | General margin |
| `data-margin-top` | number | - | Top margin |
| `data-margin-left` | number | - | Left margin |

### Behavior Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data-default-page` | number | `1` | Default page to open |
| `data-momentum` | number | `0.5` | Scroll momentum factor |
| `data-disable-webgl` | boolean | `true` | Disable WebGL rendering |
| `data-debug` | boolean | `false` | Enable debug mode |

### HTML Download Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `data-download-timeout` | number | `30000` | Download timeout (ms) |

## Performance & Optimization

### Render Queue System

The application uses a sophisticated render queue to manage page rendering:

```javascript
class RenderQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentTask = null;
  }

  add(task, priority = false) {
    // Priority tasks go to front of queue
    if (priority) {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }
  }
}
```

### Memory Management

**Automatic Cleanup**:
- Off-screen pages are automatically cleaned up
- Memory pressure events trigger aggressive cleanup
- Mobile devices use reduced cache sizes

**Configuration**:
```javascript
// Device-specific optimization
this.isMobile = window.innerWidth <= 768;
this.maxCachedPages = this.isMobile ? 3 : 5;
this.visibleRange = this.isMobile ? 1 : 2;
```

### Performance Metrics

When debug mode is enabled, detailed metrics are collected:

```javascript
const metrics = viewer.getPerformanceMetrics();
// Returns:
{
  initialRenderTime: 1234,           // Initial render time (ms)
  averageLowResRenderTime: 45,       // Average low-res render (ms)
  averageHighResRenderTime: 120,     // Average high-res render (ms)
  totalPagesRendered: 10,            // Total pages rendered
  totalHighResUpgrades: 8,           // High-res upgrades performed
  pageRenderTimes: {...},            // Per-page render times
  highResUpgradeTimes: {...}         // Per-page upgrade times
}
```

## Accessibility Features

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Focus the viewer |
| `Left Arrow` | Previous page |
| `Right Arrow` | Next page |
| `+` | Zoom in |
| `-` | Zoom out |
| `Enter` | Activate focused element |

### Screen Reader Support

**ARIA Labels**:
```javascript
canvas.setAttribute("tabindex", "0");
canvas.setAttribute("data-page", i + 1);
canvas.setAttribute("aria-label", `Page ${i + 1} of ${this.pageCount}`);
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
├── e2e/                    # End-to-end tests
├── integration/            # Integration tests
├── unit/                   # Unit tests
│   ├── rendering/          # Render-specific tests
│   ├── ui/                 # UI component tests
│   └── utils/              # Utility function tests
├── fixtures/               # Test data
│   ├── mock-data/          # Mock objects
│   └── test-pdfs/          # Sample PDFs
└── performance.spec.ts     # Performance tests
```

### Performance Testing

The application includes comprehensive performance tests using Playwright:

```typescript
// Desktop performance test
test('should render PDF pages within performance thresholds (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });

  const metrics = await page.evaluate(() => {
    return window.pdfViewer?.getPerformanceMetrics();
  });

  expect(metrics.initialRenderTime).toBeLessThan(5000); // 5s threshold
});

// Mobile performance test with CPU throttling
test('should render PDF pages within performance thresholds (mobile)', async ({ page, context }) => {
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await page.setViewportSize({ width: 375, height: 667 });

  const metrics = await page.evaluate(() => {
    return window.pdfViewer?.getPerformanceMetrics();
  });

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
    import: './src/pdfagogo.js',
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
├── pdfagogo.js              # Main entry point
├── scrollablePdfViewer.js   # Core viewer class
├── ui.js                    # UI components
├── pdfLoader.js             # PDF loading logic
├── htmlDownloadHandler.js   # HTML download handling
├── pdf-a-go-go.css         # Styles
├── index.html              # Demo page
├── double-spread.html      # Large PDF demo
└── tests/                  # Test files
```

## Advanced Features

### HTML Download Handling

For institutional repositories and document management systems that serve PDFs through HTML redirect pages:

```javascript
// Automatic detection and handling
const response = await fetch(url);
const contentType = response.headers.get('content-type');

if (contentType && contentType.includes('text/html')) {
  const handler = new HTMLDownloadHandler({
    downloadTimeout: options.downloadTimeout
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
  const parts = content.split(';');
  if (parts.length < 2) return null;

  const delay = parseInt(parts[0].trim(), 10) || 0;
  const urlPart = parts.slice(1).join(';').trim();
  const urlMatch = urlPart.match(/url\\s*=\\s*['\\"]?([^'\\"]+)['\\"]?/i);

  if (!urlMatch) return null;
  return { delay, url: urlMatch[1].trim() };
}
```

### URL Fragment Support

Shareable page links with URL fragments:

```javascript
// Generate shareable link
const shareUrl = `${window.location.origin}${window.location.pathname}#pdf-page=${page}`;

// Parse page from URL
function getPageFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/#pdf-page=(\\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
```

### Debug Mode

Comprehensive debugging with visual indicators:

```javascript
if (this.debug) {
  console.log(`%c🎨 Rendering page ${ndx + 1}`, 'color: #4CAF50; font-weight: bold;');

  // Visual debug overlay
  const debugOverlay = document.createElement('div');
  debugOverlay.style.background = '#4CAF50';
  debugOverlay.style.color = 'white';
  debugOverlay.textContent = `Rendering...`;
  // Add to page...
}
```
