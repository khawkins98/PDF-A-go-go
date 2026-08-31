import { test, expect } from '@playwright/test';

// UI string i18n. The fixture has three viewer instances on one page:
//   A (#pdfagogo-container) — French overrides, rest English
//   B (#pdfagogo-de)        — German overrides incl. reordered {token}
//                             interpolation and one wrong-typed value
//   C (#pdfagogo-invalid)   — malformed data-strings JSON (degrades to English)

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

  test('two locales on one page stay isolated', async ({ page }) => {
    // Instance B renders too.
    await page.locator('#pdfagogo-de .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    // A is French and B is German simultaneously — no cross-instance leakage.
    await expect(page.locator('#pdfagogo-container .pdfagogo-next-page')).toHaveAttribute('aria-label', 'Page suivante');
    await expect(page.locator('#pdfagogo-de .pdfagogo-next-page')).toHaveAttribute('aria-label', 'Nächste Seite');
    await expect(page.locator('#pdfagogo-de .pdfagogo-prev-page')).toHaveAttribute('aria-label', 'Vorherige Seite');
  });

  test('interpolated strings honor a translated, reordered template', async ({ page }) => {
    const de = page.locator('#pdfagogo-de');
    await de.locator('.pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });

    // searchCounter override "Treffer {current} von {total}" — tokens substituted.
    const input = de.locator('.pdfagogo-search-input');
    const result = de.locator('.pdfagogo-search-result');
    await input.fill('pdf');
    await input.press('Enter');
    await expect(result).toHaveText(/^Treffer 1 von \d+$/);

    // pageAnnouncement override "Seite {current} von {total}" — live region text
    // after navigating a page. The announcement lives in the instance's wrapper
    // (a sibling of the container), so scope to the wrapper that holds #pdfagogo-de.
    await de.locator('.pdfagogo-next-page').click();
    const deWrapper = page.locator('.pdfagogo-viewer-wrapper', { has: page.locator('#pdfagogo-de') });
    await expect(deWrapper.locator('.pdfagogo-page-announcement')).toHaveText(/^Seite 2 von \d+$/);
  });

  test('valid JSON with a wrong-typed value falls back to English', async ({ page }) => {
    // Instance B set "download": 42 (a number); the guard drops it, so the
    // English default is used rather than injecting "42".
    const de = page.locator('#pdfagogo-de');
    await de.locator('.pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    await expect(de.locator('.pdfagogo-download')).toHaveAttribute('aria-label', 'Download PDF');
  });

  test('malformed data-strings degrades to English', async ({ page }) => {
    // Wait for the invalid instance to render.
    await page.locator('#pdfagogo-invalid .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    const bad = page.locator('#pdfagogo-invalid');
    await expect(bad.locator('.pdfagogo-next-page')).toHaveAttribute('aria-label', 'Next page');
    await expect(bad.locator('.pdfagogo-search-input')).toHaveAttribute('placeholder', 'Search...');
  });
});
