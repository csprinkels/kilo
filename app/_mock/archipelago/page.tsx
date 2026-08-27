import MockChrome from "../MockChrome";
import ArchipelagoScreen from "./ArchipelagoScreen";

export const metadata = { title: "Archipelago mock — Kilo" };

export default function ArchipelagoMock() {
  return <MockChrome style="archipelago"><ArchipelagoScreen /></MockChrome>;
}
