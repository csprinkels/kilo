import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const island = v.union(
  v.literal("hawaii"), v.literal("maui"), v.literal("oahu"), v.literal("kauai"), v.literal("state"),
);

export default defineSchema({
  items: defineTable({
    key: v.string(),
    source: v.string(),
    type: v.string(),
    tier: v.union(v.literal("official"), v.literal("vetted"), v.literal("community")),
    sev: v.number(),
    islands: v.array(island),
    districts: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    srcUrl: v.string(),
    lat: v.optional(v.number()),
    lon: v.optional(v.number()),
    status: v.optional(v.string()),
    fields: v.optional(v.record(v.string(), v.string())),
    issuedAt: v.number(),
    lastConfirmedAt: v.number(),
    expiresAt: v.optional(v.number()),
    hash: v.string(),
    active: v.boolean(), // false once the source stops listing it
  })
    .index("by_key", ["key"])
    .index("by_source_active", ["source", "active"])
    .index("by_active", ["active"]),

  // Published JSON: served by http.ts (dev / fallback) and mirrored to R2 (prod).
  snapshots: defineTable({
    path: v.string(), // "v1/hawaii.json", "v1/manifest.json"
    body: v.string(),
    etag: v.string(),
    gen: v.number(),
  }).index("by_path", ["path"]),
});
