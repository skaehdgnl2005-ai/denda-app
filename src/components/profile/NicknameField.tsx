// 닉네임 입력 — 가입 화면과 프로필 수정 화면이 공유.
// 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §7.
//
// 입력 스타일은 app/group/new.tsx의 TextInput 패턴을 그대로 따른다(surface-2, radius-md,
// space-4/3 패딩, Pretendard). 상태 표시는 힌트 ↔ 에러 한 자리만 쓴다 — 둘을 동시에
// 띄우면 사용자가 어느 쪽을 따라야 할지 모호해진다.

import React from 'react';
import { TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Caption } from '@/design/typography';
import { messages } from '@/lib/i18n/messages';
import { NICKNAME_MAX } from '@/lib/profile/nickname';

export interface NicknameFieldProps {
  value: string;
  onChangeText: (next: string) => void;
  /** 있으면 힌트 대신 에러를 표시 */
  error?: string | null;
  /** 키보드 완료 키 */
  onSubmit?: () => void;
  autoFocus?: boolean;
}

export const NicknameField: React.FC<NicknameFieldProps> = ({
  value,
  onChangeText,
  error,
  onSubmit,
  autoFocus,
}) => {
  const { colors, space, radius } = useTheme();
  const hasError = Boolean(error);

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={messages.nickname.placeholder}
        placeholderTextColor={colors.text.disabled}
        testID="nickname-input"
        accessibilityLabel={messages.nickname.placeholder}
        // 상한 초과 입력을 애초에 막는다 — 12자를 넘긴 뒤 에러를 띄우는 것보다
        // 넘어가지 않는 편이 덜 답답하다. 하한(2자)은 막을 수 없으므로 에러로 안내.
        maxLength={NICKNAME_MAX}
        // iOS 자동 대문자·자동 수정이 닉네임을 임의로 바꾸면 사용자가 정한 값이 아니게 된다.
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        returnKeyType="done"
        style={{
          backgroundColor: colors.surface[2],
          borderRadius: radius.md,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
          color: colors.text.primary,
          fontFamily: 'PretendardVariable',
          fontSize: 16,
          borderWidth: 1,
          // 에러 시 보더로도 신호 — 색만으로 상태를 전달하지 않는다(§12.6).
          borderColor: hasError ? colors.semantic.error.fg : 'transparent',
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: space[2],
          marginLeft: space[1],
        }}
      >
        {/* Lucide는 testID를 SVG 내부로 넘겨 조회가 안 되므로 View로 감싼다
            (profile.tsx의 calendar-disconnected-badge와 같은 패턴). */}
        {hasError ? (
          <View testID="nickname-error-icon">
            <Icon name="경고" color={colors.semantic.error.fg} size={14} />
          </View>
        ) : null}
        <Caption
          variant="default"
          color={hasError ? colors.semantic.error.fg : colors.text.tertiary}
          style={{ marginLeft: hasError ? space[1] : 0, flex: 1 }}
        >
          {error ?? messages.nickname.hint}
        </Caption>
      </View>
    </View>
  );
};
