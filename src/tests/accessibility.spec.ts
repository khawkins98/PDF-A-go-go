import { test, expect } from '@playwright/test';

test.describe('Accessibility Features', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9000/tests/accessibility-test.html');
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  test('All toolbar buttons have aria-labels', async ({ page }) => {
    const buttons = page.locator('#pdfagogo-container .pdfagogo-toolbar button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      expect(ariaLabel, `Button ${i} missing aria-label`).toBeTruthy();
      expect(ariaLabel!.length, `Button ${i} has empty aria-label`).toBeGreaterThan(0);
    }
  });

  test('Search input has aria-label', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    await expect(searchInput).toHaveAttribute('aria-label', 'Search in document');
  });

  test('Page input has aria-label', async ({ page }) => {
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    await expect(pageInput).toHaveAttribute('aria-label', 'Current page');
  });

  test('Page total is not a redundant live region', async ({ page }) => {
    // Page changes are announced by the dedicated .pdfagogo-page-announcement
    // element (asserted in the next test). The page-total span must NOT also be
    // a live region, or screen readers get competing/duplicate announcements.
    const pageTotal = page.locator('#pdfagogo-container .pdfagogo-page-total');
    await expect(pageTotal).not.toHaveAttribute('aria-live', /.+/);
  });

  test('Screen reader page announcement updates on navigation', async ({ page }) => {
    // The announcement element is in the wrapper (parent of container), not inside it
    const wrapper = page.locator('#pdfagogo-container').locator('..');
    const announcement = wrapper.locator('.pdfagogo-page-announcement');

    // Should have aria-live="polite"
    await expect(announcement).toHaveAttribute('aria-live', 'polite');

    // Navigate to page 5 using the page input (more reliable than button click)
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    await pageInput.click();
    await pageInput.fill('5');
    await pageInput.press('Enter');
    await page.waitForTimeout(1000);

    // Announcement should show the page navigation text
    await expect(announcement).toHaveText(/Page \d+ of \d+/);
  });

  test('Container is focusable', async ({ page }) => {
    const container = page.locator('#pdfagogo-container');
    const tabindex = await container.getAttribute('tabindex');
    expect(tabindex).toBe('0');
  });

  test('Accessibility instructions panel is expandable details element', async ({ page }) => {
    // The a11y instructions are in the wrapper (parent of container), not inside it
    const wrapper = page.locator('#pdfagogo-container').locator('..');
    const instructions = wrapper.locator('.pdfagogo-a11y-instructions');

    // Should exist in the DOM
    await expect(instructions).toBeAttached();

    // Should be a <details> element
    const tagName = await instructions.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('details');

    // Scroll the instructions into view and expand it
    await instructions.scrollIntoViewIfNeeded();
    await instructions.click();
    await page.waitForTimeout(300);

    // Should contain keyboard shortcut <kbd> elements when expanded
    const kbdElements = instructions.locator('kbd');
    const kbdCount = await kbdElements.count();
    expect(kbdCount).toBeGreaterThan(0);
  });

  test('Resize grip has accessibility attributes', async ({ page }) => {
    const grip = page.locator('#pdfagogo-container .pdfagogo-resize-grip');
    await expect(grip).toHaveAttribute('role', 'separator');
    await expect(grip).toHaveAttribute('aria-orientation', 'vertical');
    await expect(grip).toHaveAttribute('aria-label', 'Resize PDF viewer');
    await expect(grip).toHaveAttribute('tabindex', '0');
  });
});
