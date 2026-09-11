// NaverSearchProvider — S16 fallback 장소 검색 provider (D1 no-answer eager 활성).
//
// 네이버 지역검색 Open API는 Client Secret 필요 → 클라이언트 직접 호출 금지 (CLAUDE.md rule 7).
// Edge Function `naver_local_search`를 supabase.functions.invoke로 호출 (secret은 Edge env).
//
// 사용:
//   const provider: PlaceSearchProvider = new NaverSearchProvider();
//   const results = await provider.search({ query: '강남 카페', display: 5 });

import { supabase } from '@/lib/supabase/client';

import type {
  PlaceSearchProvider,
  PlaceSearchQuery,
  PlaceSearchResult,
} from './PlaceSearchProvider';

interface NaverSearchEdgeResponse {
  ok: true;
  results?: PlaceSearchResult[];
}

interface NaverSearchBody {
  query: string;
  display?: number;
}

const SEARCH_FAILED_MESSAGE = '장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

export class NaverSearchProvider implements PlaceSearchProvider {
  readonly source = 'naver' as const;

  async search(query: PlaceSearchQuery): Promise<PlaceSearchResult[]> {
    const q = query.query.trim();
    if (q.length === 0) {
      throw new Error('검색어를 입력해주세요.');
    }

    const body: NaverSearchBody = { query: q };
    if (query.display !== undefined) {
      body.display = query.display;
    }

    const { data, error } = await supabase.functions.invoke<NaverSearchEdgeResponse>(
      'naver_local_search',
      { body },
    );

    if (error || !data) {
      throw new Error(SEARCH_FAILED_MESSAGE);
    }

    return data.results ?? [];
  }
}
