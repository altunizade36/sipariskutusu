import React from 'react';
import { Neighborhood } from '../../types/address';

type Props = {
  value?: number;
  options: Neighborhood[];
  onChange: (id?: number) => void;
  disabled?: boolean;
};

export function NeighborhoodSelect({ value, options, onChange, disabled }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      disabled={disabled}
      className="w-full rounded border px-3 py-2"
    >
      <option value="">Mahalle/Koy secin</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} ({item.type})
        </option>
      ))}
    </select>
  );
}
