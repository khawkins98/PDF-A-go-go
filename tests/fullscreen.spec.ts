import { test, expect, Page } from '@playwright/test';

async function waitForViewer(page: Page) {
  await page.goto('http://localhost:9000/tests/test-small.html');
  await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

test.describe('PDF-A-go-go Fullscreen Control', () => {
  test.beforeEach(async ({ page }) => {
    await waitForViewer(page);
  });

  test('Fullscreen button exists and requests fullscreen on wrapper', async ({ page }) => {
    // Ensure the wrapper and button exist
    const hasElements = await page.evaluate(() => {
      const wrapper = document.querySelector('.pdfagogo-viewer-wrapper');
      const btn = document.querySelector<HTMLButtonElement>('.pdfagogo-controls .pdfagogo-fullscreen');
      return { hasWrapper: !!wrapper, hasBtn: !!btn, btnText: btn?.textContent?.trim() };
    });

    expect(hasElements.hasWrapper).toBe(true);
    expect(hasElements.hasBtn).toBe(true);
    expect(hasElements.btnText).toMatch(/Fullscreen|Exit Fullscreen/i);

    // Stub requestFullscreen to verify it is called
    await page.evaluate(() => {
      const wrapper = document.querySelector('.pdfagogo-viewer-wrapper') as any;
      (window as any).__fsRequested = false;
      if (wrapper) {
        wrapper.requestFullscreen = () => {
          (window as any).__fsRequested = true;
          // In real browser this would trigger fullscreen; here we just mark flag
        };
      }
    });

    // Click the fullscreen button
    await page.click('.pdfagogo-controls .pdfagogo-fullscreen');

    // Verify our stub was invoked
    const fsRequested = await page.evaluate(() => (window as any).__fsRequested === true);
    expect(fsRequested).toBe(true);
  });
});


