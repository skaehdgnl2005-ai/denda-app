import { classifyHeat, heatToTokenIndex, type HeatLevel } from './heatmap';

describe('classifyHeat — RN src/lib/heatmap/classify.ts mirror (D10 5-stop quartile)', () => {
  describe('edge cases (graceful clamp)', () => {
    it('count = 0 → heat-0', () => {
      expect(classifyHeat(0, 7)).toBe<HeatLevel>('heat-0');
    });

    it('count < 0 (이상치) → heat-0', () => {
      expect(classifyHeat(-3, 7)).toBe<HeatLevel>('heat-0');
    });

    it('maxCount = 0 (멤버 없는 모임) → heat-0', () => {
      expect(classifyHeat(5, 0)).toBe<HeatLevel>('heat-0');
    });

    it('maxCount < 0 → heat-0', () => {
      expect(classifyHeat(5, -1)).toBe<HeatLevel>('heat-0');
    });

    it('count > maxCount (이상치) → heat-4 clamp', () => {
      expect(classifyHeat(10, 7)).toBe<HeatLevel>('heat-4');
    });

    it('count === maxCount → heat-4', () => {
      expect(classifyHeat(7, 7)).toBe<HeatLevel>('heat-4');
    });
  });

  describe('quartile 경계 (maxCount=8: q1=2, q2=4, q3=6)', () => {
    it('count=1 → heat-1 (q1=2 이하)', () => {
      expect(classifyHeat(1, 8)).toBe<HeatLevel>('heat-1');
    });

    it('count=2 → heat-1 (q1 경계 포함)', () => {
      expect(classifyHeat(2, 8)).toBe<HeatLevel>('heat-1');
    });

    it('count=3 → heat-2 (q1 초과 ~ q2 이하)', () => {
      expect(classifyHeat(3, 8)).toBe<HeatLevel>('heat-2');
    });

    it('count=4 → heat-2 (q2 경계 포함)', () => {
      expect(classifyHeat(4, 8)).toBe<HeatLevel>('heat-2');
    });

    it('count=5 → heat-3 (q2 초과 ~ q3 이하)', () => {
      expect(classifyHeat(5, 8)).toBe<HeatLevel>('heat-3');
    });

    it('count=6 → heat-3 (q3 경계 포함)', () => {
      expect(classifyHeat(6, 8)).toBe<HeatLevel>('heat-3');
    });

    it('count=7 → heat-4 (q3 초과)', () => {
      expect(classifyHeat(7, 8)).toBe<HeatLevel>('heat-4');
    });
  });

  describe('비정수 maxCount (실 모임: 7명) — 분수 quartile', () => {
    it('count=1, max=7 → heat-1 (q1=1.75)', () => {
      expect(classifyHeat(1, 7)).toBe<HeatLevel>('heat-1');
    });

    it('count=2, max=7 → heat-2 (q1=1.75 초과)', () => {
      expect(classifyHeat(2, 7)).toBe<HeatLevel>('heat-2');
    });

    it('count=4, max=7 → heat-3 (q2=3.5 초과)', () => {
      expect(classifyHeat(4, 7)).toBe<HeatLevel>('heat-3');
    });

    it('count=6, max=7 → heat-4 (q3=5.25 초과)', () => {
      expect(classifyHeat(6, 7)).toBe<HeatLevel>('heat-4');
    });
  });

  describe('1인 모임 (maxCount=1, q1=q2=q3=0.25,0.5,0.75 모두 1 미만)', () => {
    it('count=1 → heat-4 (count>=maxCount)', () => {
      expect(classifyHeat(1, 1)).toBe<HeatLevel>('heat-4');
    });

    it('count=0 → heat-0', () => {
      expect(classifyHeat(0, 1)).toBe<HeatLevel>('heat-0');
    });
  });
});

describe('heatToTokenIndex — heat-N → tokens.heat[0..4] index 매핑', () => {
  it('heat-0 → 0', () => expect(heatToTokenIndex('heat-0')).toBe(0));
  it('heat-1 → 1', () => expect(heatToTokenIndex('heat-1')).toBe(1));
  it('heat-2 → 2', () => expect(heatToTokenIndex('heat-2')).toBe(2));
  it('heat-3 → 3', () => expect(heatToTokenIndex('heat-3')).toBe(3));
  it('heat-4 → 4', () => expect(heatToTokenIndex('heat-4')).toBe(4));
});
