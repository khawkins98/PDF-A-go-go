/**
 * A simple event bus for decoupled communication between modules.
 */
export class EventBus {
  constructor(debug = false) {
    this.listeners = {};
    this.debug = debug;
  }

  /**
   * Subscribes to an event.
   * @param {string} eventName - The name of the event.
   * @param {Function} callback - The function to call when the event is emitted.
   * @returns {Function} A function to unsubscribe the listener.
   */
  on(eventName, callback) {
    if (typeof callback !== 'function') {
      console.error(`[EventBus] Listener for event "${eventName}" must be a function.`);
      return () => {}; // Return a no-op unsubscriber
    }
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(callback);
    if (this.debug) {
      console.log(`[EventBus] Listener added for event: "${eventName}"`);
    }
    return () => this.off(eventName, callback); // Return an unsubscribe function
  }

  /**
   * Unsubscribes from an event.
   * @param {string} eventName - The name of the event.
   * @param {Function} callback - The callback function to remove.
   */
  off(eventName, callback) {
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName] = this.listeners[eventName].filter(
      (listener) => listener !== callback
    );
    if (this.debug) {
      console.log(`[EventBus] Listener removed for event: "${eventName}"`);
    }
  }

  /**
   * Emits an event, calling all subscribed listeners.
   * @param {string} eventName - The name of the event.
   * @param {*} [data] - Optional data to pass to listeners.
   */
  emit(eventName, data) {
    if (this.debug) {
      console.log(`[EventBus] Emitting event: "${eventName}"`, data !== undefined ? data : '');
    }
    if (!this.listeners[eventName]) {
      return;
    }
    this.listeners[eventName].forEach(listener => {
      setTimeout(() => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[EventBus] Error in listener for event "${eventName}":`, error);
        }
      }, 0);
    });
  }

  /**
   * Subscribes to an event only once. The listener is automatically removed after being called.
   * @param {string} eventName - The name of the event.
   * @param {Function} callback - The function to call when the event is emitted.
   * @returns {Function} A function to unsubscribe the listener before it fires.
   */
  once(eventName, callback) {
    if (typeof callback !== 'function') {
      console.error(`[EventBus] Listener for event "${eventName}" (once) must be a function.`);
      return () => {};
    }
    const self = this; // eslint-disable-line consistent-this
    function onceWrapper(data) {
      self.off(eventName, onceWrapper);
      callback(data);
    }
    return this.on(eventName, onceWrapper);
  }

  /**
   * Clears all listeners for a specific event, or all listeners if no event name is provided.
   * @param {string} [eventName] - Optional. The name of the event to clear listeners for.
   */
  clear(eventName) {
    if (eventName) {
      if (this.listeners[eventName]) {
        delete this.listeners[eventName];
        if (this.debug) {
          console.log(`[EventBus] All listeners cleared for event: "${eventName}"`);
        }
      }
    } else {
      this.listeners = {};
      if (this.debug) {
        console.log('[EventBus] All listeners cleared.');
      }
    }
  }

  /**
   * Gets the number of listeners for a specific event.
   * @param {string} eventName - The name of the event.
   * @returns {number} The number of listeners for the event.
   */
  getListenerCount(eventName) {
    return this.listeners[eventName] ? this.listeners[eventName].length : 0;
  }
} 