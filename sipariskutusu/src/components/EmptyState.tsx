import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';
import BoxMascot from './BoxMascot';

type MascotVariant = 'welcome' | 'loading' | 'order' | 'success';

interface EmptyStateProps {
  icon?: string;
  mascot?: MascotVariant;
  title: string;
  description: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, mascot, title, description, action }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Visual */}
      <View style={{ marginBottom: 20, alignItems: 'center' }}>
        {mascot ? (
          <BoxMascot variant={mascot} size={96} animated />
        ) : icon ? (
          <View
            style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#EFF6FF',
              borderWidth: 1, borderColor: '#DBEAFE',
              alignItems: 'center', justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            <Ionicons name={icon as any} size={34} color={colors.primary} />
          </View>
        ) : null}
      </View>

      {/* Text */}
      <Text
        style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', marginBottom: 8 }}
      >
        {title}
      </Text>

      <Text
        style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 }}
      >
        {description}
      </Text>

      {action && (
        <Pressable
          onPress={action.onPress}
          style={{
            marginTop: 20,
            height: 44,
            paddingHorizontal: 28,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
