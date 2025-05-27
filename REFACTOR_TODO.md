# PDF-A-go-go Refactor TODO

This document tracks the remaining tasks and potential future enhancements for the PDF-A-go-go refactoring effort.

## High Priority / Next Steps

-   [ ] **Review and Refine `ScrollablePdfViewer.js`:**
    -   [ ] Identify further opportunities to extract logic into smaller, focused modules (e.g., event handling, zoom logic, complex grab-and-scroll).
    -   [ ] Ensure all options passed to `PageManager` and other components are necessary and dependencies are clear.
    -   [ ] Clean up any remaining commented-out old code or unnecessary logs.
    -   [ ] Review `_getPageHeight()` logic for robustness, especially if `scrollContainer` might not always have a fixed client height.
-   [ ] **Implement Full Search Functionality:**
    -   [ ] Wire up event listeners for `searchBox`, `searchBtn`, `nextMatchBtn`, `prevMatchBtn` in `src/ui.js`.
    -   [ ] Implement search logic within `ScrollablePdfViewer.js` or a new dedicated `SearchManager.js` module. This should interact with PDF.js's text layer capabilities.
    -   [ ] Display search results (e.g., number of matches, highlighting current match) in `searchResult` span.
    -   [ ] Implement navigation between search results.
    -   [ ] Consider options for search (case sensitive, whole word).
-   [ ] **Finalize `ConfigManager.js` Integration:**
    -   [ ] Thoroughly audit the codebase (`ScrollablePdfViewer.js`, `PageManager.js`, `ui.js`, etc.) to ensure all option access goes through `configManager.get()`.
    -   [ ] Remove any lingering direct access to `this.options` or `DEFAULT_OPTIONS` from `ScrollablePdfViewer.js` if not already done.
    -   [ ] Verify that `ConfigManager` is correctly instantiated and passed to all necessary components.
-   [ ] **Update Example HTML Files:**
    -   [ ] Locate or create example HTML files.
    -   [ ] Ensure they correctly instantiate `ScrollablePdfViewer` with the new `ConfigManager` pattern.
    -   [ ] Demonstrate usage of various configuration options.

## Medium Priority / Further Enhancements

-   [ ] **Comprehensive Code Review & Cleanup:**
    -   [ ] Review all modified and newly created files (`src/core/`, `src/ui.js`, `src/utils/`, `src/scrollablePdfViewer.js`) for consistency, clarity, and best practices.
    -   [ ] Remove any dead code, unused variables, or redundant comments.
    -   [ ] Ensure JSDoc comments are accurate, complete, and cover all public APIs.
-   [ ] **Strengthen Unit Tests:**
    -   [ ] Review existing unit tests (`src/tests/unit/core/`) for `EventBus`, `PageManager`, `RenderQueue`, `ConfigManager`. Identify and cover edge cases.
    -   [ ] Add unit tests for `src/ui.js` helper functions (e.g., `createLoadingBar`, `updatePageIndicator`). This may require DOM mocking.
    -   [ ] Add unit tests for any new modules extracted from `ScrollablePdfViewer.js`.
    -   [ ] Aim for higher test coverage across all core modules.
-   [ ] **Integration Tests:**
    -   [ ] Evaluate the need for focused integration tests beyond existing E2E tests.
    -   [ ] Consider tests for the interaction between `PageManager`, `RenderQueue`, and `ScrollablePdfViewer` without the full UI, if valuable.
-   [ ] **Refine `src/pdfagogo.js` (Main Entry Point):**
    -   [ ] Ensure this file correctly initializes and exports the `ScrollablePdfViewer`.
    -   [ ] Review its role and simplify if possible.

## Lower Priority / Nice-to-Haves

-   [ ] **Error Handling and User Feedback:**
    -   [ ] Implement more robust error handling throughout the application.
    *   [ ] Provide clearer user feedback for errors (e.g., PDF load failure, search errors) beyond `console.error` or basic `alert()`.
    -   [ ] Enhance loading indicators for a smoother user experience during prolonged operations.
-   [ ] **Accessibility (A11y) Review:**
    -   [ ] Conduct a thorough accessibility review of all UI components.
    -   [ ] Ensure proper ARIA attributes, keyboard navigation, and screen reader compatibility.
    -   [ ] Test with accessibility tools.
-   [ ] **Performance Optimizations:**
    -   [ ] Profile the application for performance bottlenecks (scrolling, zooming, rendering, search).
    -   [ ] Optimize critical paths as needed.
    -   [ ] Consider more advanced virtualization techniques for page rendering if performance with very large documents is a concern.
-   [ ] **Documentation (Beyond JSDoc):**
    -   [ ] Enhance `README.md` with more detailed usage examples and API documentation.
    -   [ ] Consider creating a more formal documentation site if the project grows.
-   [ ] **Advanced Features from `DEFAULT_OPTIONS`:**
    -   [ ] Systematically implement UI and logic for all features mentioned in `DEFAULT_OPTIONS` that are not yet fully functional (e.g., rotate controls, print, fullscreen, presentation mode, open file, sidebar controls).

## Completed Tasks (Summary)

-   Restructured `src` directory (`core`, `rendering`, `ui`, `utils`, `types`).
-   Extracted `RenderQueue.js` from `scrollablePdfViewer.js` + unit tests.
-   Created `EventBus.js` + unit tests; integrated into `scrollablePdfViewer.js`.
-   Created `PageManager.js` + unit tests; integrated, moving logic from `scrollablePdfViewer.js`.
-   Created `ConfigManager.js` + unit tests; integrated, replacing `this.options` and static `defaultOptions` in `scrollablePdfViewer.js` and updating `ui.js`.
-   Refactored `ui.js` for hint arrows, main controls, and resize grip, ensuring proper DOM element creation and event handling.
-   Resolved numerous bugs related to unit tests, rendering, and UI element visibility/functionality.
-   Added initial JSDoc comments to core modules and `ui.js`. 