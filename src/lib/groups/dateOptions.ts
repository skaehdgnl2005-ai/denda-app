// S18 — 모임 후보 날짜 옵션. KST 기준. buildDateOptions/formatDateChip는 순수 함수
// (now() 미사용)라 결정적 테스트 가능. 그리드가 dates DATE[]를 소비하므로
// 동일한 yyyy-MM-dd(KST) 포맷 유지. bare 생성자 대신 luxon DateTime만 사용 (D13).
import { DateTime } from 'luxon';

export function buildDateOptions(baseIsoDate: string, count: number): string[] {
  const base = DateTime.fromISO(baseIsoDate, { zone: 'Asia/Seoul' });
  if (!base.isValid || count <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const iso = base.plus({ days: i }).toISODate();
    if (iso) out.push(iso);
  }
  return out;
}

export function formatDateChip(isoDate: string): string {
  const d = DateTime.fromISO(isoDate, { zone: 'Asia/Seoul' }).setLocale('ko');
  if (!d.isValid) return isoDate;
  return d.toFormat('M/d (EEE)');
}

// 화면에서 buildDateOptions의 base로 사용 (KST 오늘).
export function todayKstIso(): string {
  return DateTime.now().setZone('Asia/Seoul').toISODate() ?? '';
}
