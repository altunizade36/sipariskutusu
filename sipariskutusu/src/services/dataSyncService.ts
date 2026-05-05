export interface SyncRecord<T> {
  id: string;
  local: T;
  remote?: T;
  lastSyncedAt?: number;
  isDirty: boolean;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
  conflictResolution?: 'local' | 'remote' | 'merge';
}

export interface SyncConflict<T> {
  id: string;
  local: T;
  remote: T;
  resolution: 'local' | 'remote' | 'merge';
}

export type MergeStrategy<T> = (local: T, remote: T) => T;

export class DataSyncManager {
  private static records: Map<string, SyncRecord<any>> = new Map();
  private static mergeStrategies: Map<string, MergeStrategy<any>> = new Map();
  private static conflicts: SyncConflict<any>[] = [];

  static registerMergeStrategy<T>(key: string, strategy: MergeStrategy<T>) {
    this.mergeStrategies.set(key, strategy);
  }

  static addRecord<T>(
    id: string,
    local: T,
    remote?: T,
  ): SyncRecord<T> {
    const record: SyncRecord<T> = {
      id,
      local,
      remote,
      isDirty: !remote || JSON.stringify(local) !== JSON.stringify(remote),
      syncStatus: remote ? 'synced' : 'pending',
    };

    this.records.set(id, record);
    return record;
  }

  static updateLocal<T>(id: string, data: T): SyncRecord<T> | null {
    const record = this.records.get(id) as SyncRecord<T>;
    if (!record) return null;

    record.local = data;
    record.isDirty = true;
    record.syncStatus = 'pending';

    return record;
  }

  static updateRemote<T>(id: string, data: T): SyncRecord<T> | null {
    const record = this.records.get(id) as SyncRecord<T>;
    if (!record) return null;

    const wasConflict = record.syncStatus === 'conflict';

    if (JSON.stringify(record.local) !== JSON.stringify(data)) {
      if (record.isDirty && !wasConflict) {
        // Conflict detected
        record.syncStatus = 'conflict';
        this.conflicts.push({
          id,
          local: record.local,
          remote: data,
          resolution: 'remote',
        });
      } else {
        record.local = data;
        record.isDirty = false;
      }
    }

    record.remote = data;
    record.lastSyncedAt = Date.now();
    record.syncStatus = 'synced';

    return record;
  }

  static resolveConflict<T>(
    id: string,
    resolution: 'local' | 'remote' | 'merge',
  ): SyncRecord<T> | null {
    const record = this.records.get(id) as SyncRecord<T>;
    if (!record || record.syncStatus !== 'conflict') return null;

    const mergeStrategy = this.mergeStrategies.get(id);

    switch (resolution) {
      case 'local':
        record.syncStatus = 'pending';
        record.isDirty = true;
        break;
      case 'remote':
        record.local = record.remote!;
        record.syncStatus = 'synced';
        record.isDirty = false;
        break;
      case 'merge':
        if (mergeStrategy) {
          record.local = mergeStrategy(record.local, record.remote!);
        }
        record.syncStatus = 'pending';
        record.isDirty = true;
        break;
    }

    // Remove from conflicts list
    this.conflicts = this.conflicts.filter((c) => c.id !== id);

    return record;
  }

  static getRecord<T>(id: string): SyncRecord<T> | null {
    return (this.records.get(id) as SyncRecord<T>) || null;
  }

  static getPendingSyncs(): SyncRecord<any>[] {
    return Array.from(this.records.values()).filter((r) => r.isDirty);
  }

  static getConflicts(): SyncConflict<any>[] {
    return [...this.conflicts];
  }

  static getSyncStatus(id: string): string | null {
    const record = this.records.get(id);
    return record?.syncStatus || null;
  }

  static async syncAll(
    syncFunction: (record: SyncRecord<any>) => Promise<any>,
  ): Promise<{
    successful: number;
    failed: number;
    conflicts: number;
  }> {
    const pending = this.getPendingSyncs();
    let successful = 0;
    let failed = 0;

    for (const record of pending) {
      try {
        record.syncStatus = 'syncing';
        const result = await syncFunction(record);

        if (result.success) {
          record.syncStatus = 'synced';
          record.isDirty = false;
          successful++;
        } else {
          record.syncStatus = 'error';
          failed++;
        }
      } catch (error) {
        record.syncStatus = 'error';
        failed++;
      }
    }

    return {
      successful,
      failed,
      conflicts: this.conflicts.length,
    };
  }

  static markSynced(id: string): void {
    const record = this.records.get(id);
    if (record) {
      record.isDirty = false;
      record.syncStatus = 'synced';
    }
  }

  static clear(): void {
    this.records.clear();
    this.conflicts = [];
  }

  static getStats() {
    const all = Array.from(this.records.values());
    return {
      total: all.length,
      synced: all.filter((r) => r.syncStatus === 'synced').length,
      pending: all.filter((r) => r.isDirty).length,
      conflicts: this.conflicts.length,
      errors: all.filter((r) => r.syncStatus === 'error').length,
    };
  }
}
