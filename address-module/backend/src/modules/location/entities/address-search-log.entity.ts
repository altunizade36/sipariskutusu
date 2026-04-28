import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

@Entity({ name: 'address_search_logs' })
@Index('idx_address_search_logs_normalized_query', ['normalizedQuery'])
@Index('idx_address_search_logs_created_at', ['createdAt'])
export class AddressSearchLogEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  query!: string;

  @Column({ name: 'normalized_query', type: 'text' })
  normalizedQuery!: string;

  @Column({ name: 'result_count', type: 'int', default: 0 })
  resultCount!: number;

  @Column({ name: 'request_ip', type: 'varchar', length: 64, nullable: true })
  requestIp?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 300, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'metadata_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadataJson!: Record<string, unknown>;
}
