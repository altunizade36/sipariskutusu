import { View, Text } from 'react-native';
import { fonts } from '../../constants/theme';
import type { StockStatus } from '../../services/inventoryService';

type StyleSpec = { bg: string; text: string; border: string; label: string };

const STYLES: Record<StockStatus, StyleSpec> = {
  in_stock:  { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC', label: 'Stokta' },
  low_stock: { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74', label: 'Az kaldı' },
  sold_out:  { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5', label: 'Tükendi' },
  untracked: { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB', label: 'Takipsiz' },
};

type Props = {
  status: StockStatus;
  remaining?: number;
  size?: 'sm' | 'md';
  showRemaining?: boolean;
};

export function StockStatusBadge({ status, remaining, size = 'sm', showRemaining = false }: Props) {
  const spec = STYLES[status];
  const padV = size === 'sm' ? 3 : 5;
  const padH = size === 'sm' ? 7 : 10;
  const fs = size === 'sm' ? 10 : 12;

  const label =
    showRemaining && status === 'low_stock' && typeof remaining === 'number'
      ? `Son ${Math.max(0, remaining)}`
      : spec.label;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: spec.bg,
        borderColor: spec.border,
        borderWidth: 0.5,
        paddingHorizontal: padH,
        paddingVertical: padV,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: spec.text, fontFamily: fonts.bold, fontSize: fs }}>{label}</Text>
    </View>
  );
}
