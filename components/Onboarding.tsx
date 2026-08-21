"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import ConditionIcon, { TopicIcon } from "@/components/ConditionIcon";
import { ISLANDS, type Island } from "@/lib/types";
import { TOWNS } from "@/lib/towns";
import { APP_NAME, islandName } from "@/lib/brand";
import { enablePush, pushStatus, type PushStatus } from "@/lib/push";

type IslandId = Exclude<Island, "state">;
type Step = "welcome" | "island" | "town" | "location" | "warnings" | "done";

/**
 * First run: one idea per screen, in the order Acme does it — what this is, where you are, what it may ask your phone for, done.
 * Every permission screen says why before it asks, and every one can be skipped. Finishing writes the island, which is
 * what the rest of the app keys on; a deep link from a notification never sees this (it carries its own island).
 */
export default function Onboarding({ onDone }: { onDone: (island: IslandId) => void }) {
  const [step, setStep] = useState<Step>("welcome");
  const [island, setIsland] = useState<IslandId | null>(null);
  const [town, setTown] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const towns = island ? TOWNS.filter((t) => t.island === island) : [];

  // Web Push is only offered where it can work (not inside the iOS app yet, not in browsers without it).
  useEffect(() => { let live = true; void Promise.resolve().then(() => pushStatus()).then((s) => { if (live) setPush(s); }); return () => { live = false; }; }, []);
  const canAskPush = push === "off" || push === "needs-install";

  const finish = () => {
    if (!island) return;
    try { if (town) localStorage.setItem("town", town); localStorage.setItem("onboarded", "1"); } catch { /* fine */ }
    onDone(island);
  };
  const askLocation = () => {
    setBusy(true); setNote(null);
    if (!("geolocation" in navigator)) { setBusy(false); setNote("This phone cannot share its location."); return; }
    navigator.geolocation.getCurrentPosition(
      () => { setBusy(false); setStep(canAskPush ? "warnings" : "done"); },
      () => { setBusy(false); setNote("That is okay. You can allow it later from the Tsunami or Roads page."); },
      { timeout: 15_000, maximumAge: 600_000 },
    );
  };
  const askPush = async () => {
    if (!island) return;
    setBusy(true); setNote(null);
    try {
      const s = await enablePush(island, 3);
      setPush(s);
      if (s === "on") setStep("done");
      else if (s === "needs-install") setNote(`First add ${APP_NAME} to your Home Screen (Share, then “Add to Home Screen”), then turn warnings on from Settings.`);
      else if (s === "denied") setNote("Notifications are off for Kilo in your phone's settings. You can turn them on there any time.");
    } catch { setNote("Could not finish turning this on. Try again from Settings when you have a better signal."); }
    finally { setBusy(false); }
  };

  const order: Step[] = ["welcome", "island", "town", "location", ...(canAskPush ? ["warnings" as const] : []), "done"];
  const at = order.indexOf(step);

  return (
    <main className="relative z-[1] mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-s7 pt-s7">
      {/* progress: one dot per screen, the current one long */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden>{order.map((s, i) => <span key={s} className={`h-1.5 rounded-full transition-all ${i === at ? "w-6 bg-brand" : i < at ? "w-1.5 bg-brand/50" : "w-1.5 bg-line"}`} />)}</div>
        {step !== "welcome" && step !== "done" && island && (
          <button className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-ink-2" onClick={finish}>Skip</button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center py-s6">
        {step === "welcome" && (
          <Screen picture={<ConditionIcon code={2} size={144} />} title={APP_NAME} text="What is happening on your island, in plain words: weather, roads, storms, earthquakes, the volcano, tsunami, and what neighbors report. Free, no ads, no account.">
            <button className="btn btn-primary btn-big" onClick={() => setStep("island")}>Get started</button>
          </Screen>
        )}

        {step === "island" && (
          <Screen picture={<TopicIcon topic="volcano" size={120} />} title="Which island are you on?" text="Everything in Kilo is about one island at a time. You can change this any time at the top of the screen.">
            <div className="flex flex-col gap-s2">
              {(ISLANDS as readonly Island[]).filter((i): i is IslandId => i !== "state").map((i) => (
                <button key={i} onClick={() => { setIsland(i); setTown(TOWNS.find((t) => t.island === i)?.id ?? null); setStep("town"); }}
                  className={`btn btn-big justify-start px-s5 text-left ${island === i ? "chip-active" : ""}`}>{islandName(i, true)}</button>
              ))}
            </div>
          </Screen>
        )}

        {step === "town" && island && (
          <Screen picture={<ConditionIcon code={0} size={120} />} title="Your town for weather" text="The temperature and forecast on the Now page come from the town you pick here.">
            <div className="flex flex-col gap-s2">
              {towns.map((t) => (
                <button key={t.id} onClick={() => setTown(t.id)} className={`btn btn-big justify-start px-s5 text-left ${town === t.id ? "chip-active" : ""}`}>{t.name}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-big mt-s4" onClick={() => setStep("location")}>Next</button>
          </Screen>
        )}

        {step === "location" && (
          <Screen picture={<TopicIcon topic="tsunami" size={120} />} title="Where you are" text="Kilo can check whether the spot you are standing on is in a tsunami evacuation zone, and which closed roads are near you. The check happens on your phone. Your location is never saved or sent anywhere.">
            <button className="btn btn-primary btn-big" disabled={busy} onClick={askLocation}><Icon name="crosshair" size={20} /> {busy ? "Asking your phone…" : "Allow location"}</button>
            <button className="btn btn-big mt-s2" onClick={() => setStep(canAskPush ? "warnings" : "done")}>Not now</button>
            {note && <p className="mt-s3 text-body text-ink-2">{note}</p>}
          </Screen>
        )}

        {step === "warnings" && (
          <Screen picture={<TopicIcon topic="alert" size={120} />} title="Warnings on this phone" text={`Shelter openings, evacuations and warnings for ${island ? islandName(island) : "your island"} as notifications. The whole message is in the notification, so you can read it with no signal.`}>
            <button className="btn btn-primary btn-big" disabled={busy} onClick={() => void askPush()}><Icon name="bell" size={20} /> {busy ? "One moment…" : "Turn on warnings"}</button>
            <button className="btn btn-big mt-s2" onClick={() => setStep("done")}>Not now</button>
            {note && <p className="mt-s3 text-body text-ink-2">{note}</p>}
          </Screen>
        )}

        {step === "done" && (
          <Screen picture={<TopicIcon topic="neighbors" size={120} />} title="You are set" text={`${APP_NAME} checks every few minutes and says when something changes. It is not an emergency service — if someone is hurt or in danger, call 911.`}>
            <button className="btn btn-primary btn-big" onClick={finish}>Open {APP_NAME}</button>
          </Screen>
        )}
      </div>
    </main>
  );
}

/** One screen: picture → heading → one paragraph → the control. */
function Screen({ picture, title, text, children }: { picture: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="fade-up">
      <div className="flex justify-center">{picture}</div>
      <h1 className="h-display mt-s6 text-center">{title}</h1>
      <p className="mx-auto mt-s3 max-w-[34rem] text-center text-body text-ink-2">{text}</p>
      <div className="mt-s6">{children}</div>
    </section>
  );
}
