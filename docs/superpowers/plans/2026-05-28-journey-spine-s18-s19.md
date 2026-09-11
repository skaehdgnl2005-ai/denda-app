# 여정 척추 클러스터 A (S18 모임생성 + S19 모임리스트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 앱 안에서 모임을 만들고(S18), 홈에서 내 모임 목록을 보고 탭해 시간 그리드 화면(`/group/[id]`)에 도달(S19)할 수 있게 한다 — 현재 도달 불가능한 척추를 연결.

**Architecture:** `create_group` Postgres RPC(단일 트랜잭션으로 groups + 호스트 group_members INSERT, invite_code는 기존 트리거 자동)로 원자적 생성. 클라이언트는 얇은 wrapper(`createGroup`)로 호출. 모임 리스트는 RLS(`groups_select_member_or_host`)가 자연 필터하는 `fetchMyGroups`. 홈 화면이 리스트를 렌더하고 각 항목·CTA가 navigation 연결. 지도(S10)·친구 API(mock)는 일절 미접촉.

**Tech Stack:** React Native + Expo Router(file-based routing), Supabase(Postgres RPC + RLS), zustand(useAuth), luxon(KST), Jest + @testing-library/react-native(TDD).

---

## 배경: 기존 코드 사실 (구현 전 숙지)

- **groups 스키마** (`supabase/migrations/0001_initial.sql:198`): `id`, `host_id`, `name`, `dates DATE[] NOT NULL` (CHECK `array_length(dates,1) > 0`), `confirmed_at`, `confirmed_start_at`, `confirmed_end_at`, `confirmed_place_id`, `f4_sent_at` 등. `invite_code CHAR(4)`는 `0016`의 BEFORE INSERT 트리거가 자동 채움 → **createGroup이 건드리지 않음**.
- **RLS** (`supabase/migrations/0002_rls.sql`): `groups_insert_as_host`(WITH CHECK `auth.uid()=host_id`), `group_members_insert_self`(WITH CHECK `auth.uid()=user_id`), `groups_select_member_or_host`(host 또는 멤버만 SELECT). → SECURITY INVOKER RPC로 두 INSERT 모두 자연 통과.
- **RPC 패턴 레퍼런스**: `supabase/migrations/0008_block_user_rpc.sql` (plpgsql 단일 tx + `auth.uid()` 내부 추출 + REVOKE/GRANT).
- **lib wrapper 패턴**: `src/lib/blocks/api.ts` (`supabase.rpc(name, {p_arg})` + 에러 한국어 throw), `src/lib/groups/queries.ts` (`supabase.from('groups').select(...)`).
- **화면 테스트 패턴**: `tests/screens/group/place.test.tsx` (`jest.mock('expo-router', ...)` + lib 모듈 mock + `ThemeProvider` wrapper + `findByTestId`/`act`/`fireEvent`/`waitFor`).
- **홈 화면 현 상태**: `app/(tabs)/index.tsx` — "새 모임 만들기" CTA `onPress`가 `/* TODO S04 */` 빈 stub(`:77`), "다가오는 모임"이 `upcomingCount = 0` 하드코딩(`:18`) + 빈 카드.
- **친구탭 현 상태**: `app/(tabs)/friends/index.tsx:55` `handleMakeGroup` = `Alert("모임을 만듭니다")` 스텁.
- **그리드 화면**: `app/group/[id]/index.tsx` 존재(도착지). `app/group/_layout.tsx`는 Stack.

## 절대 규칙 (모든 태스크 공통)

- **TDD**: 테스트 먼저 → 실패 확인 → 최소 구현 → 통과 → 커밋.
- **KST**: `new Date()` 직접 금지(design-guard hook 차단). luxon `DateTime.now().setZone('Asia/Seoul')` / `DateTime.fromISO(iso, {zone:'Asia/Seoul'})`.
- **한국어 UI** only. 에러 메시지 친근체.
- **DESIGN 토큰만**: hex 금지 → `useTheme()`의 `colors.*`. brand-500 fill CTA는 화면당 1개(§17). 간격 `space[N]`.
- **타입**: strict, `any` 금지, 명시적 return type, props interface.

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `src/lib/groups/dateOptions.ts` | 후보 날짜 옵션 생성·칩 라벨 (순수 함수) | T1 |
| `supabase/migrations/0018_create_group_rpc.sql` | `create_group` 원자적 RPC | T2 |
| `src/lib/groups/create.ts` | `createGroup` 클라 wrapper | T3 |
| `app/group/new.tsx` | 모임 생성 화면 + 홈/친구탭 진입 wire-up | T4 |
| `src/lib/groups/list.ts` | `fetchMyGroups` 조회 | T5 |
| `app/(tabs)/index.tsx` | 홈 "다가오는 모임" 실데이터 + 카드 navigation | T6 |
| `docs/TASK_BACKLOG.md` 등 | Lane E + S18~S24 entry 추가 | T7 |

