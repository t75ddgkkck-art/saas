"use client";

/**
 * Global error boundary (Lot 13 monitoring).
 * Next.js remonte ici les erreurs qui pètent AVANT le root layout
 * (rare, mais on veut quand même les capturer côté Sentry).
 *
 * Ce fichier DOIT contenir son propre <html> / <body>.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import("@/lib/monitoring")
      .then(({ captureException }) => {
        captureException(error, {
          route: "app/global-error.tsx",
          severity: "critical", // erreur avant même que le layout monte
          extra: { digest: error.digest },
        });
      })
      .catch(() => {
        // eslint-disable-next-line no-console
        console.error("[global] uncaught error", error);
      });
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Une erreur critique est survenue</h1>
        <p style={{ maxWidth: 480, marginTop: "1rem", color: "#64748b" }}>
          L&apos;application n&apos;a pas pu démarrer. Notre équipe a été alertée automatiquement.
        </p>
        {error.digest && (
          <p style={{ marginTop: "1rem", fontFamily: "monospace", fontSize: "0.75rem", color: "#94a3b8" }}>
            Code : {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.5rem",
            border: 0,
            borderRadius: "0.5rem",
            background: "#0f172a",
            color: "white",
            cursor: "pointer",
          }}
        >
          Recharger
        </button>
      </body>
    </html>
  );
}
