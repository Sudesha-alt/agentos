export default function MarketingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-center text-ink">
      <div className="flex max-w-md flex-col items-center gap-4">
        <div className="size-8 animate-pulse rounded-full bg-indigo/40 shadow-glow-indigo" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Loading 3D scene
        </p>
        <p className="text-sm leading-relaxed text-ink-dim">
          The first dev load can take a minute while Vite bundles Three.js. If
          this screen stays longer than 2 minutes, stop the server, delete{" "}
          <code className="text-ink">app/node_modules/.vite</code>, and run{" "}
          <code className="text-ink">npm run dev</code> again.
        </p>
      </div>
    </div>
  );
}
