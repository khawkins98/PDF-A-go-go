import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {

  test('CORS failure shows error UI', async ({ page }) => {
    await page.goto('http://localhost:9000/remote-pdf-cors-fail.html');

    // Wait for error to appear
    const loadingText = page.locator('#pdfagogo-container .pdfagogo-loading-text');
    await expect(loadingText).toContainText('Could not load this PDF', { timeout: 15000 });
  });

  test('CORS error has "open directly" link', async ({ page }) => {
    await page.goto('http://localhost:9000/remote-pdf-cors-fail.html');

    const loadingText = page.locator('#pdfagogo-container .pdfagogo-loading-text');
    await expect(loadingText).toContainText('Could not load this PDF', { timeout: 15000 });

    // Check the "open directly" link
    const link = page.locator('#pdfagogo-container .pdfagogo-error-actions a.primary');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');

    // href should match data-pdf-url
    const pdfUrl = await page.locator('#pdfagogo-container').getAttribute('data-pdf-url');
    await expect(link).toHaveAttribute('href', pdfUrl!);
  });

  test('Error has collapsible technical details', async ({ page }) => {
    await page.goto('http://localhost:9000/remote-pdf-cors-fail.html');

    const loadingText = page.locator('#pdfagogo-container .pdfagogo-loading-text');
    await expect(loadingText).toContainText('Could not load this PDF', { timeout: 15000 });

    // Check details element
    const details = page.locator('#pdfagogo-container details.pdfagogo-error-details');
    await expect(details).toBeVisible();

    // Should have a summary
    const summary = details.locator('summary');
    await expect(summary).toContainText('Technical details');

    // Should have a pre element with error message
    const pre = details.locator('pre');
    await expect(pre).toBeAttached();
    const preText = await pre.textContent();
    expect(preText!.length).toBeGreaterThan(0);
  });

  test('404 displays error', async ({ page }) => {
    // The 404 page has data-download-timeout="3000" so the HTML download handler
    // (triggered because the dev server returns HTML for 404) times out quickly
    test.setTimeout(45000);
    await page.goto('http://localhost:9000/tests/error-404.html');

    // Wait for error to appear (3s download timeout + processing overhead)
    const loadingText = page.locator('#pdfagogo-container .pdfagogo-loading-text');
    await expect(loadingText).toContainText('Could not load this PDF', { timeout: 30000 });

    // Error container should be visible
    const errorMsg = page.locator('#pdfagogo-container .pdfagogo-loading-error');
    await expect(errorMsg).toBeVisible();
  });

  test('Error message is HTML-escaped', async ({ page }) => {
    await page.goto('http://localhost:9000/remote-pdf-cors-fail.html');

    const loadingText = page.locator('#pdfagogo-container .pdfagogo-loading-text');
    await expect(loadingText).toContainText('Could not load this PDF', { timeout: 15000 });

    // The <pre> text content should not contain unescaped HTML tags
    const pre = page.locator('#pdfagogo-container details.pdfagogo-error-details pre');
    const preText = await pre.textContent();

    // textContent returns decoded text, so if HTML was injected it would show as rendered elements.
    // Check that the pre element has no child elements (only text nodes).
    const childElementCount = await pre.evaluate(el => el.children.length);
    expect(childElementCount).toBe(0);
  });
});
