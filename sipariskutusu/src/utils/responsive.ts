import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export { SCREEN_WIDTH as screenWidth, SCREEN_HEIGHT as screenHeight };

export const isSmallDevice = SCREEN_WIDTH < 375;
export const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;
export const isLargeDevice = SCREEN_WIDTH >= 414;
export const isTablet = SCREEN_WIDTH >= 768;

/** Width-based percentage of screen */
export function wp(percent: number): number {
  return (SCREEN_WIDTH * percent) / 100;
}

/** Height-based percentage of screen */
export function hp(percent: number): number {
  return (SCREEN_HEIGHT * percent) / 100;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate card width for a column grid.
 * @param columns - number of columns (default 2)
 * @param gap - gap between cards in px
 * @param horizontalPadding - total horizontal padding (both sides combined)
 */
export function calcCardWidth(
  columns = 2,
  gap = 8,
  horizontalPadding = 32,
): number {
  const totalGap = gap * (columns - 1);
  const available = SCREEN_WIDTH - horizontalPadding - totalGap;
  const raw = available / columns;
  return isTablet ? Math.min(raw, 300) : raw;
}

/** Pre-computed 2-column card width (16px padding each side + 8px gap) */
export const cardWidth = calcCardWidth(2, 8, 32);

/** Spacing scale */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/**
 * Scale a font size proportionally to screen width (clamped ±15%).
 * Base reference width is 390px (iPhone 14).
 */
export function scaledFont(size: number): number {
  const scale = SCREEN_WIDTH / 390;
  return clamp(Math.round(size * scale), Math.round(size * 0.85), Math.round(size * 1.15));
}

/** Tab bar total height (including safe area on most devices) */
export const TAB_BAR_HEIGHT = Platform.select({
  web: 94,
  default: clamp(Math.round(SCREEN_HEIGHT * 0.115), 82, 108),
}) as number;

/** Safe bottom padding to use in ScrollView contentContainerStyle */
export const SCROLL_BOTTOM_PADDING = TAB_BAR_HEIGHT + 16;
