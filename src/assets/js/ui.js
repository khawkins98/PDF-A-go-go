/**
 * @file UI Components and Controls for PDF-A-go-go.
 *
 * This module provides comprehensive UI functionality for the PDF viewer including:
 * - Loading progress indicators with visual feedback
 * - Navigation controls (previous/next, page selector, download)
 * - Search functionality with text highlighting and match navigation
 * - Accessibility features (screen reader support, keyboard navigation)
 * - Error handling and user feedback
 * - Mobile-responsive design and touch interaction
 *
 * All UI components are designed with accessibility in mind, featuring proper
 * ARIA labels, keyboard navigation support, and screen reader compatibility.
 *
 * @author PDF-A-go-go Contributors
 * @version 1.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

/**
 * Creates and inserts a loading progress bar inside the given container.
 *
 * The loading bar provides visual feedback during PDF loading with both
 * a progress bar and percentage text. It's designed to be accessible
 * and provides clear indication of loading status.
 *
 * @param {HTMLElement} container - The container element to insert the loading bar into
 * @returns {HTMLProgressElement} The created progress bar element for updating progress
 *
 * @example
 * const container = document.getElementById('pdf-container');
 * const progressBar = createLoadingBar(container);
 *
 * // Later, update the progress
 * updateLoadingBar(progressBar, 0.5); // 50% complete
 *
 * @example
 * // The loading bar creates this structure:
 * // <div class="pdfagogo-loading">
 * //   <div class="pdfagogo-loading-text">Loading <span class="pdfagogo-loading-percent">0%</span></div>
 * //   <progress class="pdfagogo-progress-bar" value="0" max="1"></progress>
 * // </div>
 */
export function createLoadingBar(container, strings = defaultStrings) {
  let loadingDiv = document.createElement("div");
  loadingDiv.className = "pdfagogo-loading";
  loadingDiv.style.maxWidth = "600px";
  loadingDiv.style.margin = "2rem auto";
  loadingDiv.style.textAlign = "center";
  loadingDiv.style.padding = "1.5rem 0";
  // Build via DOM APIs (not innerHTML) so a translated `loading` string can
  // never inject markup. The live percentage lives in its own span, substituted
  // at the first {percent} placeholder; updateLoadingBar keeps it in sync. If a
  // translation omits the token, no percentage span is shown (handled there).
  const textDiv = document.createElement("div");
  textDiv.className = "pdfagogo-loading-text";
  const template = String(strings.loading != null ? strings.loading : defaultStrings.loading);
  const tokenIdx = template.indexOf("{percent}");
  if (tokenIdx === -1) {
    textDiv.appendChild(document.createTextNode(template));
  } else {
    const before = template.slice(0, tokenIdx);
    const after = template.slice(tokenIdx + "{percent}".length);
    if (before) textDiv.appendChild(document.createTextNode(before));
    const percentSpan = document.createElement("span");
    percentSpan.className = "pdfagogo-loading-percent";
    percentSpan.textContent = "0%";
    textDiv.appendChild(percentSpan);
    if (after) textDiv.appendChild(document.createTextNode(after));
  }

  const progress = document.createElement("progress");
  progress.className = "pdfagogo-progress-bar";
  progress.value = 0;
  progress.max = 1;
  progress.style.width = "80%";
  progress.style.height = "1.2em";

  loadingDiv.appendChild(textDiv);
  loadingDiv.appendChild(progress);
  container.appendChild(loadingDiv);
  return progress;
}

/**
 * Updates the loading progress bar value and percentage text display.
 *
 * This function handles both determinate progress (with specific percentage)
 * and indeterminate progress (when exact progress is unknown). It updates
 * both the visual progress bar and the text percentage display.
 *
 * @param {HTMLProgressElement} progressBar - The progress bar element to update
 * @param {number|null} value - Progress value between 0-1, or null for indeterminate progress
 *
 * @example
 * // Update to 75% complete
 * updateLoadingBar(progressBar, 0.75);
 *
 * @example
 * // Set to indeterminate state (spinning/unknown progress)
 * updateLoadingBar(progressBar, null);
 *
 * @example
 * // Typical usage in a loading sequence
 * const progressBar = createLoadingBar(container);
 *
 * // Start with indeterminate
 * updateLoadingBar(progressBar, null);
 *
 * // Update with actual progress as it becomes available
 * fetch('/api/pdf-data')
 *   .then(response => {
 *     const reader = response.body.getReader();
 *     const contentLength = response.headers.get('Content-Length');
 *     let receivedLength = 0;
 *
 *     return new ReadableStream({
 *       start(controller) {
 *         function pump() {
 *           return reader.read().then(({ done, value }) => {
 *             if (done) {
 *               controller.close();
 *               return;
 *             }
 *             receivedLength += value.length;
 *             updateLoadingBar(progressBar, receivedLength / contentLength);
 *             controller.enqueue(value);
 *             return pump();
 *           });
 *         }
 *         return pump();
 *       }
 *     });
 *   });
 */
