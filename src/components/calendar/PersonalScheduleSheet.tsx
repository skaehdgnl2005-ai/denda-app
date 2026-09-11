// S25 — 수동 개인 일정 추가/수정 바텀시트.
//
// ConfirmSheet의 시트 골격(grabber·radius-2xl·scrim·slide-up·reduce-motion)을 미러한다.
// 삭제는 시스템 Alert 대신 ConfirmSheet를 한 겹 더 띄운다 (§11.3 Alert 금지).
// 시간은 15분 단위(D14 일관) 목록에서 고른다 — 네이티브 피커 의존 없이 토큰만으로 구성.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { useTheme } from '@/design/theme';
import { rowPressBg } from '@/design/press';
import { Body, Caption, Title } from '@/design/typography';
import { formatKstDayLabel, formatKstMinute } from '@/lib/calendar/agenda';
import { motionEasing } from '@/lib/motion/easing';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import {
  createPersonalSchedule,
  deletePersonalSchedule,
  updatePersonalSchedule,
  validatePersonalSchedule,
} from '@/lib/schedules/personal';

const SLIDE_DISTANCE = 480;
const SLOT_MINUTES = 15; // D14
const DEFAULT_START = 540; // 09:00
const DEFAULT_DURATION = 60;
const TIME_ROW_HEIGHT = 44;
const TITLE_MAX = 40;

/** 수정 대상 — 시트는 날짜를 바꾸지 않는다(날짜 이동은 캘린더에서). */
export interface EditingPersonalSchedule {
  scheduleId: string;
  title: string;
  startMinute: number;
  endMinute: number;
}

export interface PersonalScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 저장·삭제 성공 시 — 호출부가 목록을 다시 읽는다 */
  onSaved: (message: string) => void;
  userId: string;
  /** KST yyyy-MM-dd */
  dateIso: string;
  /** null이면 추가 모드 */
  editing: EditingPersonalSchedule | null;
  testID?: string;
}

/** 00:00 ~ 23:45 (15분 간격) + 종료용 24:00 */
function timeOptions(min: number, max: number): number[] {
  const out: number[] = [];
  for (let m = min; m <= max; m += SLOT_MINUTES) out.push(m);
  return out;
}

interface TimeFieldProps {
  label: string;
  minute: number;
  onChange: (minute: number) => void;
  /** 이 값보다 큰 옵션만 노출 (종료 시간용) */
  minExclusive?: number;
  testIDPrefix: string;
}

