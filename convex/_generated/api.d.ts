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
import type * as parsers_feeds from "../parsers/feeds.js";
import type * as parsers_hccda from "../parsers/hccda.js";
import type * as parsers_nws from "../parsers/nws.js";
import type * as parsers_storms from "../parsers/storms.js";
import type * as push from "../push.js";
import type * as pushStore from "../pushStore.js";
import type * as reports from "../reports.js";
import type * as storms from "../storms.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  http: typeof http;
  ingest: typeof ingest;
  "parsers/feeds": typeof parsers_feeds;
  "parsers/hccda": typeof parsers_hccda;
  "parsers/nws": typeof parsers_nws;
  "parsers/storms": typeof parsers_storms;
  push: typeof push;
  pushStore: typeof pushStore;
  reports: typeof reports;
  storms: typeof storms;
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
