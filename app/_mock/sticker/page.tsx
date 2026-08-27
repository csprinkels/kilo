import MockChrome from "../MockChrome";
import { StickerScreen } from "../screens";

export const metadata = { title: "Sticker mock — Kilo" };

export default function StickerMock() {
  return <MockChrome style="sticker"><StickerScreen /></MockChrome>;
}
