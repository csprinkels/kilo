import MockChrome from "../MockChrome";
import Screen from "./Screen";

export const metadata = { title: "Weather mock — Kilo" };

export default function Page() {
  return <MockChrome style="pastel-weather"><Screen /></MockChrome>;
}
