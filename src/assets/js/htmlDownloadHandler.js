/**
 * @file HTML Download Handler for PDF-A-go-go.
 * 
 * This module provides sophisticated handling for URLs that return HTML pages instead of
 * direct PDF downloads. It's commonly used for institutional repositories, academic
 * websites, and document management systems that use HTML redirect pages or meta refresh
 * tags to initiate PDF downloads.
 * 
 * Key capabilities:
 * - Automatic detection of meta refresh redirects
 * - Iframe-based safe URL checking and content type detection
 * - Timeout management for download operations
 * - Support for authenticated downloads with cookie preservation
 * - Cross-origin request handling with proper security measures
 * 
 * The handler uses a proxy iframe system to safely intercept redirects and extract
 * the actual PDF URLs without triggering browser navigation or security restrictions.
 * 
 * @author PDF-A-go-go Contributors
 * @version 1.0.0
 * @see {@link https://github.com/khawkins98/PDF-A-go-go|GitHub Repository}
 */

/**
 * HTML Download Handler class for managing PDF downloads from HTML redirect pages.
 * 
 * This class extends EventTarget to provide event-driven download handling for scenarios
 * where PDF URLs initially return HTML content that redirects to the actual PDF file.
 * Common use cases include institutional repositories, academic paper downloads, and
 * document management systems.
 * 
 * The handler implements a sophisticated proxy iframe system that:
 * - Safely loads HTML content without affecting the main page
 * - Parses meta refresh tags to extract redirect URLs
 * - Performs content type checking before downloading
 * - Handles authentication and cookies properly
 * - Provides timeout management for slow or failed downloads
 * 
 * @class HTMLDownloadHandler
 * @extends EventTarget
 * 
 * @example
 * // Basic usage for institutional repository
 * const handler = new HTMLDownloadHandler({
 *   downloadTimeout: 30000
 * });
 * 
 * handler.initialize(containerElement);
 * 
 * try {
 *   const pdfBlob = await handler.handleHTMLDownload(
 *     'https://repository.example.edu/download/12345'
 *   );
 *   console.log('PDF downloaded successfully:', pdfBlob.size, 'bytes');
 * } catch (error) {
 *   console.error('Download failed:', error.message);
 * }
 * 
 * @example
 * // Advanced usage with event handling
 * const handler = new HTMLDownloadHandler({
 *   downloadTimeout: 45000
 * });
 * 
 * handler.addEventListener('progress', (event) => {
 *   console.log('Download progress:', event.detail);
 * });
 * 
 * handler.addEventListener('redirect', (event) => {
 *   console.log('Redirect detected:', event.detail.url);
 * });
 * 
 * handler.initialize(document.getElementById('pdf-container'));
 * const pdfBlob = await handler.handleHTMLDownload(htmlUrl);
 */
export class HTMLDownloadHandler extends EventTarget {
  /**
   * Create a new HTMLDownloadHandler instance.
   * 
   * @param {Object} [options={}] - Configuration options for the handler
   * @param {number} [options.downloadTimeout=30000] - Timeout in milliseconds for download operations
   * @param {boolean} [options.enableLogging=false] - Enable detailed console logging for debugging
   * @param {boolean} [options.preserveCookies=true] - Include cookies in download requests for authentication
   * 
   * @constructor
   * @example
   * // Basic handler with default 30-second timeout
   * const handler = new HTMLDownloadHandler();
   * 
   * @example
   * // Handler with custom timeout and logging
   * const handler = new HTMLDownloadHandler({
   *   downloadTimeout: 60000,  // 60 seconds
   *   enableLogging: true,
   *   preserveCookies: true
   * });
   */
  constructor(options = {}) {
    super();
    
    /** @type {Object} Configuration options for the handler */
    this.options = options;
    
    /** @type {HTMLIFrameElement|null} The iframe element used for HTML content loading */
    this.iframe = null;
    
    /** @type {HTMLElement|null} The container element for rendering iframes */
    this.container = null;
    
    /** @type {number} Timeout in milliseconds for download operations */
    this.downloadTimeout = options.downloadTimeout || 30000;
    
    /** @type {boolean} Whether to enable detailed console logging */
    this.enableLogging = options.enableLogging || false;
    
    /** @type {boolean} Whether to preserve cookies for authenticated downloads */
    this.preserveCookies = options.preserveCookies !== false;
  }

