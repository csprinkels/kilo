import Link from "next/link";
import { STYLES, type StyleId } from "./_data";
import "./mock.css";

export default function MockChrome({ style, children }: { style: StyleId | "chooser"; children: React.ReactNode }) {
  return (
    <div className={`mock-root mock-${style}`}>
      <div className="mock-bar">
        <span>Mock</span>
        <nav aria-label="Style">
          {STYLES.map((s) => (
            <Link key={s.id} href={s.href} aria-current={style === s.id ? "page" : undefined}>{s.label}</Link>
          ))}
        </nav>
        <Link href="/" className="mock-bar-back">Back to app</Link>
      </div>
      <div className="mock-phone">{children}</div>
    </div>
  );
}
