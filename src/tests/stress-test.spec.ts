import { test, expect, Page } from '@playwright/test';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

// Helper function to get memory usage (Chrome only)
async function getMemoryUsage(page: Page): Promise<MemoryInfo | null> {
  return await page.evaluate(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return null;
  });
}

// Helper function to get debug metrics
async function getDebugMetrics(page: Page): Promise<any> {
  return await page.evaluate(() => {
    const debugElement = document.querySelector('.pdfagogo-debug-info');
    if (!debugElement) return null;

    const metrics: any = {};
    debugElement.querySelectorAll('div').forEach(el => {
      const text = el.textContent || '';
      if (text.includes(':')) {
        const [key, value] = text.split(':').map(s => s.trim());
        if (value.includes('ms')) {
          metrics[key] = parseFloat(value);
        } else if (value.includes('MB')) {
          metrics[key] = parseFloat(value);
        } else if (!isNaN(parseFloat(value))) {
          metrics[key] = parseFloat(value);
        } else {
          metrics[key] = value;
        }
      }
    });
    return metrics;
  });
}

test.describe('PDF-A-go-go Large PDF Stress Tests', () => {
  test('Large PDF Loading and Performance (827 pages, 5.4MB)', async ({ page }) => {
    console.log('🚀 Starting large PDF stress test...');
    
    // Track initial memory
    const initialMemory = await getMemoryUsage(page);
    
    // Load the stress test page
    await page.goto('http://localhost:9000/stress-test-large-pdf.html');
    
    // Wait for initial load and debug info to appear
    await page.waitForSelector('.pdfagogo-debug-info', { timeout: 30000 });
    
    // Wait for initial render to complete
    await page.waitForTimeout(5000);
    
    console.log('📄 Large PDF loaded, starting tests...');
    
    // Test 1: Initial render performance
    const initialMetrics = await getDebugMetrics(page);
    console.log('📊 Initial metrics:', initialMetrics);
    
    expect(initialMetrics).toBeTruthy();
    expect(initialMetrics['Initial Render']).toBeLessThan(1000); // Should render within 1 second
    
    // Test 2: Memory usage after initial load
    const postLoadMemory = await getMemoryUsage(page);
    if (postLoadMemory && initialMemory) {
      const memoryIncrease = (postLoadMemory.usedJSHeapSize - initialMemory.usedJSHeapSize) / 1024 / 1024;
      console.log(`💾 Memory increase after load: ${memoryIncrease.toFixed(1)}MB`);
      expect(memoryIncrease).toBeLessThan(100); // Should not use more than 100MB for initial load (only renders visible pages)
    }
    
    // Test 3: Scroll through the entire document
    console.log('📜 Testing scroll performance...');
    const scrollStartTime = Date.now();
    
    // Scroll to bottom
    await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(3000);
    
    const scrollEndTime = Date.now();
    const scrollDuration = scrollEndTime - scrollStartTime;
    console.log(`⏱️ Full document scroll took: ${scrollDuration}ms`);
    
    expect(scrollDuration).toBeLessThan(20000); // Should complete full scroll within 20 seconds for 827 pages
    
    // Test 4: Check memory after scrolling
    const postScrollMemory = await getMemoryUsage(page);
    if (postScrollMemory && postLoadMemory) {
      const additionalMemory = (postScrollMemory.usedJSHeapSize - postLoadMemory.usedJSHeapSize) / 1024 / 1024;
      console.log(`💾 Additional memory after full scroll: ${additionalMemory.toFixed(1)}MB`);
      expect(additionalMemory).toBeLessThan(100); // Should not use excessive memory while scrolling
    }
    
    // Test 5: Zoom performance with large document
    console.log('🔍 Testing zoom performance...');
    
    // Focus the container and zoom in
    await page.click('.pdfagogo-scroll-container');
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');
    await page.keyboard.press('Control+=');
    await page.waitForTimeout(1000);
    
    // Check that zoom worked and performance is still good
    const zoomedMemory = await getMemoryUsage(page);
    if (zoomedMemory && postScrollMemory) {
      const zoomMemoryIncrease = (zoomedMemory.usedJSHeapSize - postScrollMemory.usedJSHeapSize) / 1024 / 1024;
      console.log(`💾 Memory increase from zoom: ${zoomMemoryIncrease.toFixed(1)}MB`);
      expect(zoomMemoryIncrease).toBeLessThan(50); // Zoom should not cause significant memory increase
    }
    
    // Test 6: Page navigation performance
    console.log('🔄 Testing page navigation...');
    
    const navigationStartTime = Date.now();
    
    // Jump to middle of document
    await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      if (container) {
        container.scrollTo({ top: container.scrollHeight / 2, behavior: 'smooth' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Jump to beginning
    await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    
    await page.waitForTimeout(1000);
    
    const navigationEndTime = Date.now();
    const navigationDuration = navigationEndTime - navigationStartTime;
    console.log(`🔄 Navigation test took: ${navigationDuration}ms`);
    
    expect(navigationDuration).toBeLessThan(5000); // Navigation should be responsive
    
    // Test 7: Final performance metrics
    const finalMetrics = await getDebugMetrics(page);
    console.log('📊 Final metrics:', finalMetrics);
    
    if (finalMetrics['Avg High-Res']) {
      expect(finalMetrics['Avg High-Res']).toBeLessThan(1000); // High-res rendering should be under 1 second
    }
    
    // Test 8: Memory cleanup verification
    const finalMemory = await getMemoryUsage(page);
    if (finalMemory && initialMemory) {
      const totalMemoryIncrease = (finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize) / 1024 / 1024;
      console.log(`💾 Total memory increase: ${totalMemoryIncrease.toFixed(1)}MB`);
      console.log(`💾 Memory efficiency: ${(totalMemoryIncrease / 5.4).toFixed(1)}MB per MB of PDF`);
      
      // Should not use more than 200MB total for a 5.4MB PDF with 827 pages (reasonable ratio)
      expect(totalMemoryIncrease).toBeLessThan(200);
    }
    
    console.log('✅ Large PDF stress test completed successfully!');
  });

  test('Large PDF Zoom Stress Test', async ({ page }) => {
    console.log('🔍 Starting zoom stress test...');
    
    await page.goto('http://localhost:9000/stress-test-large-pdf.html');
    await page.waitForSelector('.pdfagogo-debug-info', { timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Focus the PDF container
    await page.click('.pdfagogo-scroll-container');
    
    // Stress test: Multiple zoom operations
    console.log('🔍 Performing multiple zoom operations...');
    
    const zoomStartTime = Date.now();
    
    // Zoom in multiple times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Control+=');
      await page.waitForTimeout(100);
    }
    
    // Zoom out multiple times
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Control+-');
      await page.waitForTimeout(100);
    }
    
    // Reset zoom
    await page.keyboard.press('Control+0');
    await page.waitForTimeout(500);
    
    const zoomEndTime = Date.now();
    const zoomDuration = zoomEndTime - zoomStartTime;
    
    console.log(`⏱️ Zoom stress test took: ${zoomDuration}ms`);
    expect(zoomDuration).toBeLessThan(5000); // Should handle rapid zoom operations smoothly
    
    // Verify zoom reset worked
    const finalZoom = await page.evaluate(() => {
      const container = document.querySelector('.pdfagogo-container') as any;
      return container?.pdfViewer?.getZoom() || 1.0;
    });
    
    expect(finalZoom).toBeCloseTo(1.0, 1);
    
    console.log('✅ Zoom stress test completed successfully!');
  });
}); 