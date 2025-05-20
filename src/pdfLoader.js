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