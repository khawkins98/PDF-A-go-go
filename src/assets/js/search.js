/**
 * @file Search controls (toolbar UI) for PDF-A-go-go.
 *
 * This module builds the search UI (input, buttons, result status) and wires it
 * to the viewer instance's {@link SearchController}, which owns all search logic
 * (finding matches, computing highlight boxes, match navigation, and rendering
 * highlights via the per-instance TileManager). This module contains no search
 * logic of its own — it only reflects controller state into the DOM and forwards
 * user intent (typing, Enter/Shift+Enter, button clicks, Escape) to the controller.
 */

/**
 * Create and wire up search controls, driving the instance's SearchController.
 *
 * @param {HTMLElement} container - The main viewer container element
 * @param {Object} featureOptions - Feature toggles and configuration options
 * @param {import('./scrollablePdfViewer').ScrollablePdfViewer} viewer - The initialized PDF viewer instance
 * @param {Object} book - The PDF book object with page access methods
 * @param {Object} pdf - The loaded PDF.js document instance
 * @param {Function} setPageByNumber - Function to navigate to a 1-based page number
 * @returns {void}
 */
export function setupSearchControls(container, featureOptions, viewer, book, pdf, setPageByNumber) {
  // If search feature is disabled, don't render controls.
  if (!featureOptions || featureOptions.showSearch === false) {
    return;
  }

  // Find the toolbar center section to insert search controls
  const toolbarCenter = container.querySelector('.pdfagogo-toolbar-center');
  if (!toolbarCenter) {
    console.warn('PDF-A-go-go: Toolbar center section not found, search disabled');
    return;
  }

  // The canonical search implementation lives in the per-instance SearchController.
  // It is created in pdfagogo.js and stored on the instance before controls are set up.
  const instance = container._pdfagogoInstance;
  const searchController = instance ? instance.searchController : null;
  if (!searchController) {
    console.warn('PDF-A-go-go: SearchController not available, search disabled');
    return;
  }

  // Remove any existing search controls to avoid duplicates
  toolbarCenter.innerHTML = '';

  // Build the search UI - inline in toolbar
  // Icons from Lucide (https://lucide.dev) - MIT License
  const searchControls = document.createElement('div');
  searchControls.className = 'pdfagogo-search-group';
  searchControls.innerHTML = `
    <input class="pdfagogo-search-input" type="text" placeholder="Search..." aria-label="Search in document" />
    <span class="pdfagogo-search-result" role="status" aria-live="polite" aria-atomic="true"></span>
    <button class="pdfagogo-prev-match-btn" aria-label="Previous match" title="Previous (Shift+Enter)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg></button>
    <button class="pdfagogo-next-match-btn" aria-label="Next match" title="Next (Enter)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>
  `;
  toolbarCenter.appendChild(searchControls);

  const searchBox = searchControls.querySelector('.pdfagogo-search-input');
  const searchResult = searchControls.querySelector('.pdfagogo-search-result');
  const prevMatchBtn = searchControls.querySelector('.pdfagogo-prev-match-btn');
  const nextMatchBtn = searchControls.querySelector('.pdfagogo-next-match-btn');

  // The result span stays in the DOM as a live region so updates are announced to
  // screen readers. It is left visually empty (rather than display:none) while
  // there is nothing to report. Nav buttons are hidden until there are matches.
  showNavButtons(false);

  // Update the live-region result text (kept in DOM for screen-reader announcements).
  function setResultText(text) {
    if (searchResult) searchResult.textContent = text || '';
  }

  // Show or hide the prev/next navigation buttons.
  function showNavButtons(show) {
    if (prevMatchBtn) {
      prevMatchBtn.disabled = !show;
      prevMatchBtn.style.display = show ? '' : 'none';
    }
    if (nextMatchBtn) {
      nextMatchBtn.disabled = !show;
      nextMatchBtn.style.display = show ? '' : 'none';
    }
  }

  // Navigate to a match by index, reflecting controller state into the UI.
  function showMatch(idx) {
    const result = searchController.goToMatch(idx);
    if (!result) {
      setResultText('No matches');
      showNavButtons(false);
      return;
    }

    // Reflect controller state into the UI first, so the match counter and nav
    // buttons update synchronously even if the page scroll below is slow or
    // throws (scrolling is a side-effect, not part of the navigation contract).
    setResultText(`${searchController.getCurrentMatchNumber()} / ${searchController.getMatchCount()}`);
    showNavButtons(true);

    try {
      setPageByNumber(result.pageNum);
    } catch (e) {
      // Non-fatal: the match is selected and counted; only the scroll failed.
    }
  }

  // Run a fresh search for the current input value.
  async function doSearch() {
    const query = searchBox ? searchBox.value.trim() : '';
    if (!query) return;
    setResultText('...');
    await searchController.search(query.toLowerCase());
    if (searchController.hasMatches()) {
      showMatch(0);
    } else {
      setResultText('No matches');
      showNavButtons(false);
    }
  }

  // Clear search state, highlights, and UI.
  function clearSearch() {
    if (searchBox) searchBox.value = '';
    searchController.clearSearch();
    setResultText('');
    showNavButtons(false);
  }

  // Navigation button handlers
  if (prevMatchBtn)
    prevMatchBtn.onclick = function () {
      showMatch(searchController.currentMatchIdx - 1);
    };

  if (nextMatchBtn)
    nextMatchBtn.onclick = function () {
      showMatch(searchController.currentMatchIdx + 1);
    };

  // Keyboard handling
  if (searchBox) {
    // Pending debounced live-search timer, shared so Enter can cancel it and
    // avoid a redundant second search overlapping the manual one.
    let searchTimeout = null;

    searchBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        // A manual search supersedes any pending debounced one.
        clearTimeout(searchTimeout);
        const query = searchBox.value.trim().toLowerCase();
        if (query && query === searchController.getLastQuery() && searchController.hasMatches()) {
          // Same query - navigate matches
          if (e.shiftKey) {
            showMatch(searchController.currentMatchIdx - 1);
          } else {
            showMatch(searchController.currentMatchIdx + 1);
          }
        } else {
          // New query - search
          doSearch();
        }
      } else if (e.key === 'Escape') {
        clearTimeout(searchTimeout);
        clearSearch();
      }
    });

    // Live search as user types (debounced)
    searchBox.addEventListener('input', function () {
      // Clear stale results while typing (keep the live region in the DOM)
      setResultText('');
      showNavButtons(false);

      // Debounce search
      clearTimeout(searchTimeout);
      const query = searchBox.value.trim();
      if (query.length >= 2) {
        searchTimeout = setTimeout(doSearch, 300);
      }
    });
  }
}
