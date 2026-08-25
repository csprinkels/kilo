/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as nativePush from "../nativePush.js";
import type * as pages from "../pages.js";
import type * as parsers_feeds from "../parsers/feeds.js";
import type * as parsers_hccda from "../parsers/hccda.js";
import type * as parsers_nws from "../parsers/nws.js";
import type * as parsers_pages from "../parsers/pages.js";
import type * as parsers_storms from "../parsers/storms.js";
import type * as push from "../push.js";
import type * as pushJwt from "../pushJwt.js";
import type * as pushStore from "../pushStore.js";
import type * as reports from "../reports.js";
import type * as stats from "../stats.js";
import type * as storms from "../storms.js";
import type * as waitlist from "../waitlist.js";
import type * as watch from "../watch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  ingest: typeof ingest;
  nativePush: typeof nativePush;
  pages: typeof pages;
  "parsers/feeds": typeof parsers_feeds;
  "parsers/hccda": typeof parsers_hccda;
  "parsers/nws": typeof parsers_nws;
  "parsers/pages": typeof parsers_pages;
  "parsers/storms": typeof parsers_storms;
  push: typeof push;
  pushJwt: typeof pushJwt;
  pushStore: typeof pushStore;
  reports: typeof reports;
  stats: typeof stats;
  storms: typeof storms;
  waitlist: typeof waitlist;
  watch: typeof watch;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
