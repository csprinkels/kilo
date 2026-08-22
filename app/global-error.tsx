"use client";
import { useEffect } from "react";

// Last resort: something threw in the root layout, so error.tsx never mounted. This file replaces the whole
// document — Next's docs are explicit that global styles, fonts and the app's theme do NOT reach it, so every
// colour here is inline and both schemes are painted by hand.
const CSS = `
  :root { color-scheme: light dark; --bg:#f5f1ea; --ink:#1b1a17; --ink2:#4a463f; --danger:#b3261e; --dangerbg:#fbe9e7; --line:#ddd6ca; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#121311; --ink:#f1ede6; --ink2:#cdc7bb; --danger:#ff6b5e; --dangerbg:#3a1512; --line:#34362e; }
  }
  html,body { margin:0; background:var(--bg); color:var(--ink); }
  body { font: 400 19px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; padding: 2rem 1.25rem; }
  main { max-width: 36rem; margin: 0 auto; }
  h1 { font-size: 2rem; line-height: 1.15; margin: 1.75rem 0 0; }
  p { color: var(--ink2); }
  .call { border-left: 4px solid var(--danger); background: var(--dangerbg); padding: 0.75rem 1rem; border-radius: 0.75rem; }
  .call b { color: var(--ink); font-size: 1.0625rem; }
  button { font: inherit; font-weight: 600; min-height: 3.5rem; width: 100%; margin-top: 1.5rem;
           border: 1px solid var(--line); border-radius: 999px; background: var(--bg); color: var(--ink); cursor: pointer; }
  button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  a { color: inherit; }
`;

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error("[kilo] root", error); }, [error]);
  return (
    <html lang="en">
      <body>
        <title>Kilo could not start</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <main>
          <div className="call">
            <b>Hurt or in danger? Call 911.</b>
            <p style={{ margin: "0.25rem 0 0" }}>Do not wait for this screen.</p>
          </div>
          <h1>Kilo could not start</h1>
          <p>Something went wrong on this phone, not out in the world. Try again.</p>
          <button onClick={() => retry()}>Try again</button>
          <p style={{ fontSize: "1rem", marginTop: "1.5rem" }}>
            Official warnings are always at <a href="https://www.weather.gov/hfo/">weather.gov/hfo</a>.
          </p>
        </main>
      </body>
    </html>
  );
}
