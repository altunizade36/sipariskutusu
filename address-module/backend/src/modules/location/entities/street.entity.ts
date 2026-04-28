import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { DistrictEntity } from './district.entity';
import { NeighborhoodEntity } from './neighborhood.entity';
import { ProvinceEntity } from './province.entity';

export type StreetType = 'cadde' | 'sokak' | 'bulvar' | 'meydan' | 'kume evler' | 'diger';

@Entity({ name: 'streets' })
@Unique('uq_streets_code', ['code'])
@Unique('uq_streets_neighborhood_normalized_name_type', ['neighborhoodId', 'normalizedName', 'type'])
@Index('idx_streets_province_id', ['provinceId'])
@Index('idx_streets_district_id', ['districtId'])
@Index('idx_streets_neighborhood_id', ['neighborhoodId'])
@Index('idx_streets_normalized_name', ['normalizedName'])
export class StreetEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'province_id', type: 'int' })
  provinceId!: number;

  @Column({ name: 'district_id', type: 'int' })
  districtId!: number;

  @Column({ name: 'neighborhood_id', type: 'int' })
  neighborhoodId!: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  code?: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 200 })
  normalizedName!: string;

  @Column({ type: 'varchar', length: 20, default: 'sokak' })
  type!: StreetType;

  @ManyToOne(() => ProvinceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'province_id' })
  province!: ProvinceEntity;

  @ManyToOne(() => DistrictEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'district_id' })
  district!: DistrictEntity;

  @ManyToOne(() => NeighborhoodEntity, (neighborhood) => neighborhood.streets, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'neighborhood_id' })
  neighborhood!: NeighborhoodEntity;
}
