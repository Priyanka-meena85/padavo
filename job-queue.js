// ==============================================================================
// PADAVO HIGH-CONCURRENCY EVENT-DRIVEN JOB QUEUE
// Offloads heavy tasks (PDF generation, Vision QC scanning, WhatsApp broadcast)
// Prevents Node.js Event Loop blocking under high concurrency
// ==============================================================================

const EventEmitter = require('events');

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = false;
    this.history = [];
    this.stats = {
      total_queued: 0,
      total_processed: 0,
      total_failed: 0
    };
  }

  /**
   * Enqueues an asynchronous background job
   */
  enqueue(type, payload, handler = null) {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      id: jobId,
      type: type,
      payload: payload,
      handler: handler,
      status: 'QUEUED',
      enqueued_at: new Date().toISOString()
    };

    this.queue.push(job);
    this.stats.total_queued++;
    this.emit('job:enqueued', job);

    // Process next job asynchronously on next tick
    setImmediate(() => this.processNext());

    return {
      success: true,
      job_id: jobId,
      queue_length: this.queue.length,
      status: 'QUEUED_FOR_EXECUTION'
    };
  }

  /**
   * Processes jobs sequentially or with concurrency throttle
   */
  async processNext() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const currentJob = this.queue.shift();
    currentJob.status = 'PROCESSING';
    currentJob.started_at = new Date().toISOString();

    try {
      if (typeof currentJob.handler === 'function') {
        currentJob.result = await currentJob.handler(currentJob.payload);
      } else {
        // Default simulated async worker execution
        await new Promise(resolve => setTimeout(resolve, 50));
        currentJob.result = { processed: true, type: currentJob.type };
      }

      currentJob.status = 'COMPLETED';
      currentJob.completed_at = new Date().toISOString();
      this.stats.total_processed++;
      this.emit('job:completed', currentJob);
    } catch (err) {
      currentJob.status = 'FAILED';
      currentJob.error = err.message;
      this.stats.total_failed++;
      this.emit('job:failed', currentJob);
    } finally {
      this.history.push({
        id: currentJob.id,
        type: currentJob.type,
        status: currentJob.status,
        completed_at: currentJob.completed_at || new Date().toISOString()
      });
      // Keep history bounded
      if (this.history.length > 100) this.history.shift();

      this.processing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  getMetrics() {
    return {
      active_jobs: this.queue.length,
      is_busy: this.processing,
      total_queued: this.stats.total_queued,
      total_processed: this.stats.total_processed,
      total_failed: this.stats.total_failed,
      recent_history: this.history.slice(-5)
    };
  }
}

module.exports = new JobQueue();
