import React from 'react';
import { render } from '@testing-library/react-native';

import { ColdStartBadge } from './ColdStartBadge';
import { createColdStartTracker, type ColdStartTracker } from '@/lib/perf/coldStart';
import { ThemeProvider } from '@/design/theme';

function makeNow(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)] ?? 0;
    i += 1;
    return v;
  };
}

function renderBadge(opts: { enabled: boolean; tracker: ColdStartTracker }) {
  return render(<ColdStartBadge enabled={opts.enabled} tracker={opts.tracker} />, {
    wrapper: ThemeProvider,
  });
}

describe('ColdStartBadge', () => {
  it('enabled=false → 렌더 안 함 (production 안전)', () => {
    const tracker = createColdStartTracker({ now: makeNow([0, 1500]) });
    const { queryByTestId } = renderBadge({ enabled: false, tracker });
    expect(queryByTestId('cold-start-badge')).toBeNull();
  });

  it('enabled=true → 측정 duration(ms) 노출', () => {
    const tracker = createColdStartTracker({ now: makeNow([0, 1480]) });
    const { getByTestId, getByText } = renderBadge({ enabled: true, tracker });
    expect(getByTestId('cold-start-badge')).toBeTruthy();
    expect(getByText(/1480ms/)).toBeTruthy();
    expect(getByText(/2000ms/)).toBeTruthy();
  });

  it('예산 내(✅)와 초과(⚠️) 마커가 다르다', () => {
    const within = renderBadge({
      enabled: true,
      tracker: createColdStartTracker({ now: makeNow([0, 1000]) }),
    });
    expect(within.getByText(/✅/)).toBeTruthy();

    const over = renderBadge({
      enabled: true,
      tracker: createColdStartTracker({ now: makeNow([0, 3000]) }),
    });
    expect(over.getByText(/⚠️/)).toBeTruthy();
  });

  it('accessibilityLabel에 측정값 포함', () => {
    const tracker = createColdStartTracker({ now: makeNow([0, 1200]) });
    const { getByTestId } = renderBadge({ enabled: true, tracker });
    expect(getByTestId('cold-start-badge').props.accessibilityLabel).toContain('1200');
  });
});
