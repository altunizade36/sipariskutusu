const { withNativeWind } = require("nativewind/metro");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

config.resolver.unstable_enablePackageExports = true;

config.resolver.unstable_conditionNames = ['require', 'react-native'];

module.exports = withNativeWind(config, { input: "./global.css" });