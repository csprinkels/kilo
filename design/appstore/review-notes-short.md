# App Review Notes — Kilo

Full reply with the recording: Resolution Center (review-notes.md). This fits the 4000-byte Notes field.

SETUP. Nothing to set up: no account, login, credentials, sample files or purchases. On first
launch pick **Hawaiʻi Island** — neighbor reports are Hawaiʻi Island only, so Reports is where the
user-generated content, flagging and blocking can be seen. Every screen is reachable from the
section links (a bar at the bottom on iPhone, pills under the header on iPad). Location and
notifications are optional: two features use location — distance sorting on Roads and the
evacuation-zone check on Tsunami — and each has a no-location alternative on the same screen.

PURPOSE. Kilo shows what is happening on one Hawaiian island — official warnings, storms, road
closures, shelters, weather, earthquakes, tsunami evacuation zones, volcano status — in plain words
on one page, for residents and visitors who need one answer immediately, often on a weak
connection. It opens with no signal and shows the last copy it saved, with the time it was checked.

REGIONS. No regional differences, geographic restrictions or region-locked content. The content is
Hawaiʻi-specific by design; someone outside Hawaiʻi sees the same working app.

USER-GENERATED CONTENT (Guideline 1.2). Reports carries short-lived neighbor posts, Hawaiʻi Island
only.
- Terms: posting requires agreeing to the neighbor rules, which have zero tolerance for abuse.
- Filtering: posts are screened before publication — license plates, phone numbers, contact details
  and links, accusations naming a person, home addresses, profanity and all-caps are held for human
  review, and "Something else" posts are always held. No neighbor post can raise a notification.
- Reporting: every post carries "Flag this post", before and after voting. Each flag alerts the
  moderator, who acts within 24 hours; three flags take the post down until then.
- Blocking: every post carries "Hide posts from this neighbor", which hides every post from that
  person across the app, on that device, until undone in Settings → "Neighbors you have hidden".
- Moderation: a named moderator reviews the held queue, hides posts, and can block the phone that
  sent one from posting or voting again. Posts expire on their own
  (2–12 hours; 7 days for a lost pet). Limits: 5 posts per device per day, 60 per district per
  hour, 30 votes per day.
- Contact: aloha@csprinkels.com, published at https://kilohi.org/support and inside the app.

EXTERNAL SERVICES. Convex (backend), Cloudflare Pages, Cloudflare R2, Cloudflare Turnstile (bot
check on the report form), Apple Push Notification service. Maps: MapLibre with CARTO tiles,
RainViewer radar, NOAA imagery, an embedded Waze traffic map, links to Apple Maps. Public data:
National Weather Service, Pacific Tsunami Warning Center, Central Pacific Hurricane Center, USGS,
USGS Hawaiian Volcano Observatory, NOAA buoys and tides, AirNow, Hawaiʻi DOT, County Civil Defense,
HI-EMA, County Water Supply, Hawaiʻi Police, Honolulu 911 dispatch, Department of Health / IVHHN,
State of Hawaiʻi GIS, and Open-Meteo (an alternate forecast, labelled as such, CC-BY). No AI or
machine-learning service: the in-app search is a fixed on-device lexicon over what is already on
screen. No authentication provider, payment processor, advertising or analytics SDK.

THIRD-PARTY MATERIAL. Kilo is not a government app and claims no affiliation. It republishes public
agency feeds; US federal works (NWS, USGS, NHC, PTWC) are public domain and the state and county
feeds are public. Every item names the agency that issued it and links to that agency's page. The
app says throughout that it is not an emergency service and that 911 comes first.

PRIVACY. No accounts, no advertising. Location is used on the device and is not sent to us. Usage
counts are anonymous tallies tied to no person and no device. https://kilohi.org/privacy
