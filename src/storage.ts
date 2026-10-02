import { ACHIEVEMENTS } from "./achievements";
import { COSMETICS, cosmeticById, SLOTS, type Slot } from "./cosmetics";
import { newState, RNG_MOD, UPGRADES, type State } from "./game";

// v3: economia nova. Saves das versões anteriores não são compatíveis e são ignorados.
const KEY = "clawd-aura-farm:v3";
const PLAYER_KEY = "clawd-aura-farm:player";
const MUTE_KEY = "clawd-aura-farm:mute";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const int = (v: unknown) => Math.floor(num(v));

/**
 * Valida qualquer estado vindo de fora (localStorage ou servidor): números finitos e não negativos,
 * upgrades dentro do limite, e só ids de conquistas e enfeites que existem no catálogo.
 */
export function sanitize(data: Record<string, unknown> | null | undefined): State {
  const s = newState();
  if (!data || typeof data !== "object") return s;
  s.aura = num(data.aura);
  s.total = Math.max(num(data.total), s.aura);
  s.lifetime = Math.max(num(data.lifetime), s.total);
  const rng = int(data.rng);
  if (rng >= 1 && rng < RNG_MOD) s.rng = rng;
  const ups = data.upgrades as Record<string, unknown> | undefined;
  for (const u of UPGRADES) s.upgrades[u.id] = Math.min(int(ups?.[u.id]), u.max);
  s.goldenAt = num(data.goldenAt);
  s.buffUntil = num(data.buffUntil);
  s.thiefAt = num(data.thiefAt);
  for (const k of ["prestige", "tokens", "clicks", "crits", "goldens", "thieves", "streak"] as const) s[k] = int(data[k]);
  s.lastDay = typeof data.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.lastDay) ? data.lastDay : null;
  const ids = (v: unknown, known: (id: string) => boolean) =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && known(x)))] : [];
  s.achievements = ids(data.achievements, id => ACHIEVEMENTS.some(a => a.id === id));
  s.owned = ids(data.owned, id => COSMETICS.some(c => c.id === id));
  const eq = data.equipped as Record<string, unknown> | undefined;
  for (const { id: slot } of SLOTS) {
    const item = typeof eq?.[slot] === "string" ? cosmeticById(eq[slot] as string) : undefined;
    if (item && item.slot === slot && s.owned.includes(item.id)) s.equipped[slot as Slot] = item.id;
  }
  return s;
}

/** Carrega o save local. `away` é quantos segundos o jogador ficou fora. */
export function load(): { state: State; away: number } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return { state: sanitize(data), away: Math.max(0, (Date.now() - num(data.savedAt)) / 1000) };
    }
  } catch {
    // storage bloqueado ou JSON inválido: começa do zero
  }
  return { state: newState(), away: 0 };
}

export function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
  } catch {
    // sem storage o jogo continua, só não salva
  }
}

export interface Player { id: string; secret: string }

/** Identidade do jogador no ranking. O segredo nunca sai do navegador, só o hash fica no servidor. */
export function player(): Player {
  try {
    const p = JSON.parse(localStorage.getItem(PLAYER_KEY) || "null");
    if (p && typeof p.id === "string" && typeof p.secret === "string") return p;
  } catch {
    // cai na criação abaixo
  }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const p = { id: crypto.randomUUID(), secret: [...bytes].map(b => b.toString(16).padStart(2, "0")).join("") };
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(p)); } catch { /* jogador novo a cada visita */ }
  return p;
}

export function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function saveMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* ignora */ }
}
