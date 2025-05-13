import { test, expect, Page } from '@playwright/test';
import { cpus } from 'os';

interface DebugMetrics {
  'Initial Render': number;
  'Avg Low-Res': number;
  'Avg High-Res': number;
  [key: string]: number;
}

// Helper function to get debug metrics from the page
async function getDebugMetrics(page: Page): Promise<DebugMetrics | null> {
  return await page.evaluate(() => {
    const debugElement = document.querySelector('.pdfagogo-debug-info');
    if (!debugElement) return null;

    // Parse the timing values from the debug display
    const timings: Record<string, number> = {};
    debugElement.querySelectorAll('.timing').forEach(el => {
      const text = el.textContent || '';
      const [key, value] = text.split(': ');
      timings[key] = parseFloat(value);
    });

    return timings as DebugMetrics;
  });
}

// Helper function to get CPU usage
async function getCpuUsage(): Promise<number[]> {
  const cpuInfo = cpus();
  return cpuInfo.map(cpu => {
    const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
    const usage = 100 - (100 * cpu.times.idle) / total;
    return usage;
  });
}

// Helper function to track CPU usage
function startCpuTracking() {
  const cpuReadings: number[][] = [];
  const cpuInterval = setInterval(async () => {
    try {
      const usage = await getCpuUsage();
      cpuReadings.push(usage);
    } catch (error) {
      console.error('Error tracking CPU:', error);
    }
  }, 1000);

  return {
    cpuReadings,
    stopTracking: () => {
      clearInterval(cpuInterval);
      return cpuReadings;
    }
  };
}

// Helper function to measure scroll performance
async function measureScrollPerformance(page: Page, cpuTracker: ReturnType<typeof startCpuTracking>) {
  // Get the initial CPU readings count to calculate CPU during scroll
  const initialCpuReadingsCount = cpuTracker.cpuReadings.length;

  // Start timing
  const scrollStartTime = Date.now();

  // Perform scroll
  await page.evaluate(() => {
    const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
    if (container) {
      const scrollAmount = container.scrollWidth - container.clientWidth;
      container.scrollTo({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  });

  // Wait for scroll to complete (wait for scrollend event)
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const container = document.querySelector('.pdfagogo-scroll-container') as HTMLElement;
      let scrollTimeout: NodeJS.Timeout;

      const handleScrollEnd = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          container.removeEventListener('scroll', handleScrollEnd);
          resolve();
        }, 150); // Wait for scroll to settle
      };

      container.addEventListener('scroll', handleScrollEnd);
      handleScrollEnd(); // Initial check in case scroll doesn't occur
    });
  });

  // Calculate timing
  const scrollDuration = Date.now() - scrollStartTime;

  // Calculate CPU during scroll
  const scrollCpuReadings = cpuTracker.cpuReadings.slice(initialCpuReadingsCount);
  const avgScrollCpuUsage = scrollCpuReadings.length > 0
    ? scrollCpuReadings.reduce((acc, reading) =>
        acc + reading.reduce((sum, val) => sum + val, 0) / reading.length, 0
      ) / scrollCpuReadings.length
    : 0;

  return {
    duration: scrollDuration,
    avgCpuUsage: avgScrollCpuUsage
  };
}

