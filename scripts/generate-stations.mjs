// S-MAP M5 — 전국도시철도역사정보표준데이터 CSV → src/lib/map/stations.data.ts 생성.
//
// 사용법:
//   1) 공공데이터포털에서 "전국도시철도역사정보표준데이터" CSV 다운로드 (UTF-8)
//   2) scripts/data/stations_raw.csv 로 저장
//   3) node scripts/generate-stations.mjs
//
// 처리:
//   - 헤더에서 역사명/역위도/역경도 컬럼 탐색
//   - 역명 정규화: 괄호 병기 제거 + "역" 접미 보정
//   - 한국 bbox(32.5~39.0 / 124.0~132.5, coords/normalize.ts와 정합) 밖 행 제외
//   - 같은 역명은 1km 이내 근접 클러스터로 묶어 좌표 평균 1건 (환승역 dedup).
//     1km 초과 동명역(예: 서울/대전/부산 시청역)은 별개 항목 유지 — 지역별 최근접이 맞도록.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'scripts/data/stations_raw.csv';
const OUT = 'src/lib/map/stations.data.ts';
const BBOX = { latMin: 32.5, latMax: 39.0, lngMin: 124.0, lngMax: 132.5 };
const CLUSTER_METERS = 1000;

// 따옴표 필드를 처리하는 최소 CSV 파서 (주소 필드에 콤마 존재).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

function haversineMeters(a, b) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeName(raw) {
  const stripped = raw.replace(/\(.*?\)/g, '').trim();
  if (stripped === '') return null;
  return stripped.endsWith('역') ? stripped : `${stripped}역`;
}

const text = readFileSync(SRC, 'utf-8').replace(/^﻿/, '');
const rows = parseCsv(text);
const header = rows[0].map((h) => h.trim());
const nameIdx = header.indexOf('역사명');
const latIdx = header.indexOf('역위도');
const lngIdx = header.indexOf('역경도');
if (nameIdx < 0 || latIdx < 0 || lngIdx < 0) {
  console.error(`헤더에서 역사명/역위도/역경도를 찾지 못했습니다. 실제 헤더: ${header.join(', ')}`);
  console.error('CSV가 EUC-KR이면 UTF-8로 재저장 후 다시 실행하세요.');
  process.exit(1);
}

// 1) 파싱 + 정규화 + bbox 필터
const points = [];
for (const row of rows.slice(1)) {
  const name = normalizeName(row[nameIdx] ?? '');
  const lat = Number(row[latIdx]);
  const lng = Number(row[lngIdx]);
  if (name === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  if (lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) continue;
  points.push({ name, lat, lng });
}

// 2) 역명별 group-by → 1km greedy 클러스터 → 클러스터별 좌표 평균
const byName = new Map();
for (const p of points) {
  if (!byName.has(p.name)) byName.set(p.name, []);
  byName.get(p.name).push(p);
}
const stations = [];
for (const [name, group] of byName) {
  const clusters = [];
  for (const p of group) {
    const hit = clusters.find(
      (c) =>
        haversineMeters({ lat: c.latSum / c.n, lng: c.lngSum / c.n }, p) <= CLUSTER_METERS,
    );
    if (hit) {
      hit.latSum += p.lat;
      hit.lngSum += p.lng;
      hit.n += 1;
    } else {
      clusters.push({ latSum: p.lat, lngSum: p.lng, n: 1 });
    }
  }
  for (const c of clusters) {
    stations.push({
      name,
      lat: Number((c.latSum / c.n).toFixed(6)),
      lng: Number((c.lngSum / c.n).toFixed(6)),
    });
  }
}
stations.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.lat - b.lat));

const body = stations
  .map((s) => `  { name: '${s.name.replace(/'/g, "\\'")}', lat: ${s.lat}, lng: ${s.lng} },`)
  .join('\n');
const file = `// S-MAP M5 — 전국 지하철역 좌표 (생성 파일 — 직접 수정 금지).
// 출처: 공공데이터포털 "전국도시철도역사정보표준데이터" (공공누리 — 상업 이용 가능).
// 재생성: CSV를 scripts/data/stations_raw.csv 에 두고 \`node scripts/generate-stations.mjs\`.
// 환승역은 역명 기준 1km 클러스터 평균 1건, 1km 초과 동명역(타 도시)은 별개 유지.

import type { SubwayStation } from './stationSnap';

export const SUBWAY_STATIONS: readonly SubwayStation[] = [
${body}
];
`;
writeFileSync(OUT, file, 'utf-8');
console.log(`OK: ${stations.length}개 역 → ${OUT}`);
