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
    path: v.optional(v.array(v.array(v.number()))),
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
    .index("by_active", ["active"])
    .index("by_active_confirmed", ["active", "lastConfirmedAt"]), // purge: inactive rows, oldest first

  // Active tropical cyclones (latest advisory) + every past advisory position.
  storms: defineTable({
    stormId: v.string(),
    advNum: v.number(),
    data: v.any(), // Storm minus `track`
    active: v.boolean(),
    updatedAt: v.number(),
  }).index("by_stormId", ["stormId"]).index("by_active", ["active"]),
  stormTrack: defineTable({
    stormId: v.string(),
    adv: v.number(),
    at: v.number(),
    lat: v.number(),
    lon: v.number(),
    windKt: v.number(),
    cls: v.string(),
  }).index("by_storm_adv", ["stormId", "adv"]),

  // Web Push subscriptions (one row per browser/device), scoped to an island.
  pushSubs: defineTable({
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    island: v.string(),
    minSev: v.number(),
    createdAt: v.number(),
    lastOkAt: v.optional(v.number()),
    failures: v.number(),
    kind: v.optional(v.string()), // absent = "web"; "apns" | "fcm" rows keep the device token in `endpoint`, p256dh/auth ""
  }).index("by_endpoint", ["endpoint"]).index("by_island", ["island"]),
  pushLog: defineTable({ island: v.string(), at: v.number(), trigger: v.string(), sent: v.number(), failed: v.number() }).index("by_island", ["island"]),

  // Community reports. Never deleted by app code while fresh; never published with coordinates (none collected in v1).
  reports: defineTable({
    type: v.string(),
    text: v.string(),
    locText: v.string(),
    island: v.string(),
    district: v.string(),
    status: v.union(v.literal("pending"), v.literal("live"), v.literal("hidden"), v.literal("expired")),
    holdReason: v.optional(v.string()),
    deviceHash: v.string(),
    confirmCount: v.number(),
    goneCount: v.number(),
    flagCount: v.number(),
    voters: v.array(v.string()),
    createdAt: v.number(),
    lastConfirmedAt: v.number(),
    expiresAt: v.number(),
    modNote: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_district_type_created", ["district", "type", "createdAt"])
    .index("by_device_created", ["deviceHash", "createdAt"]),

  // Source health over time, so the owner hears about a feed that has been failing for a while (watch.ts).
  watch: defineTable({ source: v.string(), failsInRow: v.number(), lastOk: v.number(), lastAlertAt: v.number() }).index("by_source", ["source"]),

  // Published JSON: served by http.ts (dev / fallback) and mirrored to R2 (prod).
  snapshots: defineTable({
    path: v.string(), // "v1/hawaii.json", "v1/manifest.json"
    body: v.string(),
    etag: v.string(),
    gen: v.number(),
  }).index("by_path", ["path"]),
});
