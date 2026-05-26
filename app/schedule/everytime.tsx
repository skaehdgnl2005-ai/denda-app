// S03b — 에브리타임 OCR import 화면
// flow: semester input → upload → OCR → preview/edit → confirm → success
//
// 결정 의존:
//   D2 OCR keep, D13 KST, D15 source='everytime' enum 격리

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { SemesterInput } from '@/components/everytime/SemesterInput';
import { CourseRow } from '@/components/everytime/CourseRow';
import {
  ImagePickerPermissionDeniedError,
  ImagePickerUnavailableError,
  pickImageFromLibrary,
} from '@/lib/ocr/imagePicker';
import { confirmEverytimeOcr, previewEverytimeOcr, type OcrCourse } from '@/lib/ocr/everytime';
import {
  addCourse,
  hasAnyValidationError,
  removeCourse,
  updateCourse,
} from '@/lib/ocr/courseListEditor';
import { isSemesterValid } from '@/lib/ocr/semesterValidation';

type Step = 'input' | 'ocr_loading' | 'preview' | 'confirming' | 'success';

export default function EverytimeImportScreen() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();

  const [step, setStep] = useState<Step>('input');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [courses, setCourses] = useState<OcrCourse[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [insertedCount, setInsertedCount] = useState(0);

  const semesterReady = isSemesterValid(semesterStart, semesterEnd);
  const canConfirm = semesterReady && courses.length > 0 && !hasAnyValidationError(courses);

  const handlePickAndOcr = async () => {
    if (!semesterReady) {
      Alert.alert('학기 입력', '학기 시작·종료일을 먼저 입력해주세요.');
      return;
    }
    try {
      setStep('ocr_loading');
      const picked = await pickImageFromLibrary();
      const result = await previewEverytimeOcr({
        imageBase64: picked.base64,
        mimeType: picked.mimeType,
      });
      if (result.courses.length === 0) {
        Alert.alert('OCR 결과', '강의를 찾지 못했어요. 다른 스크린샷으로 시도해주세요.');
        setStep('input');
        return;
      }
      setCourses(result.courses);
      setStep('preview');
    } catch (e) {
      if (e instanceof ImagePickerUnavailableError) {
        Alert.alert('곧 활성화돼요', e.message);
      } else if (e instanceof ImagePickerPermissionDeniedError) {
        Alert.alert('권한 필요', e.message);
      } else if (e instanceof Error && e.message === 'canceled') {
        // 사용자 취소 — silent
      } else {
        Alert.alert('OCR 실패', (e as Error).message ?? '잠시 후 다시 시도해주세요.');
      }
      setStep('input');
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setStep('confirming');
      const result = await confirmEverytimeOcr({
        courses,
        semesterStart,
        semesterEnd,
        replaceExisting,
      });
      setInsertedCount(result.inserted);
      setStep('success');
    } catch (e) {
      Alert.alert('저장 실패', (e as Error).message ?? '잠시 후 다시 시도해주세요.');
      setStep('preview');
    }
  };

  const renderHeader = () => (
    <View style={[styles.topBar, { paddingHorizontal: space[4], paddingVertical: space[3] }]}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        testID="back-button"
        style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Icon name="뒤로" color={colors.text.primary} size={24} />
      </Pressable>
      <Title level="h2" color={colors.text.primary}>
        에브리타임 가져오기
      </Title>
      <View style={styles.iconButton} />
    </View>
  );

  const renderInput = () => (
    <ScrollView contentContainerStyle={{ padding: space[4] }} keyboardShouldPersistTaps="handled">
      <Title level="h3" color={colors.text.primary} style={{ marginBottom: space[2] }}>
        학기 기간을 알려주세요
      </Title>
      <Body variant="sm" color={colors.text.secondary} style={{ marginBottom: space[4] }}>
        시간표 일정이 학기 종료일까지만 자동으로 추가돼요.
      </Body>

      <SemesterInput
        start={semesterStart}
        end={semesterEnd}
        onChangeStart={setSemesterStart}
        onChangeEnd={setSemesterEnd}
      />

      <View style={{ height: space[6] }} />

      <Pressable
        onPress={handlePickAndOcr}
        disabled={!semesterReady}
        accessibilityRole="button"
        accessibilityLabel="시간표 사진 선택"
        testID="pick-image-button"
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: semesterReady ? colors.brand[500] : colors.surface[2],
            borderRadius: radius.md,
            paddingVertical: space[3],
            paddingHorizontal: space[4],
            opacity: pressed && semesterReady ? 0.92 : 1,
          },
        ]}
      >
        <Body variant="bold" color={semesterReady ? colors.text['on-brand'] : colors.text.tertiary}>
          시간표 사진 선택
        </Body>
      </Pressable>

      {!semesterReady && (
        <Body
          variant="sm"
          color={colors.text.tertiary}
          style={{ marginTop: space[2], textAlign: 'center' }}
        >
          학기 기간을 입력하면 사진 선택을 시작할 수 있어요.
        </Body>
      )}
    </ScrollView>
  );

  const renderLoading = (label: string) => (
    <View style={[styles.centered, { padding: space[4] }]}>
      <ActivityIndicator color={colors.brand[500]} size="large" />
      <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[3] }}>
        {label}
      </Body>
    </View>
  );

  const renderPreview = () => (
    <ScrollView
      contentContainerStyle={{ padding: space[4], paddingBottom: space[8] }}
      keyboardShouldPersistTaps="handled"
    >
      <Caption color={colors.text.secondary} style={{ marginBottom: space[2] }}>
        강의 {courses.length}개 인식됨 · 확인 후 저장하세요
      </Caption>

      {courses.map((c, i) => (
        <CourseRow
          key={i}
          course={c}
          index={i}
          onChange={(patch) => setCourses((prev) => updateCourse(prev, i, patch))}
          onRemove={() => setCourses((prev) => removeCourse(prev, i))}
        />
      ))}

      <Pressable
        onPress={() => setCourses((prev) => addCourse(prev))}
        accessibilityRole="button"
        accessibilityLabel="강의 추가"
        testID="add-course-button"
        style={({ pressed }) => [
          {
            borderWidth: 1,
            borderColor: colors.border.subtle,
            borderRadius: radius.md,
            paddingVertical: space[3],
            alignItems: 'center',
            backgroundColor: pressed ? colors.surface[2] : colors.surface[0],
            marginBottom: space[4],
          },
        ]}
      >
        <Body variant="sm-bold" color={colors.text.secondary}>
          + 강의 추가
        </Body>
      </Pressable>

      <Pressable
        onPress={() => setReplaceExisting((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: replaceExisting }}
        accessibilityLabel="기존 에브리타임 일정 모두 교체"
        testID="replace-existing-toggle"
        style={({ pressed }) => [
          styles.toggleRow,
          {
            paddingVertical: space[3],
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: replaceExisting ? colors.brand[500] : colors.border.strong,
              backgroundColor: replaceExisting ? colors.brand[500] : 'transparent',
              borderRadius: radius.sm,
            },
          ]}
        >
          {replaceExisting && <Icon name="확정" color={colors.text['on-brand']} size={14} />}
        </View>
        <Body variant="sm" color={colors.text.primary} style={{ marginLeft: space[2] }}>
          기존 에브리타임 일정 모두 교체하기
        </Body>
      </Pressable>

      <View style={{ height: space[4] }} />

      <Pressable
        onPress={handleConfirm}
        disabled={!canConfirm}
        accessibilityRole="button"
        accessibilityLabel="일정 저장"
        testID="confirm-button"
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: canConfirm ? colors.brand[500] : colors.surface[2],
            borderRadius: radius.md,
            paddingVertical: space[3],
            paddingHorizontal: space[4],
            opacity: pressed && canConfirm ? 0.92 : 1,
          },
        ]}
      >
        <Body variant="bold" color={canConfirm ? colors.text['on-brand'] : colors.text.tertiary}>
          일정에 저장하기
        </Body>
      </Pressable>

      {!canConfirm && courses.length > 0 && (
        <Body
          variant="sm"
          color={colors.text.tertiary}
          style={{ marginTop: space[2], textAlign: 'center' }}
        >
          빨간색으로 표시된 강의를 먼저 수정해주세요.
        </Body>
      )}
    </ScrollView>
  );

  const renderSuccess = () => (
    <View style={[styles.centered, { padding: space[4] }]}>
      <View
        style={[
          styles.successIcon,
          { backgroundColor: colors.brand[50], borderRadius: radius.full },
        ]}
      >
        <Icon name="확정" color={colors.brand[500]} size={32} />
      </View>
      <Title level="h2" color={colors.text.primary} style={{ marginTop: space[4] }}>
        시간표를 가져왔어요!
      </Title>
      <Body
        variant="sm"
        color={colors.text.secondary}
        style={{ marginTop: space[2], textAlign: 'center' }}
      >
        {insertedCount}개의 강의가 학기 종료일까지 자동 반복돼요.
      </Body>

      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="홈으로 돌아가기"
        testID="back-home-button"
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: colors.brand[500],
            borderRadius: radius.md,
            paddingVertical: space[3],
            paddingHorizontal: space[8],
            marginTop: space[6],
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Body variant="bold" color={colors.text['on-brand']}>
          돌아가기
        </Body>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface[0] }]} edges={['top']}>
      {renderHeader()}
      {step === 'input' && renderInput()}
      {step === 'ocr_loading' && renderLoading('사진을 분석하는 중이에요...')}
      {step === 'preview' && renderPreview()}
      {step === 'confirming' && renderLoading('일정을 저장하는 중이에요...')}
      {step === 'success' && renderSuccess()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
