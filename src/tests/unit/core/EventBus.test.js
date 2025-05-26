import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../../core/EventBus';

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    vi.useFakeTimers(); // For testing async emit
  });

  afterEach(() => {
    eventBus.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should initialize with no listeners', () => {
    expect(eventBus.listeners).toEqual({});
  });

  it('should subscribe a listener to an event and return an unsubscribe function', () => {
    const callback = vi.fn();
    const unsubscribe = eventBus.on('testEvent', callback);
    expect(eventBus.listeners['testEvent']).toContain(callback);
    expect(eventBus.getListenerCount('testEvent')).toBe(1);
    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
    expect(eventBus.listeners['testEvent']).not.toContain(callback);
    expect(eventBus.getListenerCount('testEvent')).toBe(0);
  });
  
  it('should not subscribe if callback is not a function and log an error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = eventBus.on('testEvent', 'not a function');
    expect(eventBus.getListenerCount('testEvent')).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[EventBus] Listener for event "testEvent" must be a function.');
    expect(typeof unsubscribe).toBe('function'); // Should still return a no-op function
    unsubscribe(); // Calling it should not throw
    consoleErrorSpy.mockRestore();
  });

  it('should unsubscribe a listener correctly', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    eventBus.on('testEvent', callback1);
    eventBus.on('testEvent', callback2);
    expect(eventBus.getListenerCount('testEvent')).toBe(2);

    eventBus.off('testEvent', callback1);
    expect(eventBus.listeners['testEvent']).not.toContain(callback1);
    expect(eventBus.listeners['testEvent']).toContain(callback2);
    expect(eventBus.getListenerCount('testEvent')).toBe(1);
  });

  it('off should not throw if event or listener does not exist', () => {
    const callback = vi.fn();
    expect(() => eventBus.off('nonExistentEvent', callback)).not.toThrow();
    eventBus.on('testEvent', callback);
    expect(() => eventBus.off('testEvent', vi.fn())).not.toThrow(); // Different callback instance
  });

  it('should emit an event to all subscribed listeners with data (asynchronously)', async () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const eventData = { message: 'hello' };

    eventBus.on('testEvent', callback1);
    eventBus.on('anotherEvent', callback2); // Should not be called
    eventBus.on('testEvent', callback2);

    eventBus.emit('testEvent', eventData);

    // Wait for setTimeout to execute listeners
    await vi.runAllTimersAsync();

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback1).toHaveBeenCalledWith(eventData);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledWith(eventData);
  });

  it('emit should not throw if no listeners for an event', async () => {
    expect(() => eventBus.emit('noListenersEvent')).not.toThrow();
    await vi.runAllTimersAsync(); // Ensure any potential async operations complete
  });

  it('should subscribe a listener for only one emission with "once"', async () => {
    const callback = vi.fn();
    const unsubscribe = eventBus.once('onceEvent', callback);

    eventBus.emit('onceEvent', 'data1');
    await vi.runAllTimersAsync();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('data1');
    expect(eventBus.getListenerCount('onceEvent')).toBe(0);

    eventBus.emit('onceEvent', 'data2');
    await vi.runAllTimersAsync();
    expect(callback).toHaveBeenCalledTimes(1); // Still 1
    
    expect(typeof unsubscribe).toBe('function');
  });
  
  it('once should return an unsubscribe function that works before emit', async () => {
    const callback = vi.fn();
    const unsubscribe = eventBus.once('onceEventEarlyUnsub', callback);
    unsubscribe(); // Unsubscribe before emitting

    eventBus.emit('onceEventEarlyUnsub', 'data');
    await vi.runAllTimersAsync();
    expect(callback).not.toHaveBeenCalled();
    expect(eventBus.getListenerCount('onceEventEarlyUnsub')).toBe(0);
  });

  it('once should not subscribe if callback is not a function and log an error', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const unsubscribe = eventBus.once('testOnceEvent', 'not a function');
    expect(eventBus.getListenerCount('testOnceEvent')).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[EventBus] Listener for event "testOnceEvent" (once) must be a function.');
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
    consoleErrorSpy.mockRestore();
  });

  it('should handle errors within listeners without stopping other listeners (async emit)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingCallback = vi.fn(() => { throw new Error('Listener failed'); });
    const succeedingCallback = vi.fn();

    eventBus.on('errorTest', failingCallback);
    eventBus.on('errorTest', succeedingCallback);

    eventBus.emit('errorTest', 'test');
    await vi.runAllTimersAsync();

    expect(failingCallback).toHaveBeenCalledTimes(1);
    expect(succeedingCallback).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[EventBus] Error in listener for event "errorTest":', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('clear should remove all listeners for a specific event', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    eventBus.on('eventA', cb1);
    eventBus.on('eventB', cb2);

    eventBus.clear('eventA');
    expect(eventBus.getListenerCount('eventA')).toBe(0);
    expect(eventBus.getListenerCount('eventB')).toBe(1);
  });

  it('clear should remove all listeners if no event name is provided', () => {
    eventBus.on('eventA', vi.fn());
    eventBus.on('eventB', vi.fn());

    eventBus.clear();
    expect(eventBus.getListenerCount('eventA')).toBe(0);
    expect(eventBus.getListenerCount('eventB')).toBe(0);
    expect(eventBus.listeners).toEqual({});
  });

  describe('Debug Mode', () => {
    let consoleLogSpy;

    beforeEach(() => {
      eventBus = new EventBus(true); // Enable debug mode
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
    });

    it('should log when a listener is added in debug mode', () => {
      eventBus.on('debugEvent', vi.fn());
      expect(consoleLogSpy).toHaveBeenCalledWith('[EventBus] Listener added for event: "debugEvent"');
    });

    it('should log when a listener is removed in debug mode', () => {
      const cb = vi.fn();
      eventBus.on('debugEvent', cb);
      consoleLogSpy.mockClear(); // Clear previous log
      eventBus.off('debugEvent', cb);
      expect(consoleLogSpy).toHaveBeenCalledWith('[EventBus] Listener removed for event: "debugEvent"');
    });

    it('should log when an event is emitted in debug mode', () => {
      eventBus.emit('debugEvent', { data: 'test' });
      expect(consoleLogSpy).toHaveBeenCalledWith('[EventBus] Emitting event: "debugEvent"', { data: 'test' });
      eventBus.emit('debugEventNoData');
      expect(consoleLogSpy).toHaveBeenCalledWith('[EventBus] Emitting event: "debugEventNoData"', '');
    });
    
    it('should log when all listeners for a specific event are cleared in debug mode', () => {
        eventBus.on('debugClearEvent', vi.fn());
        consoleLogSpy.mockClear();
        eventBus.clear('debugClearEvent');
        expect(consoleLogSpy).toHaveBeenCalledWith('[EventBus] All listeners cleared for event: "debugClearEvent"');
    });

    it('should log when all listeners are cleared in debug mode', () => {
        eventBus.on('debugClearAll1', vi.fn());
        eventBus.on('debugClearAll2', vi.fn());
        consoleLogSpy.mockClear();
        eventBus.clear();
        expect(consoleLogSpy).toHaveBeenCalledWith('[EventBus] All listeners cleared.');
    });
  });
}); 