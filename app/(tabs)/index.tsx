// 홈 화면 placeholder (인증 완료 후 진입점).
// 정식 홈 UI (캘린더 + 모임 list + 지도 토글)는 후속 sprint.
// S01 검증용: 닉네임 표시 + 로그아웃 버튼.

import { router } from 'expo-router';
import { Pressable, SafeAreaView, Text, View } from 'react-native';

import { authStore, useAuth } from '@/lib/auth/setup';

const TEXT_PRIMARY = 'rgba(0, 0, 0, 0.87)';
const TEXT_SECONDARY = 'rgba(0, 0, 0, 0.6)';

export default function HomeScreen() {
  const nickname = useAuth((s) => s.session?.user.nickname ?? '');

  const handleSignOut = async () => {
    await authStore.getState().signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '600',
            color: TEXT_PRIMARY,
          }}
        >
          된다
        </Text>
        <Text
          style={{
            fontSize: 14,
            marginTop: 8,
            color: TEXT_SECONDARY,
          }}
        >
          {nickname ? `${nickname}님, 환영합니다` : '준비 중입니다'}
        </Text>

        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          style={({ pressed }) => ({
            marginTop: 32,
            paddingHorizontal: 24,
            minHeight: 44,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(0, 0, 0, 0.16)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 14, color: TEXT_SECONDARY }}>로그아웃</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
