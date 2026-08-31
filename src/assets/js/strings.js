/**
 * UI string table for internationalization (i18n).
 *
 * Every user-facing label lives here as a plain string so embedders can
 * translate the interface without touching source. Interpolated strings use
 * `{token}` placeholders (rather than functions) so they survive being passed
 * as JSON via the `data-strings` attribute.
 *
 * Override per instance via the `strings` option (JS API) or the
 * `data-strings` attribute (a JSON object). Any keys you omit fall back to the
 * English defaults below. Key glyphs (Tab, arrows, Ctrl, +, -, 0, F) and PDF
 * document content are intentionally not part of this table.
 */

export const defaultStrings = {
  // Toolbar buttons (used as both aria-label and title unless noted)
  prevPage: 'Previous page',
  nextPage: 'Next page',
  currentPageLabel: 'Current page', // aria-label on the page-number input
  goToPage: 'Go to page', // title on the page-number input
  download: 'Download PDF',
  enterFullscreen: 'Enter fullscreen',
  exitFullscreen: 'Exit fullscreen',
  shareLabel: 'Share link', // aria-label
  shareTitle: 'Copy link to this page', // title
  outline: 'Table of contents', // outline toggle + panel label
  linkCopied: 'Link copied', // transient screen-reader status

  // Search UI
  searchPlaceholder: 'Search...',
  searchLabel: 'Search in document', // aria-label on the input
  prevMatch: 'Previous match', // aria-label
  prevMatchTitle: 'Previous (Shift+Enter)', // title
  nextMatch: 'Next match', // aria-label
  nextMatchTitle: 'Next (Enter)', // title
  noMatches: 'No matches',
  searchCounter: '{current} / {total}', // e.g. "3 / 10"

  // Live-region announcements
  pageAnnouncement: 'Page {current} of {total}',
  zoomLevel: '{percent}%',

  // Loading / error states. In `loading`, {percent} is replaced by the live
  // percentage element (which renders e.g. "42%"); translators may reorder it.
  loading: 'Loading {percent}',
  errorTitle: 'Could not load this PDF',
  errorBody: 'This may be due to CORS restrictions, a network issue, or the file being unavailable.',
  errorOpenDirect: 'Attempt to open directly',
  errorTechnicalDetails: 'Technical details',

  // Accessibility instructions panel (phrases only; key glyphs stay literal)
  keyboardShortcuts: 'Keyboard shortcuts',
  shortcutFocus: 'to focus the viewer',
  shortcutPrevPage: 'previous page',
  shortcutNextPage: 'next page',
  shortcutZoom: 'zoom in/out',
  shortcutResetZoom: 'reset zoom',
  shortcutSearch: 'search',

  // Outline / table-of-contents panel
  outlineHeading: 'Contents',
  outlineUntitled: '(untitled)',

  // Resize grip
  resizeGrip: 'Resize PDF viewer', // aria-label
  resizeGripTitle: 'Drag or use arrow keys to resize PDF viewer height' // title
};

/**
 * Substitute `{token}` placeholders in a template with values from params.
 * Unmatched tokens are left intact; missing params render as an empty string
 * is avoided by leaving the literal token so problems are visible rather than
 * silently blank.
 *
 * @param {string} template - e.g. "Page {current} of {total}"
 * @param {Object} [params] - e.g. { current: 3, total: 10 }
 * @returns {string}
 */
export function format(template, params) {
  if (typeof template !== 'string') return '';
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}

/**
 * Merge partial overrides onto the English defaults. Only keys present in
 * defaultStrings are honored, so a typo or unknown key can't inject arbitrary
 * content or shadow a default. Non-string override values are ignored.
 *
 * @param {Object} [overrides] - partial map of string keys to translations
 * @returns {Object} a complete string table
 */
export function resolveStrings(overrides) {
  const resolved = { ...defaultStrings };
  if (overrides && typeof overrides === 'object') {
    for (const key of Object.keys(defaultStrings)) {
      if (typeof overrides[key] === 'string') {
        resolved[key] = overrides[key];
      }
    }
  }
  return resolved;
}
