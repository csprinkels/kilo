import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// ponytail: fixed 2-minute poll for every source; self-schedule 60s during "watch" if latency ever matters.
crons.interval("ingest feeds", { minutes: 2 }, internal.ingest.run, {});
crons.interval("tropical cyclones", { minutes: 2 }, internal.storms.refresh, {});
crons.interval("expire community reports", { minutes: 5 }, internal.reports.expire, {});
crons.interval("page data (weather, quakes, volcano, tsunami)", { minutes: 5 }, internal.pages.run, {});
crons.daily("purge stale feed items", { hourUTC: 12, minuteUTC: 0 }, internal.ingest.purge, {}); // 2am HST
crons.interval("watchdog: is the manifest still updating", { minutes: 10 }, internal.watch.check, {});
export default crons;
