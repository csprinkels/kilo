/** Frozen Now copy so the three styles are judged on look, not live data. */

export const MOCK = {
  island: "Hawaiʻi Island",
  town: "Hilo",
  temp: 83,
  feels: 90,
  hi: 84,
  lo: 73,
  condition: "Mostly cloudy",
  forecast: "Chance of showers from 6 PM on. Sunset at 6:46 PM.",
  checked: "Checked 7:08 PM",
  sky: "cloud" as const,
  storm: {
    word: "Storm this weekend",
    headline: "Two-C is headed this way. It should be Tropical Storm Moke by Saturday.",
    action: "Heavy rain late Saturday night into Sunday. 5 to 10 inches on this island, more in the mountains. The ground is still soaked from Lala — flooding and mudslides are the worry.",
    ready: "Finish getting ready before Saturday. Watches could go up as soon as tonight.",
  },
  shelter: {
    word: "Shelter open",
    headline: "Nāʻālehu Elementary School is open",
    action: "Bring medicine, ID, food and bedding. Pets only if it says pet-friendly.",
    source: "Hawaiʻi County Civil Defense · Wednesday 9:46 PM",
    stale: "Civil Defense has not updated this since Wednesday 9:46 PM. Check before you go.",
  },
  needs: [
    { key: "roads", label: "Roads", text: "Mamalahoa Highway 190 closed both ways in North Kona. 19 more.", pip: "warn" as const },
  ],
  quiet: [
    { key: "storms", label: "Storms", text: "Lala is 1,148 miles northwest. Not coming this way." },
    { key: "quakes", label: "Earthquakes", text: "A 4.1 near Hōnaunau-Napoʻopoʻo shook lightly on Monday. No tsunami." },
    { key: "volcano", label: "Volcano", text: "Kīlauea is quiet." },
    { key: "tsunami", label: "Tsunami", text: "No danger." },
    { key: "neighbors", label: "Neighbors", text: "Nothing reported today." },
  ],
};

export const STYLES = [
  { id: "archipelago", href: "/mock/archipelago/", label: "Archipelago", line: "The background is the status display — pick an island, synced to now." },
  { id: "island", href: "/mock/island/", label: "Island", line: "New from the brief — cards, pastels, danger first." },
  { id: "sky", href: "/mock/sky/", label: "Sky", line: "Quiet page. Weather sits in a soft sky wash." },
  { id: "mango", href: "/mock/mango/", label: "Mango", line: "Big type, no icons. Color only when something is wrong." },
  { id: "sticker", href: "/mock/sticker/", label: "Sticker", line: "Swiss list. One round weather badge." },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];
