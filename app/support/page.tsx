"use client";
import Link from "next/link";
import PageShell, { Section } from "@/components/PageShell";
import { APP_NAME } from "@/lib/brand";

/**
 * Support: the page both app stores require a public URL for, and the one place a person can
 * write to a human about Kilo. Same plain words as the rest of the app; one address, no form,
 * because a form is one more thing to be down when someone needs help.
 */
const EMAIL = "aloha@csprinkels.com";

const Mail = ({ subject }: { subject: string }) => (
  <a className="font-semibold text-brand" href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}>{EMAIL}</a>
);

export default function Support() {
  return (
    <PageShell title="Support" sentence={`Something wrong, missing or confusing in ${APP_NAME}? Write to one person in Hilo, who reads all of it.`}>
      <Section title="In an emergency">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          Call <strong className="font-semibold text-ink">911</strong>. {APP_NAME} is not an emergency service and is not part of any government, and nobody is watching this address at 3 a.m. When Civil Defense says something different from {APP_NAME}, do what Civil Defense says.
        </p>
      </Section>

      <Section title="Write to us">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          <Mail subject="Kilo" /> &mdash; questions, problems, or a thing the app got wrong. Answered within a couple of days, usually the same one. There is no phone number and no account to log into: this is a free app made by one person.
        </p>
      </Section>

      <Section title="Something on a screen looks wrong">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          Send <Mail subject="Kilo: something looks wrong" /> the island you had picked, roughly when you saw it, and what the screen said. A photo of the screen is the fastest thing you can send. Every item in {APP_NAME} names the agency it came from &mdash; if the agency&apos;s own page says something different, that is worth telling us too.
        </p>
      </Section>

      <Section title="Warnings are not arriving">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          Warnings are turned on per phone, in <Link href="/sources/" className="font-semibold text-brand">Settings and about</Link>, and they follow the island you picked there. If they are on and nothing arrives, check that notifications are allowed for {APP_NAME} in your phone&apos;s own settings, then write to us. {APP_NAME} only sends a warning when an agency issues one, so a quiet week is usually a quiet week.
        </p>
      </Section>

      <Section title="A neighbor report about you">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          Neighbor reports are what people nearby say they are seeing, and they are never presented as official. To have one taken down, write to <Mail subject="Kilo: take a report down" /> and say which one. The <Link href="/guidelines/" className="font-semibold text-brand">rules for reports</Link> say what is not allowed in one.
        </p>
      </Section>

      <Section title="What we keep">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          Almost nothing, and no account ever. <Link href="/privacy/" className="font-semibold text-brand">Privacy</Link> says exactly what that means, sentence by sentence.
        </p>
      </Section>

      <Section title="Who we are">
        <p className="mt-s2 max-w-[36rem] text-body text-ink-2">
          {APP_NAME} is made in Hilo by Christian Sprinkel. It is free, has no ads and shows the same thing to everyone on your island.
        </p>
      </Section>
    </PageShell>
  );
}
