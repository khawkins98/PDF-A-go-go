import { test, expect } from '@playwright/test';

// The search result span is a live region that stays in the DOM (visually empty
// when there is nothing to report), so "cleared" is asserted via empty text
// rather than via visibility.
const RESULT_COUNT = /\d+\s*\/\s*\d+/;

test.describe('Search Functionality', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9000/');
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
  });

  test('No matches found shows "No matches" text', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    await searchInput.fill('xyznonexistent123');
    await searchInput.press('Enter');

    await expect(searchResult).toHaveText('No matches');
    await expect(searchResult).toBeVisible();
  });

  test('Search is case insensitive', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    // Search uppercase
    await searchInput.fill('PDF');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const upperResult = await searchResult.textContent();
    const upperCount = upperResult?.match(/\d+\s*\/\s*(\d+)/)?.[1];

    // Search lowercase
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const lowerResult = await searchResult.textContent();
    const lowerCount = lowerResult?.match(/\d+\s*\/\s*(\d+)/)?.[1];

    expect(upperCount).toBeTruthy();
    expect(lowerCount).toBeTruthy();
    expect(upperCount).toBe(lowerCount);
  });

  test('Match navigation wraps forward', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    // Get total match count
    const resultText = await searchResult.textContent();
    const totalMatch = resultText?.match(/\d+\s*\/\s*(\d+)/);
    expect(totalMatch).toBeTruthy();
    const total = parseInt(totalMatch![1]);
    expect(total).toBeGreaterThan(0);

    // Navigate to last match by clicking next-match button
    const nextBtn = page.locator('#pdfagogo-container .pdfagogo-next-match-btn');
    for (let i = 1; i < total; i++) {
      await nextBtn.click();
      await expect(searchResult).toHaveText(`${i + 1} / ${total}`);
    }

    // Should be at last match
    await expect(searchResult).toHaveText(`${total} / ${total}`);

    // Press Enter to wrap to first match
    await searchInput.focus();
    await searchInput.press('Enter');

    await expect(searchResult).toHaveText(`1 / ${total}`);
  });

  test('Match navigation wraps backward', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    // Get total match count
    const resultText = await searchResult.textContent();
    const totalMatch = resultText?.match(/\d+\s*\/\s*(\d+)/);
    expect(totalMatch).toBeTruthy();
    const total = parseInt(totalMatch![1]);

    // At first match "1 / N", press Shift+Enter to wrap backward
    await expect(searchResult).toHaveText(`1 / ${total}`);
    await searchInput.press('Shift+Enter');

    await expect(searchResult).toHaveText(`${total} / ${total}`);
  });

  test('Clear search with Escape', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    // Perform a search first
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    // Press Escape to clear
    await searchInput.press('Escape');

    // Input should be cleared
    await expect(searchInput).toHaveValue('');

    // Result live region should be emptied (kept in DOM for announcements)
    await expect(searchResult).toHaveText('');
  });

  test('Multiple successive searches return different counts', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    // First search
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const firstResult = await searchResult.textContent();
    const firstCount = firstResult?.match(/\d+\s*\/\s*(\d+)/)?.[1];

    // Second search (different term)
    await searchInput.fill('page');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const secondResult = await searchResult.textContent();
    const secondCount = secondResult?.match(/\d+\s*\/\s*(\d+)/)?.[1];

    // Both should have results
    expect(parseInt(firstCount!)).toBeGreaterThan(0);
    expect(parseInt(secondCount!)).toBeGreaterThan(0);

    // Re-search first term should restore count
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const thirdResult = await searchResult.textContent();
    const thirdCount = thirdResult?.match(/\d+\s*\/\s*(\d+)/)?.[1];

    expect(thirdCount).toBe(firstCount);
  });

  test('Match count is consistent and navigation position is accurate', async ({ page }) => {
    const searchInput = page.locator('#pdfagogo-container .pdfagogo-search-input');
    const searchResult = page.locator('#pdfagogo-container .pdfagogo-search-result');

    // First search
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const resultText = await searchResult.textContent();
    const match = resultText?.match(/(\d+)\s*\/\s*(\d+)/);
    expect(match).toBeTruthy();
    const currentPos = parseInt(match![1]);
    const total = parseInt(match![2]);

    // Position should start at 1
    expect(currentPos).toBe(1);
    expect(total).toBeGreaterThan(0);

    // Navigate forward and verify position increments
    const nextBtn = page.locator('#pdfagogo-container .pdfagogo-next-match-btn');
    await nextBtn.click();

    await expect(searchResult).toHaveText(`2 / ${total}`);

    // Clear and re-search same term — count should be identical
    await searchInput.press('Escape');
    await expect(searchResult).toHaveText('');
    await searchInput.fill('pdf');
    await searchInput.press('Enter');
    await expect(searchResult).toHaveText(RESULT_COUNT);

    const reSearchText = await searchResult.textContent();
    const reSearchTotal = reSearchText?.match(/\d+\s*\/\s*(\d+)/)?.[1];
    expect(parseInt(reSearchTotal!)).toBe(total);
  });

  test('Overlapping searches do not duplicate or inflate results', async ({ page }) => {
    // Regression: two search() runs overlapping across their internal await
    // points (e.g. a debounced live search firing while an Enter-triggered
    // search is mid-flight) used to both push into the shared result arrays,
    // duplicating pages and inflating the match count.
    const result = await page.evaluate(async () => {
      const container = document.querySelector('#pdfagogo-container') as any;
      const controller = container?._pdfagogoInstance?.searchController;
      if (!controller) return { error: 'no searchController' } as any;

      // Baseline: a single, clean, fully-awaited search.
      await controller.search('pdf');
      const baseline = controller.getMatchCount();

      // Fire two searches for the same query concurrently (do not await the
      // first before starting the second) so they interleave.
      await Promise.all([controller.search('pdf'), controller.search('pdf')]);

      const pages = controller.matchPages.slice();
      const unique = Array.from(new Set(pages));
      return {
        baseline,
        after: controller.getMatchCount(),
        hasDuplicates: pages.length !== unique.length
      };
    });

    expect(result.error).toBeFalsy();
    expect(result.baseline).toBeGreaterThan(0);
    // No duplicate page entries from the overlap.
    expect(result.hasDuplicates).toBe(false);
    // Count equals a single clean search — not inflated by the concurrent run.
    expect(result.after).toBe(result.baseline);
  });
});
