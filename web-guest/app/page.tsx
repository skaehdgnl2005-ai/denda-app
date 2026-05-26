export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-surface-2 px-4">
      <main className="flex w-full max-w-md flex-col items-center gap-6 rounded-md bg-surface-0 p-8 text-center">
        <h1 className="text-2xl font-semibold text-text-primary">된다 (DenDa)</h1>
        <p className="text-base text-text-secondary">친구들과 모임 시간 맞추고 예약까지 한 번에.</p>
        <p className="text-sm text-text-tertiary">모임 초대 링크로 접속해 주세요.</p>
      </main>
    </div>
  );
}
