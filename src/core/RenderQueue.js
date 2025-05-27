/**
 * @file RenderQueue.js
 * Implements a queue for managing and prioritizing rendering tasks.
 * It ensures that rendering operations are processed sequentially and can be paused, resumed, or cleared.
 */

import { DEFAULT_OPTIONS } from "./ConfigManager";

/**
 * @callback TaskFunction
 * @returns {Promise<any>}
 */

/**
 * @typedef {object} Task
 * @property {TaskFunction} func - The function to execute for this task.
 * @property {number} priority - The priority of the task (lower number = higher priority).
 * @property {number} id - Unique ID for the task.
 * @property {function} resolve - Resolve function for the task's promise.
 * @property {function} reject - Reject function for the task's promise.
 */

const MAX_CONCURRENT_DEFAULT = 1;

/**
 * @class RenderQueue
 * Manages a queue of rendering tasks, processing them with a configurable concurrency limit.
 * Tasks can be prioritized.
 */
export class RenderQueue {
  /**
   * @private
   * @type {Task[]}
   */
  #queue = [];
  /**
   * @private
   * @type {number}
   */
  #maxConcurrent = MAX_CONCURRENT_DEFAULT;
  /**
   * @private
   * @type {number}
   */
  #runningTasks = 0;
  /**
   * @private
   * @type {number}
   */
  #nextTaskId = 0;
  /**
   * @private
   * @type {boolean}
   */
  #isStopped = false;
   /**
   * @private
   * @type {boolean} Flag for enabling verbose debug logging.
   */
  #debug = false;

  #tasksCompleted = 0;
  #tasksFailed = 0;

  /**
   * Creates an instance of RenderQueue.
   * @param {object} [options]
   * @param {number} [options.maxConcurrent=1] - Maximum number of tasks to run concurrently.
   * @param {boolean} [options.debug=false] - Enable debug logging.
   */
  constructor({ maxConcurrent = MAX_CONCURRENT_DEFAULT, debug = false } = {}) {
    this.#maxConcurrent = maxConcurrent;
    this.#debug = debug;
    if (this.#debug) console.log(`[RenderQueue] Initialized with maxConcurrent: ${this.#maxConcurrent}`);
  }

  /**
   * Adds a task to the queue.
   * @param {TaskFunction} func - The function to execute.
   * @param {object} [options]
   * @param {number} [options.priority=0] - Task priority (lower number is higher priority).
   * @returns {Promise<any>} A promise that resolves or rejects when the task is completed or fails.
   */
  add(func, { priority = 0 } = {}) {
    if (this.#isStopped) {
      if (this.#debug) console.warn("[RenderQueue] Add called on stopped queue. Task rejected.");
      return Promise.reject(new Error("Queue is stopped"));
    }
    if (this.#debug) console.log(`[RenderQueue] Adding task with priority ${priority}. Current queue size: ${this.#queue.length}, running: ${this.#runningTasks}`);

    return new Promise((resolve, reject) => {
      const task = {
        id: this.#nextTaskId++,
        func,
        priority,
        resolve,
        reject,
      };
      this.#queue.push(task);
      this.#queue.sort((a, b) => a.priority - b.priority); // Sort by priority
      this._processNext();
    });
  }

  /**
   * @private
   * Processes the next task in the queue if concurrency limit allows.
   */
  _processNext() {
    if (this.#isStopped) {
        if (this.#debug) console.log("[RenderQueue] _processNext called but queue is stopped.");
        return;
    }
    if (this.#runningTasks >= this.#maxConcurrent || this.#queue.length === 0) {
        if (this.#debug && this.#runningTasks >= this.#maxConcurrent) console.log(`[RenderQueue] _processNext: Concurrency limit reached (${this.#runningTasks}/${this.#maxConcurrent}). Waiting.`);
        if (this.#debug && this.#queue.length === 0 && this.#runningTasks > 0) console.log(`[RenderQueue] _processNext: Queue empty, but ${this.#runningTasks} tasks still running.`);
        return;
    }

    const task = this.#queue.shift(); // Get the highest priority task (front of sorted queue)
    if (!task) {
        if (this.#debug) console.log("[RenderQueue] _processNext: No task found after shift, though queue length check passed. This shouldn't happen.");
        return;
    }

    this.#runningTasks++;
    if (this.#debug) console.log(`[RenderQueue] Starting task ${task.id}. Running: ${this.#runningTasks}/${this.#maxConcurrent}. Queue remaining: ${this.#queue.length}`);

    task.func()
      .then((result) => {
        if (this.#debug) console.log(`[RenderQueue] Task ${task.id} completed successfully.`);
        this.#tasksCompleted++;
        task.resolve(result);
      })
      .catch((error) => {
        if (this.#debug) console.error(`[RenderQueue] Task ${task.id} failed:`, error);
        this.#tasksFailed++;
        task.reject(error);
      })
      .finally(() => {
        this.#runningTasks--;
        if (this.#debug) console.log(`[RenderQueue] Task ${task.id} finished. Running: ${this.#runningTasks}. Queue remaining: ${this.#queue.length}. Attempting to process next.`);
        if (!this.#isStopped) {
            this._processNext();
        }
      });
  }

  /**
   * Clears all pending tasks from the queue. Does not stop running tasks.
   */
  clear() {
    if (this.#debug) console.log(`[RenderQueue] Clearing queue. Current length: ${this.#queue.length}`);
    this.#queue.forEach(task => task.reject(new Error("Queue cleared")));
    this.#queue = [];
  }

  /**
   * Stops the queue from processing new tasks. Tasks already running will complete.
   * New tasks added after stop() will be immediately rejected.
   */
  stop() {
    if (this.#debug) console.log("[RenderQueue] Stopping queue.");
    this.#isStopped = true;
    // Note: This doesn't clear the queue. If restart is desired, clear() should also be called.
  }

  /**
   * Resumes a stopped queue. Allows new tasks to be processed.
   */
  start() {
    if (this.#debug) console.log("[RenderQueue] Starting queue.");
    this.#isStopped = false;
    this._processNext(); // Attempt to process any tasks that might have been queued while stopped or were remaining
  }

  /**
   * Gets the current number of tasks in the queue (waiting to be processed).
   * @returns {number}
   */
  getQueueLength() {
    return this.#queue.length;
  }

  /**
   * Checks if the queue is currently processing any tasks.
   * @returns {boolean}
   */
  isProcessing() {
    return this.#runningTasks > 0;
  }

  /**
   * Gets performance and state metrics for the queue.
   * @returns {object} Metrics object.
   */
  getMetrics() {
    return {
        queueLength: this.#queue.length,
        runningTasks: this.#runningTasks,
        maxConcurrent: this.#maxConcurrent,
        isStopped: this.#isStopped,
        tasksCompleted: this.#tasksCompleted,
        tasksFailed: this.#tasksFailed,
        tasksInQueueIds: this.#queue.map(t => t.id) // For more detailed debugging if needed
    };
  }
}