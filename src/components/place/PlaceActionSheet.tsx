// S08-ui — 장소 액션 바텀시트 (DESIGN §10.3)
//
// 마커 탭 → trigger sheet. 두 CTA:
//   1) "예약하기" — Gate #2 click 로깅 (caller가 onReservationPress 내부에서 logReservationClick 호출)
//   2) "장소만 정하기" — 카톡 공유 (caller가 onSharePress 내부에서 sharePlaceToKakao 호출)
//
// Phase 1+2 baseline: 보증금/환불 정책 영역(DESIGN §10.3 spec의 결제 line)은
// 🔒 Phase 3 코드 작성 금지 정책에 따라 미노출. 대신 "예약은 준비 중" info chip.
//
// §17 anti-AI-feel:
//   - brand-500 fill CTA 1개 ("예약하기"), secondary "장소만 정하기" (surface-2)
//   - inflight = ActivityIndicator (CTA disable + 더블 탭 방어)
//   - 친근체 micro-copy (founder review 대기 — Q-B12 closure 시 본문 교체 가능)

import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';

export interface PlaceSheetPlace {
  id: string;
  name: string;
  category?: string;
  address?: string;
}

export interface PlaceActionSheetProps {
  visible: boolean;
  onClose: () => void;
  place: PlaceSheetPlace;
  groupName: string;
  /** DESIGN §10.2 강조와 별개 — 추후 chip 노출 위치 wire-up. 현재는 props 보관만 */
  isPartnership: boolean;
  /**
   * "예약하기" press. caller가 내부에서 `logReservationClick({groupId, placeId, partnershipId})` 호출.
   * 성공 → 시트 close. 실패 throw → 한국어 메시지 노출 + 시트 유지.
   */
  onReservationPress: () => Promise<void>;
  /**
   * "장소만 정하기" press. caller가 내부에서 `sharePlaceToKakao(args, opts)` 호출.
   * 성공 → 시트 close. 실패 throw → 한국어 메시지 노출 + 시트 유지.
   */
  onSharePress: () => Promise<void>;
  testID?: string;
}

type BusyState = 'idle' | 'reservation' | 'share';

export const PlaceActionSheet: React.FC<PlaceActionSheetProps> = ({
  visible,
  onClose,
  place,
  // groupName, isPartnership는 caller의 onReservationPress/onSharePress가 사용 — 본 component는 prop으로 보관만
  onReservationPress,
  onSharePress,
  testID,
}) => {
  const { colors, space, radius, shadow } = useTheme();
  const [busy, setBusy] = useState<BusyState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!visible) return null;

  const isBusy = busy !== 'idle';
  const sheetTestID = testID ?? 'place-action-sheet';

  const handleClose = (): void => {
    if (isBusy) return;
    setBusy('idle');
    setErrorMsg(null);
    onClose();
  };

  const handleReservation = async (): Promise<void> => {
    if (isBusy) return;
    setBusy('reservation');
    setErrorMsg(null);
    try {
      await onReservationPress();
      setBusy('idle');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '예약을 기록하지 못했어요.';
      setErrorMsg(message);
      setBusy('idle');
    }
  };

  const handleShare = async (): Promise<void> => {
    if (isBusy) return;
    setBusy('share');
    setErrorMsg(null);
    try {
      await onSharePress();
      setBusy('idle');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : '공유에 실패했어요.';
      setErrorMsg(message);
      setBusy('idle');
    }
  };

  const reservationBg = isBusy ? colors.surface[2] : colors.brand[500];
  const reservationFg = isBusy ? colors.text.disabled : colors.text['on-brand'];
  const shareBg = isBusy ? colors.surface[2] : colors.surface[2];
  const shareFg = isBusy ? colors.text.disabled : colors.text.secondary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      testID={sheetTestID}
    >
      <View style={styles.root}>
        <Pressable
          testID={`${sheetTestID}-backdrop`}
          accessibilityLabel="시트 닫기"
          onPress={handleClose}
          style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]}
        />

        <View
          style={[
            styles.container,
            shadow.e3,
            {
              backgroundColor: colors.surface[1],
              borderTopLeftRadius: radius['2xl'],
              borderTopRightRadius: radius['2xl'],
              paddingBottom: space[6],
            },
          ]}
        >
          <View style={[styles.grabberRow, { paddingTop: space[2], paddingBottom: space[3] }]}>
            <View
              testID={`${sheetTestID}-grabber`}
              style={[
                styles.grabber,
                { backgroundColor: colors.surface[3], borderRadius: radius.full },
              ]}
            />
          </View>

          <View style={{ paddingHorizontal: space[4] }}>
            <Title level="h2" color={colors.text.primary}>
              {place.name}
            </Title>

            {place.category ? (
              <Caption color={colors.text.tertiary} style={{ marginTop: space[1] }}>
                {place.category}
              </Caption>
            ) : null}

            {place.address ? (
              <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[2] }}>
                {place.address}
              </Body>
            ) : null}

            <View
              testID="phase12-notice"
              style={[
                styles.notice,
                {
                  backgroundColor: colors.semantic.info.bg,
                  borderColor: colors.semantic.info.border,
                  borderRadius: radius.md,
                  marginTop: space[4],
                  padding: space[3],
                },
              ]}
            >
              <Body variant="sm" color={colors.semantic.info.fg}>
                예약 기능은 준비 중이에요. 지금은 식당 정보만 공유할 수 있어요.
              </Body>
            </View>

            {errorMsg ? (
              <Body
                variant="sm"
                color={colors.semantic.error.fg}
                testID="error-message"
                style={{ marginTop: space[3] }}
              >
                {errorMsg}
              </Body>
            ) : null}

            <View style={{ marginTop: space[5], gap: space[2] }}>
              <Pressable
                testID="reservation-cta"
                accessibilityRole="button"
                accessibilityLabel="예약하기"
                accessibilityState={{ disabled: isBusy, busy: busy === 'reservation' }}
                onPress={handleReservation}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: reservationBg,
                    borderRadius: radius.md,
                    paddingVertical: space[3],
                    opacity: pressed && !isBusy ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.ctaContent}>
                  {busy === 'reservation' ? (
                    <ActivityIndicator
                      size="small"
                      color={reservationFg}
                      testID="reservation-cta-spinner"
                    />
                  ) : null}
                  <Body variant="bold" color={reservationFg}>
                    예약하기
                  </Body>
                </View>
              </Pressable>

              <Pressable
                testID="share-cta"
                accessibilityRole="button"
                accessibilityLabel="장소만 정하기"
                accessibilityState={{ disabled: isBusy, busy: busy === 'share' }}
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: shareBg,
                    borderRadius: radius.md,
                    paddingVertical: space[3],
                    opacity: pressed && !isBusy ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.ctaContent}>
                  {busy === 'share' ? (
                    <ActivityIndicator size="small" color={shareFg} testID="share-cta-spinner" />
                  ) : null}
                  <Body variant="bold" color={shareFg}>
                    장소만 정하기
                  </Body>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    width: '100%',
  },
  grabberRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grabber: {
    width: 36,
    height: 4,
  },
  notice: {
    borderWidth: 1,
  },
  cta: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
