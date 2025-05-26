import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PageManager } from '../../../core/PageManager';
import { RenderQueue } from '../../../core/RenderQueue'; // Real RenderQueue for some tests

// Mocks
const mockViewer = () => ({
  app: document.createElement('div'),
  scrollContainer: document.createElement('div'),
  pagesContainer: document.createElement('div'),
  options: {
    scale: 1.5,
    renderBufferFactor: 1.0,
    pageMargin: 10,
    scrollDebounceTime: 20,
    resizeDebounceTime: 20,
    enablePageCleanup: true,
    debug: false,
  },
  debug: false,
  emit: vi.fn(),
  _getPageHeight: vi.fn(() => 600),
  _renderPageInternal: vi.fn(() => Promise.resolve()), // Mock internal render logic
});

const mockBook = (numPages = 5) => ({
  numPages: () => numPages,
  getPage: vi.fn((pageIndex, callback) => {
    // Simulate async page data fetching by resolving in the next microtask
    Promise.resolve().then(() => { 
      if (pageIndex < 0 || pageIndex >= numPages) {
        callback(new Error('Page out of range'));
        return;
      }
      callback(null, {
        width: 400,
        height: 600,
        getViewport: vi.fn(() => ({ width: 400, height: 600, scale: 1.0, rotation: 0 })),
        // ... other page details
      });
    });
  }),
});

const mockRenderQueue = () => ({
  add: vi.fn(),
  clear: vi.fn(),
  getMetrics: vi.fn(() => ({ queueLength: 0, tasksCompleted: 0, tasksFailed: 0 })),
});