---

## Task 1: 후보 날짜 옵션 순수 함수

**Files:**
- Create: `src/lib/groups/dateOptions.ts`
- Test: `src/lib/groups/dateOptions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/groups/dateOptions.test.ts
import { buildDateOptions, formatDateChip, todayKstIso } from './dateOptions';

describe('buildDateOptions', () => {
  test('base부터 count일간의 ISO 날짜를 반환', () => {
    expect(buildDateOptions('2026-05-30', 3)).toEqual(['2026-05-30', '2026-05-31', '2026-06-01']);
  });

  test('count <= 0 이면 빈 배열', () => {
    expect(buildDateOptions('2026-05-30', 0)).toEqual([]);
  });

  test('잘못된 base ISO면 빈 배열', () => {
    expect(buildDateOptions('not-a-date', 5)).toEqual([]);
  });
});

describe('formatDateChip', () => {
  test('M/d (요일) 형식 — 5/30로 시작', () => {
    const label = formatDateChip('2026-05-30');
    expect(label.startsWith('5/30')).toBe(true);
    expect(label).toMatch(/^\d+\/\d+ \(.\)$/);
  });
});

describe('todayKstIso', () => {
  test('yyyy-MM-dd 형식 문자열', () => {
    expect(todayKstIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/groups/dateOptions.test.ts`
Expected: FAIL — "Cannot find module './dateOptions'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/groups/dateOptions.ts
// 모임 후보 날짜 옵션 — KST 기준. 순수 함수(now() 미사용)라 결정적 테스트 가능.
// 그리드가 dates DATE[]를 소비하므로 동일한 yyyy-MM-dd(KST) 포맷 유지.
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
  return d.toFormat('M/d (EEEEE)');
}