export function updateLoadingBar(progressBar, value) {
  if (!progressBar) return;

  const percentSpan = document.querySelector('.pdfagogo-loading-percent');

  if (typeof value === "number") {
    // Determinate progress - show specific percentage
    progressBar.value = value;
    if (percentSpan) percentSpan.textContent = `${Math.round(value * 100)}%`;
  } else {
    // Indeterminate progress - remove value attribute for spinning animation
    progressBar.removeAttribute("value");
    if (percentSpan) percentSpan.textContent = '';
  }
}

/**
 * Removes the loading bar from the DOM completely.
 *
 * This function safely removes the loading indicator once PDF loading
 * is complete or has failed. It handles cases where the loading bar
 * might not exist or has already been removed.
 *
 * @example
 * // After successful PDF load
 * loadPdf(url)
 *   .then(pdf => {
 *     removeLoadingBar();
 *     initializeViewer(pdf);
 *   })
 *   .catch(error => {
 *     removeLoadingBar();
 *     showError('Failed to load PDF: ' + error.message);
 *   });
 */
export function removeLoadingBar(container) {
  // Search within container first if provided, then fall back to global
  let loadingDiv;
  if (container) {
    loadingDiv = container.querySelector(".pdfagogo-loading");
  }
  if (!loadingDiv) {
    loadingDiv = document.querySelector(".pdfagogo-loading");
  }
  if (loadingDiv && loadingDiv.parentNode) {
    loadingDiv.parentNode.removeChild(loadingDiv);
  }
}

/**
 * Displays an error message to the user in place of the loading indicator.
 *
 * This function replaces the loading bar content with an error message,
 * providing clear feedback when PDF loading fails. The error is displayed
 * in a user-friendly format with appropriate styling.
 *
 * @param {string} message - The error message to display to the user
 *
 * @example
 * // Handle network error
 * showError('PDF not found. Please check the URL and try again.');
 *
 * @example
 * // Handle parsing error
 * showError('Invalid PDF file. The file may be corrupted.');
 *
 * @example
 * // Handle timeout error
 * showError('Loading timeout. Please check your connection and try again.');
 */
