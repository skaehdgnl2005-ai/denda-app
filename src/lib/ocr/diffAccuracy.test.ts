// S03 — diffAccuracy 단위 테스트

import { diffAccuracy, type OcrCourseLike } from './diffAccuracy';

const linear: OcrCourseLike = {
  name: '선형대수',
  day: 'MON',
  start: '10:00',
  end: '11:30',
  room: '공학관 401',
};
const prog: OcrCourseLike = {
  name: '프로그래밍입문',
  day: 'WED',
  start: '13:00',
  end: '14:30',
  room: '정보관 205',
};
const econ: OcrCourseLike = { name: '경제학원론', day: 'FRI', start: '09:00', end: '10:30' };

describe('diffAccuracy', () => {
  it('완벽 매치 = 1.0', () => {
    const result = diffAccuracy([linear, prog, econ], [linear, prog, econ]);
    expect(result.accuracy).toBe(1);
    expect(result.matched).toBe(3);
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it('순서 다르더라도 매치', () => {
    const result = diffAccuracy([econ, linear, prog], [linear, prog, econ]);
    expect(result.accuracy).toBe(1);
  });

  it('일부 누락 = 비례 정확도', () => {
    const result = diffAccuracy([linear, prog], [linear, prog, econ]);
    expect(result.accuracy).toBeCloseTo(2 / 3, 5);
    expect(result.missing).toEqual([econ]);
    expect(result.extra).toEqual([]);
  });

  it('추가 false-positive도 정확도 감점', () => {
    const result = diffAccuracy(
      [linear, prog, econ, { name: '없는수업', day: 'TUE', start: '11:00', end: '12:00' }],
      [linear, prog, econ],
    );
    expect(result.accuracy).toBeCloseTo(3 / 4, 5);
    expect(result.extra.length).toBe(1);
  });

  it('한 필드 다르면 미매치 (room mismatch)', () => {
    const wrongRoom = { ...linear, room: '공학관 402' };
    const result = diffAccuracy([wrongRoom, prog, econ], [linear, prog, econ]);
    expect(result.accuracy).toBeCloseTo(2 / 3, 5);
    expect(result.missing).toEqual([linear]);
    expect(result.extra).toEqual([wrongRoom]);
  });

  it('room undefined vs "" 동등 (normalize)', () => {
    const noRoom: OcrCourseLike = { name: '경제학원론', day: 'FRI', start: '09:00', end: '10:30' };
    const emptyRoom: OcrCourseLike = { ...noRoom, room: '   ' };
    const result = diffAccuracy([emptyRoom], [noRoom]);
    expect(result.accuracy).toBe(1);
  });

  it('빈 배열 / 빈 배열 = 1.0', () => {
    const result = diffAccuracy([], []);
    expect(result.accuracy).toBe(1);
    expect(result.matched).toBe(0);
  });

  it('expected 비어있는데 actual 있으면 0', () => {
    const result = diffAccuracy([linear], []);
    expect(result.accuracy).toBe(0);
    expect(result.extra).toEqual([linear]);
  });
});
