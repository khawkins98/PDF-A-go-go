/**
 * Memory and performance tests for PDF-A-go-go
 *
 * This test measures memory usage, render times, and performance
 * characteristics of the tile-based rendering system.
 */

import { test, expect, Page } from '@playwright/test';

interface MemoryMetrics {
  canvasMemoryMB: number;
  canvasCount: number;
  maxCanvasSize: { width: number; height: number };
  tilesRendered: number;
  cacheSize: number;
  currentTier: number;
  currentZoom: number;
}

async function getMemoryMetrics(page: Page): Promise<MemoryMetrics> {
  return await page.evaluate(() => {
    const canvases = document.querySelectorAll('.pdfagogo-page-canvas');
    let totalPixels = 0;
    let maxCanvasSize = { width: 0, height: 0 };

    canvases.forEach(canvas => {
      const c = canvas as HTMLCanvasElement;
      totalPixels += c.width * c.height;
      if (c.width > maxCanvasSize.width) {
        maxCanvasSize.width = c.width;
        maxCanvasSize.height = c.height;
      }
    });

    const container = document.querySelector('.pdfagogo-container') as any;
    const tileStats = container?.pdfViewer?.tileRenderer?.getStats() || {};

    return {
      canvasMemoryMB: (totalPixels * 4) / (1024 * 1024),
      canvasCount: canvases.length,
      maxCanvasSize,
      tilesRendered: tileStats.tilesRendered || 0,
      cacheSize: tileStats.cacheSize || 0,
      currentTier: tileStats.currentTier || 0,
      currentZoom: tileStats.currentZoom || 1,
    };
  });
}

