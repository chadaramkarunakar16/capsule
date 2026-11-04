"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ padding: 32, maxWidth: 420, margin: "20vh auto 0", textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--font-fraunces)", fontSize: 26, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ opacity: 0.7, lineHeight: 1.5, marginBottom: 18 }}>Your wardrobe is safe — nothing was lost. Try again, or reload the page.</p>
      <button className="btn dark" onClick={reset}>Try again</button>
    </main>
  );
}
