// S03 — Edge Function: 에브리타임 OCR (Gemini Vision)
// 두 단계:
//   1) action='preview': 이미지 → Gemini Vision → 강의 list (INSERT 안 함)
//   2) action='confirm': 사용자가 검수한 강의 list → schedules table INSERT (source='everytime')
//
// 결정 의존:
//   D2: OCR Phase 1+2 keep (외부 캘린더 push 안 함)
//   D13: KST 입력 → DB TIMESTAMPTZ UTC
//   D15: source enum = 'everytime' 격리
//   secret: GEMINI_API_KEY는 Edge Function only (클라이언트 expose 금지)

import { handlePreflight, jsonResponse, errorResponse } from '../_lib/http.ts';
import { getAnonClient, getServiceRoleClient } from '../_lib/supabase.ts';
import { parseGeminiResponse, type OcrCourse, type OcrResult } from './parser.ts';
import { buildScheduleRow } from './schedule.ts';

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const OCR_PROMPT = `다음 이미지는 대학교 시간표 (에브리타임 등)야. 모든 강의를 추출해.

규칙:
- name: 강의명 (한국어 원문 그대로)
- day: MON | TUE | WED | THU | FRI | SAT | SUN 중 하나 (월=MON, 화=TUE, ...)
- start, end: HH:MM 24시간 표기 (예: 10:00, 13:30)
- room: 강의실 (있으면 포함, 없으면 생략)
- 동일 강의가 여러 요일에 있으면 요일별로 분리

응답은 반드시 다음 형식의 순수 JSON (다른 텍스트 금지):
{ "courses": [{ "name": "선형대수", "day": "MON", "start": "10:00", "end": "11:30", "room": "공학관 401" }] }`;

interface PreviewBody {
  action: 'preview';
  image: string; // base64
  mimeType?: string;
}

interface ConfirmBody {
  action: 'confirm';
  semesterStart: string;
  semesterEnd: string;
  courses: OcrCourse[];
  replaceExisting?: boolean;
}

type RequestBody = PreviewBody | ConfirmBody;

async function callGeminiVision(imageBase64: string, mimeType: string): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY env missing');
  }
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: OCR_PROMPT },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  // Gemini response: { candidates: [{ content: { parts: [{ text: '...' }] } }] }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini response missing text');
  }
  return text;
}

async function handlePreview(body: PreviewBody): Promise<Response> {
  if (typeof body.image !== 'string' || body.image.length === 0) {
    return errorResponse('image (base64) required', 400);
  }
  const mimeType = body.mimeType ?? 'image/png';
  if (!/^image\/(png|jpe?g|webp)$/.test(mimeType)) {
    return errorResponse(`unsupported mimeType: ${mimeType}`, 400);
  }
  let rawJson: string;
  try {
    rawJson = await callGeminiVision(body.image, mimeType);
  } catch (e) {
    return errorResponse(`OCR 실패: ${(e as Error).message}`, 502);
  }
  let parsed: OcrResult;
  try {
    parsed = parseGeminiResponse(rawJson);
  } catch (e) {
    return errorResponse(`OCR 결과 파싱 실패: ${(e as Error).message}`, 502);
  }
  return jsonResponse({ ok: true, courses: parsed.courses });
}

async function handleConfirm(body: ConfirmBody, userId: string): Promise<Response> {
  if (!Array.isArray(body.courses) || body.courses.length === 0) {
    return errorResponse('courses (검수 결과) 필요', 400);
  }
  if (typeof body.semesterStart !== 'string' || typeof body.semesterEnd !== 'string') {
    return errorResponse('semesterStart / semesterEnd (YYYY-MM-DD) 필요', 400);
  }

  let rows;
  try {
    rows = body.courses.map((course) =>
      buildScheduleRow({
        course,
        semesterStart: body.semesterStart,
        semesterEnd: body.semesterEnd,
        userId,
      })
    );
  } catch (e) {
    return errorResponse(`일정 변환 실패: ${(e as Error).message}`, 400);
  }

  const service = getServiceRoleClient();

  // 기존 everytime 일정 교체 옵션: 동일 user의 같은 학기 범위 source='everytime' 모두 삭제 후 재삽입
  // (TASK_BACKLOG: "두 번째 import 시 기존 데이터 덮어쓰기 또는 추가 결정 UI" — 기본은 추가, replaceExisting=true 시 덮어쓰기)
  if (body.replaceExisting === true) {
    const { error: delErr } = await service
      .from('schedules')
      .delete()
      .eq('user_id', userId)
      .eq('source', 'everytime');
    if (delErr) {
      return errorResponse(`기존 일정 삭제 실패: ${delErr.message}`, 500);
    }
  }

  const { data, error } = await service.from('schedules').insert(rows).select('id');
  if (error) {
    return errorResponse(`schedules INSERT 실패: ${error.message}`, 500);
  }

  return jsonResponse({ ok: true, inserted: data?.length ?? 0 });
}

Deno.serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return errorResponse('POST only', 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Authorization header 필요', 401);
  }
  const userClient = getAnonClient(authHeader);
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return errorResponse('인증 실패', 401);
  }
  const userId = userData.user.id;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('JSON body 필요', 400);
  }

  if (body.action === 'preview') {
    return handlePreview(body);
  }
  if (body.action === 'confirm') {
    return handleConfirm(body, userId);
  }
  return errorResponse(`unknown action: ${(body as { action?: unknown }).action}`, 400);
});
