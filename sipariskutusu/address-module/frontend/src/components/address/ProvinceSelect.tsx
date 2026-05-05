import React from 'react';
import { Province } from '../../types/address';

type Props = {
  value?: number;
  options: Province[];
  onChange: (id?: number) => void;
  disabled?: boolean;
};

export function ProvinceSelect({ value, options, onChange, disabled }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      disabled={disabled}
      className="w-full rounded border px-3 py-2"
    >
      <option value="">Il secin</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
