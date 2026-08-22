"use node";
// Pure pieces of native push: JWT assembly + env decoding. "use node" because the Convex isolate bundler
// refuses node:crypto; the directive is inert for node --test, which imports this directly.
import { createPrivateKey, sign } from "node:crypto";

export const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** Secrets in env may be the raw PEM / JSON or base64 of it (Convex dashboard mangles multi-line values). */
export function decodeEnv(s: string): string {
  const t = s.trim();
  return t.startsWith("-----") || t.startsWith("{") ? t : Buffer.from(t, "base64").toString("utf8");
}

/** Compact JWS. ES256 signatures are emitted raw r||s (ieee-p1363), as JWT requires — not DER. */
export function signJwt(alg: "ES256" | "RS256", header: Record<string, unknown>, claims: Record<string, unknown>, pem: string): string {
  const input = `${b64url(JSON.stringify({ alg, ...header }))}.${b64url(JSON.stringify(claims))}`;
  const key = createPrivateKey(pem);
  const sig = sign("sha256", Buffer.from(input), alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key);
  return `${input}.${b64url(sig)}`;
}

/** APNs provider token (token-based auth). Apple accepts it for 60 min. */
export const apnsJwt = (c: { keyId: string; teamId: string; key: string }, now = Date.now()) =>
  signJwt("ES256", { kid: c.keyId }, { iss: c.teamId, iat: Math.floor(now / 1000) }, c.key);

export type ServiceAccount = { project_id: string; client_email: string; private_key: string };

/** OAuth2 JWT-bearer grant for a Google service account. */
export function googleGrantJwt(sa: ServiceAccount, scope: string, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  return signJwt("RS256", { typ: "JWT" }, { iss: sa.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat, exp: iat + 3600 }, sa.private_key);
}

/** Module-level TTL cache for one async value; a rejection is not cached. */
export function memo<T>(ttlMs: number, make: () => Promise<T>): () => Promise<T> {
  let slot: { at: number; p: Promise<T> } | null = null;
  return () => {
    if (!slot || Date.now() - slot.at > ttlMs) {
      const p = make().catch((e) => { slot = null; throw e; });
      slot = { at: Date.now(), p };
    }
    return slot.p;
  };
}
