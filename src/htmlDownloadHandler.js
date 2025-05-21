/**
 * HTMLDownloadHandler - Handles cases where a PDF download URL initially returns an HTML page
 * that triggers the actual PDF download.
 */
export class HTMLDownloadHandler extends EventTarget {
  constructor(options = {}) {
    super();
    this.options = options;
    this.iframe = null;
    this.container = null;
    this.downloadTimeout = options.downloadTimeout || 30000; // 30 second timeout by default
  }

  /**
   * Initialize the handler with a container element
   * @param {HTMLElement} container - The container element to render the iframe in
   */
  initialize(container) {
    this.container = container;
    this.container.style.position = 'relative';
  }

  /**
   * Handle a URL that returns HTML instead of a PDF
   * @param {string} url - The URL that returned HTML
   * @returns {Promise<Blob>} - Promise that resolves with the downloaded PDF blob
   */
  async handleHTMLDownload(url) {
    return new Promise((resolve, reject) => {
      // Create loading indicator
      // const loadingDiv = document.createElement('div');
      // loadingDiv.className = 'pdfagogo-html-loading';
      // loadingDiv.innerHTML = `
      //   <div class="pdfagogo-html-loading-content">
      //     <div class="pdfagogo-html-loading-spinner"></div>
      //     <div class="pdfagogo-html-loading-text">
      //       Preparing document...
      //     </div>
      //   </div>
      // `;
      // this.container.appendChild(loadingDiv);

      // Set up timeout
      const downloadTimeout = setTimeout(() => {
        this.cleanup();
        reject(new Error('Download timeout - no redirect detected'));
      }, this.downloadTimeout);

      // Function to check a URL and download if it's a PDF
      const checkUrlAndDownload = async (urlToCheck) => {
        console.log('Checking URL:', urlToCheck);
        try {
          // Try a HEAD request first to check content type
          const headResponse = await fetch(urlToCheck, {
            method: 'HEAD',
            credentials: 'include'
          });
          const contentType = headResponse.headers.get('content-type');
          console.log('Content type:', contentType);

          if (contentType && contentType.toLowerCase().includes('pdf')) {
            clearTimeout(downloadTimeout);
            this.downloadPDF(urlToCheck).then(resolve).catch(reject);
            return true;
          }
        } catch (e) {
          console.log('HEAD request failed, will try direct download:', e);
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
   * Download a PDF from a URL
   * @param {string} url - The PDF URL to download
   * @returns {Promise<Blob>} - Promise that resolves with the PDF blob
   */
  async downloadPDF(url) {
    console.log('Downloading PDF from', url);
    try {
      const response = await fetch(url, {
        credentials: 'include' // Include cookies for authenticated downloads
      });
      if (!response.ok) throw new Error('PDF download failed: ' + response.statusText);

      const blob = await response.blob();
      console.log('Downloaded blob', blob);
      if (!blob.type.includes('pdf')) {
        throw new Error(`Downloaded file is not a PDF (type: ${blob.type})`);
      }

      this.cleanup();
      return blob;
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Clean up the handler's DOM elements
   */
  cleanup() {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    const loadingDiv = this.container.querySelector('.pdfagogo-html-loading');
    if (loadingDiv && loadingDiv.parentNode) {
      loadingDiv.parentNode.removeChild(loadingDiv);
    }
  }
}