test.describe('PDF-A-go-go Performance Tests', () => {
  test('Desktop Performance Test (HiDPI)', async ({ page }) => {
    // Set viewport to desktop size with HiDPI
    await page.setViewportSize({ width: 1280, height: 800 });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 2,
      mobile: false
    });

    // Start CPU tracking
    const cpuTracker = startCpuTracking();

    try {
      // Load the page
      await page.goto('http://localhost:9000/double-spread.html');

      // Wait for initial render to complete
      await page.waitForSelector('.pdfagogo-debug-info', { timeout: 10000 });

      // Get performance metrics after 5 seconds to allow for initial render and high-res upgrades
      await page.waitForTimeout(5000);
      const metrics = await getDebugMetrics(page);

      if (!metrics) {
        throw new Error('Failed to get debug metrics');
      }

      // Measure scroll performance
      console.log('\nMeasuring scroll performance...');
      const scrollMetrics = await measureScrollPerformance(page, cpuTracker);

      // Stop CPU tracking and get readings
      const cpuReadings = cpuTracker.stopTracking();

      // Calculate CPU statistics
      const avgCpuUsage = cpuReadings.reduce((acc, reading) =>
        acc + reading.reduce((sum, val) => sum + val, 0) / reading.length, 0
      ) / (cpuReadings.length || 1); // Avoid division by zero

      const peakCpuUsage = Math.max(...cpuReadings.map(reading =>
        Math.max(...reading)
      ));

      // Log all results
      console.log('Desktop Performance Results (HiDPI):');
      console.log('Initial Render Time:', metrics['Initial Render'], 'ms');
      console.log('Average Low-Res Render:', metrics['Avg Low-Res'], 'ms');
      console.log('Average High-Res Render:', metrics['Avg High-Res'], 'ms');
      console.log('Average CPU Usage:', avgCpuUsage.toFixed(2), '%');
      console.log('Peak CPU Usage:', peakCpuUsage.toFixed(2), '%');
      console.log('Scroll Duration:', scrollMetrics.duration, 'ms');
      console.log('Average CPU During Scroll:', scrollMetrics.avgCpuUsage.toFixed(2), '%');

      // Additional assertions for scroll performance
      expect(scrollMetrics.duration).toBeLessThan(2000); // Scroll should complete within 2 seconds
      expect(scrollMetrics.avgCpuUsage).toBeLessThan(85); // CPU during scroll should stay reasonable

      // Basic assertions
      expect(metrics['Initial Render']).toBeLessThan(5000); // 5 seconds max for initial render
      expect(avgCpuUsage).toBeLessThan(80); // CPU should not be constantly maxed
    } catch (error) {
      // Ensure CPU tracking is stopped even if test fails
      cpuTracker.stopTracking();
      throw error;
    } finally {
      // Reset device metrics
      await session.send('Emulation.clearDeviceMetricsOverride');
    }
  });

  test('Mobile Performance Test (Throttled CPU, HiDPI)', async ({ page }) => {
    // Set viewport to mobile size with HiDPI
    await page.setViewportSize({ width: 375, height: 667 });
    const session = await page.context().newCDPSession(page);

    // Set mobile HiDPI and CPU throttling
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 3, // Common mobile HiDPI ratio (e.g., iPhone)
      mobile: true
    });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    // Start CPU tracking
    const cpuTracker = startCpuTracking();

    try {
      // Load the page
      await page.goto('http://localhost:9000/double-spread.html');

      // Wait for initial render to complete with longer timeout for mobile
      await page.waitForSelector('.pdfagogo-debug-info', { timeout: 15000 });

      // Get performance metrics after 8 seconds (longer for mobile)
      await page.waitForTimeout(8000);
      const metrics = await getDebugMetrics(page);

      if (!metrics) {
        throw new Error('Failed to get debug metrics');
      }

      // Measure scroll performance
      console.log('\nMeasuring mobile scroll performance...');
      const scrollMetrics = await measureScrollPerformance(page, cpuTracker);

      // Stop CPU tracking and get readings
      const cpuReadings = cpuTracker.stopTracking();

      // Calculate CPU statistics
      const avgCpuUsage = cpuReadings.reduce((acc, reading) =>
        acc + reading.reduce((sum, val) => sum + val, 0) / reading.length, 0
      ) / (cpuReadings.length || 1); // Avoid division by zero

      const peakCpuUsage = Math.max(...cpuReadings.map(reading =>
        Math.max(...reading)
      ));

      // Log all results
      console.log('Mobile Performance Results (Throttled, HiDPI):');
      console.log('Initial Render Time:', metrics['Initial Render'], 'ms');
      console.log('Average Low-Res Render:', metrics['Avg Low-Res'], 'ms');
      console.log('Average High-Res Render:', metrics['Avg High-Res'], 'ms');
      console.log('Average CPU Usage:', avgCpuUsage.toFixed(2), '%');
      console.log('Peak CPU Usage:', peakCpuUsage.toFixed(2), '%');
      console.log('Scroll Duration:', scrollMetrics.duration, 'ms');
      console.log('Average CPU During Scroll:', scrollMetrics.avgCpuUsage.toFixed(2), '%');

      // More lenient assertions for mobile scroll performance
      expect(scrollMetrics.duration).toBeLessThan(3000); // Allow longer scroll time on mobile
      expect(scrollMetrics.avgCpuUsage).toBeLessThan(95); // Allow higher CPU usage during mobile scroll

      // Mobile-specific assertions (more lenient due to throttling)
      expect(metrics['Initial Render']).toBeLessThan(10000); // 10 seconds max for initial render on mobile
      expect(avgCpuUsage).toBeLessThan(90); // CPU threshold higher for mobile
    } catch (error) {
      // Ensure CPU tracking is stopped even if test fails
      cpuTracker.stopTracking();
      throw error;
    } finally {
      // Disable CPU throttling and reset device metrics after test
      await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await session.send('Emulation.clearDeviceMetricsOverride');
    }
  });
});