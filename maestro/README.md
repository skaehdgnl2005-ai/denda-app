# Maestro E2E — 된다 (DenDa)

모바일 E2E 스위트. **EAS Build로 디바이스 설치된 빌드** 기준으로 실기기/에뮬레이터에서 실행.

→ Test plan SSoT: [docs/TEST_PLAN.md §3.2](../docs/TEST_PLAN.md#§32-maestro-e2e-모바일)

## 설치

```bash
# macOS / Linux
curl -fsSL "https://get.maestro.mobile.dev" | bash

# Windows (PowerShell, WSL2 또는 git-bash 경유)
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

자세한 설치는 [Maestro 공식 문서](https://docs.maestro.dev/getting-started/installing-maestro).

## 실행

```bash
# 단일 spec
maestro test maestro/kakao_oauth.yaml

# 디렉토리 전체
maestro test maestro/

# Maestro Cloud (CI / 디바이스 팜)
maestro cloud --api-key $MAESTRO_API_KEY maestro/
```

## Critical Paths (Gate 측정 직접 영향)

| Spec | 측정 대상 | 영향 |
|---|---|---|
| `kakao_oauth.yaml` | D29 OIDC 첫 로그인 funnel | onboarding 완주율 |
| `host_create_group.yaml` | 모임 생성 + 친구 초대 + 카톡 공유 | Gate #1 진입 |
| `member_vote.yaml` | 시간 그리드 60fps 드래그 sweep | D12 회사 운명 |
| `place_select_click_through.yaml` | 장소 확정 → "예약하기" click | **Gate #2 (Phase 3 commit 단일 게이트)** |

## 사전 조건 (per-spec)

- **kakao_oauth.yaml**: 카카오 portal에서 본 디바이스가 테스트 계정으로 등록되어 있어야 함
- **host_create_group.yaml**: 카카오 친구 목록에 *테스트 친구* 최소 1명 존재
- **member_vote.yaml**: 호스트 계정이 미리 모임을 생성하고 invite_code 또는 push F3 전송 (또는 attribution_resolve로 자동 합류)
- **place_select_click_through.yaml**: `groups.confirmed_at IS NOT NULL` + `confirmed_place_id IS NOT NULL` 상태인 모임

## 운영 트랙

- Maestro CLI 설치 + Maestro Cloud API key 등록은 founder 운영
- 실기기 매트릭스: iPhone SE 2 (저사양 iOS) + Galaxy A14/A10 (저사양 Android, D12 측정 기준)
- TestFlight Internal Testing 라운드와 함께 진행 (S17 acceptance)
- CI 통합은 W3.5 이후 결정 (현재는 founder 수동 실행)

## 본 스켈레톤의 한계

- 본 spec은 *흐름과 검증 포인트*를 정의. 실기기에서 selector(`id`, `text`, `accessibilityLabel`)가 정확히 매칭되는지 검증 필요
- 카카오 로그인 모달은 SDK 네이티브 모달이라 Maestro 입력이 제한적 — webview script가 필요할 수 있음
- 60fps 그리드 드래그는 시각적 정확도까지 검증 안 됨 (수치 측정은 production binary + Android profiler — D12 + S05e 운영)
