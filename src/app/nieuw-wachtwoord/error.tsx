"use client";

import Link from "next/link";

export default function NewPasswordError() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Nieuw wachtwoord</h1>
        <p className="form-message error">Er ging iets mis bij het laden van deze pagina.</p>
        <p>
          <Link href="/wachtwoord-vergeten">Vraag een nieuwe resetlink aan</Link>
        </p>
      </section>
    </main>
  );
}
