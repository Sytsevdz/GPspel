"use client";

import { useEffect } from "react";

export default function WachtwoordVergetenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[wachtwoord-vergeten] route error", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Er ging iets mis</h1>
        <p>De pagina voor wachtwoordherstel kon niet geladen worden. Probeer het opnieuw.</p>
        <button type="button" onClick={reset}>
          Opnieuw proberen
        </button>
      </section>
    </main>
  );
}
