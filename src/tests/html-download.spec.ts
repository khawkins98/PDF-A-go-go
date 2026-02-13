import { test, expect } from '@playwright/test';

test.describe('HTML Download Handler', () => {

  // The meta refresh has a 3s delay plus PDF loading time
  test.setTimeout(60000);

  test('HTML redirect loads a PDF', async ({ page }) => {
    await page.goto('http://localhost:9000/html-download-example.html');

    // PDF canvas should eventually appear after the HTML redirect is resolved
    const canvas = page.locator('#pdfagogo-container .pdfagogo-page-canvas').first();
    await canvas.waitFor({ timeout: 30000 });
    await expect(canvas).toBeVisible();
  });

  test('Correct PDF loaded after redirect', async ({ page }) => {
    await page.goto('http://localhost:9000/html-download-example.html');

    // Wait for PDF to load
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify page count matches example_spread.pdf (the redirect target)
    const pageCount = await page.evaluate(() => {
      const container = document.querySelector('#pdfagogo-container') as any;
      return container?._pdfagogoInstance?.getPageCount() ?? 0;
    });

    // example_spread.pdf should have pages (we verify it loaded a real PDF)
    expect(pageCount).toBeGreaterThan(0);

    // Also verify via page total UI
    const pageTotal = page.locator('#pdfagogo-container .pdfagogo-page-total');
    const totalText = await pageTotal.textContent();
    expect(totalText).toMatch(/\d+/);
    expect(parseInt(totalText!.replace(/\D/g, ''))).toBe(pageCount);
  });

  test('Loading indicator shown during redirect', async ({ page }) => {
    await page.goto('http://localhost:9000/html-download-example.html');

    // Loading indicator should be visible initially
    const loading = page.locator('#pdfagogo-container .pdfagogo-loading');
    await expect(loading).toBeVisible({ timeout: 5000 });

    // After PDF loads, loading should disappear
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);

    await expect(loading).not.toBeVisible();
  });

  test('Navigation works after redirect', async ({ page }) => {
    await page.goto('http://localhost:9000/html-download-example.html');

    // Wait for full load
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1000);

    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    const nextButton = page.locator('#pdfagogo-container .pdfagogo-next-page');

    // Get initial page
    const initialPage = await pageInput.inputValue();

    // Click next page
    await nextButton.click();
    await page.waitForTimeout(800);

    // Page should have advanced
    const newPage = await pageInput.inputValue();
    expect(parseInt(newPage)).toBe(parseInt(initialPage) + 1);
  });
});