  /**
   * Initialize the handler with a container element for iframe rendering.
   * 
   * This method prepares the container for iframe-based download handling by setting
   * the appropriate CSS positioning. The container will be used to render hidden
   * iframes that load and analyze HTML content.
   * 
   * @param {HTMLElement} container - The container element to render iframes in
   * @throws {Error} When container is null or not an HTMLElement
   * 
   * @example
   * // Initialize with existing container
   * const container = document.getElementById('pdf-viewer');
   * handler.initialize(container);
   * 
   * @example
   * // Initialize with dynamically created container
   * const container = document.createElement('div');
   * container.style.display = 'none';
   * document.body.appendChild(container);
   * handler.initialize(container);
   */
  initialize(container) {
    if (!container || !(container instanceof HTMLElement)) {
      throw new Error('Container must be a valid HTMLElement');
    }
    
    this.container = container;
    this.container.style.position = 'relative';
    
    if (this.enableLogging) {
      console.log('[HTMLDownloadHandler] Initialized with container:', container);
    }
  }

  /**
   * Handle a URL that returns HTML content instead of a direct PDF download.
   * 
   * This method implements a sophisticated multi-step process to extract and download
   * the actual PDF from HTML redirect pages:
   * 
   * 1. Creates a proxy iframe system for safe content analysis
   * 2. Loads the HTML content and parses meta refresh tags
   * 3. Extracts potential PDF URLs from redirects and links
   * 4. Validates content types before downloading
   * 5. Downloads the PDF blob with proper authentication
   * 6. Cleans up all temporary DOM elements
   * 
   * The method handles various redirect mechanisms including:
   * - Meta refresh tags with delays
   * - JavaScript-based redirects
   * - Direct download links
   * - Authenticated download endpoints
   * 
   * @param {string} url - The URL that returned HTML instead of PDF content
   * @returns {Promise<Blob>} Promise that resolves with the downloaded PDF blob
   * @throws {Error} When container is not initialized
   * @throws {Error} When download timeout is exceeded
   * @throws {Error} When no PDF redirect is detected
   * @throws {Error} When PDF download fails or returns invalid content
   * 
   * @example
   * // Handle institutional repository URL
   * try {
   *   const pdfBlob = await handler.handleHTMLDownload(
   *     'https://repository.university.edu/handle/123456789/12345'
   *   );
   *   
   *   // Create download link for user
   *   const downloadUrl = URL.createObjectURL(pdfBlob);
   *   const link = document.createElement('a');
   *   link.href = downloadUrl;
   *   link.download = 'document.pdf';
   *   link.click();
   *   URL.revokeObjectURL(downloadUrl);
   * } catch (error) {
   *   console.error('Failed to download PDF:', error.message);
   * }
   * 
   * @example
   * // Handle with progress monitoring
   * const progressHandler = (event) => {
   *   console.log(`Download progress: ${event.detail.loaded}/${event.detail.total}`);
   * };
   * 
   * handler.addEventListener('progress', progressHandler);
   * 
   * try {
   *   const pdfBlob = await handler.handleHTMLDownload(htmlUrl);
   *   console.log('Download complete:', pdfBlob.size, 'bytes');
   * } finally {
   *   handler.removeEventListener('progress', progressHandler);
   * }
   */
  async handleHTMLDownload(url) {
    if (!this.container) {
      throw new Error('Handler must be initialized with a container before use');
    }
    
    if (this.enableLogging) {
      console.log('[HTMLDownloadHandler] Starting HTML download handling for:', url);
    }
    
    return new Promise((resolve, reject) => {
      // Set up timeout for the entire download process
      const downloadTimeout = setTimeout(() => {
        this.cleanup();
        reject(new Error(`Download timeout after ${this.downloadTimeout}ms - no redirect detected`));
      }, this.downloadTimeout);

      /**
       * Check a URL for PDF content and download if valid.
       * 
       * This internal function performs content type validation before attempting
       * to download, preventing unnecessary downloads of non-PDF content.
       * 
       * @param {string} urlToCheck - The URL to validate and potentially download
       * @returns {Promise<boolean>} True if URL was a PDF and download succeeded
       * @private
       */
      const checkUrlAndDownload = async (urlToCheck) => {
        if (this.enableLogging) {
          console.log('[HTMLDownloadHandler] Checking URL:', urlToCheck);
        }
        
        try {
          // Perform HEAD request to check content type without downloading full content
          const headResponse = await fetch(urlToCheck, {
            method: 'HEAD',
            credentials: this.preserveCookies ? 'include' : 'omit'
          });
          
          const contentType = headResponse.headers.get('content-type');
          if (this.enableLogging) {
            console.log('[HTMLDownloadHandler] Content type:', contentType);
          }

          // Check if content type indicates PDF
          if (contentType && contentType.toLowerCase().includes('pdf')) {
            clearTimeout(downloadTimeout);
            this.downloadPDF(urlToCheck).then(resolve).catch(reject);
            return true;
          }
        } catch (error) {
          if (this.enableLogging) {
            console.log('[HTMLDownloadHandler] HEAD request failed, will try direct download:', error);
          }
        }
        return false;
      };

      // Create a proxy iframe that will intercept redirects
      const proxyFrame = document.createElement('iframe');
      proxyFrame.style.display = 'none';
      document.body.appendChild(proxyFrame);

      // Write content to the proxy iframe that will help us detect redirects
      const proxyContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <script>
            // Function to check if a string might be a PDF URL
            function mightBePdfUrl(url) {
              return url.toLowerCase().endsWith('.pdf') ||
                     url.toLowerCase().includes('/pdf/') ||
                     url.toLowerCase().includes('download') ||
                     url.toLowerCase().includes('document');
            }

            /**
             * Parses the content attribute of a meta refresh tag to extract the delay and URL.
             * This function uses a simple string split approach for robustness.
             *
             * Handles common meta refresh formats, for example:
             *   "5; url=http://example.com/file.pdf"
             *   "0;URL='/file.pdf'"
             *   "3; url=\"/path/to/file.pdf?foo=bar\""
             *
             * @param {string} content - The content attribute from a meta refresh tag.
             * @returns {{delay: number, url: string}|null} An object with the delay (in seconds) and the URL, or null if parsing fails.
             */
            function parseMetaRefresh(content) {
              // Return null if content is empty or undefined
              if (!content) return null;

              // Split the content string on semicolons
              const parts = content.split(';');
              if (parts.length < 2) return null;

              // The first part should be the delay in seconds (e.g., "5")
              const delay = parseInt(parts[0].trim(), 10) || 0;

              // The rest (joined in case the URL contains semicolons) should contain "url="
              // This allows for URLs with semicolons in query strings or fragments
              const urlPart = parts.slice(1).join(';').trim();

              // Extract the URL after "url=", allowing for optional quotes and whitespace
              // Example matches: url=http://..., url='/file.pdf', url="file.pdf"
              const urlMatch = urlPart.match(/url\s*=\s*['"]?([^'"]+)['"]?/i);
              if (!urlMatch) return null;

              // The actual URL, trimmed of whitespace
              const url = urlMatch[1].trim();

              // Return the delay and URL as an object
              return { delay, url };
            }

            /**
             * Scans the content of the iframe for meta refresh tags and, if found,
             * extracts the delay and URL, removes the meta tag to prevent native redirect,
             * and posts a message to the parent after the specified delay.
             */
            function checkMetaRefresh() {
              const frame = document.getElementById('contentFrame');
              if (!frame || !frame.contentDocument) return;

              const metaTags = frame.contentDocument.getElementsByTagName('meta');
              for (const meta of metaTags) {
                if (meta.httpEquiv && meta.httpEquiv.toLowerCase() === 'refresh') {
                  const result = parseMetaRefresh(meta.content);
                  console.log('metaRefresh', result, meta);
                  if (result && result.url) {
                    // Convert relative URL to absolute using a temporary anchor element
                    const link = document.createElement('a');
                    link.href = result.url;

                    // Remove the meta refresh tag to prevent the browser from performing a native redirect
                    meta.parentNode.removeChild(meta);

                    // Wait for the specified delay before notifying the parent window
                    setTimeout(() => {
                      window.parent.postMessage({
                        type: 'potentialPdfUrl',
                        url: link.href,
                        source: 'metaRefresh'
                      }, '*');
                    }, result.delay * 1000); // delay is in seconds
                  }
                }
              }
            }

            // Set up message handler
            window.addEventListener('message', function(event) {
              if (event.data.type === 'checkUrl') {
                var link = document.createElement('a');
                link.href = event.data.url;

                // If it might be a PDF URL, send it back to parent
                if (mightBePdfUrl(link.href)) {
                  window.parent.postMessage({
                    type: 'potentialPdfUrl',
                    url: link.href
                  }, '*');
                }

                // Get the content frame and set up load handler
                const frame = document.getElementById('contentFrame');
                if (frame) {
                  frame.onload = checkMetaRefresh;
                  frame.src = event.data.url;
                }
              }
            });

            // Intercept all link clicks
            document.addEventListener('click', function(e) {
              if (e.target.tagName === 'A') {
                e.preventDefault();
                window.parent.postMessage({
                  type: 'potentialPdfUrl',
                  url: e.target.href
                }, '*');
              }
            }, true);
          </script>
        </head>
        <body>
          <iframe id="contentFrame" style="width:100%;height:100%;border:none;"></iframe>
        </body>
        </html>
      `;
      proxyFrame.contentDocument.write(proxyContent);
      proxyFrame.contentDocument.close();

      // Listen for messages from the proxy iframe
      const messageHandler = async (event) => {
        console.log('messageHandler', event.data);
        if (event.data.type === 'potentialPdfUrl') {
            console.log('potentialPdfUrl', event.data.url, event.data.source);
          const isPdf = await checkUrlAndDownload(event.data.url);
          if (isPdf) {
            window.removeEventListener('message', messageHandler);
            proxyFrame.remove();
          }
        }
      };
      window.addEventListener('message', messageHandler);

      // Create the main iframe
      this.iframe = document.createElement('iframe');
      this.iframe.className = 'pdfagogo-html-iframe';
      this.iframe.src = url;

      // When the main iframe loads, have the proxy check its URL
      this.iframe.onload = () => {
        try {
          proxyFrame.contentWindow.postMessage({
            type: 'checkUrl',
            url: this.iframe.src
          }, '*');
        } catch (e) {
          console.log('Error checking iframe URL:', e);
        }
      };

      this.container.appendChild(this.iframe);
    });
  }

  /**
   * Download a PDF from a validated URL.
   * 
   * This method performs the actual PDF download after URL validation. It handles
   * authentication by preserving cookies and validates the downloaded content to
   * ensure it's actually a PDF file.
   * 
   * @param {string} url - The validated PDF URL to download
   * @returns {Promise<Blob>} Promise that resolves with the PDF blob
   * @throws {Error} When the HTTP request fails
   * @throws {Error} When the downloaded content is not a PDF
   * 
   * @example
   * // Direct PDF download (typically called internally)
   * try {
   *   const pdfBlob = await handler.downloadPDF('https://example.com/document.pdf');
   *   console.log('Downloaded PDF:', pdfBlob.size, 'bytes');
   * } catch (error) {
   *   console.error('Download failed:', error.message);
   * }
   * 
   * @private
   */
  async downloadPDF(url) {
    if (this.enableLogging) {
      console.log('[HTMLDownloadHandler] Downloading PDF from:', url);
    }
    
    try {
      const response = await fetch(url, {
        credentials: this.preserveCookies ? 'include' : 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`PDF download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      
      if (this.enableLogging) {
        console.log('[HTMLDownloadHandler] Downloaded blob:', blob.size, 'bytes, type:', blob.type);
      }
      
      // Validate that the downloaded content is actually a PDF
      if (!blob.type.includes('pdf') && blob.size > 0) {
        // Additional validation: check if blob starts with PDF signature
        const arrayBuffer = await blob.slice(0, 4).arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const signature = String.fromCharCode(...uint8Array);
        
        if (!signature.startsWith('%PDF')) {
          throw new Error(`Downloaded file is not a PDF (type: ${blob.type}, signature: ${signature})`);
        }
      }

      this.cleanup();
      return blob;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Clean up all DOM elements created by the handler.
   * 
   * This method removes all iframes and loading indicators created during the
   * download process. It should be called after successful downloads or when
   * errors occur to prevent memory leaks and DOM pollution.
   * 
   * @example
   * // Manual cleanup (usually called automatically)
   * handler.cleanup();
   * 
   * @example
   * // Cleanup in error handling
   * try {
   *   const pdf = await handler.handleHTMLDownload(url);
   * } catch (error) {
   *   handler.cleanup(); // Ensure cleanup on error
   *   throw error;
   * }
   */
  cleanup() {
    // Remove main iframe if it exists
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
    
    // Remove any loading indicators
    if (this.container) {
      const loadingDiv = this.container.querySelector('.pdfagogo-html-loading');
      if (loadingDiv && loadingDiv.parentNode) {
        loadingDiv.parentNode.removeChild(loadingDiv);
      }
    }
    
    // Remove any proxy iframes that might still exist
    const proxyFrames = document.querySelectorAll('iframe[data-pdfagogo-proxy]');
    proxyFrames.forEach(frame => {
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
      }
    });
    
    if (this.enableLogging) {
      console.log('[HTMLDownloadHandler] Cleanup completed');
    }
  }

  /**
   * Parse meta refresh content to extract delay and URL.
   * 
   * This static utility method parses the content attribute of HTML meta refresh tags
   * to extract the delay time and redirect URL. It handles various formats commonly
   * used in institutional repositories and document management systems.
   * 
   * Supported formats:
   * - "5; url=http://example.com/file.pdf"
   * - "0;URL='/file.pdf'"
   * - "3; url=\"/path/to/file.pdf?foo=bar\""
   * - "10;url='https://example.com/doc.pdf'"
   * 
   * @param {string} content - The content attribute from a meta refresh tag
   * @returns {{delay: number, url: string}|null} Object with delay (seconds) and URL, or null if parsing fails
   * 
   * @example
   * // Parse standard meta refresh
   * const result = HTMLDownloadHandler.parseMetaRefresh('5; url=http://example.com/doc.pdf');
   * console.log(result); // { delay: 5, url: 'http://example.com/doc.pdf' }
   * 
   * @example
   * // Parse with quotes and complex URL
   * const result = HTMLDownloadHandler.parseMetaRefresh('0; url="/download?id=123&format=pdf"');
   * console.log(result); // { delay: 0, url: '/download?id=123&format=pdf' }
   * 
   * @static
   */
  static parseMetaRefresh(content) {
    // Return null if content is empty or undefined
    if (!content) return null;

    // Split the content string on semicolons
    const parts = content.split(';');
    if (parts.length < 2) return null;

    // The first part should be the delay in seconds (e.g., "5")
    const delay = parseInt(parts[0].trim(), 10) || 0;

    // The rest (joined in case the URL contains semicolons) should contain "url="
    // This allows for URLs with semicolons in query strings or fragments
    const urlPart = parts.slice(1).join(';').trim();

    // Extract the URL after "url=", allowing for optional quotes and whitespace
    // Example matches: url=http://..., url='/file.pdf', url="file.pdf"
    const urlMatch = urlPart.match(/url\s*=\s*['"]?([^'"]+)['"]?/i);
    if (!urlMatch) return null;

    // The actual URL, trimmed of whitespace
    const url = urlMatch[1].trim();

    // Return the delay and URL as an object
    return { delay, url };
  }

  /**
   * Check if a URL might be a PDF based on common patterns.
   * 
   * This static utility method performs heuristic analysis of URLs to determine
   * if they're likely to point to PDF files. It's used to prioritize which URLs
   * to check during the redirect analysis process.
   * 
   * @param {string} url - The URL to analyze
   * @returns {boolean} True if the URL appears to be a PDF link
   * 
   * @example
   * // Direct PDF file
   * HTMLDownloadHandler.mightBePdfUrl('https://example.com/document.pdf'); // true
   * 
   * @example
   * // Download endpoint
   * HTMLDownloadHandler.mightBePdfUrl('https://repo.edu/download/12345'); // true
   * 
   * @example
   * // Regular web page
   * HTMLDownloadHandler.mightBePdfUrl('https://example.com/about.html'); // false
   * 
   * @static
   */
  static mightBePdfUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.pdf') ||
           lowerUrl.includes('/pdf/') ||
           lowerUrl.includes('download') ||
           lowerUrl.includes('document') ||
           lowerUrl.includes('attachment') ||
           lowerUrl.includes('file');
  }
}