import React from 'react';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>HESTIIA RESTAURANT — BACKEND API</h1>
      <p>DIMISI-OPS Next.js App Router + MongoDB + Cloudinary API Engine</p>
      <p>
        Healthcheck: <a href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
