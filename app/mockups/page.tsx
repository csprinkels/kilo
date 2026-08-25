import type { Metadata } from "next";
import Icon, { type IconName } from "@/components/Icon";
import styles from "./mockups.module.css";

export const metadata: Metadata = {
  title: "Kilo UI directions",
  description: "Three visual design directions for Kilo.",
};

const nav: { label: string; icon: IconName }[] = [
  { label: "Now", icon: "house-fill" },
  { label: "Weather", icon: "cloud-sun" },
  { label: "Roads", icon: "car" },
  { label: "Reports", icon: "users-three" },
];

export default function MockupsPage() {
  return (
    <main className={styles.board}>
      <header className={styles.boardHeader}>
        <div>
          <p className={styles.eyebrow}>Kilo · visual exploration</p>
          <h1>Three ways to give the app a point of view.</h1>
        </div>
        <p className={styles.boardIntro}>
          Same priorities, same plain words, same one-glance structure. Different personality.
        </p>
      </header>

      <div className={styles.directions}>
        <Direction
          number="01"
          name="Island Almanac"
          note="Warm, human, and rooted in place."
          palette={["#f3ead7", "#e7673f", "#145f58", "#f4c95d"]}
        >
          <Almanac />
        </Direction>
        <Direction
          number="02"
          name="Pacific Signal"
          note="Calm command center, built for urgency."
          palette={["#071d21", "#76e6ce", "#ff765e", "#d9f1ea"]}
        >
          <Signal />
        </Direction>
        <Direction
          number="03"
          name="Trade Wind"
          note="Optimistic, breezy, and unmistakably island."
          palette={["#ddf2eb", "#176b63", "#f47457", "#f8cb58"]}
        >
          <TradeWind />
        </Direction>
      </div>
    </main>
  );
}

function Direction({
  number,
  name,
  note,
  palette,
  children,
}: {
  number: string;
  name: string;
  note: string;
  palette: string[];
  children: React.ReactNode;
}) {
  return (
    <section className={styles.direction} id={`concept-${number}`}>
      <header className={styles.directionHeader}>
        <p className={styles.directionNumber}>{number}</p>
        <div>
          <h2>{name}</h2>
          <p>{note}</p>
        </div>
        <div className={styles.palette} aria-label="Color palette">
          {palette.map((color) => <span key={color} style={{ background: color }} />)}
        </div>
      </header>
      <div className={styles.phone}>{children}</div>
    </section>
  );
}

function Almanac() {
  return (
    <div className={styles.almanac}>
      <div className={styles.almanacSun} />
      <header className={styles.almanacTop}>
        <Brand variant="almanac" />
        <button>Hawaiʻi Island <Icon name="caret-down" size={12} px /></button>
      </header>

      <section className={styles.almanacHero}>
        <p className={styles.almanacKicker}>Tuesday · August 25</p>
        <h3>Here&apos;s your island today.</h3>
        <p>One water notice. Roads are mostly clear. A warm, showery afternoon.</p>
      </section>

      <section className={styles.almanacWeather}>
        <div>
          <p>Hilo now</p>
          <strong>81°</strong>
          <span>Showers · High 84°</span>
        </div>
        <WeatherArt />
      </section>

      <section className={styles.almanacNotice}>
        <div className={styles.almanacNoticeTop}>
          <span><Icon name="drop-fill" size={15} px /> Water notice</span>
          <small>Kaʻū</small>
        </div>
        <h4>Boil your water before drinking.</h4>
        <p>Waiʻōhinu to Nāʻālehu. Bottled water is fine.</p>
        <button>What to do <Icon name="caret-right" size={14} px /></button>
      </section>

      <section className={styles.almanacGlance}>
        <p className={styles.almanacSectionLabel}>Around the island</p>
        <div className={styles.almanacTiles}>
          <MiniTile icon="traffic-cone-fill" title="Roads" text="1 closure in Kaʻū" tone="clay" />
          <MiniTile icon="tent-fill" title="Shelters" text="Kaʻū Gym is open" tone="sun" />
          <MiniTile icon="wind-fill" title="Storms" text="None nearby" tone="sea" />
          <MiniTile icon="pulse-fill" title="Quakes" text="Nothing big" tone="sky" />
        </div>
      </section>

      <MockNav className={styles.almanacNav} />
    </div>
  );
}

