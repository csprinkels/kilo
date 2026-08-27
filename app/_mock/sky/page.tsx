import MockChrome from "../MockChrome";
import { SkyScreen } from "../screens";

export const metadata = { title: "Sky mock — Kilo" };

export default function SkyMock() {
  return <MockChrome style="sky"><SkyScreen /></MockChrome>;
}
