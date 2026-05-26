// (tabs) 그룹 layout — PROJECT_CONTEXT IA의 4탭 + FAB.
// 베타 Phase 1+2: 홈 / 친구 / [+ FAB 후속] / 지도 / 프로필
// search/requests는 friends/_layout.tsx에서 stack 처리.

import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/design/theme';

function renderTabIcon(name: IconName) {
  const TabIcon = (props: { focused: boolean; color: ColorValue; size: number }) => (
    <Icon name={name} color={String(props.color)} size={22} />
  );
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export default function TabsLayout() {
  const { colors, space } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand[500],
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: colors.surface[0],
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: 64 + space[2],
          paddingTop: space[2],
          paddingBottom: space[2],
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
  );
}
