import { newState, UPGRADES, type State } from "./game";

const KEY = "clawd-aura-farm:v2";
/** Chave da versão em HTML puro, que guardava só um número. */
const LEGACY_KEY = "aura";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

export function load(): State {
  const s = newState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      s.aura = num(data.aura);
      s.total = Math.max(num(data.total), s.aura);
      for (const u of UPGRADES) s.upgrades[u.id] = Math.floor(num(data.upgrades?.[u.id]));
      return s;
    }
    const legacy = Number(localStorage.getItem(LEGACY_KEY)) || 0;
    s.aura = s.total = Math.max(legacy, 0);
  } catch {
    // storage bloqueado ou JSON inválido: começa do zero
  }
  return s;
}

export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // sem storage o jogo continua, só não salva
  }
}
