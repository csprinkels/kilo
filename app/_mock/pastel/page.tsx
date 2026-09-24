import MockChrome from "../MockChrome";
import Screen from "./Screen";

export const metadata = { title: "Pastel mock — Kilo" };

export default function Page() {
  return <MockChrome style="pastel"><Screen /></MockChrome>;
}
