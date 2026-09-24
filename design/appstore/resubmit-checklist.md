# Kilo — before resubmitting to the App Store

Written 2026-09-24, after the redesign (commits aae5353, 424ac85, c53eb17) and before the next
upload. The last review asked for a screen recording and answers to Guideline 2.1 (Sep 17) and to see
flagging and hiding (1.2). Both are answered in `review-notes.md`; this list is what has to change
around them because the app now looks different.

## 1. Build
- [ ] `git pull` on `main`, then `pnpm native:ios`. It builds against production Convex, refuses a
      bundle without the Turnstile key or with the dev backend, syncs, and opens Xcode.
- [ ] Bump the build number. `CURRENT_PROJECT_VERSION` is `1.0.2`; App Store Connect rejects a
      build number it has already seen, so make it `1.0.3` (or higher).
- [ ] Decide the version. `MARKETING_VERSION` is `1.0.1`. Keep it if 1.0.1 was never approved;
      the listing and review notes still say "1.0.0" in their headings, so make those match.
- [ ] Product → Archive with the **Release** configuration and a distribution profile, so
      `aps-environment` is `production` (see the note at the top of `scripts/native.mjs`).
- [ ] Upload to App Store Connect and wait for processing.

## 2. Test on a physical iPhone (TestFlight build, not the simulator)
- [ ] First run: onboarding screens, pick **Hawaiʻi Island**, skip location, skip warnings. The app
      still works.
- [ ] Now, Weather, Roads, Reports, Storms, Quakes, Tsunami, Volcano, Settings all open and read.
- [ ] The dock search button opens the ʻIo sheet; type a question; the answer appears; the X,
      a tap outside, and the swipe-down/Escape all close it.
- [ ] Reports: post a neighbor report, then **Flag this post** and **Hide posts from this
      neighbor** on a post. Settings → "Neighbors you have hidden" shows it and can undo it.
- [ ] Turn warnings on; a notification arrives (APNs, production).
- [ ] Airplane mode: the app opens and shows the saved copy with its checked time.
- [ ] Dark mode and the largest text size: nothing clipped or unreadable.

## 3. Screenshots — must be retaken
The sets in `iphone-6.9/` and `ipad-13/` were captured on Sep 23, **before** the redesign, so they
no longer match the app. Apple rejects screenshots that do not reflect the build (2.3.3).
- [ ] iPhone 6.9": Now, Weather, Roads, Tsunami (same four, new look). Replace `iphone-6.9/*`.
- [ ] iPad 13": the same four. Replace `ipad-13/*`.
- [ ] Upload both sets in App Store Connect for the new version.

## 4. Screen recording for App Review
- [ ] Record again on the physical iPhone; the old recording shows the old design. Start at launch
      and follow the order in `review-notes.md` §1: onboarding → Now → Weather → Roads → Reports,
      including posting, flagging and hiding. Show the ʻIo sheet once.
- [ ] Attach it to the Resolution Center reply (or link it) with `review-notes.md` as the text.

## 5. App Store Connect text
- [ ] App Review Information → Notes: paste `review-notes-short.md` (3,911 bytes, under the 4,000 cap).
- [ ] Optional line for both notes: the search now also opens as a sheet from the round button
      beside the tab bar; it is still the on-device lexicon, no network call, no model.
- [ ] Description, keywords, promotional text: `listing.md` is still accurate; paste unchanged.
- [ ] Support URL https://kilohi.org/support and Privacy URL https://kilohi.org/privacy both
      resolve (checked 2026-09-24, both 200 after redirect to app.kilohi.org).
- [ ] App Privacy answers unchanged: no data collected and linked to the user, no tracking.
- [ ] Age rating still reflects user-generated content (the Reports screen).
- [ ] Location permission string (Info.plist) is unchanged and matches what the app does.

## 6. Submit
- [ ] Select the new build on the version page, then **Add for Review** → **Submit**.
- [ ] Reply in the Resolution Center to the Sep 17 message so the reviewer sees the answers.
- [ ] Watch aloha+apple@csprinkels.com for the outcome.
