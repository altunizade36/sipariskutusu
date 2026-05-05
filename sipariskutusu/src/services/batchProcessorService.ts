export interface BatchOperation<T, R> {
  items: T[];
  processor: (item: T) => Promise<R>;
  batchSize: number;
  onProgress?: (completed: number, total: number) => void;
  onError?: (error: Error, item: T, index: number) => void;
}

export interface BatchResult<R> {
  successful: R[];
  failed: Array<{ item: any; error: Error; index: number }>;
  totalProcessed: number;
  duration: number;
}

export class BatchProcessor {
  static async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      batchSize?: number;
      onProgress?: (completed: number, total: number) => void;
      onError?: (error: Error, item: T, index: number) => void;
      retryFailed?: boolean;
    } = {},
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const { batchSize = 10, onProgress, onError, retryFailed = false } = options;

    const successful: R[] = [];
    const failed: Array<{ item: T; error: Error; index: number }> = [];

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, Math.min(i + batchSize, items.length));

      const results = await Promise.allSettled(
        batch.map((item, batchIndex) => {
          const globalIndex = i + batchIndex;
          return processor(item)
            .then((result) => ({ success: true, result, item, globalIndex }))
            .catch((error) => ({
              success: false,
              error,
              item,
              globalIndex,
            }));
        }),
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const resultValue = result.value;

          if (resultValue.success && 'result' in resultValue) {
            const { result: processedResult, item, globalIndex } = resultValue as any;
            successful.push(processedResult);
          } else if (!resultValue.success && 'error' in resultValue) {
            const { error, item, globalIndex } = resultValue as any;
            failed.push({
              item,
              error,
              index: globalIndex,
            });

            if (onError) {
              onError(error, item, globalIndex);
            }
          }
        } else {
          const failedItem = batch[results.indexOf(result)];
          failed.push({
            item: failedItem,
            error: result.reason,
            index: i + results.indexOf(result),
          });

          if (onError) {
            onError(result.reason, failedItem, i + results.indexOf(result));
          }
        }
      }

      const completed = Math.min(i + batchSize, items.length);
      if (onProgress) {
        onProgress(completed, items.length);
      }
    }

    // Retry failed items if enabled
    if (retryFailed && failed.length > 0) {
      const retryResult = await this.processBatch(
        failed.map((f) => f.item),
        processor,
        { batchSize, onProgress, onError },
      );

      successful.push(...retryResult.successful);
      failed.length = 0;
      failed.push(...retryResult.failed);
    }

    return {
      successful,
      failed,
      totalProcessed: items.length,
      duration: Date.now() - startTime,
    };
  }

  static async processSerial<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      onProgress?: (completed: number, total: number) => void;
      onError?: (error: Error, item: T, index: number) => void;
    } = {},
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const { onProgress, onError } = options;

    const successful: R[] = [];
    const failed: Array<{ item: T; error: Error; index: number }> = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await processor(items[i]);
        successful.push(result);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        failed.push({ item: items[i], error: err, index: i });

        if (onError) {
          onError(err, items[i], i);
        }
      }

      if (onProgress) {
        onProgress(i + 1, items.length);
      }
    }

    return {
      successful,
      failed,
      totalProcessed: items.length,
      duration: Date.now() - startTime,
    };
  }

  static async processParallel<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    maxConcurrency: number = 5,
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const successful: R[] = [];
    const failed: Array<{ item: T; error: Error; index: number }> = [];

    // Create a queue of items with their indices
    const queue = items.map((item, index) => ({ item, index }));
    const processing: Promise<void>[] = [];

    const worker = async () => {
      while (queue.length > 0) {
        const { item, index } = queue.shift()!;

        try {
          const result = await processor(item);
          successful.push(result);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          failed.push({ item, error: err, index });
        }
      }
    };

    // Start workers
    for (let i = 0; i < Math.min(maxConcurrency, items.length); i++) {
      processing.push(worker());
    }

    await Promise.all(processing);

    return {
      successful,
      failed,
      totalProcessed: items.length,
      duration: Date.now() - startTime,
    };
  }

  static async chunk<T>(items: T[], chunkSize: number): Promise<T[][]> {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  static async debatch<T>(batches: T[][]): Promise<T[]> {
    return batches.flat();
  }

  static getFailureRate(result: BatchResult<any>): number {
    const total = result.totalProcessed;
    if (total === 0) return 0;
    return (result.failed.length / total) * 100;
  }

  static getSuccessRate(result: BatchResult<any>): number {
    return 100 - this.getFailureRate(result);
  }
}
