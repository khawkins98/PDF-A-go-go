import { test, expect, Page } from '@playwright/test';

/**
 * Regression coverage for the share-link off-by-one (issue H3).
 *
 * The share button builds a URL of the form `...#pdf-page-N` where N must match
 * the page the viewer is currently on. Before the fix, the internal page counter
 * was 0-based while the handler added +1, producing `#pdf-page-2` while sitting
 * on page 1. These tests assert the copied fragment matches the current page.
 */

async function waitForViewer(page: Page) {
  // Use the local, multi-page (example.pdf) fixture with sharing enabled so the
  // navigation case actually exercises a second page and the test doesn't depend
  // on a remote PDF host.
  await page.goto('http://localhost:9000/tests/accessibility-test.html');
  await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 10000 });
  await page.waitForTimeout(1000);
}

// Intercept navigator.clipboard.writeText so we can read whatever the share
// handler tries to copy (avoids clipboard-permission flakiness in the harness).
async function installClipboardCapture(page: Page) {
  await page.evaluate(() => {
    (window as any).__copiedText = null;
    try {
      navigator.clipboard.writeText = (text: string) => {
        (window as any).__copiedText = text;
        return Promise.resolve();
      };
    } catch (e) {
      // If clipboard isn't writable, fall back to defining a stub.
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            (window as any).__copiedText = text;
            return Promise.resolve();
          },
        },
      });
    }
  });
}

async function getCopiedText(page: Page): Promise<string | null> {
  return page.evaluate(() => (window as any).__copiedText);
}

test.describe('Share link page fragment', () => {
  test.beforeEach(async ({ page }) => {
    await waitForViewer(page);
    await installClipboardCapture(page);
  });

  test('copies #pdf-page-1 while on page 1', async ({ page }) => {
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    await expect(pageInput).toHaveValue('1');

    await page.locator('#pdfagogo-container .pdfagogo-share').click();

    const copied = await getCopiedText(page);
    expect(copied).toBeTruthy();
    // Would be #pdf-page-2 before the off-by-one fix.
    expect(copied).toMatch(/#pdf-page-1$/);
  });

  test('copies the matching fragment after navigating', async ({ page }) => {
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    const pageTotal = page.locator('#pdfagogo-container .pdfagogo-page-total');

    const totalText = (await pageTotal.textContent()) || '1';
    const total = parseInt(totalText, 10);

    // Only exercise multi-page navigation when the document has a second page.
    if (total >= 2) {
      await pageInput.click();
      await pageInput.fill('2');
      await pageInput.press('Enter');
      await page.waitForTimeout(800);
      await expect(pageInput).toHaveValue('2');

      await page.locator('#pdfagogo-container .pdfagogo-share').click();

      const copied = await getCopiedText(page);
      expect(copied).toBeTruthy();
      expect(copied).toMatch(/#pdf-page-2$/);
    } else {
      // Single-page document: fragment must still reference page 1.
      await page.locator('#pdfagogo-container .pdfagogo-share').click();
      const copied = await getCopiedText(page);
      expect(copied).toMatch(/#pdf-page-1$/);
    }
  });

  test('announces "Link copied" to screen readers', async ({ page }) => {
    await page.locator('#pdfagogo-container .pdfagogo-share').click();
    const status = page.locator('.pdfagogo-status-message');
    await expect(status).toHaveText('Link copied', { timeout: 2000 });
  });
});
