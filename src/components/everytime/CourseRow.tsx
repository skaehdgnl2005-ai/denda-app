import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { normalizeTimeInput, validateCourse } from '@/lib/ocr/courseListEditor';
import type { Day, OcrCourse } from '@/lib/ocr/everytime';

const DAYS: readonly { value: Day; label: string }[] = [
  { value: 'MON', label: '월' },
  { value: 'TUE', label: '화' },
  { value: 'WED', label: '수' },
  { value: 'THU', label: '목' },
  { value: 'FRI', label: '금' },
  { value: 'SAT', label: '토' },
  { value: 'SUN', label: '일' },
];

export interface CourseRowProps {
  course: OcrCourse;
  index: number;
  onChange: (patch: Partial<OcrCourse>) => void;
  onRemove: () => void;
}

export const CourseRow: React.FC<CourseRowProps> = ({ course, index, onChange, onRemove }) => {
  const { colors, space, radius } = useTheme();
  const validationError = validateCourse(course);

  const handleTimeBlur = (field: 'start' | 'end', value: string) => {
    const normalized = normalizeTimeInput(value);
    if (normalized !== value) {
      onChange({ [field]: normalized });
    }
  };

  const inputBase = {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.md,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    fontFamily: 'PretendardVariable',
    fontSize: 14,
    color: colors.text.primary,
    backgroundColor: colors.surface[0],
    minHeight: 44,
  } as const;

  return (
    <View
      testID={`course-row-${index}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface[0],
          borderColor: validationError ? colors.semantic.error.border : colors.border.subtle,
          borderRadius: radius.md,
          padding: space[3],
          marginBottom: space[2],
        },
      ]}
    >
      <View style={[styles.row, { marginBottom: space[2] }]}>
        <TextInput
          value={course.name}
          onChangeText={(text) => onChange({ name: text })}
          placeholder="강의명"
          placeholderTextColor={colors.text.tertiary}
          accessibilityLabel={`강의 ${index + 1} 이름`}
          testID={`course-name-${index}`}
          style={[inputBase, { flex: 1 }]}
        />
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`강의 ${index + 1} 삭제`}
          testID={`course-remove-${index}`}
          style={({ pressed }) => [
            styles.iconButton,
            {
              marginLeft: space[2],
              backgroundColor: pressed ? colors.surface[2] : 'transparent',
              borderRadius: radius.md,
            },
          ]}
        >
          <Icon name="닫기" color={colors.text.tertiary} size={20} />
        </Pressable>
      </View>

      <View style={[styles.daysRow, { marginBottom: space[2] }]}>
        {DAYS.map((d) => {
          const selected = course.day === d.value;
          return (
            <Pressable
              key={d.value}
              onPress={() => onChange({ day: d.value })}
              accessibilityRole="button"
              accessibilityLabel={`${d.label}요일`}
              testID={`course-${index}-day-${d.value}`}
              style={({ pressed }) => [
                styles.dayChip,
                {
                  backgroundColor: selected ? colors.brand[500] : colors.surface[2],
                  borderRadius: radius.md,
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Caption
                variant="default"
                color={selected ? colors.text['on-brand'] : colors.text.secondary}
              >
                {d.label}
              </Caption>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.timeRow}>
        <View style={{ flex: 1 }}>
          <Caption color={colors.text.tertiary} style={styles.timeLabel}>
            시작
          </Caption>
          <TextInput
            value={course.start}
            onChangeText={(text) => onChange({ start: text })}
            onBlur={() => handleTimeBlur('start', course.start)}
            placeholder="09:00"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={`강의 ${index + 1} 시작 시각`}
            testID={`course-start-${index}`}
            style={[inputBase, { fontVariant: ['tabular-nums'] }]}
          />
        </View>
        <View style={{ width: space[3] }} />
        <View style={{ flex: 1 }}>
          <Caption color={colors.text.tertiary} style={styles.timeLabel}>
            종료
          </Caption>
          <TextInput
            value={course.end}
            onChangeText={(text) => onChange({ end: text })}
            onBlur={() => handleTimeBlur('end', course.end)}
            placeholder="10:30"
            placeholderTextColor={colors.text.tertiary}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={`강의 ${index + 1} 종료 시각`}
            testID={`course-end-${index}`}
            style={[inputBase, { fontVariant: ['tabular-nums'] }]}
          />
        </View>
        <View style={{ width: space[3] }} />
        <View style={{ flex: 1.4 }}>
          <Caption color={colors.text.tertiary} style={styles.timeLabel}>
            강의실
          </Caption>
          <TextInput
            value={course.room ?? ''}
            onChangeText={(text) => onChange({ room: text.length > 0 ? text : undefined })}
            placeholder="(선택)"
            placeholderTextColor={colors.text.tertiary}
            accessibilityLabel={`강의 ${index + 1} 강의실`}
            testID={`course-room-${index}`}
            style={inputBase}
          />
        </View>
      </View>

      {validationError && (
        <Body
          variant="sm"
          color={colors.semantic.error.fg}
          style={{ marginTop: space[2] }}
          testID={`course-error-${index}`}
        >
          {errorMessageFor(validationError)}
        </Body>
      )}
    </View>
  );
};

function errorMessageFor(err: NonNullable<ReturnType<typeof validateCourse>>): string {
  switch (err) {
    case 'name':
      return '강의명을 입력해주세요.';
    case 'day':
      return '요일을 선택해주세요.';
    case 'time_format':
      return '시간은 HH:MM 형식으로 입력해주세요.';
    case 'time_order':
      return '종료 시각은 시작 시각보다 뒤여야 해요.';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 36,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  timeLabel: {
    marginBottom: 4,
  },
});
