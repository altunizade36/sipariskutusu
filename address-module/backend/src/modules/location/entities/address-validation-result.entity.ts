import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

@Entity({ name: 'address_validation_results' })
@Index('idx_address_validation_results_input_hash', ['inputHash'])
export class AddressValidationResultEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'input_text', type: 'text' })
  inputText!: string;

  @Column({ name: 'normalized_text', type: 'text' })
  normalizedText!: string;

  @Column({ name: 'input_hash', type: 'varchar', length: 128 })
  inputHash!: string;

  @Column({ name: 'is_valid', type: 'boolean', default: false })
  isValid!: boolean;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, default: 0 })
  confidenceScore!: string;

  @Column({ name: 'validation_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  validationJson!: Record<string, unknown>;
}