export function showError(message, targetContainer, strings = defaultStrings) {
  // Try to reuse the existing loading overlay; create one if missing
  let loadingDiv;
  const container = targetContainer || document.querySelector('.pdfagogo-container');
  if (container) {
    loadingDiv = container.querySelector(".pdfagogo-loading");
  }
  if (!loadingDiv) {
    loadingDiv = document.querySelector(".pdfagogo-loading");
  }
  if (!loadingDiv && container) {
    loadingDiv = document.createElement('div');
    loadingDiv.className = 'pdfagogo-loading';
    loadingDiv.style.maxWidth = '600px';
    loadingDiv.style.margin = '2rem auto';
    loadingDiv.style.textAlign = 'center';
    loadingDiv.style.padding = '1.5rem 0';
    container.appendChild(loadingDiv);
  }
  if (!loadingDiv) return;

  // Sanitize the "open directly" link: resolve relative to the page and allow
  // only http/https so a javascript:/data: URL (or an attribute-breakout via
  // quotes) in data-pdf-url can't ride the user-clickable link.
  const rawUrl = (container && container.getAttribute('data-pdf-url')) || '';
  let safeHref = '#';
  try {
    const u = new URL(rawUrl, window.location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') safeHref = u.href;
  } catch (e) {
    // Unparseable URL: leave the placeholder '#'.
  }

  // Build via DOM APIs (textContent / property assignment) rather than an
  // innerHTML template, so neither the translated labels nor the dev message
  // nor the URL can inject markup.
  loadingDiv.textContent = '';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'pdfagogo-loading-text';
  titleDiv.style.marginBottom = '0.5rem';
  titleDiv.textContent = strings.errorTitle;
  loadingDiv.appendChild(titleDiv);

  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'pdfagogo-loading-error';
  bodyDiv.textContent = strings.errorBody;
  loadingDiv.appendChild(bodyDiv);

  const actions = document.createElement('div');
  actions.className = 'pdfagogo-error-actions';
  const link = document.createElement('a');
  link.className = 'primary';
  link.href = safeHref;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = strings.errorOpenDirect;
  actions.appendChild(link);
  loadingDiv.appendChild(actions);

  const details = document.createElement('details');
  details.className = 'pdfagogo-error-details';
  const summary = document.createElement('summary');
  summary.textContent = strings.errorTechnicalDetails;
  details.appendChild(summary);
  const pre = document.createElement('pre');
  pre.textContent = String(message);
  details.appendChild(pre);
  loadingDiv.appendChild(details);
}

/**
 * Sets up all main UI controls and wires up their event listeners.
 *
 * This is the primary UI initialization function that creates and configures:
 * - Search controls with text input and match navigation
 * - Navigation controls (previous/next buttons, page selector)
 * - Download and share functionality
 * - Accessibility features (screen reader announcements, keyboard navigation)
 * - Page tracking and URL fragment support
 * - Mobile-responsive touch interactions
 *
 * The function handles feature toggles through the featureOptions parameter,
 * allowing selective enabling/disabling of UI components. All controls are
 * designed with accessibility in mind and include proper ARIA labels.
 *
 * @param {HTMLElement} container - The main viewer container element
 * @param {Object} featureOptions - Feature toggles and configuration options
 * @param {boolean} [featureOptions.showSearch=true] - Enable search functionality
 * @param {boolean} [featureOptions.showPageSelector=true] - Show page number input field
 * @param {boolean} [featureOptions.showCurrentPage=true] - Show current page indicator
 * @param {boolean} [featureOptions.showDownload=true] - Show download button
 * @param {boolean} [featureOptions.showResizeGrip=true] - Show resize handle
 * @param {ScrollablePdfViewer} viewer - The initialized PDF viewer instance
 * @param {Object} book - The PDF book object with page access methods
 * @param {Function} book.numPages - Returns total number of pages
 * @param {Function} book.getPage - Retrieves a specific page
 * @param {Object} pdf - The loaded PDF.js document instance
 *
 * @example
 * // Basic setup with all features enabled
 * setupControls(
 *   document.getElementById('pdf-container'),
 *   {
 *     showSearch: true,

 *     showPageSelector: true,
 *     showCurrentPage: true,
 *     showDownload: true
 *   },
 *   viewerInstance,
 *   bookObject,
 *   pdfDocument
 * );
 *
 * @example
 * // Minimal setup with only navigation
 * setupControls(
 *   container,
 *   {
 *     showSearch: false,

 *     showPageSelector: false,
 *     showCurrentPage: true,
 *     showDownload: false
 *   },
 *   viewer,
 *   book,
 *   pdf
 * );
 *
 */
import { setupSearchControls } from './search.js';
import { defaultStrings, format } from './strings.js';

export function setupControls(container, featureOptions, viewer, book, pdf, instance) {
  // Resolved UI string table (English defaults filled upstream); `t` is the
  // translatable label source used throughout this function.
  const t = featureOptions.strings || defaultStrings;
  // Remove any existing controls to prevent duplicates
  // Scope to wrapper if available, otherwise scope to the container itself
  // (avoids removing another instance's controls in multi-instance setups)
  const existingWrapper = container.closest('.pdfagogo-viewer-wrapper');
  const cleanupScope = existingWrapper || container;
  [
    "pdfagogo-toolbar",
    "pdfagogo-page-announcement",
    "pdfagogo-a11y-instructions"
  ].forEach((cls) => {
    const el = cleanupScope.querySelector("." + cls);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });

  // Ensure a wrapper exists so we can fullscreen the viewer and its controls together
  let wrapper = existingWrapper;
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'pdfagogo-viewer-wrapper';
    // Mark as dynamically created so destroy() knows it's safe to remove
    wrapper.setAttribute('data-pdfagogo-created', 'true');
    const parent = container.parentNode;
    if (parent) {
      parent.insertBefore(wrapper, container);
      wrapper.appendChild(container);
    }
  }

  // Helper function to track page navigation source (instance-scoped)
  function setPageSource(source) {
    if (instance) {
      instance.setPageSource(source);
    }
    // Maintain backward compatibility with window global
    if (typeof window !== 'undefined') {
      window.__pdfagogo__pageSetBy = source;
    }
  }

  function getPageSource() {
    if (instance) {
      return instance.getPageSource();
    }
    return typeof window !== 'undefined' ? window.__pdfagogo__pageSetBy : null;
  }

  // Track cleanup callbacks for document/window-level listeners so they can be
  // removed on destroy (prevents leaked listeners in multi-instance / SPA use).
  const cleanupFns = [];

  // Search controls are handled by the dedicated module
  let setPageByNumber = null; // will be defined below then passed into search module

  // Check if toolbar should be shown (default: true)
  const showToolbar = featureOptions.showToolbar !== false;

  // Create unified top toolbar (inside the container)
  const toolbar = document.createElement("div");
  toolbar.className = "pdfagogo-toolbar";
  if (!showToolbar) {
    toolbar.style.display = 'none';
  }

  // Toolbar is built with DOM APIs (rather than an HTML string) to keep the
  // XSS surface minimal. Icons from Lucide (https://lucide.dev) - MIT License;
  // the SVG markup below is static and trusted, parsed into nodes without
  // innerHTML. Wrapped in a block so these build-time locals don't collide with
  // the element lookups later in this function.
  {
  const TOOLBAR_ICONS = {
    prevPage: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    nextPage: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>',
    fullscreen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>',
    share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
    outline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'
  };

  // Parse a static, trusted SVG string into a DOM node (no innerHTML).
  function svgIcon(markup) {
    return new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  }

  function iconButton(className, ariaLabel, title, iconKey) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', ariaLabel);
    btn.setAttribute('title', title);
    btn.appendChild(svgIcon(TOOLBAR_ICONS[iconKey]));
    return btn;
  }

  function toolbarSection(modifier) {
    const div = document.createElement('div');
    div.className = 'pdfagogo-toolbar-section ' + modifier;
    return div;
  }

  // Left section: page navigation with prev/next buttons and editable page input
  const leftSection = toolbarSection('pdfagogo-toolbar-left');
  // Outline / table-of-contents toggle. Created hidden and only revealed later
  // (see the outline panel section below) if the PDF actually carries bookmarks,
  // so documents without an outline show no affordance at all.
  if (featureOptions.showOutline !== false) {
    const outlineBtn = iconButton('pdfagogo-outline', t.outline, t.outline, 'outline');
    outlineBtn.setAttribute('aria-expanded', 'false');
    outlineBtn.hidden = true;
    leftSection.appendChild(outlineBtn);
  }
  if (featureOptions.showPageSelector !== false || featureOptions.showCurrentPage !== false) {
    const pageNav = document.createElement('div');
    pageNav.className = 'pdfagogo-page-nav';
    pageNav.appendChild(iconButton('pdfagogo-prev-page', t.prevPage, t.prevPage, 'prevPage'));

    const gotoInput = document.createElement('input');
    gotoInput.className = 'pdfagogo-goto-page';
    gotoInput.setAttribute('type', 'text');
    gotoInput.setAttribute('inputmode', 'numeric');
    gotoInput.setAttribute('pattern', '\\d*');
    gotoInput.setAttribute('min', '1');
    gotoInput.setAttribute('aria-label', t.currentPageLabel);
    gotoInput.setAttribute('title', t.goToPage);
    pageNav.appendChild(gotoInput);

    const pageTotal = document.createElement('span');
    pageTotal.className = 'pdfagogo-page-total';
    pageNav.appendChild(pageTotal);

    pageNav.appendChild(iconButton('pdfagogo-next-page', t.nextPage, t.nextPage, 'nextPage'));
    leftSection.appendChild(pageNav);
  }

  // Center section: search (handled by search module, placeholder for spacing)
  const centerSection = toolbarSection('pdfagogo-toolbar-center');

  // Right section: zoom + actions
  const rightSection = toolbarSection('pdfagogo-toolbar-right');
  const zoomIndicator = document.createElement('span');
  zoomIndicator.className = 'pdfagogo-zoom-indicator';
  zoomIndicator.setAttribute('aria-live', 'polite');
  rightSection.appendChild(zoomIndicator);
  if (featureOptions.showDownload) {
    rightSection.appendChild(iconButton('pdfagogo-download', t.download, t.download, 'download'));
  }
  if (featureOptions.showFullscreen !== false) {
    rightSection.appendChild(iconButton('pdfagogo-fullscreen', t.enterFullscreen, t.enterFullscreen, 'fullscreen'));
  }
  if (featureOptions.showShare !== false) {
    rightSection.appendChild(iconButton('pdfagogo-share', t.shareLabel, t.shareTitle, 'share'));
  }

  toolbar.appendChild(leftSection);
  toolbar.appendChild(centerSection);
  toolbar.appendChild(rightSection);
  // Insert toolbar at the top of the container
  container.insertBefore(toolbar, container.firstChild);
  }

  // Page announcement for screen readers
  let pageAnnouncement = wrapper.querySelector(".pdfagogo-page-announcement");
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
    wrapper.appendChild(pageAnnouncement);
  }

  // Accessibility instructions (collapsible, visible block can be toggled by featureOptions)
  let a11yInstructions = wrapper.querySelector(".pdfagogo-a11y-instructions");
  if (!a11yInstructions && featureOptions.showAccessibilityControlsVisibly) {
    a11yInstructions = document.createElement("details");
    a11yInstructions.className = "pdfagogo-a11y-instructions";

    // Built with DOM APIs (no innerHTML) to keep the XSS surface minimal.
    const kbd = (text) => {
      const el = document.createElement('kbd');
      el.textContent = text;
      return el;
    };
    const li = (...parts) => {
      const el = document.createElement('li');
      parts.forEach((p) => el.appendChild(typeof p === 'string' ? document.createTextNode(p) : p));
      return el;
    };

    const summary = document.createElement('summary');
    summary.textContent = t.keyboardShortcuts;
    a11yInstructions.appendChild(summary);

    const list = document.createElement('ul');
    list.appendChild(li(kbd('Tab'), ' ', t.shortcutFocus));
    list.appendChild(li(kbd('↑'), ' / ', kbd('←'), ' ', t.shortcutPrevPage));
    list.appendChild(li(kbd('↓'), ' / ', kbd('→'), ' ', t.shortcutNextPage));
    list.appendChild(li(kbd('Ctrl'), '+', kbd('+'), ' / ', kbd('-'), ' ', t.shortcutZoom));
    list.appendChild(li(kbd('Ctrl'), '+', kbd('0'), ' ', t.shortcutResetZoom));
    list.appendChild(li(kbd('Ctrl'), '+', kbd('F'), ' ', t.shortcutSearch));
    a11yInstructions.appendChild(list);

    // Place a11y instructions below the container
    wrapper.appendChild(a11yInstructions);
  } else if (a11yInstructions && !featureOptions.showAccessibilityControlsVisibly) {
    // If present but disabled, remove from DOM
    if (a11yInstructions.parentNode) a11yInstructions.parentNode.removeChild(a11yInstructions);
  }

  // Track the current page number using the 'seen' event.
  // NOTE: 1-based throughout this module (matches the public goToPage() and the
  // 1-based value delivered by the viewer's 'seen' event).
  let currentPage = 1;

  // Visually-hidden live region for transient status messages (e.g. "Link copied").
  const statusRegion = document.createElement("div");
  statusRegion.className = "pdfagogo-status-message";
  statusRegion.setAttribute("role", "status");
  statusRegion.setAttribute("aria-live", "polite");
  statusRegion.style.position = "absolute";
  statusRegion.style.left = "-9999px";
  statusRegion.style.top = "auto";
  statusRegion.style.width = "1px";
  statusRegion.style.height = "1px";
  statusRegion.style.overflow = "hidden";
  wrapper.appendChild(statusRegion);

  // --- Event wiring and logic ---

  // Share button
  // Icons from Lucide (https://lucide.dev) - MIT License
  const shareBtn = toolbar.querySelector(".pdfagogo-share");
  if (shareBtn) {
    const originalHTML = shareBtn.innerHTML;
    shareBtn.onclick = () => {
      // currentPage is already 1-based; use it directly for the share fragment.
      const page = currentPage;
      const shareUrl = `${window.location.origin}${window.location.pathname}#pdf-page-${page}`;
      navigator.clipboard.writeText(shareUrl);
      shareBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      shareBtn.classList.add("copied");
      // Announce to screen readers (button swap is not otherwise announced).
      // Clear then set so repeated copies re-announce.
      statusRegion.textContent = "";
      setTimeout(() => { statusRegion.textContent = t.linkCopied; }, 50);
      setTimeout(() => {
        shareBtn.innerHTML = originalHTML;
        shareBtn.classList.remove("copied");
      }, 1500);
    };
  }

  // Download button
  const downloadBtn = toolbar.querySelector(".pdfagogo-download");
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const link = document.createElement('a');
      link.href = featureOptions.pdfUrl;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }

  // Fullscreen button
  // Icons from Lucide (https://lucide.dev) - MIT License
  const fullscreenBtn = toolbar.querySelector('.pdfagogo-fullscreen');
  if (fullscreenBtn) {
    const fsIconEnter = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
    const fsIconExit = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>';
    const updateFsButton = () => {
      const isFs = !!document.fullscreenElement && wrapper === document.fullscreenElement;
      fullscreenBtn.innerHTML = isFs ? fsIconExit : fsIconEnter;
      fullscreenBtn.setAttribute('aria-label', isFs ? t.exitFullscreen : t.enterFullscreen);
      fullscreenBtn.title = isFs ? t.exitFullscreen : t.enterFullscreen;
      fullscreenBtn.classList.toggle('active', isFs);
    };
    fullscreenBtn.onclick = () => {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) document.exitFullscreen();
      } else {
        if (wrapper.requestFullscreen) wrapper.requestFullscreen();
      }
    };
    // Fullscreen change: update the toggle button and manage focus.
    // On enter, move focus into the container (so keyboard nav works and focus
    // isn't trapped outside the fullscreen element); on exit, restore focus to
    // the fullscreen button that triggered it.
    const onFullscreenChange = () => {
      updateFsButton();
      const isFs = !!document.fullscreenElement && wrapper === document.fullscreenElement;
      if (isFs) {
        if (typeof container.focus === 'function') {
          if (!container.hasAttribute('tabindex')) {
            container.setAttribute('tabindex', '-1');
          }
          container.focus();
        }
      } else {
        // Only restore focus if focus is not already on a meaningful control
        // (avoids yanking focus away if the user tabbed elsewhere).
        if (typeof fullscreenBtn.focus === 'function') {
          fullscreenBtn.focus();
        }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    cleanupFns.push(() => document.removeEventListener('fullscreenchange', onFullscreenChange));
    updateFsButton();
  }

  // Page navigation elements
  const gotoPageInput = toolbar.querySelector(".pdfagogo-goto-page");
  const pageTotalSpan = toolbar.querySelector(".pdfagogo-page-total");
  const prevPageBtn = toolbar.querySelector(".pdfagogo-prev-page");
  const nextPageBtn = toolbar.querySelector(".pdfagogo-next-page");

  function baseSetPageByNumber(pageNum) {
    if (!viewer || !book) return;
    if (
      typeof pageNum !== "number" ||
      isNaN(pageNum) ||
      pageNum < 1 ||
      pageNum > book.numPages()
    ) {
      // Flash the input to indicate invalid value
      if (gotoPageInput) {
        gotoPageInput.classList.add("invalid");
        setTimeout(() => gotoPageInput.classList.remove("invalid"), 500);
      }
      return;
    }
    if (typeof viewer.goToPage === "function") {
      viewer.goToPage(pageNum);
      return;
    }
  }

  // Initialize the navigation function variable
  setPageByNumber = baseSetPageByNumber;

  // Page input change handler
  if (gotoPageInput) {
    gotoPageInput.addEventListener('change', function() {
      const val = parseInt(gotoPageInput.value, 10);
      setPageByNumber(val);
    });
    // Select all text on focus for easy editing
    gotoPageInput.addEventListener('focus', function() {
      gotoPageInput.select();
    });
  }

  // Prev/Next page buttons
  if (prevPageBtn) {
    prevPageBtn.onclick = () => {
      if (currentPage > 1) {
        setPageByNumber(currentPage - 1);
      }
    };
  }
  if (nextPageBtn) {
    nextPageBtn.onclick = () => {
      if (currentPage < book.numPages()) {
        setPageByNumber(currentPage + 1);
      }
    };
  }

  // Update page display and button states
  function updatePage(n) {
    currentPage = parseInt(n);
    const totalPages = book.numPages();

    // Update input with current page
    if (gotoPageInput) {
      gotoPageInput.value = currentPage;
    }

    // Update total pages display
    if (pageTotalSpan) {
      pageTotalSpan.textContent = totalPages;
    }

    // Update prev/next button states
    if (prevPageBtn) {
      prevPageBtn.disabled = currentPage <= 1;
      prevPageBtn.classList.toggle('disabled', currentPage <= 1);
    }
    if (nextPageBtn) {
      nextPageBtn.disabled = currentPage >= totalPages;
      nextPageBtn.classList.toggle('disabled', currentPage >= totalPages);
    }

    // Screen reader announcement
    if (pageAnnouncement) {
      pageAnnouncement.textContent = format(t.pageAnnouncement, { current: currentPage, total: totalPages });
    }
  }
  viewer.on("seen", updatePage);
  updatePage(1); // Start at page 1 since that's what's initially visible

  // Zoom indicator - show when zoomed, hide at 100%
  const zoomIndicator = toolbar.querySelector(".pdfagogo-zoom-indicator");
  if (zoomIndicator) zoomIndicator.style.display = "none"; // Hidden by default
  viewer.on("zoom", ({ level, percentage }) => {
    if (zoomIndicator) {
      if (Math.abs(level - 1.0) < 0.01) {
        // At or very close to 100%, hide indicator
        zoomIndicator.style.display = "none";
      } else {
        zoomIndicator.style.display = "";
        zoomIndicator.textContent = format(t.zoomLevel, { percent: percentage });
      }
    }
  });

  // Initialize search controls (delegated to search module)
  setupSearchControls(container, featureOptions, viewer, book, pdf, setPageByNumber);

  // Keyboard navigation for accessibility
  container.addEventListener("keydown", function (event) {
    // Ctrl/Cmd+F: focus the in-viewer search input (advertised in the shortcuts
    // panel). Only intercept when a search input is present; otherwise let the
    // browser's native find run.
    if ((event.ctrlKey || event.metaKey) && (event.key === "f" || event.key === "F")) {
      const searchInput = container.querySelector(".pdfagogo-search-input");
      if (searchInput) {
        event.preventDefault();
        searchInput.focus();
        if (typeof searchInput.select === "function") searchInput.select();
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      viewer.flip_back();
      event.preventDefault();
    } else if (event.key === "ArrowRight") {
      viewer.flip_forward();
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      viewer.flip_back();
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      viewer.flip_forward();
      event.preventDefault();
    } else if (event.key === "+" || event.key === "=") {
      // No zoom in scroll mode
      event.preventDefault();
    } else if (event.key === "-") {
      // No zoom in scroll mode
      event.preventDefault();
    }
  });

  // --- Hash-based page navigation ---
  function getPageFromHash() {
    const match = window.location.hash.match(/pdf-page-(\d+)/);
    if (match) {
      const pageNum = parseInt(match[1], 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= pdf.numPages) {
        return pageNum;
      }
    }
    return null;
  }
  function goToHashPage() {
    // console.log('goToHashPage');
    const pageNum = getPageFromHash();
    if (pageNum) {
      setTimeout(() => {
        // console.log('goToHashPage', pageNum);
        setPageByNumber(pageNum);
        setPageSource('hash');
      }, 200);
    }
  }
  // Wait for initial render before going to hash page
  viewer.on('initialRenderComplete', () => {
    // Update visible pages to sync the page counter with what's actually shown
    if (typeof viewer._updateVisiblePages === 'function') {
      viewer._updateVisiblePages();
    }
    const hashPage = getPageFromHash();
    if (hashPage) {
      goToHashPage();
    } else if (featureOptions.defaultPage) {
      const defPage = parseInt(featureOptions.defaultPage, 10);
      if (!isNaN(defPage) && defPage >= 1 && defPage <= pdf.numPages) {
        setPageByNumber(defPage);
        setPageSource('defaultPage');
      }
    }
  });

  // Listen for hash changes
  window.addEventListener("hashchange", goToHashPage);
  cleanupFns.push(() => window.removeEventListener("hashchange", goToHashPage));
  // Default page is now handled after initial render to ensure pages are ready
  // When navigating to a page, update the hash as well
  const originalSetPageByNumber = setPageByNumber;
  setPageByNumber = function(pageNum) {
    if (!viewer || !pdf) return;
    if (
      typeof pageNum !== "number" ||
      isNaN(pageNum) ||
      pageNum < 1 ||
      pageNum > pdf.numPages
    ) {
      return;
    }

    // Update the URL hash without triggering browser's default anchor scroll
    // Wrapped in try-catch for iframe contexts where history manipulation may fail
    try {
      const newUrl = `${window.location.pathname}${window.location.search}#pdf-page-${pageNum}`;
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', newUrl);
      } else {
        window.location.hash = `pdf-page-${pageNum}`;
      }
    } catch (e) {
      // Ignore history errors in restricted contexts (e.g., iframes)
    }
    originalSetPageByNumber(pageNum);
  };

  // Fallback: if no hash and defaultPage is provided, attempt to set it shortly after init
  // This covers rare cases where the initialRenderComplete event might fire before listeners attach
  if (!getPageFromHash() && featureOptions.defaultPage) {
    const defPage = parseInt(featureOptions.defaultPage, 10);
    if (!isNaN(defPage) && defPage >= 1 && defPage <= pdf.numPages) {
      setTimeout(() => {
        if (!getPageSource()) {
          setPageByNumber(defPage);
          setPageSource('defaultPage-fallback');
        }
      }, 400);
    }
  }

  // --- Resize grip feature: enabled by default, can be disabled with featureOptions.resize === false ---
  if (featureOptions.showResizeGrip !== false) {
    let resizeGrip = document.createElement("div");
    resizeGrip.className = "pdfagogo-resize-grip";
    resizeGrip.setAttribute("tabindex", "0");
    resizeGrip.setAttribute("role", "separator");
    resizeGrip.setAttribute("aria-orientation", "vertical");
    resizeGrip.setAttribute("aria-label", t.resizeGrip);
    resizeGrip.setAttribute("title", t.resizeGripTitle);
    container.appendChild(resizeGrip);

    const MIN_HEIGHT = 200;
    const KEY_STEP = 24; // px per Arrow key press
    // Upper bound: viewport height, falling back to a generous cap.
    function getMaxHeight() {
      const vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 2000;
      return Math.max(MIN_HEIGHT, vh);
    }

    // Keep the ARIA slider values in sync with the actual container height so
    // assistive tech announces the current/possible sizes.
    function syncGripAria() {
      resizeGrip.setAttribute("aria-valuemin", String(MIN_HEIGHT));
      resizeGrip.setAttribute("aria-valuemax", String(Math.round(getMaxHeight())));
      resizeGrip.setAttribute("aria-valuenow", String(Math.round(container.offsetHeight)));
    }

    // Apply a new container height, clamped to the allowed range, and update ARIA.
    function setContainerHeight(px) {
      const clamped = Math.min(getMaxHeight(), Math.max(MIN_HEIGHT, px));
      container.style.height = clamped + 'px';
      syncGripAria();
    }

    syncGripAria();

    // Keyboard operability: ArrowDown/ArrowUp adjust height by a step,
    // Home/End jump to min/max. (Down = taller, matching the drag direction.)
    resizeGrip.addEventListener('keydown', function (e) {
      let handled = true;
      const current = container.offsetHeight;
      switch (e.key) {
        case 'ArrowDown':
          setContainerHeight(current + KEY_STEP);
          break;
        case 'ArrowUp':
          setContainerHeight(current - KEY_STEP);
          break;
        case 'Home':
          setContainerHeight(MIN_HEIGHT);
          break;
        case 'End':
          setContainerHeight(getMaxHeight());
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    });

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    /**
     * Handler for when the user starts dragging the resize grip.
     * Sets up initial state and event listeners for mouse/touch move and up.
     */
    function onMouseDown(e) {
      isResizing = true;
      startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startHeight = container.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      // document.addEventListener('touchmove', onMouseMove, { passive: false });
      // document.addEventListener('touchend', onMouseUp);
      e.preventDefault();
    }

    /**
     * Handler for mouse/touch move events during resizing.
     * Dynamically updates the container height as the user drags.
     */
    function onMouseMove(e) {
      if (!isResizing) return;
      let clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
      let newHeight = startHeight + (clientY - startY);
      setContainerHeight(newHeight); // clamps to min/max and updates ARIA
      e.preventDefault();
    }

    /**
     * Handler for when the user releases the resize grip (mouse/touch up).
     * Cleans up event listeners. Note: PDF pages maintain their scale - only container height changes.
     */
    async function onMouseUp(e) {
      isResizing = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Note: We no longer trigger window resize events to maintain consistent PDF page scale
      // The container height change provides more vertical space without affecting page rendering
      e.preventDefault();
    }

    // Attach event listeners to the resize grip for mouse and touch support
    resizeGrip.addEventListener('mousedown', onMouseDown);
    resizeGrip.addEventListener('touchstart', onMouseDown, { passive: false });
  }

  // --- Outline / table-of-contents panel ---------------------------------
  // A toolbar toggle opens an overlay panel listing the PDF's bookmarks. The
  // panel is built lazily and the toggle stays hidden unless getOutline()
  // returns entries, so PDFs without bookmarks are unaffected. Clicking an
  // entry navigates via setPageByNumber (inheriting its hash + screen-reader
  // announcement side-effects). Overlay only — the page never reflows.
  const outlineToggle = toolbar.querySelector('.pdfagogo-outline');
  if (outlineToggle && pdf && typeof pdf.getOutline === 'function') {
    let panel = null;
    let isOpen = false;

    // Resolve an outline item's destination to a 1-based page number. The dest
    // is either a named-destination string or an explicit array whose first
    // element is a page ref. Returns null if it cannot be resolved.
    const destToPage = async (dest) => {
      try {
        const explicit = typeof dest === 'string' ? await pdf.getDestination(dest) : dest;
        if (!Array.isArray(explicit) || !explicit[0]) return null;
        const index = await pdf.getPageIndex(explicit[0]); // 0-based
        return index + 1; // 1-based for setPageByNumber
      } catch (e) {
        return null;
      }
    };

    const openPanel = () => {
      if (!panel) return;
      // Anchor the overlay just below the toolbar (its height is dynamic).
      panel.style.top = toolbar.offsetHeight + 'px';
      panel.hidden = false;
      isOpen = true;
      outlineToggle.setAttribute('aria-expanded', 'true');
      const first = panel.querySelector('.pdfagogo-outline-entry:not([disabled])');
      if (first) first.focus();
    };
    const closePanel = (refocus) => {
      if (!panel) return;
      panel.hidden = true;
      isOpen = false;
      outlineToggle.setAttribute('aria-expanded', 'false');
      if (refocus) outlineToggle.focus();
    };

    // Build a nested <ul> from outline items. Each item's page is resolved up
    // front so click handlers are synchronous and cannot race.
    const buildList = async (items) => {
      const ul = document.createElement('ul');
      ul.className = 'pdfagogo-outline-list';
      for (const item of items) {
        const page = item.dest ? await destToPage(item.dest) : null;
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pdfagogo-outline-entry';
        btn.textContent = item.title || t.outlineUntitled;
        if (page == null) {
          btn.disabled = true;
        } else {
          btn.addEventListener('click', () => {
            setPageByNumber(page);
            closePanel(false);
            // Land focus on the viewer so keyboard users continue on content
            // (arrow-key page nav) rather than losing focus to <body>.
            if (!container.hasAttribute('tabindex')) {
              container.setAttribute('tabindex', '-1');
            }
            container.focus();
          });
        }
        li.appendChild(btn);
        if (item.items && item.items.length) {
          li.appendChild(await buildList(item.items));
        }
        ul.appendChild(li);
      }
      return ul;
    };

    // Escape closes and returns focus to the toggle.
    const onKeydown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        closePanel(true);
      }
    };

    (async () => {
      let outline = null;
      try { outline = await pdf.getOutline(); } catch (e) { outline = null; }
      if (!outline || !outline.length) return; // no bookmarks: toggle stays hidden

      panel = document.createElement('nav');
      panel.className = 'pdfagogo-outline-panel';
      panel.setAttribute('aria-label', t.outline);
      panel.hidden = true;

      const heading = document.createElement('div');
      heading.className = 'pdfagogo-outline-heading';
      heading.textContent = t.outlineHeading;
      panel.appendChild(heading);
      panel.appendChild(await buildList(outline));
      // Appended to the container (position: relative) so the panel overlays the
      // page area without reflowing it; the container's overflow clips it.
      container.appendChild(panel);

      // Reveal the toggle now that there is content to show.
      outlineToggle.hidden = false;
      outlineToggle.addEventListener('click', () => {
        if (isOpen) closePanel(true); else openPanel();
      });
      outlineToggle.addEventListener('keydown', onKeydown);
      panel.addEventListener('keydown', onKeydown);

      // Click outside the panel (and off the toggle) closes it.
      const onDocMouseDown = (e) => {
        if (!isOpen) return;
        if (panel.contains(e.target) || outlineToggle.contains(e.target)) return;
        closePanel(false);
      };
      document.addEventListener('mousedown', onDocMouseDown);
      cleanupFns.push(() => document.removeEventListener('mousedown', onDocMouseDown));
    })();
  }

  // Expose a cleanup routine so the owning instance can remove document/window
  // level listeners on destroy (element-scoped listeners are freed when the
  // container's innerHTML is cleared, but these outlive the DOM otherwise).
  const uiCleanup = () => {
    while (cleanupFns.length) {
      const fn = cleanupFns.pop();
      try { fn(); } catch (e) { /* ignore */ }
    }
  };
  if (instance) {
    instance._uiCleanup = uiCleanup;
  }
  // Also expose on the container as a fallback for callers without an instance.
  container._pdfagogoUiCleanup = uiCleanup;

  return uiCleanup;
}