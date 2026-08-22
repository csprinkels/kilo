import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { apnsJwt, decodeEnv, googleGrantJwt, memo } from "../convex/pushJwt.ts";

const part = (jwt: string, i: number) => JSON.parse(Buffer.from(jwt.split(".")[i], "base64url").toString());
const sigOf = (jwt: string) => Buffer.from(jwt.split(".")[2], "base64url");
const inputOf = (jwt: string) => Buffer.from(jwt.split(".").slice(0, 2).join("."));

test("apnsJwt: ES256, kid/iss/iat, ieee-p1363 signature verifies", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const key = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const jwt = apnsJwt({ keyId: "ABC123DEFG", teamId: "TEAM000001", key }, 1_700_000_000_500);
  assert.equal(jwt.split(".").length, 3);
  assert.deepEqual(part(jwt, 0), { alg: "ES256", kid: "ABC123DEFG" });
  assert.deepEqual(part(jwt, 1), { iss: "TEAM000001", iat: 1_700_000_000 });
  assert.equal(sigOf(jwt).length, 64); // raw r||s, not DER
  assert.ok(verify("sha256", inputOf(jwt), { key: publicKey, dsaEncoding: "ieee-p1363" }, sigOf(jwt)));
});

test("googleGrantJwt: RS256 grant with scope/aud/exp, signature verifies", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const private_key = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const sa = { project_id: "kilo", client_email: "svc@kilo.iam.gserviceaccount.com", private_key };
  const jwt = googleGrantJwt(sa, "https://www.googleapis.com/auth/firebase.messaging", 1_700_000_000_000);
  assert.deepEqual(part(jwt, 0), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(part(jwt, 1), {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600,
  });
  assert.ok(verify("sha256", inputOf(jwt), publicKey, sigOf(jwt)));
  assert.ok(!verify("sha256", Buffer.from("tampered"), publicKey, sigOf(jwt)));
});

test("decodeEnv: raw PEM/JSON pass through, base64 decodes", () => {
  const pem = "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n";
  assert.equal(decodeEnv(pem), pem.trim());
  assert.equal(decodeEnv(Buffer.from(pem).toString("base64")), pem);
  assert.equal(decodeEnv(' {"a":1} '), '{"a":1}');
  assert.equal(decodeEnv(Buffer.from('{"a":1}').toString("base64")), '{"a":1}');
});

test("memo: one make per ttl, rejections not cached", async () => {
  let n = 0;
  const ok = memo(60_000, async () => ++n);
  assert.equal(await ok(), 1);
  assert.equal(await ok(), 1);
  const bad = memo(60_000, async () => { n++; throw new Error("x"); });
  await assert.rejects(bad());
  await assert.rejects(bad());
  assert.equal(n, 3);
});
