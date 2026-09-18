# App Review notes — Kilo 1.0.0

Paste into **App Store Connect → App Review Information → Notes**, and send the same text as a reply
to the Guideline 2.1 message. Answers are numbered to match Apple's request of Sep 17, 2026.

---

**1. Screen recording.** Attached/linked separately. It is captured on a physical iPhone running the
latest iOS, begins at app launch, and shows: onboarding (island, town, optional location, optional
warnings) → the Now screen → Weather → Roads → Reports, including posting a neighbor report, flagging
a post, and hiding a neighbor. There is no account registration, no login, no account deletion and no
paid content anywhere in the app, so none of those flows appear.

**2. What the app is, and who it is for.** Kilo shows what is happening on one Hawaiian island —
official warnings, storms, road closures, shelters, weather, earthquakes, tsunami evacuation zones and
volcano status — rewritten in plain words on a single page. It is for residents and visitors in
Hawaiʻi who need one answer immediately ("is the road open", "is there a shelter", "do I have to
leave") and who often need it on a weak connection. The app opens with no signal and shows the last
copy it saved, stamped with the time it was checked.

**3. Setting up and accessing the features.** There is nothing to set up. No account, no login, no
credentials, no sample files, no in-app purchase, no subscription. On first launch you pick an island
and a town. **Please pick Hawaiʻi Island** — neighbor reports are Hawaiʻi Island only, so the Reports
screen is where the user-generated content, flagging and blocking can be seen. Every screen is reachable
from the section links on every page (a bar at the bottom on iPhone, pills under the header on iPad).

Location and notifications are both optional and skippable. Two features use location — sorting road
closures by distance on Roads, and the evacuation-zone check on Tsunami — and each has a no-location
alternative on the same screen (the full closures list, and the zone map plus the official evacuation-map
link). Declining notifications only means warnings are not pushed; every screen still works.

There is one non-public page for the app's single moderator at `/mod`, reachable only with a secret
key that is not in the app and not linked from anywhere in it. It is the queue used to approve or hide
neighbor reports (see 6). It is not part of the customer experience and needs no credentials to review
the app.

**4. External services used to deliver core functionality.**

*Infrastructure*
- Convex — backend: fetches the public feeds on a schedule, stores neighbor reports, sends notifications.
- Cloudflare Pages — web hosting for app.kilohi.org (the same build is bundled into the app via Capacitor).
- Cloudflare R2 — static mirror of the published JSON snapshots.
- Cloudflare Turnstile — bot check on the neighbor-report form.
- Apple Push Notification service — warning notifications on iOS.

*Maps and imagery*
- MapLibre GL with CARTO basemap tiles; RainViewer rain radar; NOAA satellite imagery; an embedded
  Waze live traffic map on the Roads screen; outbound links to Apple Maps.

*Public data sources (all public feeds, see 5 and 6)*
- National Weather Service (api.weather.gov, alerts.weather.gov), Pacific Tsunami Warning Center
  (tsunami.gov), Central Pacific Hurricane Center, USGS earthquakes, USGS Hawaiian Volcano Observatory,
  NOAA NDBC buoys, NOAA Tides and Currents, AirNow (air quality), Hawaiʻi DOT, Hawaiʻi County Civil
  Defense, HI-EMA, Hawaiʻi County Department of Water Supply, Hawaiʻi Police Department, City and
  County of Honolulu 911 dispatch, Hawaiʻi Department of Health / IVHHN (vog), and the State of
  Hawaiʻi GIS / Esri ArcGIS services for map layers.
- Open-Meteo — an independent forecast model shown beside the National Weather Service forecast and
  labelled in the app as an alternate prediction (CC-BY).

There is **no AI or machine-learning service**. The in-app search ("ʻIo") is a fixed lexicon running
on the device over the same items already on screen; it has no network call and no model, and every
sentence it shows is either the agency's own wording or one of a small set of fixed lines. There is
no authentication provider, no payment processor, and no advertising or analytics SDK.

**5. Regional differences.** None. The app behaves identically in every region and has no
geographic restrictions, paywalls, or region-locked content. Its *content* is Hawaiʻi-specific by
design — it covers the four Hawaiian island groups — so a person outside Hawaiʻi sees the same working
app showing Hawaiʻi conditions. Nothing is hidden or unlocked based on where the user is.

**6. Regulated industry, and third-party material.** Kilo is not a government app, not an emergency
service, and claims no affiliation with any agency. It republishes public feeds that these agencies
publish for this purpose; US federal government works (NWS, USGS, NHC, PTWC) are public domain, and
the state and county feeds are public. Every item in the app names the agency that issued it and
links to that agency's own page, word for word. The app says in its description, on its own screens,
and in the onboarding that it is not an emergency service and that 911 and Civil Defense come first.

**User-generated content (Guideline 1.2).** The Reports screen carries short-lived posts from
neighbors, on Hawaiʻi Island only. Every precaution is in the build:

- **Filtering.** Posts are screened automatically before publication — license plates, phone numbers,
  contact details and links, accusations naming a person, home addresses, profanity and all-caps
  shouting are held for human review, and "Something else" posts are *always* held. Nothing is
  published above informational severity, no post can trigger a notification, and coordinates are
  never published.
- **Reporting.** Any post can be flagged from the post itself ("Flag this post"), and the control stays
  available after voting. Three flags send it back to human review, unless more neighbors have confirmed
  the post than flagged it.
- **Blocking.** Every neighbor post carries "Hide posts from this neighbor". That hides every post from
  that person across the app, on that device, until it is undone in Settings → "Neighbors you have
  hidden", which shows the count and is the only way back.
- **Moderation.** A named moderator reviews the held queue and can hide any post outright. Posts
  expire on their own within hours (2–12 depending on type, 7 days for a lost pet).
- **Rate limits.** Five posts per device per day, sixty per district per hour, thirty votes per day.
- **Published contact.** aloha@csprinkels.com, on https://kilohi.org/support and in the app.

**Privacy.** There are no accounts and no advertising. Location, when granted, is used on the device
to sort what is near you and to check an address against the tsunami zones that ship inside the app;
it is not sent to us. Usage counts are anonymous tallies ("the Weather screen was opened 300 times
today") with nothing tied to a person or a device. https://kilohi.org/privacy
