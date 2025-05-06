/**
 * Loads a PDF using PDF.js and provides progress updates.
 * @param {string} url - The URL of the PDF to load.
 * @param {(progress: number|null) => void} onProgress - Callback for progress updates (0-1 or null for indeterminate).
 * @returns {Promise<Object>} Resolves with the loaded PDF document.
 */
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export function loadPdfWithProgress(url, onProgress) {
  const loadingTask = pdfjsLib.getDocument(url);
  if (onProgress && loadingTask && loadingTask.onProgress !== undefined) {
    loadingTask.onProgress = function (progressData) {
      if (progressData && progressData.loaded && progressData.total) {
        onProgress(progressData.loaded / progressData.total);
      } else {
        onProgress(null); // Indeterminate
      }
    };
  }
  return loadingTask.promise;
} 