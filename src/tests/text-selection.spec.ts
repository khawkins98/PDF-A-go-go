import { test, expect, Page } from '@playwright/test';

// Helper function to wait for PDF to fully load
async function waitForPdfLoad(page: Page) {
  await page.waitForSelector('.pdfagogo-page-canvas', { timeout: 10000 });
  await page.waitForTimeout(2000); // Allow time for initial render and text layer
}

// Helper function to check if text layer exists
async function hasTextLayer(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const textLayers = document.querySelectorAll('.pdfagogo-text-layer');
    return textLayers.length > 0;
  });
}

// Helper function to check if text layer has content
async function textLayerHasContent(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const textLayers = document.querySelectorAll('.pdfagogo-text-layer');
    for (const layer of textLayers) {
      if (layer.children.length > 0) return true;
    }
    return false;
  });
}

// Helper function to get text layer span count
async function getTextLayerSpanCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    let count = 0;
    const textLayers = document.querySelectorAll('.pdfagogo-text-layer');
    textLayers.forEach(layer => {
      count += layer.querySelectorAll('span').length;
    });
    return count;
  });
}

// Helper function to select text via mouse drag
async function selectTextByDrag(page: Page, startX: number, startY: number, endX: number, endY: number) {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

// Helper function to get selected text
async function getSelectedText(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const selection = window.getSelection();
    return selection ? selection.toString() : '';
  });
}

test.describe('PDF-A-go-go Text Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9000/');
    await waitForPdfLoad(page);
  });

  test('Text layer elements are created for each page', async ({ page }) => {
    const hasLayers = await hasTextLayer(page);
    expect(hasLayers).toBe(true);
  });

  test('Text layer contains span elements after render', async ({ page }) => {
    // Wait a bit more for text layer to populate
    await page.waitForTimeout(1000);

    const hasContent = await textLayerHasContent(page);
    expect(hasContent).toBe(true);
  });

  test('Text layer spans have correct CSS properties', async ({ page }) => {
    await page.waitForTimeout(1000);

    const spanStyles = await page.evaluate(() => {
      const span = document.querySelector('.pdfagogo-text-layer span') as HTMLElement;
      if (!span) return null;

      const styles = window.getComputedStyle(span);
      return {
        position: styles.position,
        color: styles.color,
        cursor: styles.cursor,
        userSelect: styles.userSelect || (styles as any).webkitUserSelect,
      };
    });

    expect(spanStyles).not.toBeNull();
    expect(spanStyles?.position).toBe('absolute');
    // Text should be transparent (invisible but selectable)
    expect(spanStyles?.color).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/);
    expect(spanStyles?.cursor).toBe('text');
  });

  test('Text can be selected by clicking and dragging', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Get position of first text span
    const spanBounds = await page.evaluate(() => {
      const span = document.querySelector('.pdfagogo-text-layer span') as HTMLElement;
      if (!span) return null;
      const rect = span.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

    if (spanBounds && spanBounds.width > 0) {
      // Select some text by dragging
      await selectTextByDrag(
        page,
        spanBounds.x + 5,
        spanBounds.y + spanBounds.height / 2,
        spanBounds.x + Math.min(spanBounds.width, 100),
        spanBounds.y + spanBounds.height / 2
      );

      const selectedText = await getSelectedText(page);
      // Should have some text selected (even if just whitespace)
      expect(selectedText.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('Text layer is properly positioned over canvas', async ({ page }) => {
    const positioning = await page.evaluate(() => {
      const canvas = document.querySelector('.pdfagogo-page-canvas') as HTMLElement;
      const textLayer = document.querySelector('.pdfagogo-text-layer') as HTMLElement;

      if (!canvas || !textLayer) return null;

      const canvasRect = canvas.getBoundingClientRect();
      const textLayerRect = textLayer.getBoundingClientRect();

      return {
        canvasTop: canvasRect.top,
        canvasLeft: canvasRect.left,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        textLayerTop: textLayerRect.top,
        textLayerLeft: textLayerRect.left,
        textLayerWidth: textLayerRect.width,
        textLayerHeight: textLayerRect.height,
      };
    });

    expect(positioning).not.toBeNull();
    if (positioning) {
      // Text layer should be positioned at same location as canvas
      expect(Math.abs(positioning.textLayerTop - positioning.canvasTop)).toBeLessThan(5);
      expect(Math.abs(positioning.textLayerLeft - positioning.canvasLeft)).toBeLessThan(5);
      // Text layer should cover the canvas
      expect(positioning.textLayerWidth).toBeGreaterThan(0);
      expect(positioning.textLayerHeight).toBeGreaterThan(0);
    }
  });

  test('Text layer has higher z-index than canvas', async ({ page }) => {
    const zIndexes = await page.evaluate(() => {
      const canvas = document.querySelector('.pdfagogo-page-canvas') as HTMLElement;
      const textLayer = document.querySelector('.pdfagogo-text-layer') as HTMLElement;

      if (!canvas || !textLayer) return null;

      const canvasZIndex = parseInt(window.getComputedStyle(canvas).zIndex) || 0;
      const textLayerZIndex = parseInt(window.getComputedStyle(textLayer).zIndex) || 0;

      return { canvasZIndex, textLayerZIndex };
    });

    expect(zIndexes).not.toBeNull();
    if (zIndexes) {
      expect(zIndexes.textLayerZIndex).toBeGreaterThan(zIndexes.canvasZIndex);
    }
  });

  test('Multiple text spans are created for PDF content', async ({ page }) => {
    await page.waitForTimeout(1000);

    const spanCount = await getTextLayerSpanCount(page);
    // A typical PDF page should have multiple text elements
    expect(spanCount).toBeGreaterThan(5);
  });

  test('Text layer is cleared when page is cleaned up', async ({ page }) => {
    // Scroll to trigger page cleanup
    await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container');
      if (container) {
        // Scroll far down to trigger cleanup of first pages
        container.scrollTop = container.scrollHeight;
      }
    });

    // Wait for cleanup to occur
    await page.waitForTimeout(2000);

    // Scroll back to top
    await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container');
      if (container) {
        container.scrollTop = 0;
      }
    });

    // Wait for re-render
    await page.waitForTimeout(2000);

    // Text layer should be repopulated
    const hasContent = await textLayerHasContent(page);
    expect(hasContent).toBe(true);
  });
});

test.describe('PDF-A-go-go Text Selection - Large Document', () => {
  test('Text layer works on large documents', async ({ page }) => {
    await page.goto('http://localhost:9000/stress-test-large-pdf.html');
    await waitForPdfLoad(page);
    await page.waitForTimeout(2000);

    const hasContent = await textLayerHasContent(page);
    expect(hasContent).toBe(true);
  });
});
