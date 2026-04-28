import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';

export type AddressAliasEntityType =
  | 'province'
  | 'district'
  | 'neighborhood'
  | 'street'
  | 'address';

@Entity({ name: 'address_aliases' })
@Unique('uq_address_aliases_entity_alias', ['entityType', 'entityId', 'normalizedAlias'])
@Index('idx_address_aliases_entity_ref', ['entityType', 'entityId'])
@Index('idx_address_aliases_normalized_alias', ['normalizedAlias'])
export class AddressAliasEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType!: AddressAliasEntityType;

  @Column({ name: 'entity_id', type: 'int' })
  entityId!: number;

  @Column({ type: 'varchar', length: 200 })
  alias!: string;

  @Column({ name: 'normalized_alias', type: 'varchar', length: 200 })
  normalizedAlias!: string;
}
