// 빈/에러 상태 (W0-4, §11.2). 제각각이던 빈 상태 7벌을 단일 프리미티브로.
// 3요소 강제: 아이콘 원(72pt) + title-3 헤드라인 + body-sm 보조 + 선택 CTA.
// 아이콘 원은 surface-2 + text-secondary (보라 금지 D5). error variant는 error 시맨틱 + 재시도.
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Icon, type IconName } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';

const CIRCLE = 72;

export type EmptyStateVariant = 'default' | 'error';

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** 기본: error→'경고', default→'안내'. 맥락 아이콘(친구·지도 등)은 명시 권장 */
  icon?: IconName;
  cta?: { label: string; onPress: () => void };
  variant?: EmptyStateVariant;
  testID?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  body,
  icon,
  cta,
  variant = 'default',
  testID,
}) => {
  const { colors, space } = useTheme();
  const isError = variant === 'error';
  const iconName: IconName = icon ?? (isError ? '경고' : '안내');
  const circleBg = isError ? colors.semantic.error.bg : colors.surface[2];
  const iconColor = isError ? colors.semantic.error.fg : colors.text.secondary;

  return (
    <View
      testID={testID}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space[6],
        paddingVertical: space[8],
      }}
    >
      <View
        testID={testID ? `${testID}-icon` : undefined}
        accessible={false}
        style={{
          width: CIRCLE,
          height: CIRCLE,
          borderRadius: CIRCLE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: circleBg,
          marginBottom: space[4],
        }}
      >
        <Icon name={iconName} color={iconColor} size={32} />
      </View>

      <Title level="h3" color={colors.text.primary} style={{ textAlign: 'center' }}>
        {title}
      </Title>

      {body ? (
        <Body
          variant="sm"
          color={colors.text.secondary}
          style={{ textAlign: 'center', marginTop: space[2] }}
        >
          {body}
        </Body>
      ) : null}

      {cta ? (
        <View style={{ marginTop: space[6], alignSelf: 'stretch' }}>
          <Button
            label={cta.label}
            onPress={cta.onPress}
            variant={isError ? 'secondary' : 'primary'}
            size="md"
            testID={testID ? `${testID}-cta` : undefined}
          />
        </View>
      ) : null}
    </View>
  );
};
