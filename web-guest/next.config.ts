import type { NextConfig } from 'next';

// S14-e2e-stability (2026-05-26): web-guest는 RN monorepo 안의 별도 Next.js 프로젝트.
// 부모 `C:\dev\denda-app\package-lock.json` 존재 때문에 Turbopack이 workspace root를
// 잘못 잡아 "Next.js package not found" panic + Fast Refresh 무한 rebuild → E2E
// hydration 미완. `turbopack.root`를 web-guest로 명시하면 panic 해소.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
