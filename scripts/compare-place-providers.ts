// compare-place-providers.ts — S16 Phase b 데이터 quality 비교 (D37 평가 트랙).
//
// Naver 지역검색 vs Kakao Local 키워드검색을 "같은 검색어"로 호출해 정규화 결과를 나란히 비교.
// 검증 완료된 _lib 정규화 로직(buildPlaceSearchResults)을 그대로 재사용 → 앱이 실제 쓸 shape로 비교.
//
// 외부 API 직접 호출. Supabase·인증·함수 배포 불필요. 키는 호출자 env only (코드/로그에 안 남음).
//
// 실행 (PowerShell):
//   $env:KAKAO_REST_API_KEY="..."; $env:NAVER_CLIENT_ID="..."; $env:NAVER_CLIENT_SECRET="..."
//   deno run --allow-net --allow-env scripts/compare-place-providers.ts
//
// (키는 supabase secrets에만 있고 로컬엔 없을 수 있음 → 카카오 디벨로퍼스/네이버 개발자센터에서
//  복사해 위 env에 넣고 1회 실행. 출력만 공유하면 분석해서 primary 추천.)

import {
  buildPlaceSearchResults as buildKakao,
  fetchKakaoLocal,
} from '../supabase/functions/_lib/kakao_local.ts';
import {
  buildPlaceSearchResults as buildNaver,
  fetchNaverLocal,
} from '../supabase/functions/_lib/naver_local.ts';

// 모임 장소 검색 대표 쿼리 (P1 학생 + P2 직장인 시나리오 혼합).
const QUERIES = [
  '강남 카페',
  '홍대 술집',
  '이태원 맛집',
  '연남동 브런치',
  '스타벅스 강남',
  '회기역 고깃집',
];

const kakaoKey = Deno.env.get('KAKAO_REST_API_KEY');
const naverId = Deno.env.get('NAVER_CLIENT_ID');
const naverSecret = Deno.env.get('NAVER_CLIENT_SECRET');

if (!kakaoKey || !naverId || !naverSecret) {
  console.error('env 필요: KAKAO_REST_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET');
  Deno.exit(1);
}

interface Metric {
  query: string;
  kCount: number;
  nCount: number;
  kCatPct: number;
  nCatPct: number;
  kAddrPct: number;
  nAddrPct: number;
}

function pct(arr: { category?: string | null; address?: string | null }[], key: 'category' | 'address'): number {
  if (arr.length === 0) return 0;
  const n = arr.filter((r) => r[key] !== null && r[key] !== undefined).length;
  return Math.round((n / arr.length) * 100);
}

const metrics: Metric[] = [];

for (const q of QUERIES) {
  const [kdocs, ndocs] = await Promise.all([
    fetchKakaoLocal({ query: q, display: 15, restApiKey: kakaoKey, fetch: globalThis.fetch }).catch(
      (e) => {
        console.error(`  [kakao 에러] ${q}: ${e?.message ?? e}`);
        return [];
      },
    ),
    fetchNaverLocal({ query: q, display: 5, clientId: naverId, clientSecret: naverSecret, fetch: globalThis.fetch }).catch(
      (e) => {
        console.error(`  [naver 에러] ${q}: ${e?.message ?? e}`);
        return [];
      },
    ),
  ]);

  const k = buildKakao(kdocs);
  const n = buildNaver(ndocs);

  console.log(`\n━━━ "${q}" ━━━`);
  console.log(`  Kakao: ${k.length}건  |  Naver: ${n.length}건  (각 API max: Kakao 15 / Naver 5)`);
  console.log('  ── Kakao 상위 3 ──');
  k.slice(0, 3).forEach((r, i) =>
    console.log(`    ${i + 1}. ${r.name}  [${r.category ?? '-'}]  ${r.address ?? '-'}`),
  );
  console.log('  ── Naver 상위 3 ──');
  n.slice(0, 3).forEach((r, i) =>
    console.log(`    ${i + 1}. ${r.name}  [${r.category ?? '-'}]  ${r.address ?? '-'}`),
  );

  metrics.push({
    query: q,
    kCount: k.length,
    nCount: n.length,
    kCatPct: pct(k, 'category'),
    nCatPct: pct(n, 'category'),
    kAddrPct: pct(k, 'address'),
    nAddrPct: pct(n, 'address'),
  });

  // 카카오 quota burst 방지용 짧은 간격 없이도 6쿼리는 안전 (30만/일 한도).
}

// --- 요약 ------------------------------------------------------------------
console.log('\n\n════════ 요약 (검색어별 건수 / 카테고리 채움% / 주소 채움%) ════════');
console.log('query'.padEnd(16), 'K건 N건', ' K카테 N카테', ' K주소 N주소');
for (const m of metrics) {
  console.log(
    m.query.padEnd(16),
    String(m.kCount).padStart(3),
    String(m.nCount).padStart(3),
    String(m.kCatPct + '%').padStart(6),
    String(m.nCatPct + '%').padStart(5),
    String(m.kAddrPct + '%').padStart(6),
    String(m.nAddrPct + '%').padStart(5),
  );
}

const avg = (sel: (m: Metric) => number) => Math.round(metrics.reduce((s, m) => s + sel(m), 0) / metrics.length);
console.log('\n평균 건수   — Kakao:', avg((m) => m.kCount), '/ Naver:', avg((m) => m.nCount));
console.log('평균 카테고리 채움 — Kakao:', avg((m) => m.kCatPct) + '%', '/ Naver:', avg((m) => m.nCatPct) + '%');
console.log('평균 주소 채움 — Kakao:', avg((m) => m.kAddrPct) + '%', '/ Naver:', avg((m) => m.nAddrPct) + '%');
console.log('\n참고: Kakao는 stable place id 제공(dedup·재조회 유리), Naver는 합성 id. 위 출력 공유하면 primary 추천.');
