import React from 'react';
import { useAddressSearch } from '../../hooks/useAddressSearch';
import { AddressSearchResult } from '../../types/address';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: AddressSearchResult) => void;
};

export function AddressAutocompleteInput({ value, onChange, onSelect }: Props) {
  const { results, isLoading, error, hasQuery } = useAddressSearch(value);

  return (
    <div className="space-y-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ornek: Istanbul Kadikoy Moda"
        className="w-full rounded border px-3 py-2"
      />

      {isLoading ? <p className="text-sm text-gray-500">Araniyor...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {hasQuery && results.length > 0 ? (
        <ul className="rounded border divide-y max-h-64 overflow-auto">
          {results.map((item, index) => (
            <li key={`${item.province.id}-${index}`}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                onClick={() => onSelect(item)}
              >
                {item.province.name}, {item.district.name}, {item.neighborhood.name}
                {item.street ? `, ${item.street.name}` : ''}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
