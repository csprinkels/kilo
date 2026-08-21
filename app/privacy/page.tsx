"use client";
import PageShell, { Section } from "@/components/PageShell";
import { APP_NAME } from "@/lib/brand";

/**
 * The privacy policy, in the same plain words as the rest of the app. Both app stores require a public URL for this page.
 * Every sentence here is a promise the code keeps; change the code, change the sentence.
 */
const UPDATED = "August 21, 2026";

export default function Privacy() {
  return (
    <PageShell title="Privacy" sentence={`${APP_NAME} is free, has no ads and no accounts. Here is exactly what it keeps, and what it never does.`}>
      <Section title="What stays on your phone">
        <ul className="mt-s2 max-w-[36rem] list-disc pl-5 text-body text-ink-2">
          <li>Your island, your town, your text size, and whether you turned warnings on. These are settings, saved in the app on your phone only.</li>
          <li>The last information the app downloaded, so it still opens with no signal.</li>
          <li>A random device number, made by the app, used only so one phone cannot post or vote without limit. It is not your phone&apos;s own number and says nothing about you.</li>
        </ul>
      </Section>

      <Section title="Your location">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          When you tap <strong className="font-semibold text-ink">Check where I am</strong> or <strong className="font-semibold text-ink">Show what is closed near me</strong>, the app asks your phone where you are and does the check on the phone. Your location is never sent to us or to anyone else, and it is not saved. The maps load street tiles from OpenStreetMap (via CARTO) and rain radar from RainViewer; like any map, they see which part of the map you are looking at, not where you are.
        </p>
      </Section>

      <Section title="Warnings on this phone">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          If you turn warnings on, your phone gives us an address to send notifications to, and we keep it together with the island you chose and how serious a warning has to be. That is all. Turn warnings off and it is deleted.
        </p>
      </Section>

      <Section title="Neighbor reports">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          What you type in a report is shown to other people on your island, marked as a neighbor report. We keep the words, the type, the area you picked, and the time, for up to a week after the report clears, then delete them. Reports that mention a license plate, a person&apos;s name, a phone number or a link are read by a person before they show. We do not ask for your name and do not know who wrote a report.
        </p>
      </Section>

      <Section title="What we never do">
        <ul className="mt-s2 max-w-[36rem] list-disc pl-5 text-body text-ink-2">
          <li>Show ads, or let anyone else show you ads.</li>
          <li>Ask you to sign up, or collect your name, email or phone number.</li>
          <li>Sell, share or store where you are.</li>
          <li>Use a tracking or analytics company. There is no analytics code in the app.</li>
          <li>Let a computer write an alert in the name of an official agency.</li>
        </ul>
      </Section>

      <Section title="Where the information comes from" sentence="Weather, alerts, roads, earthquakes, the volcano and tsunami information come from public agencies (the National Weather Service, Hawaiʻi County Civil Defense, the state highways department, the USGS and others). Reading it from them sends them nothing about you; the app fetches it for everyone and passes it on." />

      <Section title="Who we are">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          {APP_NAME} is made in Hilo by Christian Sprinkel. Questions about this page: <a className="font-semibold text-brand" href="mailto:aloha@csprinkels.com">aloha@csprinkels.com</a>. Last updated {UPDATED}.
        </p>
      </Section>
    </PageShell>
  );
}
