// 공용 검색 입력 프리미티브 (W2-13). 친구·지도·place-search 3화면이 각자 롤하던 TextInput을
// 통일 — 좌측 검색 아이콘 + clear(X) 버튼 + returnKeyType="search" + a11y 라벨. 토큰만 사용.
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';

const CONTAINER_HEIGHT = 44;

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  /** clear(X) 동작 override. 없으면 onChangeText('') 호출. */
  onClear?: () => void;
  /** 키보드 검색(return) 시. onSubmitEditing에 연결. */
  onSubmit?: () => void;
  placeholder?: string;
  /** 필수 — 입력창 스크린리더 라벨. */
  accessibilityLabel: string;
  autoFocus?: boolean;
  testID?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChangeText,
  onClear,
  onSubmit,
  placeholder,
  accessibilityLabel,
  autoFocus,
  testID,
}) => {
  const { colors, space, radius } = useTheme();
  const hasValue = value.length > 0;

  return (
    <View
      testID={testID ? `${testID}-container` : undefined}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface[2],
          borderColor: colors.border.strong,
          borderRadius: radius.md,
          paddingHorizontal: space[3],
        },
      ]}
    >
      <Icon name="검색" color={colors.text.secondary} size={20} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.text.disabled}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={[styles.input, { color: colors.text.primary, marginLeft: space[2] }]}
      />
      {hasValue ? (
        <Pressable
          onPress={() => (onClear ? onClear() : onChangeText(''))}
          accessibilityRole="button"
          accessibilityLabel="검색어 지우기"
          testID={testID ? `${testID}-clear` : undefined}
          hitSlop={10}
          style={styles.clearButton}
        >
          <Icon name="닫기" color={colors.text.tertiary} size={18} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: CONTAINER_HEIGHT,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: 'PretendardVariable',
    fontSize: 16,
  },
  clearButton: {
    width: 32,
    height: CONTAINER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