function Signal() {
  return (
    <div className={styles.signal}>
      <div className={styles.signalGrid} />
      <header className={styles.signalTop}>
        <Brand variant="signal" />
        <button><span /> Hawaiʻi Island <Icon name="caret-down" size={11} px /></button>
      </header>

      <section className={styles.signalStatus}>
        <div className={styles.signalStatusTop}>
          <span className={styles.liveDot}>Live</span>
          <span>Updated 7:22 PM</span>
        </div>
        <p>Island status</p>
        <h3>1 thing needs your attention</h3>
        <div className={styles.signalMeter}><span /></div>
        <div className={styles.signalLegend}>
          <span>Quiet</span><span>Heads up</span><span>Act now</span>
        </div>
      </section>

      <section className={styles.signalAlert}>
        <header>
          <span><Icon name="drop-fill" size={16} px /> Get ready</span>
          <small>01</small>
        </header>
        <h4>Boil your water in Kaʻū.</h4>
        <p>Waiʻōhinu to Nāʻālehu · Bottled water is safe.</p>
        <div className={styles.signalAction}>
          <Icon name="check-circle" size={17} px />
          <span><b>Do this:</b> Boil water for one minute before drinking or cooking.</span>
        </div>
        <button>Full notice <Icon name="caret-right" size={13} px /></button>
      </section>

      <div className={styles.signalReadouts}>
        <Readout icon="cloud-sun-fill" label="Hilo" value="81°" meta="Showers" />
        <Readout icon="car-fill" label="Roads" value="01" meta="Closure" />
      </div>

      <section className={styles.signalAllClear}>
        <div><Icon name="check" size={17} px /></div>
        <p><b>The rest looks normal.</b><span>No storms, tsunami, or large quakes nearby.</span></p>
      </section>

      <MockNav className={styles.signalNav} />
    </div>
  );
}

function TradeWind() {
  return (
    <div className={styles.trade}>
      <div className={styles.tradeSky}>
        <span className={styles.tradeSun} />
        <span className={styles.tradeCloudOne} />
        <span className={styles.tradeCloudTwo} />
      </div>
      <header className={styles.tradeTop}>
        <Brand variant="trade" />
        <button>Hawaiʻi <Icon name="caret-down" size={12} px /></button>
      </header>

      <section className={styles.tradeHero}>
        <p>Aloha, good morning</p>
        <h3>Mostly easy.<br />One heads-up.</h3>
        <div className={styles.tradeWeather}>
          <span>Hilo</span>
          <strong>81°</strong>
          <small><Icon name="drop-fill" size={13} px /> Showers on &amp; off</small>
        </div>
      </section>

      <section className={styles.tradeAlert}>
        <div className={styles.tradeAlertIcon}><Icon name="drop-fill" size={19} px /></div>
        <div>
          <p>Water · Kaʻū</p>
          <h4>Boil before you drink.</h4>
          <span>Waiʻōhinu to Nāʻālehu</span>
        </div>
        <Icon name="caret-right" size={16} px />
      </section>

      <section className={styles.tradeCards}>
        <article className={styles.tradeRoad}>
          <span><Icon name="car-fill" size={20} px /></span>
          <p>Roads</p>
          <h4>One closure</h4>
          <small>Wood Valley Rd</small>
        </article>
        <article className={styles.tradeShelter}>
          <span><Icon name="tent-fill" size={20} px /></span>
          <p>Open shelter</p>
          <h4>Kaʻū Gym</h4>
          <small>Bring your own supplies</small>
        </article>
      </section>

      <section className={styles.tradeQuiet}>
        <header><span>All quiet here</span><i /></header>
        <div>
          <QuietItem icon="wind-fill" label="Storms" />
          <QuietItem icon="waves-fill" label="Tsunami" />
          <QuietItem icon="mountains-fill" label="Volcano" />
        </div>
      </section>

      <MockNav className={styles.tradeNav} />
    </div>
  );
}

function Brand({ variant }: { variant: "almanac" | "signal" | "trade" }) {
  return (
    <div className={`${styles.brand} ${styles[`brand_${variant}`]}`}>
      <span className={styles.brandMark}>
        <svg viewBox="0 0 32 32" aria-hidden>
          <path d="M3 17c5-1 7-5 10-10 1 5 1 8 3 10 2-4 6-7 12-8-2 6-7 11-13 13-4 1-8-1-12-5Z" />
          <path d="M14 21c1 3 3 5 6 7" fill="none" />
        </svg>
      </span>
      <span>Kilo</span>
    </div>
  );
}

function WeatherArt() {
  return (
    <div className={styles.weatherArt} aria-hidden>
      <span className={styles.weatherSun} />
      <span className={styles.weatherCloud} />
      <i /><i /><i />
    </div>
  );
}

function MiniTile({ icon, title, text, tone }: { icon: IconName; title: string; text: string; tone: string }) {
  return (
    <article className={`${styles.miniTile} ${styles[`mini_${tone}`]}`}>
      <Icon name={icon} size={19} px />
      <h4>{title}</h4>
      <p>{text}</p>
    </article>
  );
}

function Readout({ icon, label, value, meta }: { icon: IconName; label: string; value: string; meta: string }) {
  return (
    <article>
      <header><Icon name={icon} size={17} px /><span>{label}</span></header>
      <strong>{value}</strong>
      <small>{meta}</small>
    </article>
  );
}

function QuietItem({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div>
      <span><Icon name={icon} size={16} px /></span>
      <p>{label}</p>
      <Icon name="check" size={13} px />
    </div>
  );
}

function MockNav({ className }: { className: string }) {
  return (
    <nav className={className} aria-label="Mockup navigation">
      {nav.map((item, index) => (
        <span key={item.label} className={index === 0 ? styles.navActive : undefined}>
          <Icon name={item.icon} size={20} px />
          <small>{item.label}</small>
        </span>
      ))}
    </nav>
  );
}
