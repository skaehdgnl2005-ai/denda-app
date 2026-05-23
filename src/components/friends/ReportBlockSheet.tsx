import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme } from '@/design/theme';
import { Body, Title } from '@/design/typography';
import { Icon } from '@/components/Icon';
import { FriendUser } from '@/lib/friends/api';

export interface ReportBlockSheetProps {
  visible: boolean;
  onClose: () => void;
  targetUser: FriendUser | null;
  onBlock: (userId: string) => void;
  onReport: (userId: string, reason: string, description: string) => void;
}

type SheetStep = 'menu' | 'report-reasons' | 'report-details';

const REPORT_REASONS = [
  { key: 'spam', label: '스팸 및 광고' },
  { key: 'inappropriate', label: '부적절한 닉네임 또는 프로필' },
  { key: 'fraud', label: '사기 또는 허위 사실' },
  { key: 'other', label: '기타 사유' },
];

export const ReportBlockSheet: React.FC<ReportBlockSheetProps> = ({
  visible,
  onClose,
  targetUser,
  onBlock,
  onReport,
}) => {
  const { colors, space, radius } = useTheme();
  const [step, setStep] = useState<SheetStep>('menu');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState<string>('');

  if (!targetUser) return null;

  const handleClose = () => {
    setStep('menu');
    setSelectedReason('');
    setDetails('');
    onClose();
  };

  const handleBlockClick = () => {
    onBlock(targetUser.id);
    handleClose();
  };

  const handleReasonSelect = (reasonLabel: string) => {
    setSelectedReason(reasonLabel);
    setStep('report-details');
  };

  const handleReportSubmit = () => {
    onReport(targetUser.id, selectedReason, details);
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Backdrop */}
        <Pressable
          style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}
          onPress={handleClose}
          testID="sheet-backdrop"
        />

        {/* Sheet Content */}
        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface[1],
              borderTopLeftRadius: radius['2xl'],
              borderTopRightRadius: radius['2xl'],
              paddingBottom: space[8] + (Platform.OS === 'ios' ? 16 : 0),
            },
          ]}
          testID="report-block-sheet"
        >
          {/* Grabber */}
          <View style={[styles.grabberContainer, { paddingVertical: space[3] }]}>
            <View
              style={[
                styles.grabber,
                {
                  backgroundColor: colors.surface[3],
                  borderRadius: radius.full,
                },
              ]}
            />
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space[4] }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: Menu Options */}
            {step === 'menu' && (
              <View>
                <Title level="h3" color={colors.text.primary} style={[styles.title, { marginBottom: space[4] }]}>
                  {targetUser.nickname}님 설정
                </Title>

                {/* Report Option */}
                <Pressable
                  onPress={() => setStep('report-reasons')}
                  accessibilityRole="button"
                  accessibilityLabel="친구 신고하기"
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      paddingVertical: space[4],
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.subtle,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                  testID="report-option"
                >
                  <Icon name="신고" color={colors.text.secondary} size={20} />
                  <Body variant="primary" color={colors.text.primary} style={styles.optionText}>
                    신고하기
                  </Body>
                </Pressable>

                {/* Block Option */}
                <Pressable
                  onPress={handleBlockClick}
                  accessibilityRole="button"
                  accessibilityLabel="친구 차단하기"
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      paddingVertical: space[4],
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                  testID="block-option"
                >
                  <Icon name="차단" color={colors.semantic.error.fg} size={20} />
                  <Body variant="primary" color={colors.semantic.error.fg} style={styles.optionText}>
                    차단하기
                  </Body>
                </Pressable>
              </View>
            )}

            {/* Step 2: Report Reasons */}
            {step === 'report-reasons' && (
              <View>
                <View style={styles.headerRow}>
                  <Pressable
                    onPress={() => setStep('menu')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="이전 화면으로 돌아가기"
                    testID="back-to-menu-button"
                  >
                    <Icon name="뒤로" color={colors.text.primary} size={24} />
                  </Pressable>
                  <Title level="h3" color={colors.text.primary} style={styles.headerTitle}>
                    신고 사유 선택
                  </Title>
                </View>

                <View style={{ marginTop: space[2] }}>
                  {REPORT_REASONS.map((reason) => (
                    <Pressable
                      key={reason.key}
                      onPress={() => handleReasonSelect(reason.label)}
                      accessibilityRole="button"
                      accessibilityLabel={`${reason.label} 사유로 신고`}
                      style={({ pressed }) => [
                        styles.optionRow,
                        {
                          paddingVertical: space[4],
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border.subtle,
                          opacity: pressed ? 0.6 : 1,
                        },
                      ]}
                      testID={`reason-${reason.key}`}
                    >
                      <Body variant="primary" color={colors.text.primary}>
                        {reason.label}
                      </Body>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Step 3: Report Details */}
            {step === 'report-details' && (
              <View>
                <View style={styles.headerRow}>
                  <Pressable
                    onPress={() => setStep('report-reasons')}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="이전 화면으로 돌아가기"
                    testID="back-to-reasons-button"
                  >
                    <Icon name="뒤로" color={colors.text.primary} size={24} />
                  </Pressable>
                  <Title level="h3" color={colors.text.primary} style={styles.headerTitle}>
                    상세 내용 입력
                  </Title>
                </View>

                <Body variant="sm-bold" color={colors.text.secondary} style={{ marginTop: space[4] }}>
                  사유: {selectedReason}
                </Body>

                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="신고 상세 내용을 입력해주세요. (선택사항)"
                  placeholderTextColor={colors.text.disabled}
                  multiline
                  numberOfLines={4}
                  style={[
                    styles.textInput,
                    {
                      borderColor: colors.border.strong,
                      borderRadius: radius.md,
                      color: colors.text.primary,
                      backgroundColor: colors.surface[2],
                      padding: space[3],
                      marginTop: space[3],
                      minHeight: 100,
                    },
                  ]}
                  accessibilityLabel="신고 상세 내용 입력"
                  testID="report-details-input"
                />

                <Pressable
                  onPress={handleReportSubmit}
                  accessibilityRole="button"
                  accessibilityLabel="신고 제출"
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor: colors.brand[500],
                      borderRadius: radius.md,
                      marginTop: space[6],
                      paddingVertical: space[3],
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  testID="report-submit-button"
                >
                  <Body variant="bold" color={colors.text['on-brand']}>
                    신고 제출
                  </Body>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '90%',
  },
  grabberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 4,
  },
  title: {
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    marginLeft: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: 12,
  },
  textInput: {
    borderWidth: 1,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
