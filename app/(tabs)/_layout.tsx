// (tabs) 그룹 layout — PROJECT_CONTEXT IA의 4탭 + 중앙 FAB.
// 베타 Phase 1+2: 홈 / 친구 / [지도] / 프로필  + 중앙 '모임 만들기' GroupFab(W2-3, §10.7).
// search/requests는 friends/_layout.tsx에서 stack 처리.

import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GroupFab } from '@/components/GroupFab';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { fabBottomOffset, focusedTabFill, tabBarHeightStyle } from '@/lib/nav/tabBar';

function renderTabIcon(name: IconName) {
  const TabIcon = (props: { focused: boolean; color: ColorValue; size: number }) => (
    <Icon
      name={name}
      color={String(props.color)}
      size={24}
      fill={focusedTabFill(props.focused, String(props.color))}
    />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brand[500],
          tabBarInactiveTintColor: colors.text.tertiary,
          tabBarStyle: {
            backgroundColor: colors.surface[0],
            borderTopColor: colors.border.subtle,
            borderTopWidth: 1,
            ...tabBarHeightStyle(insets.bottom),
          },
          tabBarLabelStyle: {
            fontFamily: 'PretendardVariable',
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 0.1,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: '홈',
            tabBarIcon: renderTabIcon('홈'),
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            title: '친구',
            tabBarIcon: renderTabIcon('친구'),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: '지도',
            tabBarIcon: renderTabIcon('지도'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: '프로필',
            tabBarIcon: renderTabIcon('프로필'),
          }}
        />
      </Tabs>

      {/* 중앙 '모임 만들기' FAB — 탭바 위 16pt 띄워 오버레이(§10.7). box-none으로 나머지 탭 터치 통과. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: fabBottomOffset(insets.bottom),
          alignItems: 'center',
        }}
      >
        <GroupFab />
      </View>
    </View>
  );
}
