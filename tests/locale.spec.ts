import { test, expect } from '@playwright/test';

// Bundled locale packs (data-locale). Fixture has three instances:
//   A (#pdfagogo-de)          — data-locale="de": full German from the pack
//   B (#pdfagogo-de-override) — de pack + a data-strings key that must win
//   C (#pdfagogo-unknown)     — data-locale="xx": unknown, stays English

const PAGE = 'http://localhost:9000/tests/locale-test.html';

test.describe('Bundled locales (data-locale)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PAGE);
    await page.locator('#pdfagogo-de .pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
  });

  test('data-locale="de" applies the full German pack', async ({ page }) => {
    const de = page.locator('#pdfagogo-de');
    await expect(de.locator('.pdfagogo-next-page')).toHaveAttribute('aria-label', 'Nächste Seite');
    await expect(de.locator('.pdfagogo-prev-page')).toHaveAttribute('aria-label', 'Vorherige Seite');
    await expect(de.locator('.pdfagogo-download')).toHaveAttribute('aria-label', 'PDF herunterladen');
    await expect(de.locator('.pdfagogo-share')).toHaveAttribute('aria-label', 'Link teilen');
    await expect(de.locator('.pdfagogo-search-input')).toHaveAttribute('placeholder', 'Suchen …');
    await expect(de.locator('.pdfagogo-resize-grip')).toHaveAttribute('aria-label', 'PDF-Anzeige anpassen');

    // Outline label from the pack (example.pdf has an outline).
    const outline = de.locator('.pdfagogo-outline');
    await expect(outline).toBeVisible({ timeout: 10000 });
    await expect(outline).toHaveAttribute('aria-label', 'Inhaltsverzeichnis');

    // Localized "No matches" from the pack.
    const input = de.locator('.pdfagogo-search-input');
    await input.fill('zzxqnonexistent123');
    await input.press('Enter');
    await expect(de.locator('.pdfagogo-search-result')).toHaveText('Keine Treffer');
  });

  test('data-strings overrides a single key of the locale pack', async ({ page }) => {
    const b = page.locator('#pdfagogo-de-override');
    await b.locator('.pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    // Overridden key wins over the pack...
    await expect(b.locator('.pdfagogo-next-page')).toHaveAttribute('aria-label', 'Weiterblättern');
    // ...while non-overridden keys still come from the German pack.
    await expect(b.locator('.pdfagogo-prev-page')).toHaveAttribute('aria-label', 'Vorherige Seite');
  });

  test('unknown locale falls back to English', async ({ page }) => {
    const c = page.locator('#pdfagogo-unknown');
    await c.locator('.pdfagogo-page-canvas').first().waitFor({ timeout: 15000 });
    await expect(c.locator('.pdfagogo-next-page')).toHaveAttribute('aria-label', 'Next page');
    await expect(c.locator('.pdfagogo-search-input')).toHaveAttribute('placeholder', 'Search...');
  });
});
