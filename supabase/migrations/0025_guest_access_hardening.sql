-- SEC-1/SEC-2: 초대 링크(UUID)는 모임 공개 뷰의 capability,
-- guest_token은 본인 투표 수정용 비밀. 공개 식별자와 분리한다.
BEGIN;

ALTER TABLE public.group_guests
  ADD COLUMN guest_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

DROP POLICY users_select_visible ON public.users;
CREATE POLICY users_select_visible ON public.users FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND
    (auth.uid() = id OR NOT public.is_blocked(auth.uid(), id)));
DROP POLICY groups_select_anon ON public.groups;
DROP POLICY group_guests_select_anon ON public.group_guests;
DROP POLICY group_guests_insert_anon ON public.group_guests;
DROP POLICY votes_select_anon ON public.votes;

-- RLS만으로는 같은 모임의 로그인 회원에게 비밀 컬럼이 노출된다.
-- 테이블 권한을 먼저 제거하고 필요한 컬럼만 허용한다. service_role은 유지.
REVOKE ALL ON public.group_guests FROM PUBLIC, anon, authenticated;
REVOKE SELECT (guest_token) ON public.group_guests FROM PUBLIC, anon, authenticated;
GRANT SELECT (guest_id, group_id, nickname, converted_user_id, voted_at, created_at)
  ON public.group_guests TO authenticated;
REVOKE SELECT ON public.votes FROM PUBLIC, anon, authenticated;
REVOKE SELECT (guest_token) ON public.votes FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, group_id, user_id, day, start_minute, end_minute, created_at)
  ON public.votes TO authenticated;

