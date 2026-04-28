import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseAuditEntity } from './base-audit.entity';
import { DistrictEntity } from './district.entity';

@Entity({ name: 'provinces' })
@Unique('uq_provinces_code', ['code'])
@Index('idx_provinces_normalized_name', ['normalizedName'])
export class ProvinceEntity extends BaseAuditEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 10 })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'normalized_name', type: 'varchar', length: 100 })
  normalizedName!: string;

  @OneToMany(() => DistrictEntity, (district) => district.province)
  districts!: DistrictEntity[];
}
