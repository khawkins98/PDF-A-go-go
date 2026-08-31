import { test, expect } from '@playwright/test';

// Outline / table-of-contents panel.
//
// Fixtures:
//   - accessibility-test.html loads example.pdf, which carries a nested PDF
//     outline (bookmarks) -> the toggle and panel should appear.
//   - the root page (index.html) loads pdf-a-go-go-showcase.pdf, which has no
//     outline -> the toggle must stay hidden.

const OUTLINED_PAGE = 'http://localhost:9000/tests/accessibility-test.html';
const NO_OUTLINE_PAGE = 'http://localhost:9000/';

test.describe('Outline / table-of-contents panel', () => {
  test('toggle and panel appear for a PDF with an outline', async ({ page }) => {
    await page.goto(OUTLINED_PAGE);
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });

    const toggle = page.locator('#pdfagogo-container .pdfagogo-outline');
    // Revealed asynchronously once getOutline() confirms there are entries.
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const panel = page.locator('#pdfagogo-container .pdfagogo-outline-panel');
    await expect(panel).toBeHidden();

    await toggle.click();
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    // Entries are rendered, and at least one nested (child) list exists since
    // example.pdf's outline has a section with sub-entries.
    await expect(panel.locator('.pdfagogo-outline-entry').first()).toBeVisible();
    const nested = panel.locator('.pdfagogo-outline-list .pdfagogo-outline-list');
    await expect(nested.first()).toHaveCount(1);
  });

  test('clicking an entry navigates to its page and closes the panel', async ({ page }) => {
    await page.goto(OUTLINED_PAGE);
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });

    const toggle = page.locator('#pdfagogo-container .pdfagogo-outline');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await toggle.click();

    const panel = page.locator('#pdfagogo-container .pdfagogo-outline-panel');
    const gotoInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    await expect(gotoInput).toHaveValue('1');

    // Click the last enabled entry (deepest/latest in the document) so the
    // target page is reliably greater than 1.
    const entries = panel.locator('.pdfagogo-outline-entry:not([disabled])');
    await entries.last().click();

    // Panel closes on navigation.
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Navigation happened: the page input advanced past page 1 and the URL hash
    // reflects the new page.
    await expect(gotoInput).not.toHaveValue('1', { timeout: 5000 });
    expect(page.url()).toMatch(/#pdf-page-\d+/);
  });

  test('Escape closes the panel and returns focus to the toggle', async ({ page }) => {
    await page.goto(OUTLINED_PAGE);
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });

    const toggle = page.locator('#pdfagogo-container .pdfagogo-outline');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await toggle.click();

    const panel = page.locator('#pdfagogo-container .pdfagogo-outline-panel');
    await expect(panel).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('no toggle appears for a PDF without an outline', async ({ page }) => {
    await page.goto(NO_OUTLINE_PAGE);
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });

    // Give getOutline() time to resolve; the toggle must remain hidden because
    // the showcase PDF has no bookmarks.
    await page.waitForTimeout(1500);
    const toggle = page.locator('#pdfagogo-container .pdfagogo-outline');
    await expect(toggle).toBeHidden();
    await expect(page.locator('#pdfagogo-container .pdfagogo-outline-panel')).toHaveCount(0);
  });
});
