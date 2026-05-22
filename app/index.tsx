// 홈 화면 placeholder — Sprint 1 S11 (다크 토큰) + 추후 화면들로 교체.

import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: '600' }}>된다</Text>
      <Text style={{ fontSize: 14, marginTop: 8, opacity: 0.6 }}>
        준비 중입니다
      </Text>
    </View>
  );
}
