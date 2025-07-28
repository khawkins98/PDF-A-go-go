/**
 * @file PDF Loading Module with Progress Tracking and HTML Download Handling.
 *
 * This module provides sophisticated PDF loading capabilities that handle:
 * - Direct PDF file loading with progress tracking
 * - HTML redirect page detection and handling (for institutional repositories)
 * - Content type detection and automatic routing
 * - Error handling and timeout management
 * - Integration with PDF.js for document processing
 *
 * The module automatically detects when a URL returns HTML content instead of
 * a PDF and uses the HTMLDownloadHandler to extract the actual PDF URL from
 * meta refresh tags or download links.
 *
 * @author PDF-A-go-go Contributors
 * @version 1.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

/**
 * Loads a PDF using PDF.js and provides progress updates.
 * @param {string} url - The URL of the PDF to load.
 * @param {(progress: number|null) => void} onProgress - Callback for progress updates (0-1 or null for indeterminate).
 * @param {Object} options - Additional options for loading
 * @param {HTMLElement} options.container - Container element for HTML download handling
 * @param {number} options.downloadTimeout - Timeout for HTML download handling
 * @returns {Promise<Object>} Resolves with the loaded PDF document.
 */
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs";
import { HTMLDownloadHandler } from "./htmlDownloadHandler.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Loads a PDF using PDF.js with comprehensive progress tracking and HTML handling.
 *
 * This function provides intelligent PDF loading that can handle various scenarios:
 * - Direct PDF URLs with standard HTTP responses
 * - HTML pages that redirect to PDFs (common in academic/institutional repositories)
 * - Progress tracking for both determinate and indeterminate loading states
 * - Automatic content type detection and appropriate handling
 * - Timeout management for HTML download scenarios
 *
 * The function first checks the content type of the response. If it detects HTML
 * content, it uses the HTMLDownloadHandler to extract the actual PDF URL and
 * download the file. Otherwise, it loads the PDF directly with PDF.js.
 *
 * @param {string} url - The URL of the PDF to load (may be direct PDF or HTML redirect)
 * @param {Function} onProgress - Callback for progress updates
 * @param {number|null} onProgress.progress - Progress value (0-1) or null for indeterminate
 * @param {Object} [options={}] - Additional loading options
 * @param {HTMLElement} [options.container] - Container element for HTML download handling
 * @param {number} [options.downloadTimeout=30000] - Timeout in milliseconds for HTML downloads
 * @returns {Promise<Object>} Promise that resolves with the loaded PDF.js document
 *
 * @throws {Error} When container is required but not provided for HTML downloads
 * @throws {Error} When PDF loading fails due to network, parsing, or timeout issues
 *
 * @example
 * // Basic PDF loading with progress
 * const progressBar = document.querySelector('#progress');
 *
 * loadPdfWithProgress(
 *   './document.pdf',
 *   (progress) => {
 *     if (progress !== null) {
 *       progressBar.value = progress;
 *       console.log(`Loading: ${Math.round(progress * 100)}%`);
 *     } else {
 *       console.log('Loading... (progress unknown)');
 *     }
 *   }
 * ).then(pdf => {
 *   console.log(`PDF loaded successfully: ${pdf.numPages} pages`);
 * }).catch(error => {
 *   console.error('Failed to load PDF:', error);
 * });
 *
 * @example
 * // Loading with HTML download handling (institutional repository)
 * loadPdfWithProgress(
 *   'https://repository.example.edu/download/12345',
 *   (progress) => updateProgressBar(progress),
 *   {
 *     container: document.getElementById('pdf-container'),
 *     downloadTimeout: 45000 // 45 second timeout
 *   }
 * ).then(pdf => {
 *   initializePdfViewer(pdf);
 * });
 *
 * @example
 * // Handling different content types automatically
 * const urls = [
 *   './direct-pdf.pdf',                    // Direct PDF
 *   'https://repo.edu/paper/123',          // HTML redirect
 *   'https://example.com/doc.pdf'          // Direct PDF with different domain
 * ];
 *
 * for (const url of urls) {
 *   try {
 *     const pdf = await loadPdfWithProgress(url, updateProgress, { container });
 *     console.log(`Loaded ${url}: ${pdf.numPages} pages`);
 *   } catch (error) {
 *     console.error(`Failed to load ${url}:`, error.message);
 *   }
 * }
 */
export async function loadPdfWithProgress(url, onProgress, options = {}) {
  try {
    // First try to fetch the URL to check its content type
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');

    // If it's HTML content, handle it with HTMLDownloadHandler
    if (contentType && contentType.includes('text/html')) {
      if (!options.container) {
        throw new Error('Container element is required for HTML download handling');
      }

      const handler = new HTMLDownloadHandler({
        downloadTimeout: options.downloadTimeout
      });
      handler.initialize(options.container);

      // Get the PDF blob from the handler
      const pdfBlob = await handler.handleHTMLDownload(url);

      // Create a URL from the blob
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Load the PDF with PDF.js
      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      if (onProgress && loadingTask.onProgress !== undefined) {
        loadingTask.onProgress = function (progressData) {
          if (progressData && progressData.loaded && progressData.total) {
            onProgress(progressData.loaded / progressData.total);
          } else {
            onProgress(null); // Indeterminate
          }
        };
      }

      try {
        const pdf = await loadingTask.promise;
        return pdf;
      } finally {
        // Clean up the blob URL
        URL.revokeObjectURL(pdfUrl);
      }
    }

    // If it's a PDF or other content, load directly with PDF.js
    const loadingTask = pdfjsLib.getDocument(url);
    if (onProgress && loadingTask.onProgress !== undefined) {
      loadingTask.onProgress = function (progressData) {
        if (progressData && progressData.loaded && progressData.total) {
          onProgress(progressData.loaded / progressData.total);
        } else {
          onProgress(null); // Indeterminate
        }
      };
    }
    return loadingTask.promise;
  } catch (error) {
    console.error('Error loading PDF:', error);
    throw error;
  }
}