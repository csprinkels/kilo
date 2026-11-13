import { test } from "node:test";
import assert from "node:assert/strict";
import { refEvent, returnBucket } from "../lib/stat.ts";

test("stat: a visit is new or a return, bucketed by days since the last one", () => {
  const t = "2026-11-12";
  assert.equal(returnBucket(null, t), "visit:new");
  assert.equal(returnBucket("garbage", t), "visit:new");
  assert.equal(returnBucket("2026-11-11", t), "return:1d");
  assert.equal(returnBucket("2026-11-10", t), "return:2-7d");
  assert.equal(returnBucket("2026-11-05", t), "return:2-7d");
  assert.equal(returnBucket("2026-11-04", t), "return:8d+");
  assert.equal(returnBucket("2025-11-12", t), "return:8d+");
  assert.equal(returnBucket("2026-11-13", t), "return:1d"); // clock set backwards
});

test("stat: only our own ?ref= values become a source count", () => {
  assert.equal(refEvent("?ref=qr"), "src:qr");
  assert.equal(refEvent("?type=road_blocked&ref=share"), "src:share");
  assert.equal(refEvent("?ref=evil%3Cscript%3E"), null);
  assert.equal(refEvent("?ref=QR"), null);
  assert.equal(refEvent(""), null);
});
