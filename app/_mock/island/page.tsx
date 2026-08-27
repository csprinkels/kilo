import MockChrome from "../MockChrome";
import IslandScreen from "./IslandScreen";

export const metadata = { title: "Island mock — Kilo" };

export default function IslandMock() {
  return <MockChrome style="island"><IslandScreen /></MockChrome>;
}
