import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

@Entity({ name: 'imported_location_sources' })
@Unique('uq_imported_location_sources_source_file_hash', ['sourceName', 'fileHash'])
@Index('idx_imported_location_sources_status', ['status'])
export class ImportedLocationSourceEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'source_name', type: 'varchar', length: 120 })
  sourceName!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_hash', type: 'varchar', length: 128 })
  fileHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'running' | 'completed' | 'failed';

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number;

  @Column({ name: 'inserted_rows', type: 'int', default: 0 })
  insertedRows!: number;

  @Column({ name: 'failed_rows', type: 'int', default: 0 })
  failedRows!: number;

  @Column({ name: 'failure_report_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  failureReportJson!: Array<Record<string, unknown>>;
}