CREATE FUNCTION public.register_guest(p_group_id UUID, p_nickname TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_guest public.group_guests;
BEGIN
  IF p_nickname IS NULL OR char_length(btrim(p_nickname)) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION '닉네임은 1~20자로 입력해 주세요.' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.groups g WHERE g.id = p_group_id
    AND NOT public.is_blocked(auth.uid(), g.host_id) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '모임을 찾을 수 없습니다.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.group_guests(group_id,nickname)
    VALUES(p_group_id,btrim(p_nickname)) RETURNING * INTO v_guest;
  -- 생성한 본인의 자격증명만 반환한다. 호출자가 토큰을 지정할 수 없다.
  RETURN jsonb_build_object('guest_token',v_guest.guest_token,
    'guest_id',v_guest.guest_id,'nickname',v_guest.nickname);
END;
$$;

CREATE FUNCTION public.get_guest_session(p_group_id UUID, p_guest_token UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('guest_id',gg.guest_id,'nickname',gg.nickname)
  FROM public.group_guests gg JOIN public.groups g ON g.id = gg.group_id
  WHERE gg.group_id = p_group_id AND gg.guest_token = p_guest_token
    AND NOT public.is_blocked(auth.uid(), g.host_id);
$$;

CREATE FUNCTION public.get_guest_group_view(p_group_id UUID, p_guest_token UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_group JSONB; v_members JSONB; v_guests JSONB; v_votes JSONB; v_heatmap JSONB;
BEGIN
  SELECT jsonb_build_object('id',g.id,'name',g.name,'dates',g.dates,
    'users',jsonb_build_object('nickname',u.nickname)) INTO v_group
  FROM public.groups g JOIN public.users u ON u.id = g.host_id
  WHERE g.id = p_group_id AND NOT public.is_blocked(auth.uid(),g.host_id);
  IF v_group IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('name',u.nickname,'isMember',true,
    'hasVoted',EXISTS(SELECT 1 FROM public.votes v
      WHERE v.group_id = p_group_id AND v.user_id = m.user_id)) ORDER BY m.joined_at),'[]'::jsonb)
    INTO v_members FROM public.group_members m JOIN public.users u ON u.id=m.user_id
    WHERE m.group_id=p_group_id AND NOT public.is_blocked(auth.uid(),m.user_id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('guest_id',gg.guest_id,
    'name',gg.nickname,'isMember',false,'hasVoted',EXISTS(SELECT 1 FROM public.votes v
      WHERE v.group_id=p_group_id AND v.guest_token=gg.guest_token)) ORDER BY gg.created_at),'[]'::jsonb)
    INTO v_guests FROM public.group_guests gg WHERE gg.group_id=p_group_id
      AND NOT public.is_blocked(auth.uid(),gg.converted_user_id);

  -- 본인 슬롯만 복원. 타인 토큰/회원ID/개별 투표는 반환하지 않는다.
  SELECT coalesce(jsonb_agg(jsonb_build_object('day',v.day,'start_minute',v.start_minute,
    'end_minute',v.end_minute,'is_own',true)),'[]'::jsonb) INTO v_votes
    FROM public.votes v JOIN public.group_guests gg ON gg.guest_token=v.guest_token
    WHERE v.group_id=p_group_id AND gg.group_id=p_group_id AND gg.guest_token=p_guest_token;
  -- D11: 클라이언트에서 raw votes를 합산하지 않고 서버에서 집계한다.
  SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) INTO v_heatmap FROM (
    SELECT v.day,v.start_minute,count(*)::int AS count FROM public.votes v
    LEFT JOIN public.group_guests gg ON gg.guest_token=v.guest_token
    WHERE v.group_id=p_group_id
      AND NOT public.is_blocked(auth.uid(),coalesce(v.user_id,gg.converted_user_id))
    GROUP BY v.day,v.start_minute ORDER BY v.day,v.start_minute
  ) s;
  RETURN v_group || jsonb_build_object('participants',v_members || v_guests,
    'votes',v_votes,'heatmap',v_heatmap);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_guest_votes(
  p_group_id UUID, p_guest_token UUID, p_votes JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_dates DATE[];
BEGIN
  -- 같은 게스트의 동시 저장을 직렬화하고 검증/삭제/삽입을 한 트랜잭션으로 처리.
  PERFORM 1 FROM public.group_guests gg
    WHERE gg.group_id=p_group_id AND gg.guest_token=p_guest_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '유효하지 않은 게스트 토큰입니다.' USING ERRCODE = '42501';
  END IF;
  SELECT g.dates INTO v_dates FROM public.groups g WHERE g.id=p_group_id
    AND NOT public.is_blocked(auth.uid(),g.host_id) FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '모임을 찾을 수 없습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_votes IS NULL OR jsonb_typeof(p_votes) <> 'array' THEN
    RAISE EXCEPTION '투표 형식이 올바르지 않습니다.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_votes) > cardinality(v_dates)*60 THEN
    RAISE EXCEPTION '투표 개수가 너무 많습니다.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_votes)
    AS x(day DATE,start_minute INT,end_minute INT)
    WHERE day IS NULL OR NOT day=ANY(v_dates) OR start_minute IS NULL OR end_minute IS NULL
      OR start_minute<540 OR start_minute>=1440 OR start_minute%15<>0
      OR end_minute<>start_minute+15) THEN
    RAISE EXCEPTION '모임 날짜의 15분 슬롯만 선택할 수 있습니다.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.votes WHERE group_id=p_group_id AND guest_token=p_guest_token;
  INSERT INTO public.votes(group_id,guest_token,day,start_minute,end_minute)
    SELECT DISTINCT p_group_id,p_guest_token,x.day,x.start_minute,x.end_minute
    FROM jsonb_to_recordset(p_votes) AS x(day DATE,start_minute INT,end_minute INT);
END;
$$;

REVOKE ALL ON FUNCTION public.register_guest(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_guest_session(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_guest_group_view(UUID,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_guest_votes(UUID,UUID,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_guest(UUID,TEXT),
  public.get_guest_session(UUID,UUID),public.get_guest_group_view(UUID,UUID),
  public.save_guest_votes(UUID,UUID,JSONB) TO anon,authenticated,service_role;
COMMIT;
