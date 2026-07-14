"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
          background: "#eef5f2",
          color: "#10241f",
        }}
      >
        <div style={{ textAlign: "center", padding: "1.5rem", maxWidth: "28rem" }}>
          <p style={{ fontSize: "0.75rem", letterSpacing: "0.16em", textTransform: "uppercase", color: "#5a6f68" }}>
            Catetrek
          </p>
          <h2 style={{ margin: "0.75rem 0", fontSize: "1.5rem" }}>Aplikasi mengalami gangguan</h2>
          <p style={{ color: "#5a6f68", fontSize: "0.9rem" }}>
            {error.message || "Silakan muat ulang halaman."}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.25rem",
              border: 0,
              borderRadius: "0.75rem",
              padding: "0.7rem 1.1rem",
              background: "#0b5f56",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Muat ulang
          </button>
        </div>
      </body>
    </html>
  );
}
