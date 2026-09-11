import type { NextConfig } from 'next';

// S14-e2e-stability (2026-05-26): web-guest는 RN monorepo 안의 별도 Next.js 프로젝트.
// 부모 `C:\dev\denda-app\package-lock.json` 존재 때문에 Turbopack이 workspace root를
// 잘못 잡아 "Next.js package not found" panic + Fast Refresh 무한 rebuild → E2E
// hydration 미완. `turbopack.root`를 web-guest로 명시하면 panic 해소.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // S15-deeplink (D28) — AASA + assetlinks.json Content-Type 보장.
  // Apple Universal Links: /.well-known/apple-app-site-association은 확장자 없는 파일
  // → Next.js의 default MIME가 application/octet-stream이 될 수 있어 Apple이 거부 가능.
  // application/json + no-cache 강제.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
