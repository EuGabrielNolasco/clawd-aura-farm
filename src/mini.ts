// Mini Clawd com enfeites, para a prévia da loja e o ranking.
// Só monta SVG a partir do catálogo (src/cosmetics.ts): nada vindo do servidor vira HTML.

import { cosmeticById, type Slot } from "./cosmetics";

const BODY = "#d97757";

export function clawdSvg(equipped: Partial<Record<Slot, string>>): string {
  const item = (slot: Slot) => {
    const c = equipped[slot] ? cosmeticById(equipped[slot]!) : undefined;
    return c && c.slot === slot ? c : undefined;
  };
  const fill = item("color")?.fill ?? BODY;
  const legs = [9, 13, 17, 21].map(x => `<rect x="${x}" y="21" width="2" height="4" fill="${fill}"/>`).join("");
  return `<svg viewBox="0 0 32 32" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="8" y="9" width="16" height="12" fill="${fill}"/>${legs}
    <rect x="4" y="13" width="4" height="2" fill="${fill}"/><rect x="24" y="13" width="4" height="2" fill="${fill}"/>
    <rect x="11" y="12" width="2" height="3" fill="#140f24"/><rect x="19" y="12" width="2" height="3" fill="#140f24"/>
    ${item("outfit")?.svg ?? ""}${item("face")?.svg ?? ""}${item("hat")?.svg ?? ""}
  </svg>`;
}
