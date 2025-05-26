export class RenderQueue {
  constructor(options = {}) {
    this.queue = [];
    this.isProcessing = false;
    this.currentTask = null;
    this.maxConcurrent = options.maxConcurrent || 1; // Not yet used, but planned
    this.tasksCompleted = 0;
    this.tasksFailed = 0;
  }

  add(task, priority = false) {
    if (typeof task !== 'function') {
      console.error("RenderQueue: Task must be a function.");
      return;
    }
    if (priority) {
      this.queue.unshift(task);
    } else {
      this.queue.push(task);
    }

    if (!this.isProcessing) {
      this.process();
    }
  }

  clear() {
    this.queue = [];
    this.currentTask = null;
    // Potentially cancel any currentTask if it's a Promise
  }

  process() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    this.currentTask = this.queue.shift();

    // Consider using requestIdleCallback for less critical tasks
    requestAnimationFrame(() => {
      Promise.resolve(this.currentTask())
        .then(() => {
          this.tasksCompleted++;
          this.currentTask = null;
          this.process(); // Process next task
        })
        .catch(err => {
          this.tasksFailed++;
          console.error('Render task failed:', err);
          this.currentTask = null;
          this.process(); // Continue with next task even if current fails
        });
    });
  }

  getMetrics() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
    };
  }
}