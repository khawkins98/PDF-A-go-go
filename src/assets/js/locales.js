/**
 * Bundled UI locale packs for internationalization (i18n).
 *
 * Each entry maps a BCP-47-ish language code to a (partial or complete) table
 * of the keys defined in `defaultStrings` (see strings.js). Select a pack with
 * the `data-locale` attribute or the `locale` option; any keys a pack omits,
 * and any string it overrides individually via `data-strings` / `strings`,
 * layer on top (defaults < locale pack < data-strings < strings option).
 *
 * These are curated translations, validated by a fluent speaker. Contributions
 * of additional locales are welcome — add a code here with the same keys.
 * Interpolation tokens ({current}, {total}, {percent}) must be preserved.
 */

export const locales = {
  // German (de-DE). Validated by a fluent German speaker.
  de: {
    prevPage: 'Vorherige Seite',
    nextPage: 'Nächste Seite',
    currentPageLabel: 'Aktuelle Seite',
    goToPage: 'Zu Seite springen',
    download: 'PDF herunterladen',
    enterFullscreen: 'Vollbildmodus aktivieren',
    exitFullscreen: 'Vollbildmodus beenden',
    shareLabel: 'Link teilen',
    shareTitle: 'Link zu dieser Seite kopieren',
    outline: 'Inhaltsverzeichnis',
    linkCopied: 'Link kopiert',
    searchPlaceholder: 'Suchen …',
    searchLabel: 'Im Dokument suchen',
    prevMatch: 'Vorheriger Treffer',
    prevMatchTitle: 'Vorheriger Treffer (Shift+Enter)',
    nextMatch: 'Nächster Treffer',
    nextMatchTitle: 'Nächster Treffer (Enter)',
    noMatches: 'Keine Treffer',
    searchCounter: '{current} / {total}',
    pageAnnouncement: 'Seite {current} von {total}',
    zoomLevel: '{percent} %',
    loading: 'Wird geladen {percent}',
    errorTitle: 'PDF konnte nicht geladen werden',
    errorBody: 'Dies kann an CORS-Beschränkungen, einem Netzwerkproblem oder einer nicht verfügbaren Datei liegen.',
    errorOpenDirect: 'Versuchen, direkt zu öffnen',
    errorTechnicalDetails: 'Technische Details',
    keyboardShortcuts: 'Tastenkürzel',
    shortcutFocus: 'zum Fokussieren der PDF-Anzeige',
    shortcutPrevPage: 'vorherige Seite',
    shortcutNextPage: 'nächste Seite',
    shortcutZoom: 'vergrößern/verkleinern',
    shortcutResetZoom: 'Zoom zurücksetzen',
    shortcutSearch: 'suchen',
    outlineHeading: 'Inhalt',
    outlineUntitled: '(ohne Titel)',
    resizeGrip: 'PDF-Anzeige anpassen',
    resizeGripTitle: 'Ziehen oder Pfeiltasten verwenden, um die Höhe der PDF-Anzeige zu ändern'
  }
};
