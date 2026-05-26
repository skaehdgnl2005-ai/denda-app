// Babel config — Expo SDK 56 + Reanimated 4 worklet runtime.
// react-native-worklets/plugin은 worklet 변환을 처리한다 (Reanimated 4부터 분리).
// 반드시 plugins 배열의 마지막에 위치 (다른 plugin 변환 이후 worklet 마킹 적용).

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