test.describe('Memory and Performance', () => {
  test('Memory usage at different zoom levels', async ({ page }) => {
    await page.goto('http://localhost:9000/tests/test-small.html#pdf-page-1');
    await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 30000 });
    await page.click('.pdfagogo-container');
    await page.waitForTimeout(2000);

    console.log('\n========== MEMORY AT DIFFERENT ZOOM LEVELS ==========\n');

    const zoomLevels = [
      { name: '50%', keys: ['Minus', 'Minus', 'Minus', 'Minus', 'Minus'] },
      { name: '100%', keys: ['Digit0'] },
      { name: '150%', keys: ['Equal', 'Equal', 'Equal', 'Equal', 'Equal'] },
      { name: '200%', keys: ['Equal', 'Equal', 'Equal', 'Equal', 'Equal'] },
    ];

    const results: { zoom: string; metrics: MemoryMetrics }[] = [];

    for (const zoom of zoomLevels) {
      // Reset to 100% first
      await page.keyboard.down('Control');
      await page.keyboard.press('Digit0');
      await page.keyboard.up('Control');
      await page.waitForTimeout(500);

      // Apply zoom
      await page.keyboard.down('Control');
      for (const key of zoom.keys) {
        await page.keyboard.press(key);
        await page.waitForTimeout(100);
      }
      await page.keyboard.up('Control');
      await page.waitForTimeout(1000);

      const metrics = await getMemoryMetrics(page);
      results.push({ zoom: zoom.name, metrics });

      console.log(`${zoom.name} Zoom:`);
      console.log(`  Canvas Memory: ${metrics.canvasMemoryMB.toFixed(2)}MB`);
      console.log(`  Max Canvas: ${metrics.maxCanvasSize.width}x${metrics.maxCanvasSize.height}`);
      console.log(`  Canvas Count: ${metrics.canvasCount}`);
      console.log(`  Tiles Rendered: ${metrics.tilesRendered}`);
      console.log(`  Cache Size: ${metrics.cacheSize}`);
      console.log(`  Current Tier: ${metrics.currentTier}`);
      console.log(`  Actual Zoom: ${(metrics.currentZoom * 100).toFixed(0)}%`);
      console.log('');
    }

    // Assert memory stays reasonable across zoom levels
    for (const result of results) {
      expect(result.metrics.canvasMemoryMB).toBeLessThan(100);
    }
  });

  test('Large document performance (827 pages)', async ({ page }) => {
    console.log('\n========== LARGE DOCUMENT PERFORMANCE ==========\n');

    const startTime = Date.now();
    await page.goto('http://localhost:9000/stress-test-large-pdf.html');
    await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 60000 });
    const loadTime = Date.now() - startTime;

    await page.waitForTimeout(3000); // Let it settle

    // Get initial metrics
    const initialMetrics = await getMemoryMetrics(page);
    const pageCount = await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-container') as any;
      return container?.pdfViewer?.pageCount || 0;
    });

    console.log(`Document Load Time: ${loadTime}ms`);
    console.log(`Page Count: ${pageCount}`);
    console.log(`Canvas Count: ${initialMetrics.canvasCount}`);
    console.log(`Canvas Memory: ${initialMetrics.canvasMemoryMB.toFixed(2)}MB`);
    console.log(`Tiles in Cache: ${initialMetrics.cacheSize}`);
    console.log(`Tiles Rendered: ${initialMetrics.tilesRendered}`);
    console.log(`Current Tier: ${initialMetrics.currentTier}`);

    // Scroll performance
    console.log(`\nScroll Performance:`);
    const scrollStart = Date.now();

    // Scroll through 20 pages
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => {
        const container = document.querySelector('.pdfagogo-pages-container');
        if (container) {
          container.scrollTop += 800;
        }
      });
      await page.waitForTimeout(100);
    }

    const scrollTime = Date.now() - scrollStart;
    console.log(`  20 Page Scroll: ${scrollTime}ms`);
    console.log(`  Avg per page: ${(scrollTime / 20).toFixed(2)}ms`);

    // Final memory check
    const finalMetrics = await getMemoryMetrics(page);

    console.log(`\nAfter Scrolling:`);
    console.log(`  Canvas Memory: ${finalMetrics.canvasMemoryMB.toFixed(2)}MB`);
    console.log(`  Tiles in Cache: ${finalMetrics.cacheSize}`);

    // Assertions
    expect(pageCount).toBe(827);
    expect(initialMetrics.canvasMemoryMB).toBeLessThan(50); // Should be very efficient
    expect(finalMetrics.canvasMemoryMB).toBeLessThan(50);
  });

  test('Scroll and zoom responsiveness', async ({ page }) => {
    await page.goto('http://localhost:9000/tests/test-small.html#pdf-page-1');
    await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 30000 });
    await page.click('.pdfagogo-container');
    await page.waitForTimeout(2000);

    console.log('\n========== SCROLL AND ZOOM RESPONSIVENESS ==========\n');

    // Measure scroll performance
    const scrollStart = Date.now();
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const container = document.querySelector('.pdfagogo-pages-container');
        if (container) {
          container.scrollTop += 500;
        }
      });
      await page.waitForTimeout(200);
    }
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const container = document.querySelector('.pdfagogo-pages-container');
        if (container) {
          container.scrollTop -= 500;
        }
      });
      await page.waitForTimeout(200);
    }
    const scrollDuration = Date.now() - scrollStart;

    // Measure zoom performance
    const zoomStart = Date.now();
    await page.keyboard.down('Control');
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);

    await page.keyboard.down('Control');
    await page.keyboard.press('Minus');
    await page.keyboard.press('Minus');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);

    await page.keyboard.down('Control');
    await page.keyboard.press('Digit0');
    await page.keyboard.up('Control');
    await page.waitForTimeout(500);
    const zoomDuration = Date.now() - zoomStart;

    const metrics = await getMemoryMetrics(page);

    console.log(`Scroll (10 operations): ${scrollDuration}ms`);
    console.log(`Zoom (in/out/reset): ${zoomDuration}ms`);
    console.log(`Final Memory: ${metrics.canvasMemoryMB.toFixed(2)}MB`);
    console.log(`Tiles in Cache: ${metrics.cacheSize}`);

    // Assertions - operations should complete in reasonable time
    expect(scrollDuration).toBeLessThan(5000);
    expect(zoomDuration).toBeLessThan(3000);
    expect(metrics.canvasMemoryMB).toBeLessThan(100);
  });
});
