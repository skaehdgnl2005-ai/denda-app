// kakao-key-diagnose.ts — KAKAO_REST_API_KEY 인증 실패 원인 진단 (1회용).
//
// 카카오 Local 키워드검색에 raw fetch → HTTP status + 응답 body를 그대로 출력.
// body 메시지로 "잘못된 키 / 권한 없음 / quota" 를 구분.
//
// 실행 (PowerShell):
//   $env:KAKAO_REST_API_KEY="<카카오 REST API 키>"
//   deno run --allow-net --allow-env scripts/kakao-key-diagnose.ts

const key = (Deno.env.get('KAKAO_REST_API_KEY') ?? '').trim();
if (!key) {
  console.error('env KAKAO_REST_API_KEY 가 비어 있습니다.');
  Deno.exit(1);
}

// 값 전체는 노출하지 않고 유형 판별 힌트만.
console.log('키 길이:', key.length, '(카카오 앱 키는 보통 32자 hex)');
console.log('키 앞4 / 뒤4:', key.slice(0, 4), '...', key.slice(-4));
// .env.local의 Native 앱 키와 동일하면 키 종류 착오 (Local API는 REST 키 필요).
if (key === 'c05c0ff2f46b4a25853642a1655bf3bd') {
  console.log('⚠️ 이 값은 .env.local의 *Native 앱 키* 입니다 → Local API는 REST API 키를 써야 합니다!');
}

const url =
  'https://dapi.kakao.com/v2/local/search/keyword.json?query=' +
  encodeURIComponent('강남 카페') +
  '&size=3';

const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
console.log('\nHTTP status:', res.status);
console.log('응답 body  :', await res.text());
console.log(
  '\n해석: status 401 + "invalid app key" → 잘못된 키(REST 키 아님). ' +
    '403 → 권한/플랫폼 설정. 429 → quota. 200 → 키 정상(다른 문제).',
);
