import MockChrome from "../MockChrome";
import { MangoScreen } from "../screens";

export const metadata = { title: "Mango mock — Kilo" };

export default function MangoMock() {
  return <MockChrome style="mango"><MangoScreen /></MockChrome>;
}