// 화면에서 buildDateOptions의 base로 사용 (KST 오늘).
export function todayKstIso(): string {
  return DateTime.now().setZone('Asia/Seoul').toISODate() ?? '';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/groups/dateOptions.test.ts`
Expected: PASS (4 tests). 만약 `formatDateChip`의 `EEEEE`가 단일 글자 요일을 안 주면 `EEE`로 바꾸고 정규식을 `/^\d+\/\d+ \(.+\)$/`로 완화.

- [ ] **Step 5: Commit**

```bash
git add src/lib/groups/dateOptions.ts src/lib/groups/dateOptions.test.ts
git commit -m "feat(S18): 후보 날짜 옵션 순수 함수 (KST buildDateOptions/formatDateChip)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `create_group` 원자적 RPC 마이그레이션

**Files:**
- Create: `supabase/migrations/0018_create_group_rpc.sql`

이 태스크는 SQL 마이그레이션이다. 이 레포는 마이그레이션 단위 테스트 프레임워크가 없다(예: `0008`도 SQL 단위 테스트 없음). 정합성은 (a) `0001`/`0002` 컬럼·RLS 대조, (b) `0008` 패턴 미러, (c) 다음 `supabase db push` 시점(운영) 적용으로 검증한다. **createGroup의 동작은 Task 3에서 supabase.rpc mock으로 검증**한다.

- [ ] **Step 1: 컬럼·RLS 대조**

Read 확인:
- `supabase/migrations/0001_initial.sql:198-212` — groups 컬럼명: `host_id`, `name`, `dates`.
- `supabase/migrations/0002_rls.sql:141-175` — `groups_insert_as_host`(host_id=auth.uid), `group_members_insert_self`(user_id=auth.uid).
- `supabase/migrations/0008_block_user_rpc.sql` — plpgsql + REVOKE/GRANT 패턴.

- [ ] **Step 2: 마이그레이션 작성**

```sql
-- ============================================================================
-- 된다 (DenDa) — S18: create_group RPC (atomic group + host member)
-- 출처: docs/superpowers/specs/2026-05-28-journey-spine-roadmap-design.md (S18)
--
-- 책임: groups INSERT + 호스트 본인 group_members INSERT를 단일 transaction으로 처리.
--   plpgsql function = single tx → all-or-nothing (멤버 INSERT 실패 시 orphan group 방지).
--   invite_code는 0016 BEFORE INSERT 트리거가 자동 채움.
--
-- SECURITY INVOKER 정당화: 두 INSERT 모두 호출자(host=auth.uid) 기준 RLS 통과
--   (groups_insert_as_host + group_members_insert_self). 권한 상승 불필요 → INVOKER가 안전.
--   host_id는 인자가 아닌 auth.uid()에서 추출 → 위변조 불가.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_group(p_name TEXT, p_dates DATE[])
RETURNS UUID AS $$
DECLARE
  v_host_id UUID := auth.uid();
  v_group_id UUID;
BEGIN
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Group name required';
  END IF;
  IF p_dates IS NULL OR array_length(p_dates, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one date required';
  END IF;

  INSERT INTO public.groups (host_id, name, dates)
  VALUES (v_host_id, btrim(p_name), p_dates)
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group_id, v_host_id);

  RETURN v_group_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

COMMENT ON FUNCTION public.create_group IS 'S18: groups + 호스트 group_members 원자적 생성. host_id=auth.uid(). invite_code는 트리거 자동.';

REVOKE ALL ON FUNCTION public.create_group(TEXT, DATE[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, DATE[]) TO authenticated;
```

- [ ] **Step 3: 자체 검증**

확인 사항(눈으로 + grep):
- 컬럼명 `host_id`/`name`/`dates`가 `0001`과 일치.
- 함수 시그너처 `create_group(TEXT, DATE[])` — Task 3 wrapper의 `p_name`/`p_dates`와 일치.
- (로컬 supabase 인스턴스가 있으면) `supabase db reset` 후 인증 세션으로 `select public.create_group('테스트', array['2026-05-30']::date[])` 스모크 — 그룹+멤버 row 생성 + invite_code 자동 확인. 없으면 운영 `db push` 시점 검증으로 명시.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_create_group_rpc.sql
git commit -m "feat(S18): create_group RPC — groups+호스트 멤버 원자적 생성

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `createGroup` 클라이언트 wrapper

**Files:**
- Create: `src/lib/groups/create.ts`
- Test: `src/lib/groups/create.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/groups/create.test.ts
import { createGroup } from './create';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { rpc: jest.fn() },
}));

const mockRpc = supabase.rpc as jest.Mock;

describe('createGroup', () => {
  beforeEach(() => mockRpc.mockReset());

  test('정상 → {id} 반환 + RPC 인자 shape', async () => {
    mockRpc.mockResolvedValue({ data: 'group-uuid', error: null });
    const result = await createGroup({ name: '5/30 저녁', dates: ['2026-05-30'] });
    expect(result).toEqual({ id: 'group-uuid' });
    expect(mockRpc).toHaveBeenCalledWith('create_group', {
      p_name: '5/30 저녁',
      p_dates: ['2026-05-30'],
    });
  });

  test('이름이 공백뿐이면 사전 throw + RPC 미호출', async () => {
    await expect(createGroup({ name: '   ', dates: ['2026-05-30'] })).rejects.toThrow(
      '모임 이름을 입력해주세요.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('날짜 0개면 사전 throw + RPC 미호출', async () => {
    await expect(createGroup({ name: 'g', dates: [] })).rejects.toThrow(
      '후보 날짜를 한 개 이상 선택해주세요.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('인증 에러 → 로그인 필요 메시지', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Not authenticated' } });
    await expect(createGroup({ name: 'g', dates: ['2026-05-30'] })).rejects.toThrow(
      '로그인이 필요해요.',
    );
  });

  test('기타 에러 → 일반 한국어 메시지', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(createGroup({ name: 'g', dates: ['2026-05-30'] })).rejects.toThrow(
      '모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('data 누락 → 일반 한국어 메시지', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(createGroup({ name: 'g', dates: ['2026-05-30'] })).rejects.toThrow(
      '모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/groups/create.test.ts`
Expected: FAIL — "Cannot find module './create'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/groups/create.ts
// S18 — 모임 생성 클라이언트 wrapper. 서버 create_group RPC(0018)가
// groups + 호스트 group_members INSERT를 원자적 처리. host_id는 서버 auth.uid().
import { supabase } from '@/lib/supabase/client';

export interface CreateGroupInput {
  name: string;
  dates: string[]; // ISO yyyy-MM-dd (KST)
}

export async function createGroup(input: CreateGroupInput): Promise<{ id: string }> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('모임 이름을 입력해주세요.');
  }
  if (!input.dates || input.dates.length === 0) {
    throw new Error('후보 날짜를 한 개 이상 선택해주세요.');
  }

  const { data, error } = await supabase.rpc('create_group', {
    p_name: name,
    p_dates: input.dates,
  });

  if (error) {
    if (/authenticat/i.test(error.message ?? '')) {
      throw new Error('로그인이 필요해요.');
    }
    throw new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!data || typeof data !== 'string') {
    throw new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  return { id: data };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/groups/create.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/groups/create.ts src/lib/groups/create.test.ts
git commit -m "feat(S18): createGroup 클라 wrapper (create_group RPC 호출 + 한국어 에러)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 모임 생성 화면 + 홈/친구탭 진입 wire-up

**Files:**
- Create: `app/group/new.tsx`
- Test: `tests/screens/group/new.test.tsx`
- Modify: `app/(tabs)/index.tsx` (CTA onPress `:77` 영역), `app/(tabs)/friends/index.tsx:55` (handleMakeGroup)
- Verify: `app/group/_layout.tsx` (new.tsx 자동 라우팅 여부)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/group/new.test.tsx
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import NewGroupScreen from '../../../app/group/new';
import { ThemeProvider } from '@/design/theme';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

const mockCreateGroup = jest.fn();
jest.mock('@/lib/groups/create', () => ({
  createGroup: (...args: unknown[]) => mockCreateGroup(...args),
}));

describe('NewGroupScreen', () => {
  const wrapper = ThemeProvider;
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGroup.mockReset();
  });

  test('이름 미입력·날짜 미선택이면 만들기 버튼 비활성', () => {
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });
    expect(getByTestId('create-group-submit').props.accessibilityState?.disabled).toBe(true);
  });

  test('이름 입력 + 날짜 선택 → createGroup 호출 + 성공 시 그리드로 replace', async () => {
    mockCreateGroup.mockResolvedValue({ id: 'g-123' });
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });

    fireEvent.changeText(getByTestId('group-name-input'), '5/30 저녁');
    fireEvent.press(getByTestId('date-chip-0'));

    await act(async () => {
      fireEvent.press(getByTestId('create-group-submit'));
    });

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledTimes(1);
      const arg = mockCreateGroup.mock.calls[0][0];
      expect(arg.name).toBe('5/30 저녁');
      expect(arg.dates).toHaveLength(1);
      expect(mockReplace).toHaveBeenCalledWith('/group/g-123');
    });
  });

  test('createGroup throw → Alert 노출, navigation 없음', async () => {
    mockCreateGroup.mockRejectedValue(new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });

    fireEvent.changeText(getByTestId('group-name-input'), 'g');
    fireEvent.press(getByTestId('date-chip-0'));
    await act(async () => {
      fireEvent.press(getByTestId('create-group-submit'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/screens/group/new.test.tsx`
Expected: FAIL — "Cannot find module '../../../app/group/new'".

- [ ] **Step 3: Write the screen**

```tsx
// app/group/new.tsx
// S18 — 모임 생성 화면. 이름 + 후보 날짜 다중선택(최대 7일) → createGroup → 그리드 진입.
// §17 anti-AI-feel: brand-500 CTA 1개. KST(luxon). 한국어.
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { createGroup } from '@/lib/groups/create';
import { buildDateOptions, formatDateChip, todayKstIso } from '@/lib/groups/dateOptions';

const MAX_DATES = 7; // 그리드 7열 정합
const DATE_WINDOW = 14; // 오늘부터 14일 후보

export default function NewGroupScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inflight, setInflight] = useState(false);

  const options = useMemo(() => buildDateOptions(todayKstIso(), DATE_WINDOW), []);
  const canSubmit = name.trim().length > 0 && selected.size > 0 && !inflight;

  const toggleDate = (iso: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else if (next.size < MAX_DATES) {
        next.add(iso);
      }
      return next;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setInflight(true);
    try {
      const dates = options.filter((d) => selected.has(d));
      const { id } = await createGroup({ name, dates });
      router.replace(`/group/${id}`);
    } catch (e) {
      Alert.alert('알림', (e as Error).message);
    } finally {
      setInflight(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
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
        <Title level="h2" color={colors.text.primary} style={styles.titleFlex}>
          새 모임
        </Title>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
      >
        <Caption color={colors.text.tertiary} style={{ marginTop: space[2], marginBottom: space[2] }}>
          모임 이름
        </Caption>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 5/30 저녁 모임"
          placeholderTextColor={colors.text.disabled}
          testID="group-name-input"
          style={{
            backgroundColor: colors.surface[2],
            borderRadius: radius.md,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            color: colors.text.primary,
            fontFamily: 'PretendardVariable',
            fontSize: 16,
          }}
        />

        <Caption color={colors.text.tertiary} style={{ marginTop: space[6], marginBottom: space[2] }}>
          후보 날짜 (최대 {MAX_DATES}일)
        </Caption>
        <View style={styles.chips}>
          {options.map((iso, i) => {
            const active = selected.has(iso);
            return (
              <Pressable
                key={iso}
                onPress={() => toggleDate(iso)}
                accessibilityRole="button"
                accessibilityLabel={`${formatDateChip(iso)} ${active ? '선택됨' : ''}`}
                accessibilityState={{ selected: active }}
                testID={`date-chip-${i}`}
                style={{
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  borderRadius: radius.md,
                  marginRight: space[2],
                  marginBottom: space[2],
                  backgroundColor: active ? colors.brand[50] : colors.surface[2],
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.brand[500] : colors.border.subtle,
                }}
              >
                <Body
                  variant={active ? 'bold' : 'primary'}
                  color={active ? colors.brand[600] : colors.text.secondary}
                  tabularNums
                >
                  {formatDateChip(iso)}
                </Body>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { padding: space[4], borderTopColor: colors.border.subtle }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilitylabel="모임 만들기"
          accessibilityState={{ disabled: !canSubmit }}
          testID="create-group-submit"
          style={({ pressed }) => ({
            backgroundColor: canSubmit ? colors.brand[500] : colors.surface[3],
            borderRadius: radius.lg,
            paddingVertical: space[4],
            alignItems: 'center',
            opacity: pressed && canSubmit ? 0.92 : 1,
          })}
        >
          <Body variant="bold" color={canSubmit ? colors.text['on-brand'] : colors.text.disabled}>
            {inflight ? '만드는 중...' : '모임 만들기'}
          </Body>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleFlex: { flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { borderTopWidth: 1 },
});
```

참고: `accessibilityLabel`(대문자 L)이 정확. 위 코드의 `accessibilitylabel` 오타가 있으면 `accessibilityLabel`로 수정. `Icon name="뒤로"`/`Body variant`/`colors.text['on-brand']`는 기존 `app/group/[id]/index.tsx`에서 사용 중인 동일 토큰·아이콘이라 안전.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/screens/group/new.test.tsx`
Expected: PASS (3 tests). 실패 시 `accessibilityState.disabled` 접근 경로를 RN 버전에 맞춰 확인.

- [ ] **Step 5: 홈 CTA + 친구탭 진입 wire-up**

`app/(tabs)/index.tsx` — 기존 `:77` 영역:
```tsx
// 변경 전
onPress={() => {
  /* TODO S04 — 모임 만들기 흐름 진입 */
}}
// 변경 후 (파일 상단에 import { useRouter } from 'expo-router'; 추가 + const router = useRouter();)
onPress={() => router.push('/group/new')}
```

`app/(tabs)/friends/index.tsx:55` — `handleMakeGroup`:
```tsx
// 변경 전
const handleMakeGroup = (friend: FriendUser) => {
  Alert.alert('모임 만들기', `${friend.nickname}님과 모임을 만듭니다.`);
};
// 변경 후 (router는 이미 상단에 useRouter()로 존재)
const handleMakeGroup = (_friend: FriendUser) => {
  router.push('/group/new');
};
```
(베타: 멤버 사전 선택 없이 생성 후 링크 공유. friend 인자는 미사용 → `_friend`. 친구 사전선택 초대는 S22.)

- [ ] **Step 6: `app/group/_layout.tsx` 라우팅 확인**

Read `app/group/_layout.tsx`. `<Stack screenOptions={{ headerShown: false }} />` 형태면 `new.tsx` 자동 라우팅 → 변경 불필요. 만약 `<Stack.Screen name="...">`를 명시 열거하면 `<Stack.Screen name="new" options={{ headerShown: false }} />` 추가.

- [ ] **Step 7: 회귀 확인**

Run: `npx jest tests/screens/group/new.test.tsx` + (홈·친구탭 기존 테스트가 있으면) `npx jest tests/screens` — 기존 테스트 그린 유지.
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/group/new.tsx tests/screens/group/new.test.tsx "app/(tabs)/index.tsx" "app/(tabs)/friends/index.tsx" app/group/_layout.tsx
git commit -m "feat(S18): 모임 생성 화면 + 홈 CTA/친구탭 진입 wire-up

- app/group/new.tsx (이름+후보날짜 다중선택, brand-500 CTA 1개)
- 홈 '새 모임 만들기' TODO stub → router.push('/group/new')
- 친구탭 handleMakeGroup Alert stub → router.push('/group/new')

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `fetchMyGroups` 조회 lib

**Files:**
- Create: `src/lib/groups/list.ts`
- Test: `src/lib/groups/list.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/groups/list.test.ts
import { fetchMyGroups } from './list';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
const mockFrom = supabase.from as jest.Mock;

function mockSelectOrder(result: { data: unknown; error: unknown }) {
  const order = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ order });
  mockFrom.mockReturnValue({ select });
  return { select, order };
}

describe('fetchMyGroups', () => {
  beforeEach(() => mockFrom.mockReset());

  test('groups 행을 camelCase 요약으로 매핑 (미확정 먼저 정렬 호출)', async () => {
    const { select, order } = mockSelectOrder({
      data: [
        { id: 'g1', name: '저녁', dates: ['2026-05-30'], confirmed_at: null },
        { id: 'g2', name: '점심', dates: ['2026-06-01'], confirmed_at: '2026-05-28T03:00:00Z' },
      ],
      error: null,
    });
    const result = await fetchMyGroups();
    expect(mockFrom).toHaveBeenCalledWith('groups');
    expect(select).toHaveBeenCalledWith('id, name, dates, confirmed_at');
    expect(order).toHaveBeenCalledWith('confirmed_at', { ascending: true, nullsFirst: true });
    expect(result).toEqual([
      { id: 'g1', name: '저녁', dates: ['2026-05-30'], confirmedAt: null },
      { id: 'g2', name: '점심', dates: ['2026-06-01'], confirmedAt: '2026-05-28T03:00:00Z' },
    ]);
  });

  test('에러 → 한국어 throw', async () => {
    mockSelectOrder({ data: null, error: { message: 'rls' } });
    await expect(fetchMyGroups()).rejects.toThrow(
      '모임 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });

  test('빈 결과 → 빈 배열', async () => {
    mockSelectOrder({ data: null, error: null });
    expect(await fetchMyGroups()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/groups/list.test.ts`
Expected: FAIL — "Cannot find module './list'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/groups/list.ts
// S19 — 내 모임 목록. RLS groups_select_member_or_host(0002:131)가
// host 또는 멤버인 모임만 자연 반환 → userId 인자 불필요. 미확정(confirmed_at NULL) 먼저.
import { supabase } from '@/lib/supabase/client';

export interface MyGroupSummary {
  id: string;
  name: string;
  dates: string[]; // ISO yyyy-MM-dd
  confirmedAt: string | null; // UTC ISO
}

interface MyGroupRow {
  id: string;
  name: string;
  dates: string[];
  confirmed_at: string | null;
}

export async function fetchMyGroups(): Promise<MyGroupSummary[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, dates, confirmed_at')
    .order('confirmed_at', { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error('모임 목록을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  const rows = (data ?? []) as MyGroupRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    dates: r.dates,
    confirmedAt: r.confirmed_at,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/groups/list.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/groups/list.ts src/lib/groups/list.test.ts
git commit -m "feat(S19): fetchMyGroups — RLS 자연필터 + 미확정 먼저 정렬

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 홈 "다가오는 모임" 실데이터 + 카드 navigation

**Files:**
- Modify: `app/(tabs)/index.tsx` (`upcomingCount` 하드코딩 영역 `:18` + "다가오는 모임" 섹션 + 빈 카드)
- Test: `tests/screens/home.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/screens/home.test.tsx
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import HomeScreen from '../../app/(tabs)/index';
import { ThemeProvider } from '@/design/theme';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: unknown) => unknown) => sel({ session: { user: { nickname: '민지' } } }),
}));

const mockFetchMyGroups = jest.fn();
jest.mock('@/lib/groups/list', () => ({
  fetchMyGroups: () => mockFetchMyGroups(),
}));

describe('HomeScreen', () => {
  const wrapper = ThemeProvider;
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyGroups.mockReset();
  });

  test('"새 모임 만들기" CTA → router.push(/group/new)', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { getByTestId } = render(<HomeScreen />, { wrapper });
    await act(async () => {});
    fireEvent.press(getByTestId('create-group-card'));
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  test('모임 있으면 카드 렌더 + 탭 시 그리드로 push', async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '5/30 저녁', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const card = await findByTestId('my-group-g1');
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith('/group/g1');
  });

  test('모임 없으면 빈 상태 노출', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { findByText } = render(<HomeScreen />, { wrapper });
    expect(await findByText('잡힌 모임이 아직 없어요')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/screens/home.test.tsx`
Expected: FAIL — `fetchMyGroups`/`my-group-g1` testID 미존재 + CTA push 미연결.

- [ ] **Step 3: Modify the home screen**

`app/(tabs)/index.tsx` 변경:

1. import 추가:
```tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchMyGroups, type MyGroupSummary } from '@/lib/groups/list';
import { formatDateChip } from '@/lib/groups/dateOptions';
```

2. 컴포넌트 내부 상단:
```tsx
const router = useRouter();
const [myGroups, setMyGroups] = useState<MyGroupSummary[]>([]);
useEffect(() => {
  let cancelled = false;
  fetchMyGroups()
    .then((g) => {
      if (!cancelled) setMyGroups(g);
    })
    .catch(() => {
      /* 홈 진입을 막지 않음 — 빈 목록 유지 (silent) */
    });
  return (): void => {
    cancelled = true;
  };
}, []);
const upcomingCount = myGroups.length;
```
(기존 `const upcomingCount = 0;` 줄 제거.)

3. CTA `onPress`(`:77` 영역)를 `() => router.push('/group/new')`로 교체.

4. "다가오는 모임" 섹션의 빈 카드 영역을 조건 분기로 교체 — 목록이 있으면 카드들, 없으면 기존 빈 카드:
```tsx
{myGroups.length > 0 ? (
  <View style={{ paddingHorizontal: space[4], marginTop: space[3] }}>
    {myGroups.map((g) => (
      <Pressable
        key={g.id}
        onPress={() => router.push(`/group/${g.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${g.name} 모임 열기`}
        testID={`my-group-${g.id}`}
        style={({ pressed }) => [
          {
            backgroundColor: colors.surface[2],
            borderColor: colors.border.subtle,
            borderWidth: 1,
            borderRadius: radius.lg,
            padding: space[4],
            marginBottom: space[2],
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Body variant="bold" color={colors.text.primary}>
          {g.name}
        </Body>
        <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: space[1] }}>
          {g.confirmedAt
            ? '확정됨'
            : `투표 중 · 후보 ${g.dates.length}일 (${g.dates.map(formatDateChip).join(', ')})`}
        </Caption>
      </Pressable>
    ))}
  </View>
) : (
  /* 기존 빈 카드 블록을 여기로 이동 (그대로 유지) */
  <View style={{ paddingHorizontal: space[4], marginTop: space[3] }}>
    {/* ...기존 emptyCard View 전체... */}
  </View>
)}
```
(기존 빈 카드 JSX는 삭제하지 말고 `else` 분기로 이동. "다가오는 모임" 타이틀 + 0배지 hide 규칙은 유지 — `upcomingCount`가 이제 실제 카운트라 자연 동작.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/screens/home.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: 전체 회귀 + 게이트 확인**

```bash
npx jest && npx tsc --noEmit && npm run lint
```
Expected: Jest 전부 PASS(신규 +약 16 tests), typecheck 0, lint 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/index.tsx" tests/screens/home.test.tsx
git commit -m "feat(S19): 홈 '다가오는 모임' 실데이터 + 카드→그리드 navigation

- fetchMyGroups 연동, upcomingCount 하드코딩 제거
- 모임 카드 탭 → router.push(/group/[id]) = 그리드 도달 경로 확보

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 백로그·진척 문서 갱신 (Lane E + S18~S24)

**Files:**
- Modify: `docs/TASK_BACKLOG.md` (Lane E 섹션 + S18~S24 entry. S18·S19는 DONE, S20~S24는 TODO)
- Modify: `docs/SESSION_LOG.md` (S18·S19 완료 항목 prepend)
- Modify: `docs/PROGRESS.md` (태스크 카운트 + velocity)

- [ ] **Step 1: TASK_BACKLOG.md에 Lane E 추가**

`docs/TASK_BACKLOG.md` 끝의 "태스크 추가 템플릿" 앞에 새 섹션 추가:
```markdown
## Lane E — Journey/Glue (여정 척추)

> 기능 Lane(A~D)을 걸을 수 있는 유저 여정으로 잇는 연결 작업.
> 출처: docs/superpowers/specs/2026-05-28-journey-spine-roadmap-design.md

### S18 — 모임 생성 flow
- **Status**: DONE (2026-05-28) | **Owner**: Mobile + Backend | **Lane**: E
- **Depends**: S00(groups/group_members + invite_code 트리거), S05(진입 대상)
- **Acceptance**: create_group RPC(0018) + createGroup wrapper + app/group/new.tsx + 홈 CTA/친구탭 진입 wire-up + 성공 시 그리드 replace ✅
- **Files**: supabase/migrations/0018_create_group_rpc.sql, src/lib/groups/{create,dateOptions}.ts, app/group/new.tsx, app/(tabs)/index.tsx, app/(tabs)/friends/index.tsx

### S19 — 내 모임 리스트
- **Status**: DONE (2026-05-28) | **Owner**: Mobile | **Lane**: E
- **Depends**: S00(groups RLS), S18
- **Acceptance**: fetchMyGroups + 홈 '다가오는 모임' 실데이터 + 카드→/group/[id] navigation ✅
- **Files**: src/lib/groups/list.ts, app/(tabs)/index.tsx

### S20 — 지도 없는 장소 검색·선택 (★게이트, S10 디커플)
- **Status**: TODO | **Owner**: Mobile + Backend | **Lane**: E
- **Depends**: S16 ✅(NaverSearchProvider), S08 ✅(PlaceActionSheet+click_log), S04/S05, G1·G2
- **Acceptance**: app/group/[id]/place-search.tsx + 확정화면 '장소 정하기' 버튼 + 선택 시 confirmed_place_id UPDATE(=Gate #1) + place.tsx 재사용. places 영속화 스키마 보강(별도 spec)
- **Files**: app/group/[id]/place-search.tsx, src/lib/places/persist.ts, src/lib/groups/setConfirmedPlace.ts, app/group/[id]/index.tsx, (places provider migration)

### S21 — 친구 시스템 실DB 전환
- **Status**: TODO | **Owner**: Mobile + Backend | **Lane**: E
- **Depends**: S00(friendships/friend_requests), D16
- **Acceptance**: friends/api.ts mock→supabase 전면 교체 + is_blocked 통과. **S07 PARTIAL 재마킹**
- **Files**: src/lib/friends/api.ts

### S22 — 인앱 모임 초대/합류
- **Status**: TODO | **Owner**: Mobile + Backend | **Lane**: E
- **Depends**: S21, S00(group_invitations), D16, D31
- **Acceptance**: invitations.ts(createInvitation+accept→group_members) + 초대 UI + 수락→합류
- **Files**: src/lib/groups/invitations.ts, 초대 UI

### S23 — 푸시 F1/F2/F3 publisher wire-up
- **Status**: TODO | **Owner**: Backend + Mobile | **Lane**: E
- **Depends**: S21, S22, S12 ✅(handler+dispatcher), D33
- **Acceptance**: sendRequest→F1, accept→F2, invite→F3 dispatch + handler register
- **Files**: src/lib/friends/api.ts, src/lib/groups/invitations.ts, Edge handler register

### S24 — 부차적 dead-end 정리
- **Status**: TODO | **Owner**: Mobile | **Lane**: E
- **Depends**: 없음
- **Acceptance**: 프로필 설정행 3개·홈 알림·친구탭 카톡초대 실연결 or 베타 비활성 명시
- **Files**: app/(tabs)/profile.tsx, app/(tabs)/index.tsx, app/(tabs)/friends/index.tsx
```
(진행 현황 요약·Sprint 카운트의 "총 17 태스크"도 "+ Lane E S18~S24"로 한 줄 보강.)

- [ ] **Step 2: SESSION_LOG.md prepend**

`docs/SESSION_LOG.md`의 가장 최근 항목 위에 S18·S19 DONE 항목을 형식(Depends/Changes/Tests/Next/Notes)대로 prepend. Tests에 실제 Jest/typecheck/lint 숫자 기입.

- [ ] **Step 3: PROGRESS.md 갱신**

태스크 진척 카운트 + 주차별 velocity에 S18·S19 추가. "마지막 업데이트" 날짜·요약 갱신.

- [ ] **Step 4: Commit**

```bash
git add docs/TASK_BACKLOG.md docs/SESSION_LOG.md docs/PROGRESS.md
git commit -m "docs(S18·S19): Lane E 신설 + 척추 2태스크 DONE 기록

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (작성자 체크 완료)

**1. Spec 커버리지** — roadmap spec §4의 S18·S19 acceptance 전 항목 매핑 확인:
- S18 createGroup atomic → T2(RPC)+T3(wrapper). new.tsx + 후보날짜 → T1+T4. 홈/친구탭 진입 → T4. 그리드 replace → T4. ✅
- S19 fetchMyGroups → T5. 홈 실데이터 + 카드 navigation(#3 해소) → T6. ✅
- (S20~S24는 본 클러스터 범위 밖 — spec §10대로 별도 plan. T7에서 backlog stub만 등록.)

**2. 플레이스홀더 스캔** — 모든 코드 스텝에 실제 코드 포함. "기존 emptyCard View 전체"는 기존 파일에서 그대로 이동하는 지시(신규 작성 아님)라 허용. ✅

**3. 타입 일관성** — `CreateGroupInput{name,dates}`(T3) ↔ new.tsx 호출(T4) 일치. `MyGroupSummary{id,name,dates,confirmedAt}`(T5) ↔ home map(T6) + home.test 일치. `create_group(p_name,p_dates)`(T2) ↔ rpc 호출(T3) 일치. `buildDateOptions/formatDateChip/todayKstIso`(T1) ↔ new.tsx/home(T4/T6) 일치. ✅

**4. S10 무충돌** — 본 plan은 `app/(tabs)/map.tsx`·`src/lib/places/*` 미접촉. 신규 파일 + 홈/친구탭/그리드 layout만 수정. ✅

---

## 알려진 가정 (구현 중 확인)

- `app/group/_layout.tsx`가 명시적 Stack.Screen 열거 시 `new` 추가 (T4 Step6).
- `colors.text['on-brand']`·`colors.text.disabled`·`colors.surface[3]`·`radius.lg` 토큰 존재 — 기존 `app/group/[id]/index.tsx`·홈에서 사용 중이라 안전. 없으면 가장 가까운 토큰으로 대체.
- groups에 `created_at`이 있으면 정렬을 `confirmed_at` 후 `created_at desc`로 보강 가능(현재는 `confirmed_at nullsFirst`만으로 충분).
- `formatDateChip`의 luxon `EEEEE`(축약 요일) 미지원 환경이면 `EEE`로 교체(T1 Step4 명시).
