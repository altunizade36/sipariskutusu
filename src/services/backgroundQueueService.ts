export type JobPriority = 'high' | 'normal' | 'low';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: string;
  priority: JobPriority;
  status: JobStatus;
  payload: any;
  retry: number;
  maxRetries: number;
  createdAt: number;
  processedAt?: number;
  error?: string;
}

export interface WorkerConfig {
  concurrency: number;
  autoStart: boolean;
}

type JobHandler = (job: Job) => Promise<void>;

export class BackgroundQueue {
  private static jobs: Job[] = [];
  private static handlers: Map<string, JobHandler> = new Map();
  private static isProcessing = false;
  private static config: WorkerConfig = {
    concurrency: 2,
    autoStart: true,
  };

  static configure(config: Partial<WorkerConfig>) {
    this.config = { ...this.config, ...config };
  }

  static registerHandler(jobType: string, handler: JobHandler) {
    this.handlers.set(jobType, handler);
  }

  static async enqueue(
    jobType: string,
    payload: any,
    options: { priority?: JobPriority; maxRetries?: number } = {},
  ): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const job: Job = {
      id: jobId,
      type: jobType,
      priority: options.priority || 'normal',
      status: 'pending',
      payload,
      retry: 0,
      maxRetries: options.maxRetries || 3,
      createdAt: Date.now(),
    };

    this.jobs.push(job);
    this.sortJobsByPriority();

    if (this.config.autoStart) {
      this.process();
    }

    return jobId;
  }

  private static sortJobsByPriority() {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.jobs.sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        a.createdAt - b.createdAt,
    );
  }

  static async process() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.jobs.length > 0) {
        const pendingJobs = this.jobs.filter((j) => j.status === 'pending').slice(0, this.config.concurrency);

        if (pendingJobs.length === 0) break;

        await Promise.all(pendingJobs.map((job) => this.executeJob(job)));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private static async executeJob(job: Job) {
    try {
      job.status = 'processing';
      job.processedAt = Date.now();

      const handler = this.handlers.get(job.type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.type}`);
      }

      await handler(job);
      job.status = 'completed';
    } catch (error) {
      job.retry++;
      job.error = (error as Error).message;

      if (job.retry < job.maxRetries) {
        job.status = 'pending';
        // Exponential backoff: wait 1s, 2s, 4s, 8s...
        const delay = 1000 * Math.pow(2, job.retry - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        job.status = 'failed';
      }
    }
  }

  static getJob(jobId: string): Job | undefined {
    return this.jobs.find((j) => j.id === jobId);
  }

  static getJobs(status?: JobStatus): Job[] {
    if (!status) return this.jobs;
    return this.jobs.filter((j) => j.status === status);
  }

  static getPendingJobs(): Job[] {
    return this.getJobs('pending');
  }

  static getProcessingJobs(): Job[] {
    return this.getJobs('processing');
  }

  static getCompletedJobs(): Job[] {
    return this.getJobs('completed');
  }

  static getFailedJobs(): Job[] {
    return this.getJobs('failed');
  }

  static removeJob(jobId: string): boolean {
    const index = this.jobs.findIndex((j) => j.id === jobId);
    if (index === -1) return false;
    this.jobs.splice(index, 1);
    return true;
  }

  static clearCompleted() {
    this.jobs = this.jobs.filter((j) => j.status !== 'completed');
  }

  static clearFailed() {
    this.jobs = this.jobs.filter((j) => j.status !== 'failed');
  }

  static clear() {
    this.jobs = [];
  }

  static getStats() {
    return {
      total: this.jobs.length,
      pending: this.jobs.filter((j) => j.status === 'pending').length,
      processing: this.jobs.filter((j) => j.status === 'processing').length,
      completed: this.jobs.filter((j) => j.status === 'completed').length,
      failed: this.jobs.filter((j) => j.status === 'failed').length,
    };
  }
}
