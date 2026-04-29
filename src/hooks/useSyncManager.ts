import { useState, useCallback, useRef, useEffect } from 'react';

export interface SyncJob {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  error?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export type SyncHandler = () => Promise<void>;

export function useSyncManager() {
  const [jobs, setJobs] = useState<Record<string, SyncJob>>({});
  const handlersRef = useRef<Record<string, SyncHandler>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  const registerHandler = useCallback((name: string, handler: SyncHandler) => {
    handlersRef.current[name] = handler;
  }, []);

  const unregisterHandler = useCallback((name: string) => {
    delete handlersRef.current[name];
  }, []);

  const createJob = useCallback((name: string, maxRetries = 3): string => {
    const id = `job_${Date.now()}_${Math.random()}`;
    const job: SyncJob = {
      id,
      name,
      status: 'pending',
      progress: 0,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };
    setJobs((prev) => ({ ...prev, [id]: job }));
    return id;
  }, []);

  const updateJobProgress = useCallback((jobId: string, progress: number) => {
    setJobs((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        progress: Math.min(progress, 100),
      },
    }));
  }, []);

  const completeJob = useCallback((jobId: string) => {
    setJobs((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        status: 'completed',
        progress: 100,
      },
    }));
  }, []);

  const failJob = useCallback((jobId: string, error?: string) => {
    setJobs((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        status: 'failed',
        error,
      },
    }));
  }, []);

  const executeJob = useCallback(async (jobId: string) => {
    const job = jobs[jobId];
    if (!job) return;

    const handler = handlersRef.current[job.name];
    if (!handler) {
      failJob(jobId, 'Handler not found');
      return;
    }

    setJobs((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        status: 'running',
      },
    }));

    try {
      await handler();
      completeJob(jobId);
    } catch (error) {
      if (job.retryCount < job.maxRetries) {
        setJobs((prev) => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            status: 'pending',
            retryCount: prev[jobId].retryCount + 1,
          },
        }));
      } else {
        failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }, [jobs, completeJob, failJob]);

  const syncAll = useCallback(async (handlers: Record<string, SyncHandler>) => {
    setIsSyncing(true);
    try {
      const jobIds = Object.keys(handlers).map((name) => {
        registerHandler(name, handlers[name]);
        return createJob(name);
      });

      for (const jobId of jobIds) {
        await executeJob(jobId);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [registerHandler, createJob, executeJob]);

  const getJobStatus = useCallback((jobId: string): SyncJob | undefined => {
    return jobs[jobId];
  }, [jobs]);

  const clearCompleted = useCallback(() => {
    setJobs((prev) => {
      const filtered = { ...prev };
      Object.keys(filtered).forEach((key) => {
        if (filtered[key].status === 'completed') {
          delete filtered[key];
        }
      });
      return filtered;
    });
  }, []);

  const clearAll = useCallback(() => {
    setJobs({});
  }, []);

  return {
    jobs,
    isSyncing,
    registerHandler,
    unregisterHandler,
    createJob,
    updateJobProgress,
    completeJob,
    failJob,
    executeJob,
    syncAll,
    getJobStatus,
    clearCompleted,
    clearAll,
  };
}
