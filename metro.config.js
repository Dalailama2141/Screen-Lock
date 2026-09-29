const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The build machine is memory-constrained. Metro otherwise forks one jest-worker
// per CPU for transforms, and each forked process needs its own memory reservation,
// which exhausts the system commit limit. Serializing to a single worker keeps the
// JS bundle step within the available memory.
config.maxWorkers = 1;

// Expo's default config only turns .scss into a real style module on web; on
// Android/iOS it returns an empty module so no styles apply. This transformer
// compiles .scss into React Native style objects on native, delegating every
// other file to Expo's own transform untouched.
config.transformerPath = require.resolve('./metro-scss-transformer');

module.exports = config;
