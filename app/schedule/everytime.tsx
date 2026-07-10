// S03b — 에브리타임 OCR import 화면
// flow: semester input → upload → OCR → preview/edit → confirm → success
//
// 결정 의존:
//   D2 OCR keep, D13 KST, D15 source='everytime' enum 격리

import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Icon } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Skeleton } from '@/components/Skeleton';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { mapError } from '@/lib/i18n/messages';
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
  const toast = useToast();

  const [step, setStep] = useState<Step>('input');
  const [semesterStart, setSemesterStart] = useState('');
  const [semesterEnd, setSemesterEnd] = useState('');
  const [courses, setCourses] = useState<OcrCourse[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [insertedCount, setInsertedCount] = useState(0);
  const [permissionSheet, setPermissionSheet] = useState(false);

  const semesterReady = isSemesterValid(semesterStart, semesterEnd);
  const canConfirm = semesterReady && courses.length > 0 && !hasAnyValidationError(courses);

  const handlePickAndOcr = async () => {
    // 학기 미입력은 버튼 disabled + 인라인 힌트로 이미 안내 (Alert 제거, §11.3 폼 패턴).
    if (!semesterReady) return;
    try {
      setStep('ocr_loading');
      const picked = await pickImageFromLibrary();
      const result = await previewEverytimeOcr({
        imageBase64: picked.base64,
        mimeType: picked.mimeType,
      });
      if (result.courses.length === 0) {
        toast.show({
          message: '강의를 찾지 못했어요. 다른 스크린샷으로 시도해주세요.',
          variant: 'error',
        });
        setStep('input');
        return;
      }
      setCourses(result.courses);
      setStep('preview');
    } catch (e) {
      setStep('input');
      if (e instanceof ImagePickerUnavailableError) {
        toast.show({ message: '사진 가져오기는 곧 준비돼요. 조금만 기다려주세요.' });
      } else if (e instanceof ImagePickerPermissionDeniedError) {
        setPermissionSheet(true);
      } else {
        // 취소류는 mapError가 silent 처리 — raw e.message는 노출하지 않는다.
        const { silent, message } = mapError(e);
        if (!silent) toast.show({ message, variant: 'error' });
      }
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
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
      setStep('preview');
    }
  };

  const renderHeader = () => (
    <ScreenHeader title="에브리타임 가져오기" onBack={() => router.back()} />
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

  // OCR 진행(수 초)은 스피너 대신 결과 프리뷰 형태 Skeleton으로 체감 대기를 낮춘다 (§11.1).
  const renderOcrLoading = () => (
    <ScrollView contentContainerStyle={{ padding: space[4] }} testID="ocr-loading">
      <Title level="h3" color={colors.text.primary}>
        시간표를 읽고 있어요...
      </Title>
      <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[2] }}>
        강의 정보를 하나씩 정리하는 중이에요.
      </Body>
      <View style={{ height: space[5] }} />
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            borderWidth: 1,
            borderColor: colors.border.subtle,
            borderRadius: radius.md,
            padding: space[4],
            marginBottom: space[3],
          }}
        >
          <Skeleton width="60%" height={18} />
          <Skeleton width="40%" height={14} style={{ marginTop: space[2] }} />
        </View>
      ))}
    </ScrollView>
  );

  // 저장(confirm)은 짧은 액션 — Skeleton이 아닌 Spinner (§11.1).
  const renderConfirming = () => (
    <View style={[styles.centered, { padding: space[4] }]} testID="confirming">
      <Spinner />
      <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[3] }}>
        일정을 저장하는 중이에요...
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
      {step === 'ocr_loading' && renderOcrLoading()}
      {step === 'preview' && renderPreview()}
      {step === 'confirming' && renderConfirming()}
      {step === 'success' && renderSuccess()}

      {/* 사진 권한 거부 → 시스템 Alert 대신 설정 이동 ConfirmSheet */}
      <ConfirmSheet
        visible={permissionSheet}
        onClose={() => setPermissionSheet(false)}
        title="사진 접근 권한이 필요해요"
        message="시간표 사진을 불러오려면 설정에서 사진 접근을 허용해 주세요."
        confirmLabel="설정 열기"
        cancelLabel="다음에"
        onConfirm={() => {
          setPermissionSheet(false);
          void Linking.openSettings();
        }}
        testID="permission-sheet"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
