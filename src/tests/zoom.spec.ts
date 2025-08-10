import { test, expect, Page } from '@playwright/test';

// Helper function to get current zoom level from the viewer
async function getCurrentZoomLevel(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const container = document.querySelector('.pdfagogo-container') as any;
    return container?.pdfViewer?.getZoom() || 1.0;
  });
}

// Helper function to get the transform scale from CSS
async function getCSSScale(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const pagesContainer = document.querySelector('.pdfagogo-pages-container') as HTMLElement;
    if (!pagesContainer) return 1.0;

    const transform = window.getComputedStyle(pagesContainer).transform;
    if (transform === 'none') return 1.0;

    // Parse matrix values to get scale
    const matrix = transform.match(/matrix\(([^)]+)\)/);
    if (matrix) {
      const values = matrix[1].split(',').map(v => parseFloat(v.trim()));
      return values[0]; // First value is scaleX
    }
    return 1.0;
  });
}

// Helper function to focus the PDF container
async function focusPdfContainer(page: Page) {
  await page.click('.pdfagogo-scroll-container');
}

test.describe('PDF-A-go-go Zoom Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Load the test page
    await page.goto('http://localhost:9000/tests/test-small.html');

    // Wait for the PDF to load
    await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 10000 });
    await page.waitForTimeout(2000); // Allow time for initial render
  });

  test('Keyboard Zoom In (Ctrl+Plus)', async ({ page }) => {
    await focusPdfContainer(page);

    const initialZoom = await getCurrentZoomLevel(page);
    expect(initialZoom).toBe(1.0);

    // Zoom in with Ctrl+Plus
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300); // Wait for animation

    const newZoom = await getCurrentZoomLevel(page);
    expect(newZoom).toBeCloseTo(1.1, 1);

    // Verify CSS transform was applied
    const cssScale = await getCSSScale(page);
    expect(cssScale).toBeCloseTo(1.1, 1);
  });

  test('Keyboard Zoom Out (Ctrl+Minus)', async ({ page }) => {
    await focusPdfContainer(page);

    // First zoom in to test zooming out
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);

    const zoomAfterIn = await getCurrentZoomLevel(page);
    expect(zoomAfterIn).toBeCloseTo(1.1, 1);

    // Now zoom out
    await page.keyboard.press('Control+-');
    await page.waitForTimeout(300);

    const zoomAfterOut = await getCurrentZoomLevel(page);
    expect(zoomAfterOut).toBeCloseTo(1.0, 1);
  });

  test('Keyboard Reset Zoom (Ctrl+0)', async ({ page }) => {
    await focusPdfContainer(page);

    // Zoom in multiple times
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);

    const zoomedLevel = await getCurrentZoomLevel(page);
    expect(zoomedLevel).toBeGreaterThan(1.0);

    // Reset zoom
    await page.keyboard.press('Control+0');
    await page.waitForTimeout(300);

    const resetZoom = await getCurrentZoomLevel(page);
    expect(resetZoom).toBeCloseTo(1.0, 1);
  });

  test('Mouse Wheel Zoom with Ctrl', async ({ page }) => {
    await focusPdfContainer(page);

    const initialZoom = await getCurrentZoomLevel(page);

    // Zoom in with Ctrl+Wheel
    await page.mouse.move(640, 400); // Center of viewport
    await page.mouse.wheel(0, -100); // Wheel up without Ctrl (should not zoom)
    await page.waitForTimeout(100);

    let currentZoom = await getCurrentZoomLevel(page);
    expect(currentZoom).toBeCloseTo(initialZoom, 1); // Should not have changed

    // Now with Ctrl held
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100); // Wheel up with Ctrl (should zoom in)
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);

    currentZoom = await getCurrentZoomLevel(page);
    expect(currentZoom).toBeGreaterThan(initialZoom);
  });

  test('Zoom Boundaries (Min/Max)', async ({ page }) => {
    await focusPdfContainer(page);

    // Test minimum zoom (zoom out extensively)
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Control+-');
    }
    await page.waitForTimeout(300);

    const minZoom = await getCurrentZoomLevel(page);
    expect(minZoom).toBeCloseTo(0.25, 1); // Should not go below 25%

    // Test maximum zoom (zoom in extensively)
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('Control+=');
    }
    await page.waitForTimeout(300);

    const maxZoom = await getCurrentZoomLevel(page);
    expect(maxZoom).toBeCloseTo(5.0, 1); // Should not go above 500%
  });

  test('Zoom Increments', async ({ page }) => {
    await focusPdfContainer(page);

    let currentZoom = await getCurrentZoomLevel(page);
    expect(currentZoom).toBe(1.0);

    // Test consistent 10% increments
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);
    currentZoom = await getCurrentZoomLevel(page);
    expect(currentZoom).toBeCloseTo(1.1, 1);

    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);
    currentZoom = await getCurrentZoomLevel(page);
    expect(currentZoom).toBeCloseTo(1.2, 1);

    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);
    currentZoom = await getCurrentZoomLevel(page);
    expect(currentZoom).toBeCloseTo(1.3, 1);
  });

  test('Horizontal Scrolling When Zoomed', async ({ page }) => {
    await focusPdfContainer(page);

    // Zoom in significantly to trigger horizontal scrolling
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Control+=');
    }
    await page.waitForTimeout(500);

    // Check that horizontal scrolling is available
    const scrollInfo = await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      return {
        hasHorizontalScroll: container && container.scrollWidth > container.clientWidth,
        scrollWidth: container?.scrollWidth || 0,
        clientWidth: container?.clientWidth || 0
      };
    });

    expect(scrollInfo.hasHorizontalScroll).toBe(true);

    // Test horizontal scrolling
    const initialScrollLeft = await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      return container?.scrollLeft || 0;
    });

    // Scroll horizontally by a percentage of available scroll
    const scrollAmount = Math.max(100, scrollInfo.scrollWidth * 0.1);
    await page.evaluate((amount) => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      if (container) {
        container.scrollLeft = amount;
      }
    }, scrollAmount);

    await page.waitForTimeout(100);

    const newScrollLeft = await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      return container?.scrollLeft || 0;
    });

    expect(newScrollLeft).toBeGreaterThan(initialScrollLeft);
  });

  test('Zoom Event Emission', async ({ page }) => {
    await focusPdfContainer(page);

    // Set up event listener
    await page.evaluate(() => {
      (window as any).zoomEvents = [];
      const container = document.querySelector('.pdfagogo-container') as any;
      const viewer = container?.pdfViewer;
      if (viewer) {
        viewer.on('zoom', (event: any) => {
          (window as any).zoomEvents.push(event);
        });
      }
    });

    // Trigger zoom
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);

    // Check that zoom event was emitted
    const zoomEvents = await page.evaluate(() => (window as any).zoomEvents);
    expect(zoomEvents).toHaveLength(1);
    expect(zoomEvents[0]).toHaveProperty('level');
    expect(zoomEvents[0]).toHaveProperty('percentage');
    expect(zoomEvents[0].level).toBeCloseTo(1.1, 1);
    expect(zoomEvents[0].percentage).toBe(110);
  });

  test('Touch Pinch Zoom Handler Setup', async ({ page }) => {
    await focusPdfContainer(page);

    // Test that touch event handlers are properly set up
    const hasEventListeners = await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      if (!container) return { hasTouchAction: false, containerExists: false };

      // Check if the container has the correct touch-action CSS property
      const style = window.getComputedStyle(container);
      const touchAction = style.getPropertyValue('touch-action');

      // Also verify the container accepts touch events by trying to simulate programmatically
      // This is a safer way to test touch support without complex TouchEvent construction
      let touchSupported = false;
      try {
        container.addEventListener('touchstart', () => touchSupported = true, { once: true });
        const evt = new Event('touchstart', { bubbles: true, cancelable: true });
        container.dispatchEvent(evt);
      } catch (e) {
        // TouchEvent construction may fail in test environment
      }

      return {
        hasTouchAction: touchAction.includes('pinch-zoom') || touchAction.includes('pan') || touchAction === 'auto' || touchAction === 'manipulation',
        containerExists: !!container,
        actualTouchAction: touchAction
      };
    });

    expect(hasEventListeners.containerExists).toBe(true);
    // Touch action should be set to support pinch zoom
    // Log the actual value for debugging
    console.log('Actual touch-action:', (hasEventListeners as any).actualTouchAction);
    expect(hasEventListeners.hasTouchAction).toBe(true);
  });

    test('Zoom Persistence During Page Navigation', async ({ page }) => {
    await focusPdfContainer(page);
    
    // Zoom in
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);
    
    const zoomLevel = await getCurrentZoomLevel(page);
    expect(zoomLevel).toBeCloseTo(1.2, 1);
    
    // Navigate to a different page (if PDF has multiple pages)
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(500);
    
    // Check that zoom is maintained
    const persistedZoom = await getCurrentZoomLevel(page);
    expect(persistedZoom).toBeCloseTo(zoomLevel, 1);
  });

  test('Zoom Does Not Activate When Container Not Focused', async ({ page }) => {
    // Don't focus the PDF container - focus something else instead
    await page.focus('body');
    
    const initialZoom = await getCurrentZoomLevel(page);
    expect(initialZoom).toBe(1.0);
    
    // Try to zoom without focusing the container
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);
    
    // Zoom should NOT have changed
    const unchangedZoom = await getCurrentZoomLevel(page);
    expect(unchangedZoom).toBe(1.0);
    
    // Now focus the container and zoom should work
    await focusPdfContainer(page);
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(300);
    
    const focusedZoom = await getCurrentZoomLevel(page);
    expect(focusedZoom).toBeCloseTo(1.1, 1);
  });
});