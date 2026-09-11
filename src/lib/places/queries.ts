// S08-ui — places fetch. RLS places_select_all (0002:113) — public read 자연 허용.
//
// camelCase 변환 + 한국어 에러 메시지 wrap.

import { supabase } from '@/lib/supabase/client';

export interface Place {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  partnershipId: string | null;
}

interface PlaceRow {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  partnership_id: string | null;
}

export async function fetchPlace(placeId: string): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, category, address, partnership_id')
    .eq('id', placeId)
    .single();

  if (error) {
    throw new Error('장소를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
  }
  if (!data) {
    throw new Error('장소를 찾을 수 없어요.');
  }

  const row = data as PlaceRow;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    address: row.address,
    partnershipId: row.partnership_id,
  };
}
