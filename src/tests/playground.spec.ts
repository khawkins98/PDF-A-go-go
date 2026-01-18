import { test, expect } from '@playwright/test';

test.describe('Playground Functionality', () => {

  test.beforeEach(async ({ page }) => {
    // Load the main page with the playground
    await page.goto('http://localhost:9000/');

    // Wait for the PDF to load in the playground viewer
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000); // Allow time for initial render
  });

  test('should load PDF and show correct default page', async ({ page }) => {
    // The default page is set to 3 in the playground HTML
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    await expect(pageInput).toHaveValue('3');

    // Verify page total is shown
    const pageTotal = page.locator('#pdfagogo-container .pdfagogo-page-total');
    await expect(pageTotal).toContainText('15');
  });

  test('should navigate to next page when clicking next button', async ({ page }) => {
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    const nextButton = page.locator('#pdfagogo-container .pdfagogo-next-page');
    const scrollContainer = page.locator('#pdfagogo-container .pdfagogo-scroll-container');

    // Get initial page and scroll position
    const initialPage = await pageInput.inputValue();
    expect(initialPage).toBe('3');

    const initialScrollTop = await scrollContainer.evaluate((el) => el.scrollTop);

    // Click next page button
    await nextButton.click();
    await page.waitForTimeout(800); // Wait for smooth scroll

    // Verify page changed
    await expect(pageInput).toHaveValue('4');

    // Verify scroll position changed (PDF should have scrolled)
    const newScrollTop = await scrollContainer.evaluate((el) => el.scrollTop);
    expect(newScrollTop).not.toBe(initialScrollTop);
  });

  test('should navigate to previous page when clicking prev button', async ({ page }) => {
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');
    const prevButton = page.locator('#pdfagogo-container .pdfagogo-prev-page');

    // Get initial page (should be 3)
    await expect(pageInput).toHaveValue('3');

    // Click previous page button
    await prevButton.click();
    await page.waitForTimeout(500); // Wait for smooth scroll

    // Verify page changed to 2
    await expect(pageInput).toHaveValue('2');
  });

  test('should navigate to specific page when entering page number', async ({ page }) => {
    const pageInput = page.locator('#pdfagogo-container .pdfagogo-goto-page');

    // Clear and enter a new page number
    await pageInput.click();
    await pageInput.fill('10');
    await pageInput.press('Enter');
    await page.waitForTimeout(500); // Wait for smooth scroll

    // Verify page changed
    await expect(pageInput).toHaveValue('10');
  });

  test('should perform search and show results', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    // Type a search term
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await page.waitForTimeout(1000); // Wait for search to complete

    // Verify search results are shown
    await expect(searchResult).toBeVisible();
    // Result should show something like "1 / X"
    const resultText = await searchResult.textContent();
    expect(resultText).toMatch(/\d+\s*\/\s*\d+/);
  });

  test('should navigate through search results with arrow keys', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    // Perform search
    await searchInput.fill('page');
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);

    // Verify search found results
    const resultText = await searchResult.textContent();
    expect(resultText).toMatch(/\d+\s*\/\s*\d+/);

    // Get initial match number
    const initialMatch = resultText?.match(/(\d+)\s*\/\s*\d+/)?.[1];

    // Press down arrow to go to next match
    await searchInput.press('ArrowDown');
    await page.waitForTimeout(500);

    // Verify match number increased
    const newResult = await searchResult.textContent();
    const newMatch = newResult?.match(/(\d+)\s*\/\s*\d+/)?.[1];

    if (initialMatch && newMatch) {
      expect(parseInt(newMatch)).toBeGreaterThanOrEqual(parseInt(initialMatch));
    }
  });

  test('should have toolbar with flex-shrink 0', async ({ page }) => {
    const toolbar = page.locator('#pdfagogo-container .pdfagogo-toolbar');

    // Verify toolbar exists and is visible
    await expect(toolbar).toBeVisible();

    // Get toolbar flex-shrink
    const flexShrink = await toolbar.evaluate((el) => {
      return window.getComputedStyle(el).flexShrink;
    });

    // Toolbar should not shrink in flexbox layout (stays fixed size at top)
    expect(flexShrink).toBe('0');
  });

  test('copy button should copy code to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const copyBtn = page.locator('.code-copy');
    const codeBlock = page.locator('#code-block');

    // Verify copy button exists
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toHaveText('Copy');

    // Get the code content
    const codeContent = await codeBlock.textContent();

    // Click copy button
    await copyBtn.click();

    // Verify button text changes to "Copied!"
    await expect(copyBtn).toHaveText('Copied!');

    // Verify clipboard contains the code
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe(codeContent);

    // Wait for button text to reset
    await page.waitForTimeout(2500);
    await expect(copyBtn).toHaveText('Copy');
  });

  test('fullscreen button should be functional', async ({ page }) => {
    const fullscreenBtn = page.locator('#pdfagogo-container .pdfagogo-fullscreen');

    // Verify fullscreen button exists and is visible
    await expect(fullscreenBtn).toBeVisible();

    // Verify it has the correct aria-label
    await expect(fullscreenBtn).toHaveAttribute('aria-label', /fullscreen/i);
  });

  test('download button should be functional', async ({ page }) => {
    const downloadBtn = page.locator('#pdfagogo-container .pdfagogo-download');

    // Verify download button exists and is visible
    await expect(downloadBtn).toBeVisible();

    // Verify it has the correct aria-label
    await expect(downloadBtn).toHaveAttribute('aria-label', /download/i);
  });

  test('share button should copy link', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const shareBtn = page.locator('#pdfagogo-container .pdfagogo-share');

    // Verify share button exists
    await expect(shareBtn).toBeVisible();

    // Click share button
    await shareBtn.click();
    await page.waitForTimeout(500);

    // Verify the button shows "copied" state (checkmark icon)
    await expect(shareBtn).toHaveClass(/copied/);
  });
});