describe('PageManager', () => {
  let viewer;
  let book;
  let renderQueue;
  let pageManager;
  let eventBusMock; // Declare eventBusMock

  beforeEach(() => {
    // JSDOM setup for window.innerWidth, getBoundingClientRect etc.
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800,
    }));
    HTMLDivElement.prototype.scrollTo = vi.fn();

    viewer = mockViewer();
    book = mockBook(3);
    renderQueue = mockRenderQueue();
    eventBusMock = { emit: vi.fn(), on: vi.fn(), off: vi.fn(), clear: vi.fn(), once: vi.fn(), getListenerCount: vi.fn(() => 0) }; // Create and assign mock
    pageManager = new PageManager(viewer, book, viewer.options, null /* ui */, renderQueue, eventBusMock); // Pass mock
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = ''; // Clean up DOM changes if any
  });

  describe('Initialization', () => {
    it('should initialize properties correctly', () => {
      expect(pageManager.viewer).toBe(viewer);
      expect(pageManager.book).toBe(book);
      expect(pageManager.renderQueue).toBe(renderQueue);
      expect(pageManager.pageCount).toBe(3);
      expect(pageManager.currentPage).toBe(0);
      expect(Object.keys(pageManager.pageCanvases).length).toBe(0); // Canvases created in initializePages
    });

    it('initializePages should create page wrappers and canvases', async () => {
      await pageManager.initializePages();
      await vi.runAllTimersAsync(); // Ensure async operations like getPage complete
      expect(Object.keys(pageManager.pageCanvases).length).toBe(3);
      expect(Object.keys(pageManager.pageWrappers).length).toBe(3);
      expect(viewer.app.querySelector('.pdfagogo-pages-container-offscreen')).toBeNull(); // Offscreen container removed
      expect(pageManager.pagesContainer.children.length).toBe(3);
      expect(pageManager.pageCanvases[0].getAttribute('data-page-index')).toBe('0');
      expect(pageManager.pageWrappers[0].style.width).toBeDefined(); // Check if styles were set
      expect(pageManager.pageWrappers[0].style.height).toBeDefined();
    });
    
    it('initializePages should fetch page dimensions and set wrapper sizes', async () => {
      viewer._getPageHeight.mockReturnValue(600); 
      await pageManager.initializePages();
      await vi.runAllTimersAsync(); // Ensure async operations like getPage complete
      
      // Check if book.getPage was called for each page
      expect(book.getPage).toHaveBeenCalledTimes(3);
      
      // Check if pageData has aspectRatios and dimensions
      for(let i=0; i<3; i++) {
          expect(pageManager.pageData[i].aspectRatio).toBeCloseTo(400/600);
          expect(pageManager.pageData[i].width).toBe(400);
          expect(pageManager.pageData[i].height).toBe(600);
          expect(pageManager.pageData[i].state).toBe('dimensioned');

          // Check wrapper sizes based on aspect ratio and viewer height
          const expectedWidth = 600 * (400/600);
          expect(pageManager.pageWrappers[i].style.width).toBe(`${expectedWidth}px`);
          expect(pageManager.pageWrappers[i].style.height).toBe(`600px`);
      }
    });

    it('initializePages should call updateAndRenderVisiblePages', async () => {
      const spy = vi.spyOn(pageManager, 'updateAndRenderVisiblePages');
      await pageManager.initializePages();
      await vi.runAllTimersAsync(); // Ensure async operations like getPage complete
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Visible Page Calculation and Rendering', () => {
    beforeEach(async () => {
      await pageManager.initializePages(); 
      await vi.runAllTimersAsync(); // Ensure getPage in initializePages completes
      renderQueue.add.mockClear(); // Clear calls from initializePages
      eventBusMock.emit.mockClear(); // Clear calls from initializePages
      Object.defineProperty(pageManager.scrollContainer, 'scrollLeft', { configurable: true, value: 0 });
      Object.defineProperty(pageManager.scrollContainer, 'clientWidth', { configurable: true, value: 800 });
      pageManager.scrollContainer.getBoundingClientRect = vi.fn(() => ({
        width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800,
      }));
    });

    it('_calculateVisiblePages should identify initially visible pages', () => {
      // With 3 pages of width 400px (600 * 400/600) and margin 10px
      // Page 0: 0 - 400
      // Page 1: 410 - 810
      // Page 2: 820 - 1220
      // Viewport: 0 - 800. Buffer: 800. Extended view: -800 to 1600
      const visible = pageManager._calculateVisiblePages();
      expect(visible.has(0)).toBe(true);
      expect(visible.has(1)).toBe(true);
      expect(visible.has(2)).toBe(true); // All should be within buffer initially
    });
    
    it('_calculateVisiblePages should identify correct pages on scroll', () => {
      Object.defineProperty(pageManager.scrollContainer, 'scrollLeft', { configurable: true, value: 450 }); // Scrolled past page 0
      // Viewport: 450 - 1250. Extended view: -350 to 2050
      // Page 0: 0-400 (not in view, but in buffer)
      // Page 1: 410-810 (in view)
      // Page 2: 820-1220 (in view)
      const visible = pageManager._calculateVisiblePages();
      expect(visible.has(0)).toBe(true); // still in left buffer
      expect(visible.has(1)).toBe(true);
      expect(visible.has(2)).toBe(true);
    });

    it('_diffVisiblePages should identify pages to render, upgrade, and cleanup', () => {
      pageManager._visiblePages = new Set([0]);
      pageManager.pageData[0].state = 'high-res';
      pageManager.pageData[1] = { state: 'placeholder' };
      pageManager.pageData[2] = { state: 'low-res' };

      const newVisible = new Set([1, 2]);
      const diff = pageManager._diffVisiblePages(newVisible);

      expect(diff.pagesToRender).toEqual([1, 2]); // Page 1 (placeholder) and Page 2 (newly visible, even if low-res) go to render
      expect(diff.pagesToUpgrade).toEqual([]);   // Page 2 is new, so it's rendered, not upgraded directly here.
      expect(diff.pagesToCleanup).toEqual([0]);
    });

    it('updateAndRenderVisiblePages should call renderPage and cleanupPages', async () => {
      const calculateSpy = vi.spyOn(pageManager, '_calculateVisiblePages').mockReturnValue(new Set([0,1]));
      const diffSpy = vi.spyOn(pageManager, '_diffVisiblePages').mockReturnValue({
        pagesToRender: [0], pagesToUpgrade: [1], pagesToCleanup: [2]
      });
      const renderSpy = vi.spyOn(pageManager, 'renderPage');
      const cleanupSpy = vi.spyOn(pageManager, 'cleanupPages');

      await pageManager.updateAndRenderVisiblePages();

      expect(renderSpy).toHaveBeenCalledWith(0, 'low', false);
      expect(renderSpy).toHaveBeenCalledWith(1, 'high', false);
      expect(cleanupSpy).toHaveBeenCalledWith([2]);
      expect(pageManager._visiblePages).toEqual(new Set([0,1]));
    });
    
    it('renderPage should add task to renderQueue and update page state', async () => {
        pageManager.pageData[0].state = 'dimensioned';
        const realQueue = new RenderQueue(); // Using a real queue to check its internal state
        pageManager.renderQueue = realQueue;
        const internalRenderSpy = viewer._renderPageInternal.mockResolvedValue(undefined);

        pageManager.renderPage(0, 'high', true);

        // Check queue length BEFORE advancing timers
        // expect(realQueue.getMetrics().queueLength).toBe(1); // This will be 0 as task moves to currentTask
        expect(realQueue.isProcessing).toBe(true);
        expect(realQueue.currentTask).toBeDefined();
        
        await vi.runAllTimersAsync(); // Process the queue

        expect(internalRenderSpy).toHaveBeenCalledWith(0, 'high');
        expect(pageManager.pageData[0].state).toBe('high-res');
        expect(realQueue.getMetrics().tasksCompleted).toBe(1);
        expect(realQueue.getMetrics().queueLength).toBe(0); // Should be 0 after processing
        pageManager.renderQueue = renderQueue; // Restore original mock for other tests
    });

    it('renderPage should not queue if already at target or higher resolution', () => {
        // Scenario 1: Already high-res, attempting high-res again
        pageManager.pageData[0].state = 'high-res';
        pageManager.renderPage(0, 'high');
        expect(renderQueue.add).not.toHaveBeenCalled();

        // Scenario 2: Already high-res, attempting low-res
        pageManager.renderPage(0, 'low');
        expect(renderQueue.add).not.toHaveBeenCalled(); // Still should not have been called

        renderQueue.add.mockClear(); // Clear for next scenario

        // Scenario 3: Already low-res, attempting low-res again
        pageManager.pageData[1].state = 'low-res';
        pageManager.renderPage(1, 'low');
        expect(renderQueue.add).not.toHaveBeenCalled();

        renderQueue.add.mockClear(); 

        // Scenario 4: Should queue if current state is lower than target
        // Ensure pageData[2] is initialized from initializePages
        if (!pageManager.pageData[2]) {
          pageManager.pageData[2] = { state: 'dimensioned', width: 400, height: 600, aspectRatio: 400/600 };
        }
        pageManager.pageData[2].state = 'low-res';
        pageManager.renderPage(2, 'high');
        expect(renderQueue.add).toHaveBeenCalledTimes(1); 
    });

    it('cleanupPages should clear canvas and reset page state', () => {
      pageManager.pageData[0].state = 'high-res';
      const canvas = pageManager.pageCanvases[0];
      const mockCtx = { clearRect: vi.fn() };
      canvas.getContext = vi.fn(() => mockCtx);
      const removeAttributeSpy = vi.spyOn(canvas, 'removeAttribute'); // Spy on the method

      pageManager.cleanupPages([0]);

      expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
      expect(removeAttributeSpy).toHaveBeenCalledWith('data-rendered-scale'); // Assert on the spy
      expect(pageManager.pageData[0].state).toBe('dimensioned');
    });
    
    it('cleanupPages should not run if enablePageCleanup is false', () => {
        pageManager.options.enablePageCleanup = false;
        const clearSpy = vi.spyOn(pageManager.pageCanvases[0], 'getContext');
        pageManager.cleanupPages([0]);
        expect(clearSpy).not.toHaveBeenCalled();
        pageManager.options.enablePageCleanup = true; // reset for other tests
    });

  });

  describe('Navigation and Event Handling', () => {
    beforeEach(async () => {
      await pageManager.initializePages(); 
      await vi.runAllTimersAsync(); // Ensure getPage in initializePages completes & pageManagerInitialized event fires
      eventBusMock.emit.mockClear(); // Clear mock after initializePages to isolate tests for other events
      renderQueue.add.mockClear(); // Clear renderQueue calls from initializePages
      Object.defineProperty(pageManager.scrollContainer, 'scrollLeft', { configurable: true, value: 0 });
      Object.defineProperty(pageManager.scrollContainer, 'clientWidth', { configurable: true, value: 800 });
      pageManager.scrollContainer.getBoundingClientRect = vi.fn(() => ({
        width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800,
      }));
    });

    it('goToPage should scroll to the correct page and render it', async () => {
        // Page 0 width = 400, margin = 10. Page 1 starts at 410.
        pageManager.goToPage(2); // Go to 1-indexed page 2 (index 1)

        expect(pageManager.scrollContainer.scrollTo).toHaveBeenCalledWith({
            left: (600 * (400/600)) + 10, // width of page 0 + margin
            behavior: 'smooth'
        });
        expect(renderQueue.add).toHaveBeenCalled(); // Should queue a render for page 1
        const calls = renderQueue.add.mock.calls;
        const renderCall = calls[calls.length - 1][0]; // Get the LATEST task from this goToPage call
        const internalRenderSpy = viewer._renderPageInternal.mockResolvedValue(undefined);
        await renderCall(); // Execute the task
        expect(internalRenderSpy).toHaveBeenCalledWith(1, 'high');
        expect(pageManager.currentPage).toBe(1);
        expect(eventBusMock.emit).toHaveBeenCalledWith('pagechanged', { currentPage: 2, totalPages: 3, origin: 'goToPage' });
    });

    it('handleScroll should call updateAndRenderVisiblePages after debounce', async () => {
      const spy = vi.spyOn(pageManager, 'updateAndRenderVisiblePages');
      pageManager.handleScroll();
      expect(spy).not.toHaveBeenCalled(); // Debounced
      await vi.advanceTimersByTimeAsync(pageManager.options.scrollDebounceTime);
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('handleResize should update page wrapper sizes and call updateAndRenderVisiblePages', async () => {
      viewer._getPageHeight.mockReturnValue(500); // Simulate new height
      const updateSpy = vi.spyOn(pageManager, 'updateAndRenderVisiblePages');
      const oldWidth = pageManager.pageWrappers[0].style.width;

      pageManager.handleResize();
      await vi.advanceTimersByTimeAsync(pageManager.options.resizeDebounceTime);
      
      const newExpectedWidth = 500 * pageManager.pageData[0].aspectRatio;
      expect(pageManager.pageWrappers[0].style.width).toBe(`${newExpectedWidth}px`);
      expect(pageManager.pageWrappers[0].style.height).toBe('500px');
      expect(pageManager.pageData[0].state).toBe('dimensioned'); // Should be marked for re-render
      expect(updateSpy).toHaveBeenCalled();
    });
    
    it('_updateCurrentPage should emit pagechanged when current page changes', async () => {
        // Start as if page 1 (0-indexed) is current, then scroll to make page 0 most visible
        pageManager.currentPage = 1; 
        Object.defineProperty(pageManager.scrollContainer, 'scrollLeft', { configurable: true, value: 0 });
        pageManager._updateCurrentPage(new Set([0, 1])); 
        expect(pageManager.currentPage).toBe(0); // Should update to 0
        expect(eventBusMock.emit).toHaveBeenCalledWith('pagechanged', { currentPage: 1, totalPages: 3, origin: 'PageManager' });
        eventBusMock.emit.mockClear();

        // Now test scrolling to make page 2 (0-indexed) most visible
        pageManager.currentPage = 0; // Set current page to 0 for this part of the test
        Object.defineProperty(pageManager.scrollContainer, 'scrollLeft', { configurable: true, value: 820 }); // scroll far right
        // With scrollLeft 820, scrollCenter = 820 + 400 = 1220
        // Page 0: center 200. dist |200-1220| = 1020
        // Page 1: center 610. dist |610-1220| = 610
        // Page 2: center 1020. dist |1020-1220|= 200. -> mostVisiblePageIndex = 2
        pageManager._updateCurrentPage(new Set([0, 1, 2])); 
        expect(pageManager.currentPage).toBe(2); // Should update to 2
        expect(eventBusMock.emit).toHaveBeenCalledWith('pagechanged', { currentPage: 3, totalPages: 3, origin: 'PageManager' });
    });
  });
  
  describe('Rerender and Destroy', () => {
    beforeEach(async () => {
      await pageManager.initializePages();
      await vi.runAllTimersAsync(); // Ensure getPage in initializePages completes
      renderQueue.add.mockClear(); // Clear renderQueue calls from initializePages
      eventBusMock.emit.mockClear(); // Clear event bus calls from initializePages
    });

    it('rerenderPage should mark page for re-render and add to queue', async () => {
        pageManager.pageData[0].state = 'high-res';
        pageManager.rerenderPage(0);
        expect(pageManager.pageData[0].state).toBe('dimensioned');
        expect(renderQueue.add).toHaveBeenCalledTimes(1); // Should be called once by rerenderPage
        const task = renderQueue.add.mock.calls[0][0]; // Now it's the correct call from rerenderPage
        const internalRenderSpy = viewer._renderPageInternal.mockResolvedValue(undefined);
        await task();
        expect(internalRenderSpy).toHaveBeenCalledWith(0, 'high');
    });

    it('destroy should clear timeouts', () => {
        const scrollTimeoutSpy = vi.spyOn(global, 'clearTimeout');
        // const renderQueueClearSpy = vi.spyOn(pageManager.renderQueue, 'clear'); // No longer PM's responsibility

        pageManager.handleScroll(); // To set _scrollTimeout
        pageManager.handleResize(); // To set _resizeTimeout
        const initialScrollTimeout = pageManager._scrollTimeout;
        const initialResizeTimeout = pageManager._resizeTimeout;

        pageManager.destroy();

        expect(scrollTimeoutSpy).toHaveBeenCalledWith(initialScrollTimeout);
        expect(scrollTimeoutSpy).toHaveBeenCalledWith(initialResizeTimeout);
        // expect(renderQueueClearSpy).toHaveBeenCalled(); // Removed
    });
  });

}); 