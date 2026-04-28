import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { DistrictEntity } from './district.entity';
import { NeighborhoodEntity } from './neighborhood.entity';
import { ProvinceEntity } from './province.entity';
import { StreetEntity } from './street.entity';

@Entity({ name: 'addresses' })
@Index('idx_addresses_province_id', ['provinceId'])
@Index('idx_addresses_district_id', ['districtId'])
@Index('idx_addresses_neighborhood_id', ['neighborhoodId'])
@Index('idx_addresses_street_id', ['streetId'])
@Index('idx_addresses_normalized_full_text', ['normalizedFullText'])
export class AddressEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'province_id', type: 'int' })
  provinceId!: number;

  @Column({ name: 'district_id', type: 'int' })
  districtId!: number;

  @Column({ name: 'neighborhood_id', type: 'int' })
  neighborhoodId!: number;

  @Column({ name: 'street_id', type: 'int', nullable: true })
  streetId?: number | null;

  @Column({ name: 'building_no', type: 'varchar', length: 20, nullable: true })
  buildingNo?: string | null;

  @Column({ name: 'unit_no', type: 'varchar', length: 20, nullable: true })
  unitNo?: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 10, nullable: true })
  postalCode?: string | null;

  @Column({ name: 'full_text', type: 'text' })
  fullText!: string;

  @Column({ name: 'normalized_full_text', type: 'text' })
  normalizedFullText!: string;

  @Column({ name: 'snapshot_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshotJson!: Record<string, unknown>;

  @Column({ name: 'lat', type: 'numeric', precision: 10, scale: 7, nullable: true })
  lat?: string | null;

  @Column({ name: 'lng', type: 'numeric', precision: 10, scale: 7, nullable: true })
  lng?: string | null;

  @Column({ name: 'confidence_score', type: 'numeric', precision: 5, scale: 4, default: 0 })
  confidenceScore!: string;

  @ManyToOne(() => ProvinceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'province_id' })
  province!: ProvinceEntity;

  @ManyToOne(() => DistrictEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'district_id' })
  district!: DistrictEntity;

  @ManyToOne(() => NeighborhoodEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'neighborhood_id' })
  neighborhood!: NeighborhoodEntity;

  @ManyToOne(() => StreetEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'street_id' })
  street?: StreetEntity | null;
}
