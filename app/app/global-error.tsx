"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf8f5", color: "#1a1a1a", textAlign: "center", padding: 32 }}>
        <h1 style={{ marginTop: "20vh" }}>Capsule hit a problem</h1>
        <p style={{ opacity: 0.7 }}>Your data is stored on this device and was not changed.</p>
        <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 99, border: 0, background: "#1a1a1a", color: "#fff" }}>Reload</button>
      </body>
    </html>
  );
}
