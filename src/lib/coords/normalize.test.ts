import {
  KOREA_BBOX,
  coordKey,
  isPlausibleKoreaWgs84,
  isValidWgs84,
  normalizeWgs84,
  toKakaoXY,
  type Wgs84Coord,
} from './normalize';

describe('isValidWgs84', () => {
  it('정상 범위 좌표 → true', () => {
    expect(isValidWgs84(37.5, 127.0)).toBe(true);
    expect(isValidWgs84(-89.9, -179.9)).toBe(true);
    expect(isValidWgs84(0, 0)).toBe(true);
  });

  it('위도 ±90 / 경도 ±180 경계 포함', () => {
    expect(isValidWgs84(90, 180)).toBe(true);
    expect(isValidWgs84(-90, -180)).toBe(true);
  });

  it('범위 밖 → false', () => {
    expect(isValidWgs84(90.1, 0)).toBe(false);
    expect(isValidWgs84(0, 180.1)).toBe(false);
  });

  it('비유한수(NaN/Infinity) → false', () => {
    expect(isValidWgs84(NaN, 127)).toBe(false);
    expect(isValidWgs84(37, Infinity)).toBe(false);
  });
});

describe('isPlausibleKoreaWgs84', () => {
  it('한국 영토 내 좌표 → true (서울)', () => {
    expect(isPlausibleKoreaWgs84(37.5665, 126.978)).toBe(true);
  });

  it('제주 → true', () => {
    expect(isPlausibleKoreaWgs84(33.499, 126.531)).toBe(true);
  });

  it('한국 bbox 밖(도쿄) → false', () => {
    expect(isPlausibleKoreaWgs84(35.6895, 139.6917)).toBe(false);
  });

  it('bbox 경계 상수와 정합', () => {
    expect(isPlausibleKoreaWgs84(KOREA_BBOX.latMin, KOREA_BBOX.lngMin)).toBe(true);
    expect(isPlausibleKoreaWgs84(KOREA_BBOX.latMax, KOREA_BBOX.lngMax)).toBe(true);
    expect(isPlausibleKoreaWgs84(KOREA_BBOX.latMin - 0.001, KOREA_BBOX.lngMin)).toBe(false);
  });
});

describe('normalizeWgs84', () => {
  it('유효 좌표 → 그대로 Wgs84Coord', () => {
    expect(normalizeWgs84(37.5, 127.0)).toEqual({ lat: 37.5, lng: 127.0 });
  });

  it('문자열 숫자도 허용 (외부 API string 좌표)', () => {
    expect(normalizeWgs84('37.5', '127.0')).toEqual({ lat: 37.5, lng: 127.0 });
  });

  it('비유효(범위 밖) → throw', () => {
    expect(() => normalizeWgs84(200, 127)).toThrow();
  });

  it('비유한수 → throw', () => {
    expect(() => normalizeWgs84('abc', '127')).toThrow();
  });
});

describe('toKakaoXY — D18 x=경도(lng), y=위도(lat) 매핑', () => {
  it('lng→x, lat→y 로 매핑 (순서 뒤바뀜 방지)', () => {
    const coord: Wgs84Coord = { lat: 37.5665, lng: 126.978 };
    expect(toKakaoXY(coord)).toEqual({ x: 126.978, y: 37.5665 });
  });

  it('x와 y가 동일하지 않은 좌표에서 절대 swap 안 함', () => {
    const { x, y } = toKakaoXY({ lat: 33.0, lng: 127.0 });
    expect(x).toBe(127.0);
    expect(y).toBe(33.0);
  });
});

describe('coordKey', () => {
  it('기본 정밀도(6)로 dedup 키 생성', () => {
    expect(coordKey({ lat: 37.566535, lng: 126.977969 })).toBe('37.566535,126.977969');
  });

  it('정밀도 내에서 같은 좌표는 같은 키 (dedup)', () => {
    const a = coordKey({ lat: 37.5665351, lng: 126.9779691 }, 5);
    const b = coordKey({ lat: 37.5665359, lng: 126.9779699 }, 5);
    expect(a).toBe(b);
  });

  it('다른 좌표는 다른 키', () => {
    expect(coordKey({ lat: 37.5, lng: 127.0 })).not.toBe(coordKey({ lat: 37.6, lng: 127.0 }));
  });
});
