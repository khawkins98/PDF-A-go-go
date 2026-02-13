import { test, expect } from '@playwright/test';

test.describe('Multi-Instance Isolation', () => {

  // Loading two PDFs (including the 11.4MB spread) can take a while
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9000/tests/multi-instance.html');
    // Wait for both viewers to load (spread PDF is 11.4MB)
    await page.locator('#viewer-a .pdfagogo-page-canvas').first().waitFor({ timeout: 30000 });
    await page.locator('#viewer-b .pdfagogo-page-canvas').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);
  });

  test('Both viewers load independently with different page counts', async ({ page }) => {
    const totalA = page.locator('#viewer-a .pdfagogo-page-total');
    const totalB = page.locator('#viewer-b .pdfagogo-page-total');

    const textA = await totalA.textContent();
    const textB = await totalB.textContent();

    // Both should have page totals
    expect(textA).toBeTruthy();
    expect(textB).toBeTruthy();

    // They should be different since they load different PDFs
    expect(textA).not.toBe(textB);
  });

  test('Independent navigation', async ({ page }) => {
    const pageInputA = page.locator('#viewer-a .pdfagogo-goto-page');
    const pageInputB = page.locator('#viewer-b .pdfagogo-goto-page');

    // Both start on page 1
    await expect(pageInputA).toHaveValue('1');
    await expect(pageInputB).toHaveValue('1');

    // Navigate viewer-a to page 5
    await pageInputA.click();
    await pageInputA.fill('5');
    await pageInputA.press('Enter');
    await page.waitForTimeout(500);

    // Viewer-a should be on page 5
    await expect(pageInputA).toHaveValue('5');

    // Viewer-b should still be on page 1
    await expect(pageInputB).toHaveValue('1');
  });

  test('Independent zoom', async ({ page }) => {
    // Get initial zoom for both
    const initialZoomB = await page.evaluate(() => {
      const container = document.querySelector('#viewer-b') as any;
      return container?.pdfViewer?.getZoom();
    });

    // Zoom viewer-a
    await page.evaluate(() => {
      const container = document.querySelector('#viewer-a') as any;
      container?.pdfViewer?.zoomIn();
    });
    await page.waitForTimeout(500);

    // Viewer-a should have changed zoom
    const zoomA = await page.evaluate(() => {
      const container = document.querySelector('#viewer-a') as any;
      return container?.pdfViewer?.getZoom();
    });
    expect(zoomA).toBeGreaterThan(1.0);

    // Viewer-b should still be at initial zoom
    const zoomB = await page.evaluate(() => {
      const container = document.querySelector('#viewer-b') as any;
      return container?.pdfViewer?.getZoom();
    });
    expect(zoomB).toBeCloseTo(initialZoomB, 1);
  });

  test('Registry tracks both instances', async ({ page }) => {
    const hasInstances = await page.evaluate(() => {
      const a = document.querySelector('#viewer-a') as any;
      const b = document.querySelector('#viewer-b') as any;
      return {
        instanceA: !!a?._pdfagogoInstance,
        instanceB: !!b?._pdfagogoInstance,
      };
    });

    expect(hasInstances.instanceA).toBe(true);
    expect(hasInstances.instanceB).toBe(true);
  });

  test('Theme isolation', async ({ page }) => {
    // Viewer-b has data-theme="dark", viewer-a has no theme
    const themeB = await page.locator('#viewer-b').getAttribute('data-theme');
    expect(themeB).toBe('dark');

    const themeA = await page.locator('#viewer-a').getAttribute('data-theme');
    expect(themeA).toBeNull();

    // Check computed CSS custom properties are different
    const colors = await page.evaluate(() => {
      const a = document.querySelector('#viewer-a') as HTMLElement;
      const b = document.querySelector('#viewer-b') as HTMLElement;
      return {
        bgA: getComputedStyle(a).getPropertyValue('--pdfagogo-bg-container').trim(),
        bgB: getComputedStyle(b).getPropertyValue('--pdfagogo-bg-container').trim(),
      };
    });

    expect(colors.bgA).not.toBe(colors.bgB);
  });

  test('Destroy one leaves other intact', async ({ page }) => {
    // Destroy viewer-a
    await page.evaluate(() => {
      const container = document.querySelector('#viewer-a') as any;
      container._pdfagogoInstance?.destroy();
    });
    await page.waitForTimeout(500);

    // Viewer-b should still be functional - navigate to page 2
    const pageInputB = page.locator('#viewer-b .pdfagogo-goto-page');
    await pageInputB.click();
    await pageInputB.fill('2');
    await pageInputB.press('Enter');
    await page.waitForTimeout(500);

    await expect(pageInputB).toHaveValue('2');

    // Viewer-b's instance should still exist
    const instanceB = await page.evaluate(() => {
      const b = document.querySelector('#viewer-b') as any;
      return !!b?._pdfagogoInstance;
    });
    expect(instanceB).toBe(true);
  });

  test('Search isolation', async ({ page }) => {
    const searchInputA = page.locator('#viewer-a .pdfagogo-search-input');
    const searchResultA = page.locator('#viewer-a .pdfagogo-search-result');
    const searchResultB = page.locator('#viewer-b .pdfagogo-search-result');

    // Search in viewer-a
    await searchInputA.fill('pdf');
    await searchInputA.press('Enter');
    await page.waitForTimeout(1000);

    // Viewer-a should have search results
    await expect(searchResultA).toBeVisible();
    const resultTextA = await searchResultA.textContent();
    expect(resultTextA).toMatch(/\d+\s*\/\s*\d+/);

    // Viewer-b search result should not be visible (no search performed)
    await expect(searchResultB).not.toBeVisible();
  });
});
