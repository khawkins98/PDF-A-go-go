import { test, expect } from '@playwright/test';

// UI string i18n. The fixture overrides a few strings (French) via
// data-strings on #pdfagogo-container, leaving the rest to fall back to
// English, and has a second instance (#pdfagogo-invalid) with malformed JSON
// that must degrade gracefully to the English defaults.

const PAGE = 'http://localhost:9000/tests/i18n-test.html';

test.describe('UI string i18n', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#pdfagogo-container .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
  });

  test('overridden strings are applied to the UI', async ({ page }) => {
    const root = page.locator('#pdfagogo-container');
    await expect(root.locator('.pdfagogo-next-page')).toHaveAttribute('aria-label', 'Page suivante');
    await expect(root.locator('.pdfagogo-next-page')).toHaveAttribute('title', 'Page suivante');
    await expect(root.locator('.pdfagogo-prev-page')).toHaveAttribute('aria-label', 'Page précédente');
    await expect(root.locator('.pdfagogo-download')).toHaveAttribute('aria-label', 'Télécharger le PDF');
    await expect(root.locator('.pdfagogo-search-input')).toHaveAttribute('placeholder', 'Rechercher…');

    // example.pdf has an outline, so the outline toggle is revealed and its
    // label uses the override.
    const outline = root.locator('.pdfagogo-outline');
    await expect(outline).toBeVisible({ timeout: 10000 });
    await expect(outline).toHaveAttribute('aria-label', 'Table des matières');
  });

  test('unspecified strings fall back to English', async ({ page }) => {
    const root = page.locator('#pdfagogo-container');
    // These keys were not overridden in the fixture.
    await expect(root.locator('.pdfagogo-share')).toHaveAttribute('aria-label', 'Share link');
    await expect(root.locator('.pdfagogo-fullscreen')).toHaveAttribute('aria-label', 'Enter fullscreen');
    await expect(root.locator('.pdfagogo-goto-page')).toHaveAttribute('aria-label', 'Current page');
  });

  test('overridden "No matches" text is localized', async ({ page }) => {
    const root = page.locator('#pdfagogo-container');
    const input = root.locator('.pdfagogo-search-input');
    const result = root.locator('.pdfagogo-search-result');
    await input.fill('zzxqnonexistent123');
    await input.press('Enter');
    await expect(result).toHaveText('Aucun résultat');
  });

  test('malformed data-strings degrades to English', async ({ page }) => {
    // Wait for the second instance to render.
    await page.locator('#pdfagogo-invalid .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    const bad = page.locator('#pdfagogo-invalid');
    await expect(bad.locator('.pdfagogo-next-page')).toHaveAttribute('aria-label', 'Next page');
    await expect(bad.locator('.pdfagogo-search-input')).toHaveAttribute('placeholder', 'Search...');
  });
});
