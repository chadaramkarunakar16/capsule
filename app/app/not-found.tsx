import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ padding: 32, maxWidth: 420, margin: "20vh auto 0", textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--font-fraunces)", fontSize: 26, marginBottom: 8 }}>Nothing here</h1>
      <p style={{ opacity: 0.7, marginBottom: 18 }}>That page doesn't exist.</p>
      <Link className="btn dark" href="/">Back to Capsule</Link>
    </main>
  );
}
