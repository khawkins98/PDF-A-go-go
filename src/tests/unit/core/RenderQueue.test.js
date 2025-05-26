import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderQueue } from '../../../core/RenderQueue';

// Mock requestAnimationFrame and cancelAnimationFrame
const requestAnimationFrameMock = vi.fn((fn) => setTimeout(fn, 0));
const cancelAnimationFrameMock = vi.fn(clearTimeout);

describe('RenderQueue', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock);
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with default values', () => {
    const queue = new RenderQueue();
    expect(queue.queue).toEqual([]);
    expect(queue.isProcessing).toBe(false);
    expect(queue.currentTask).toBe(null);
    expect(queue.tasksCompleted).toBe(0);
    expect(queue.tasksFailed).toBe(0);
    const metrics = queue.getMetrics();
    expect(metrics.queueLength).toBe(0);
    expect(metrics.isProcessing).toBe(false);
    expect(metrics.tasksCompleted).toBe(0);
    expect(metrics.tasksFailed).toBe(0);
  });

  it('should add a task to the queue', () => {
    const queue = new RenderQueue();
    const task = vi.fn();
    queue.add(task);
    expect(queue.queue.length).toBe(0);
    expect(queue.isProcessing).toBe(true);
    expect(queue.currentTask).toBe(task);
    expect(queue.getMetrics().queueLength).toBe(0);
  });

  it('should add a task to the front of the queue if priority is true', () => {
    const queue = new RenderQueue();
    const task1 = vi.fn();
    const task2 = vi.fn();
    const task3 = vi.fn();

    queue.add(task1);
    expect(queue.currentTask).toBe(task1);
    expect(queue.queue.length).toBe(0);

    queue.add(task2, true);
    expect(queue.queue.length).toBe(1);
    expect(queue.queue[0]).toBe(task2);
    
    queue.add(task3);
    expect(queue.queue.length).toBe(2);
    expect(queue.queue[0]).toBe(task2);
    expect(queue.queue[1]).toBe(task3);

    expect(queue.getMetrics().queueLength).toBe(2);
  });

  it('should not add a task if it is not a function', () => {
    const queue = new RenderQueue();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    queue.add('not a function');
    expect(queue.queue.length).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith('RenderQueue: Task must be a function.');
    consoleErrorSpy.mockRestore();
  });

  it('should process tasks in the queue', async () => {
    const queue = new RenderQueue();
    const task1 = vi.fn(() => Promise.resolve());
    const task2 = vi.fn(() => Promise.resolve());
    queue.add(task1);
    expect(queue.isProcessing).toBe(true);
    expect(queue.currentTask).toBe(task1);
    expect(queue.queue.length).toBe(0);

    queue.add(task2);
    expect(queue.queue.length).toBe(1);
    expect(queue.queue[0]).toBe(task2);
    
    await vi.runAllTimersAsync();
    
    expect(task1).toHaveBeenCalled();
    expect(task2).toHaveBeenCalled();
    expect(queue.isProcessing).toBe(false);
    expect(queue.tasksCompleted).toBe(2);
    expect(queue.getMetrics().tasksCompleted).toBe(2);
    expect(queue.getMetrics().queueLength).toBe(0);
  });

  it('should handle failing tasks and continue processing', async () => {
    const queue = new RenderQueue();
    const failingTask = vi.fn(() => Promise.reject('Task failed'));
    const succeedingTask = vi.fn(() => Promise.resolve());
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    queue.add(failingTask);
    queue.add(succeedingTask);

    await vi.runAllTimersAsync();

    expect(failingTask).toHaveBeenCalled();
    expect(succeedingTask).toHaveBeenCalled();
    expect(queue.isProcessing).toBe(false);
    expect(queue.tasksCompleted).toBe(1);
    expect(queue.tasksFailed).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Render task failed:', 'Task failed');
    expect(queue.getMetrics().tasksCompleted).toBe(1);
    expect(queue.getMetrics().tasksFailed).toBe(1);
    consoleErrorSpy.mockRestore();
  });

  it('should clear the queue', async () => {
    const queue = new RenderQueue();
    const task1 = vi.fn(() => Promise.resolve('task1 result'));
    const task2 = vi.fn(() => Promise.resolve('task2 result'));

    queue.add(task1);
    queue.add(task2);

    expect(queue.queue.length).toBe(1);
    expect(queue.currentTask).toBe(task1);
    
    vi.advanceTimersByTime(0); 
    queue.clear();
    expect(queue.queue.length).toBe(0);
    expect(queue.currentTask).toBe(null); 
    expect(queue.getMetrics().queueLength).toBe(0);

    await vi.runAllTimersAsync();

    expect(task1).toHaveBeenCalledTimes(1);
    expect(queue.tasksCompleted).toBe(1);
    
    expect(task2).not.toHaveBeenCalled();
    
    expect(queue.isProcessing).toBe(false);
  });

  it('getMetrics should return current metrics', async () => {
    const queue = new RenderQueue();
    const task1 = vi.fn(() => Promise.resolve());
    queue.add(task1);
    await vi.runAllTimersAsync();
    const metrics = queue.getMetrics();
    expect(metrics.tasksCompleted).toBe(1);
    expect(metrics.queueLength).toBe(0);
  });
}); 