import Link from "next/link";
import MockChrome from "./MockChrome";
import { STYLES } from "./_data";

export const metadata = { title: "Mock — Kilo" };

export default function MockChooser() {
  return (
    <MockChrome style="chooser">
      <h1 className="choose-h">Now, from the brief</h1>
      <p className="choose-p">Community app, not a weather app. Cards, island pastels, what is in the way first. The older three mocks are still here if you want to compare.</p>
      {STYLES.map((s) => (
        <Link key={s.id} href={s.href} className={`choose-a${s.id === "island" ? " pick" : ""}`}>
          <strong>{s.label}</strong>
          <span>{s.line}</span>
        </Link>
      ))}
    </MockChrome>
  );
}