const TimeField: React.FC<TimeFieldProps> = ({
  label,
  minute,
  onChange,
  minExclusive,
  testIDPrefix,
}) => {
  const { colors, space, radius } = useTheme();
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const start = minExclusive === undefined ? 0 : minExclusive + SLOT_MINUTES;
    return timeOptions(start, minExclusive === undefined ? 1425 : 1440);
  }, [minExclusive]);

  const initialIndex = Math.max(
    0,
    options.findIndex((m) => m === minute),
  );

  return (
    <View style={{ flex: 1 }}>
      <Caption variant="micro" color={colors.text.tertiary} style={{ marginBottom: space[1] }}>
        {label}
      </Caption>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${formatKstMinute(minute)}, 변경하기`}
        testID={`${testIDPrefix}-field`}
        style={({ pressed }) => [
          styles.timeField,
          {
            backgroundColor: rowPressBg(pressed, colors),
            borderColor: colors.border.subtle,
            borderRadius: radius.md,
            paddingHorizontal: space[4],
          },
        ]}
      >
        <Body variant="primary" color={colors.text.primary} tabularNums testID={testIDPrefix}>
          {formatKstMinute(minute)}
        </Body>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: colors.overlay.scrim, justifyContent: 'center' }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface[1],
              borderRadius: radius.lg,
              marginHorizontal: space[8],
              maxHeight: 320,
              overflow: 'hidden',
            }}
          >
            {/* 96행(15분 단위 하루)은 가상화 없이도 가볍다. FlatList를 쓰면 선택된 시각이
                초기 렌더 윈도 밖이라 화면에 없는 상태로 열린다 → ScrollView + contentOffset. */}
            <ScrollView contentOffset={{ x: 0, y: initialIndex * TIME_ROW_HEIGHT }}>
              {options.map((item) => {
                const selected = item === minute;
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={formatKstMinute(item)}
                    accessibilityState={{ selected }}
                    testID={`time-option-${item}`}
                    style={({ pressed }) => [
                      styles.timeOption,
                      { backgroundColor: rowPressBg(pressed || selected, colors) },
                    ]}
                  >
                    <Body
                      variant={selected ? 'bold' : 'primary'}
                      color={selected ? colors.text.brand : colors.text.primary}
                      tabularNums
                    >
                      {formatKstMinute(item)}
                    </Body>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export const PersonalScheduleSheet: React.FC<PersonalScheduleSheetProps> = ({
  visible,
  onClose,
  onSaved,
  userId,
  dateIso,
  editing,
  testID,
}) => {
  const { colors, radius, space, shadow, duration } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(0));

  // 폼 초기값은 마운트 시 한 번만 — 호출부가 key로 remount해 편집 대상별 초기화를 보장한다
  // (effect 안 setState는 cascading render를 부른다).
  const [title, setTitle] = useState(() => editing?.title ?? '');
  const [startMinute, setStartMinute] = useState(() => editing?.startMinute ?? DEFAULT_START);
  const [endMinute, setEndMinute] = useState(
    () => editing?.endMinute ?? DEFAULT_START + DEFAULT_DURATION,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? 0 : duration.medium,
      easing: motionEasing.enter,
      useNativeDriver: true,
    }).start();
  }, [visible, reduced, duration.medium, anim]);

  const handleDismiss = useCallback(() => {
    if (saving || deleting) return;
    onClose();
  }, [saving, deleting, onClose]);

  /** 시작이 종료를 넘어서면 종료를 같은 길이만큼 뒤로 민다 */
  const handleStartChange = useCallback((next: number) => {
    setStartMinute(next);
    setEndMinute((prevEnd) =>
      next >= prevEnd ? Math.min(1440, next + DEFAULT_DURATION) : prevEnd,
    );
  }, []);

  const handleSave = useCallback(async () => {
    // 같은 이벤트 배치의 더블 탭은 state 갱신 전이라 못 막는다 → ref 잠금
    if (inFlightRef.current) return;
    const input = { title, dateIso, startMinute, endMinute };

    // 검증은 시트에서 먼저 — 네트워크 왕복 없이 인라인 에러를 띄운다 (lib에도 방어적으로 존재)
    const invalid = validatePersonalSchedule(input);
    if (invalid !== null) {
      setError(invalid);
      return;
    }

    inFlightRef.current = true;
    setSaving(true);
    setError(null);
    try {
      if (editing === null) {
        await createPersonalSchedule(userId, input);
      } else {
        await updatePersonalSchedule(editing.scheduleId, input);
      }
      onSaved(editing === null ? '일정을 저장했어요' : '일정을 수정했어요');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 저장하지 못했어요.');
    } finally {
      inFlightRef.current = false;
      setSaving(false);
    }
  }, [title, dateIso, startMinute, endMinute, editing, userId, onSaved, onClose]);

  const handleDelete = useCallback(async () => {
    if (editing === null || inFlightRef.current) return;
    inFlightRef.current = true;
    setDeleting(true);
    setError(null);
    try {
      await deletePersonalSchedule(editing.scheduleId);
      setConfirmDelete(false);
      onSaved('일정을 삭제했어요');
      onClose();
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : '일정을 삭제하지 못했어요.');
    } finally {
      inFlightRef.current = false;
      setDeleting(false);
    }
  }, [editing, onSaved, onClose]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [SLIDE_DISTANCE, 0] });
  const id = testID ?? 'personal-sheet';

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: anim }}
        >
          <Pressable
            testID={`${id}-backdrop`}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={handleDismiss}
            style={{ flex: 1, backgroundColor: colors.overlay.scrim }}
          />
        </Animated.View>

        <Animated.View
          testID={`${id}-sheet`}
          accessibilityViewIsModal
          style={{
            transform: reduced ? [] : [{ translateY }],
            backgroundColor: colors.surface[1],
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            paddingHorizontal: space[5],
            paddingTop: space[2],
            paddingBottom: insets.bottom + space[4],
            ...shadow.e3,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radius.full,
              backgroundColor: colors.surface[3],
              alignSelf: 'center',
              marginBottom: space[4],
            }}
          />

          <Title level="h3" color={colors.text.primary} testID={`${id}-title`}>
            {editing === null ? '일정 추가' : '일정 수정'}
          </Title>
          <Caption
            variant="default"
            color={colors.text.secondary}
            style={{ marginTop: space[1] }}
            testID={`${id}-date`}
          >
            {formatKstDayLabel(dateIso)}
          </Caption>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="예: 치과 예약"
            placeholderTextColor={colors.text.disabled}
            maxLength={TITLE_MAX}
            accessibilityLabel="일정 이름"
            testID={`${id}-input`}
            style={{
              backgroundColor: colors.surface[2],
              borderRadius: radius.md,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              marginTop: space[4],
              color: colors.text.primary,
              fontFamily: 'PretendardVariable',
              fontSize: 16,
            }}
          />

          <View style={{ flexDirection: 'row', gap: space[3], marginTop: space[4] }}>
            <TimeField
              label="시작"
              minute={startMinute}
              onChange={handleStartChange}
              testIDPrefix={`${id}-start`}
            />
            <TimeField
              label="종료"
              minute={endMinute}
              onChange={setEndMinute}
              minExclusive={startMinute}
              testIDPrefix={`${id}-end`}
            />
          </View>

          {error === null ? null : (
            <Caption
              variant="default"
              color={colors.semantic.error.fg}
              style={{ marginTop: space[3] }}
            >
              {error}
            </Caption>
          )}

          <View style={{ flexDirection: 'row', gap: space[2], marginTop: space[6] }}>
            <View style={{ flex: 1 }}>
              <Button
                label={editing === null ? '취소' : '삭제'}
                onPress={editing === null ? handleDismiss : () => setConfirmDelete(true)}
                variant={editing === null ? 'ghost' : 'destructive'}
                size="md"
                disabled={saving || deleting}
                testID={editing === null ? `${id}-cancel` : `${id}-delete`}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="저장"
                onPress={handleSave}
                variant="primary"
                size="md"
                loading={saving}
                testID={`${id}-save`}
              />
            </View>
          </View>
        </Animated.View>
      </View>

      <ConfirmSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="일정을 삭제할까요?"
        message="삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        onConfirm={handleDelete}
        destructive
        loading={deleting}
        testID="personal-delete-confirm"
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  timeField: {
    height: 48,
    borderWidth: 1,
    justifyContent: 'center',
  },
  timeOption: {
    height: TIME_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
