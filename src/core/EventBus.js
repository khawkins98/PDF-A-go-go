/**
 * @file EventBus.js
 * Provides a simple event bus implementation for decoupled communication between modules.
 */

/**
 * Represents a generic event bus for pub/sub messaging.
 * Allows different parts of the application to communicate without direct dependencies.
 */
export class EventBus {
  /**
   * Initializes a new instance of the EventBus.
   * The `_events` property stores a map of event names to an array of listener callbacks.
   */
  constructor() {
    /**
     * @private
     * @type {Map<string, Array<Function>>}
     */
    this._events = new Map();
    /**
     * @private
     * @type {boolean}
     * Flag to enable or disable diagnostic logging for event emissions.
     * Useful for debugging event flow.
     */
    this._debug = false; // Set to true for verbose event logging
  }

  /**
   * Enables or disables diagnostic logging.
   * @param {boolean} enabled - True to enable logging, false to disable.
   */
  setDebug(enabled) {
    this._debug = enabled;
  }

  /**
   * Registers a listener for a specific event.
   * @param {string} eventName - The name of the event to listen for.
   * @param {Function} listener - The callback function to execute when the event is emitted.
   * @throws {Error} If the listener is not a function.
   */
  on(eventName, listener) {
    if (typeof listener !== 'function') {
      console.error(`[EventBus] Listener for event "${eventName}" must be a function.`);
      return () => {}; // Return a no-op unsubscriber
    }
    if (!this._events.has(eventName)) {
      this._events.set(eventName, []);
    }
    this._events.get(eventName).push(listener);
    if (this._debug) {
      console.log(`[EventBus] Listener added for event: "${eventName}"`);
    }
    return () => this.off(eventName, listener); // Return an unsubscribe function
  }

  /**
   * Removes a listener for a specific event.
   * @param {string} eventName - The name of the event to remove the listener from.
   * @param {Function} listenerToRemove - The callback function to remove.
   */
  off(eventName, listenerToRemove) {
    if (!this._events.has(eventName)) {
      return;
    }
    this._events.get(eventName).filter(
      (listener) => listener !== listenerToRemove
    );
    if (this._debug) {
      console.log(`[EventBus] Listener removed for event: "${eventName}"`);
    }
  }

  /**
   * Emits an event, calling all registered listeners for that event.
   * @param {string} eventName - The name of the event to emit.
   * @param {*} [data] - Optional data to pass to the listeners.
   * @throws {Error} If a listener throws an error during execution (logged to console, then re-thrown).
   */
  emit(eventName, data) {
    if (this._debug) {
      console.log(`[EventBus] Emitting event: "${eventName}"`, data !== undefined ? data : '');
    }
    if (!this._events.has(eventName)) {
      return;
    }
    this._events.get(eventName).forEach(listener => {
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
   * Removes all listeners for a specific event, or all listeners for all events if no event name is provided.
   * @param {string} [eventName] - The name of the event to clear listeners for. If omitted, all listeners for all events are cleared.
   */
  clear(eventName) {
    if (eventName) {
      if (this._events.has(eventName)) {
        this._events.delete(eventName);
        if (this._debug) {
          console.log(`[EventBus] All listeners cleared for event: "${eventName}"`);
        }
      }
    } else {
      this._events.clear();
      if (this._debug) {
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
    return this._events.has(eventName) ? this._events.get(eventName).length : 0;
  }
} 