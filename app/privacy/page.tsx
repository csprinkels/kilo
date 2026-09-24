"use client";
import PageShell from "@/components/PageShell";
import { APP_NAME } from "@/lib/brand";
import "../support/text.css";

/**
 * The privacy policy, in the same plain words as the rest of the app. Both app stores require a public URL for this page.
 * Every sentence here is a promise the code keeps; change the code, change the sentence.
 */
const UPDATED = "August 24, 2026";

/** One white card: a title, then a body paragraph or a bulleted list. */
const Card = ({ title, list, children }: { title: string; list?: string[]; children?: React.ReactNode }) => (
  <section className="cs-card">
    <h2 className="cs-display cs-display--card">{title}</h2>
    {list ? <ul className="cs-body">{list.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="cs-body">{children}</p>}
  </section>
);

export default function Privacy() {
  return (
    <PageShell title="Privacy" sentence={`${APP_NAME} is free, has no ads and no accounts. Here is exactly what it keeps, and what it never does.`}>
      <div className="cs-stack pg-text">
        <Card title="What stays on your phone" list={[
          "Your island, your town, your text size, and whether you turned warnings on. These are settings, saved in the app on your phone only.",
          "The last information the app downloaded, so it still opens with no signal.",
          "A random device number, made by the app, used only so one phone cannot post or vote without limit. It is not your phone's own number and says nothing about you.",
        ]} />

        <Card title="Your location">
          When you tap <strong>Check where I am</strong> or <strong>Show what is closed near me</strong>, the app asks your phone where you are and does the check on the phone. Your location is never sent to us or to anyone else, and it is not saved. The maps load street tiles from OpenStreetMap (via CARTO) and rain radar from RainViewer; like any map, they see which part of the map you are looking at, not where you are.
        </Card>

        <Card title="Warnings on this phone">
          If you turn warnings on, your phone gives us an address to send notifications to, and we keep it together with the island you chose and how serious a warning has to be. That is all. Turn warnings off and it is deleted.
        </Card>

        <Card title="Neighbor reports">
          What you type in a report is shown to other people on your island, marked as a neighbor report. We keep the words, the type, the area you picked, and the time, for up to a week after the report clears, then delete them. Reports that mention a license plate, a person&apos;s name, a phone number or a link are read by a person before they show. We do not ask for your name and do not know who wrote a report.
        </Card>

        <Card title="What we never do" list={[
          "Show ads, or let anyone else show you ads.",
          "Make you create an account, or collect your name, email or phone number. (The waitlist on kilohi.org is the one place we take an email; it is used for a single launch message, then deleted.)",
          "Sell, share or store where you are.",
          "Use an outside tracking or analytics company, set a cookie, or record your screen, mouse or taps as you. What we do keep is described just below.",
          "Let a computer write an alert in the name of an official agency.",
        ]} />

        <Card title="What we count">
          So we can see which parts of {APP_NAME} people actually use, we keep simple counts &mdash; how many times each screen is opened and each main button is tapped. These counts live on our own server, are added up across everyone, and are never tied to you, your phone, or where you are. There is no cookie, no advertising company, and nothing that could pick you out. Example: &ldquo;the Weather screen was opened 300 times today.&rdquo; One of those counts is a plain visit, added once per day: your browser remembers today&rsquo;s date so the second and third time you open {APP_NAME} today are not counted again. That date stays on your device, is never sent anywhere, and is not a name or a number for you.
        </Card>

        <Card title="Where the information comes from">
          Weather, alerts, roads, earthquakes, the volcano and tsunami information come from public agencies (the National Weather Service, Hawaiʻi County Civil Defense, the state highways department, the USGS and others). Reading it from them sends them nothing about you; the app fetches it for everyone and passes it on.
        </Card>

        <Card title="Who we are">
          {APP_NAME} is made in Hilo by Christian Sprinkel. Questions about this page: <a href="mailto:aloha@csprinkels.com">aloha@csprinkels.com</a>. Last updated {UPDATED}.
        </Card>
      </div>
    </PageShell>
  );
}
