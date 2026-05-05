const { LogBox } = require('react-native');

LogBox.ignoreLogs([
  'timeout exceeded',
  'fontfaceobserver',
  '6000ms',
  '[Reanimated] Reduced motion setting is enabled',
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'We recommend you instead use a development build',
]);

try {
  const {
    configureReanimatedLogger,
    ReanimatedLogLevel,
  } = require('react-native-reanimated');

  configureReanimatedLogger({
    level: ReanimatedLogLevel.error,
    strict: false,
  });
} catch {
  // Reanimated is not available on every platform during tooling runs.
}

require('expo-router/entry');
