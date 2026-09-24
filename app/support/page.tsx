"use client";
import Link from "next/link";
import PageShell from "@/components/PageShell";
import { APP_NAME } from "@/lib/brand";
import "./text.css";

/**
 * Support: the page both app stores require a public URL for, and the one place a person can
 * write to a human about Kilo. Same plain words as the rest of the app; one address, no form,
 * because a form is one more thing to be down when someone needs help.
 */
const EMAIL = "aloha@csprinkels.com";

const Mail = ({ subject }: { subject: string }) => (
  <a href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}>{EMAIL}</a>
);

/** One white card: a title and a body. */
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="cs-card">
    <h2 className="cs-display cs-display--card">{title}</h2>
    <p className="cs-body">{children}</p>
  </section>
);

export default function Support() {
  return (
    <PageShell title="Support" sentence={`Something wrong, missing or confusing in ${APP_NAME}? Write to one person in Hilo, who reads all of it.`}>
      <div className="cs-stack pg-text">
        <Card title="In an emergency">
          Call <strong>911</strong>. {APP_NAME} is not an emergency service and is not part of any government, and nobody is watching this address at 3 a.m. When Civil Defense says something different from {APP_NAME}, do what Civil Defense says.
        </Card>

        <Card title="Write to us">
          <Mail subject="Kilo" /> &mdash; questions, problems, or a thing the app got wrong. Answered within a couple of days, usually the same one. There is no phone number and no account to log into: this is a free app made by one person.
        </Card>

        <Card title="Something on a screen looks wrong">
          Send <Mail subject="Kilo: something looks wrong" /> the island you had picked, roughly when you saw it, and what the screen said. A photo of the screen is the fastest thing you can send. Every item in {APP_NAME} names the agency it came from &mdash; if the agency&apos;s own page says something different, that is worth telling us too.
        </Card>

        <Card title="Warnings are not arriving">
          Warnings are turned on per phone, in <Link href="/sources/">Settings and about</Link>, and they follow the island you picked there. If they are on and nothing arrives, check that notifications are allowed for {APP_NAME} in your phone&apos;s own settings, then write to us. {APP_NAME} only sends a warning when an agency issues one, so a quiet week is usually a quiet week.
        </Card>

        <Card title="A neighbor report about you">
          Neighbor reports are what people nearby say they are seeing, and they are never presented as official. To have one taken down, write to <Mail subject="Kilo: take a report down" /> and say which one. The <Link href="/guidelines/">rules for reports</Link> say what is not allowed in one.
        </Card>

        <Card title="What we keep">
          Almost nothing, and no account ever. <Link href="/privacy/">Privacy</Link> says exactly what that means, sentence by sentence.
        </Card>

        <Card title="Who we are">
          {APP_NAME} is made in Hilo by Christian Sprinkel. It is free, has no ads and shows the same thing to everyone on your island.
        </Card>
      </div>
    </PageShell>
  );
}
