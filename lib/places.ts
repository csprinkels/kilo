// Hawaiʻi Island judicial districts (the county's own scoping unit) and the towns people actually say.
export const HAWAII_DISTRICTS: Record<string, string[]> = {
  "South Hilo": ["Hilo", "Keaukaha", "Waiākea", "Pana‘ewa", "Papa‘ikou", "Pepe‘ekeo", "Wainaku", "Kaūmana"],
  "North Hilo": ["Honomū", "Hakalau", "Laupāhoehoe", "Nīnole", "‘O‘ōkala"],
  "Hāmākua": ["Honoka‘a", "Pa‘auilo", "Waipi‘o", "Kukuihaele", "Āhualoa"],
  "North Kohala": ["Hāwī", "Kapa‘au", "Kohala", "Pololū"],
  "South Kohala": ["Waimea", "Kamuela", "Waikoloa", "Kawaihae", "Puakō", "Mauna Lani", "Mauna Kea Beach"],
  "North Kona": ["Kailua-Kona", "Kona", "Hōlualoa", "Kalaoa", "Keauhou", "Kahalu‘u", "Honokōhau", "Kaloko", "Kaūpūlehu"],
  "South Kona": ["Captain Cook", "Kealakekua", "Hōnaunau", "Ho‘okena", "Miloli‘i", "Kainaliu", "Keālia"],
  "Ka‘ū": ["Pāhala", "Nā‘ālehu", "Ocean View", "Wai‘ōhinu", "Punalu‘u", "South Point", "Discovery Harbour"],
  "Puna": ["Pāhoa", "Kea‘au", "Kurtistown", "Mountain View", "Volcano", "Kapoho", "Kalapana", "Hawaiian Paradise Park", "HPP", "Orchidland", "Ainaloa", "Leilani", "Nānāwale", "Hawaiian Beaches", "Glenwood", "Fern Forest", "Eden Roc", "Hawaiian Acres", "Pohoiki", "Isaac Hale"],
};

/** Diacritic- and ʻokina-insensitive folding: "Ka'ū" and "Kau" are the same word to a search box. */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʻ‘’'`]/g, "").toLowerCase();
const INDEX: [string, string][] = Object.entries(HAWAII_DISTRICTS).flatMap(([d, towns]) => [[fold(d), d] as [string, string], ...towns.map((t): [string, string] => [fold(t), d])])
  .sort((a, b) => b[0].length - a[0].length); // longest names first ("Kailua-Kona" before "Kona")

/** Best-effort district from free text ("crash near Pahoa" -> "Puna"). Diacritic- and ʻokina-insensitive. */
export function districtFor(text: string): string | undefined {
  const t = ` ${fold(text)} `;
  return INDEX.find(([name]) => t.includes(` ${name} `) || t.includes(` ${name},`) || t.includes(` ${name}.`) || t.includes(`-${name} `))?.[1];
}

/** The county writes "Kau" and "Hamakua"; people read "Ka‘ū" and "Hāmākua". Unknown names pass through. */
/** Every district named anywhere in the text, deduped ("Papaikou and Honokaa" -> ["South Hilo","Hāmākua"]). */
export function districtsFor(text: string): string[] {
  let t = ` ${fold(text)} `;
  const out = new Set<string>();
  for (const [name, d] of INDEX) { // INDEX is longest-first, so "South Kona" is matched and consumed before bare "Kona"
    if (t.includes(` ${name} `) || t.includes(` ${name},`) || t.includes(` ${name}.`) || t.includes(`-${name} `)) {
      out.add(d);
      t = t.split(name).join(" "); // consume the span so a shorter name inside it cannot match again
    }
  }
  return [...out];
}

export function districtName(raw: string): string {
  const f = fold(raw);
  return Object.keys(HAWAII_DISTRICTS).find((d) => fold(d) === f) ?? raw;
}
