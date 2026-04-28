import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { DistrictEntity } from './district.entity';
import { ProvinceEntity } from './province.entity';
import { StreetEntity } from './street.entity';

export type NeighborhoodType = 'mahalle' | 'koy';

@Entity({ name: 'neighborhoods' })
@Unique('uq_neighborhoods_code', ['code'])
@Unique('uq_neighborhoods_district_normalized_name_type', ['districtId', 'normalizedName', 'type'])
@Index('idx_neighborhoods_province_id', ['provinceId'])
@Index('idx_neighborhoods_district_id', ['districtId'])
@Index('idx_neighborhoods_normalized_name', ['normalizedName'])
export class NeighborhoodEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'province_id', type: 'int' })
  provinceId!: number;

  @Column({ name: 'district_id', type: 'int' })
  districtId!: number;

  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 150 })
  normalizedName!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: NeighborhoodType;

  @ManyToOne(() => ProvinceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'province_id' })
  province!: ProvinceEntity;

  @ManyToOne(() => DistrictEntity, (district) => district.neighborhoods, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'district_id' })
  district!: DistrictEntity;

  @OneToMany(() => StreetEntity, (street) => street.neighborhood)
  streets!: StreetEntity[];
}
