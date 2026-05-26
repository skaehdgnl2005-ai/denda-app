import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import {
  formatSemesterError,
  validateSemesterDate,
  validateSemesterRange,
} from '@/lib/ocr/semesterValidation';

export interface SemesterInputProps {
  start: string;
  end: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  disabled?: boolean;
}

export const SemesterInput: React.FC<SemesterInputProps> = ({
  start,
  end,
  onChangeStart,
  onChangeEnd,
  disabled = false,
}) => {
  const { colors, space, radius } = useTheme();
  const startErr = start.length === 0 ? null : validateSemesterDate(start);
  const endErr = end.length === 0 ? null : validateSemesterDate(end);
  const rangeErr =
    startErr || endErr || start.length === 0 || end.length === 0
      ? null
      : validateSemesterRange(start, end);
  const errorMessage = formatSemesterError(rangeErr ?? endErr ?? startErr);

  const inputBaseStyle = {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[3],
    paddingVertical: space[3],
    fontFamily: 'PretendardVariable',
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.surface[0],
    minHeight: 44,
  } as const;

  return (
    <View testID="semester-input">
      <View style={{ marginBottom: space[2] }}>
        <Caption color={colors.text.secondary} style={styles.label}>
          학기 시작일
        </Caption>
        <TextInput
          value={start}
          onChangeText={onChangeStart}
          placeholder="2026-03-02"
          placeholderTextColor={colors.text.tertiary}
          editable={!disabled}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          accessibilityLabel="학기 시작일 입력"
          testID="semester-start-input"
          style={[
            inputBaseStyle,
            {
              borderColor: startErr ? colors.semantic.error.border : colors.border.subtle,
            },
          ]}
        />
      </View>
      <View>
        <Caption color={colors.text.secondary} style={styles.label}>
          학기 종료일
        </Caption>
        <TextInput
          value={end}
          onChangeText={onChangeEnd}
          placeholder="2026-06-19"
          placeholderTextColor={colors.text.tertiary}
          editable={!disabled}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={10}
          accessibilityLabel="학기 종료일 입력"
          testID="semester-end-input"
          style={[
            inputBaseStyle,
            {
              borderColor: endErr || rangeErr ? colors.semantic.error.border : colors.border.subtle,
            },
          ]}
        />
      </View>
      {errorMessage.length > 0 && (
        <Body
          variant="sm"
          color={colors.semantic.error.fg}
          style={{ marginTop: space[2] }}
          testID="semester-error"
        >
          {errorMessage}
        </Body>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    marginBottom: 4,
  },
});
