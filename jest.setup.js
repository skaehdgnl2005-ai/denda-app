/* eslint-env jest */
// Jest global setup — Expo + RN mocks.
// jest-expo preset already handles most native module mocks; this file is for
// project-specific globals (e.g., env vars defaulted to test values).

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY =
  process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? 'test-kakao-native-key';

// react-native-worklets — Reanimated 4 peer.
// reanimated/mock이 내부적으로 real reanimated index를 require하면서 worklets API를
// 호출하므로, worklets mock을 reanimated보다 먼저 등록 + identity stub 다수 export.
jest.mock('react-native-worklets', () => {
  const ID = (x) => x;
  const NOOP = () => {};
  return {
    runOnJS: ID,
    runOnUI: ID,
    runOnUIAsync: ID,
    runOnUISync: ID,
    runOnRuntime: ID,
    runOnRuntimeAsync: ID,
    runOnRuntimeSync: ID,
    runOnRuntimeSyncWithId: ID,
    scheduleOnRN: ID,
    scheduleOnUI: ID,
    scheduleOnRuntime: ID,
    scheduleOnRuntimeWithId: ID,
    executeOnUIRuntimeSync: ID,
    createSerializable: ID,
    isSerializableRef: () => false,
    registerCustomSerializable: NOOP,
    serializableMappingCache: { set: NOOP, get: () => undefined },
    createShareable: ID,
    createSynchronizable: ID,
    createWorkletRuntime: () => ({}),
    getUIRuntimeHolder: () => null,
    getUISchedulerHolder: () => null,
    UIRuntimeId: 0,
    isShareable: () => false,
    isShareableRef: () => false,
    isSynchronizable: () => false,
    isWorkletFunction: () => false,
    isRNRuntime: () => true,
    isUIRuntime: () => false,
    isWorkerRuntime: () => false,
    isWorkletRuntime: () => false,
    getRuntimeKind: () => 'RN',
    RuntimeKind: { RN: 'RN', UI: 'UI', Worker: 'Worker', Worklet: 'Worklet' },
    callMicrotasks: NOOP,
    makeShareable: ID,
    makeShareableCloneOnUIRecursive: ID,
    makeShareableCloneRecursive: ID,
    shareableMappingCache: { set: NOOP, get: () => undefined },
    getDynamicFeatureFlag: () => false,
    getStaticFeatureFlag: () => false,
    setDynamicFeatureFlag: NOOP,
    WorkletsModule: {},
  };
});

// Reanimated 4 mock — UI thread worklet을 JS로 직접 실행 (test 환경).
// react-native-reanimated/mock은 4.x에서도 default export로 제공.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// react-native-gesture-handler — jest-expo가 자동 mock하지만,
// Gesture.Pan() builder API는 별도 stub 필요.
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;

  // builder pattern stub — onBegin/onUpdate/onEnd가 chain 가능하도록.
  const makeGesture = () => {
    const g = {
      _handlers: {},
      onBegin(cb) {
        g._handlers.onBegin = cb;
        return g;
      },
      onStart(cb) {
        g._handlers.onStart = cb;
        return g;
      },
      onUpdate(cb) {
        g._handlers.onUpdate = cb;
        return g;
      },
      onEnd(cb) {
        g._handlers.onEnd = cb;
        return g;
      },
      onFinalize(cb) {
        g._handlers.onFinalize = cb;
        return g;
      },
      minDistance(_) {
        return g;
      },
      activeOffsetX(_) {
        return g;
      },
      activeOffsetY(_) {
        return g;
      },
      activateAfterLongPress(_) {
        return g;
      },
      runOnJS(_) {
        return g;
      },
    };
    return g;
  };

  return {
    Gesture: {
      Pan: makeGesture,
      Tap: makeGesture,
      Race: (...args) => args[0],
      Simultaneous: (...args) => args[0],
      Exclusive: (...args) => args[0],
    },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
    State: { BEGAN: 0, ACTIVE: 1, END: 2, FAILED: 3, CANCELLED: 4 },
  };
});
