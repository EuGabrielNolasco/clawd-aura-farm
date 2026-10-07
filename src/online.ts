// Cliente do ranking no Supabase. Fala direto com a API REST (PostgREST), sem SDK.
// O navegador só manda eventos; quem calcula a aura é o servidor (supabase/schema.sql).

import { UPGRADES, type State } from "./game";
import { sanitize, type Player } from "./storage";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const onlineEnabled = Boolean(URL_ && KEY);

/** Resposta do aura_sync (nomes em snake_case, como o servidor manda). */
export interface ServerState {
  now: number;
  aura: number; total: number; lifetime: number; ups: number[]; rng: number;
  prestige: number; tokens: number; clicks: number; crits: number; goldens: number; thieves: number;
  streak: number; last_day: string | null; achievements: string[]; owned: string[]; equipped: Record<string, string>;
  golden_at: number | null; buff_until: number; thief_at: number | null; combo: number;
  name: string | null; rank: number | null; ahead: { name: string; lifetime: number; rank: number } | null;
  daily: number; new_achievements: string[]; offline: number; offline_gain: number;
}

export interface RankRow { rank: number; name: string; lifetime: number; prestige: number; equipped: Record<string, string>; me?: boolean }

async function rpc<T>(fn: string, body: object, keepalive = false): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `erro ${res.status}`);
  return data as T;
}

/** Converte a resposta do servidor em State, validando tudo que chega. */
export function toState(r: ServerState): State {
  const upgrades: Record<string, unknown> = {};
  UPGRADES.forEach((u, i) => { upgrades[u.id] = r.ups?.[i]; });
  return sanitize({
    aura: r.aura, total: r.total, lifetime: r.lifetime, upgrades, rng: r.rng,
    goldenAt: r.golden_at ?? 0, buffUntil: r.buff_until, thiefAt: r.thief_at ?? 0,
    prestige: r.prestige, tokens: r.tokens, clicks: r.clicks, crits: r.crits, goldens: r.goldens, thieves: r.thieves,
    streak: r.streak, lastDay: r.last_day, achievements: r.achievements, owned: r.owned, equipped: r.equipped,
  });
}

const MAX_QUEUE = 1000;

/**
 * Envia os eventos em lotes a cada 2 s. Quando o servidor responde, `onSync` recebe o estado
 * oficial e os eventos que aconteceram enquanto o lote estava a caminho, para reaplicar por cima.
 */
export async function fetchPlayerState(p: Player): Promise<ServerState> {
  return rpc<ServerState>("aura_sync", { p_id: p.id, p_secret: p.secret, p_events: "" });
}

export function createSync(initialPlayer: Player, onSync: (r: ServerState, pending: string) => void, onStatus: (ok: boolean) => void) {
  let p = initialPlayer;
  let queue = "";
  let inflight = false;
  let paused = false;

  async function flush() {
    if (inflight || paused) return;
    inflight = true;
    const sent = queue.slice(0, MAX_QUEUE);
    queue = queue.slice(sent.length);
    let r: ServerState;
    try {
      r = await rpc<ServerState>("aura_sync", { p_id: p.id, p_secret: p.secret, p_events: sent });
    } catch {
      // o servidor não aplicou o lote: devolve para a fila e tenta de novo depois
      queue = (sent + queue).slice(0, MAX_QUEUE);
      onStatus(false);
      return;
    } finally {
      inflight = false;
    }
    // fora do try: um erro aqui não pode reenviar um lote que o servidor já aplicou
    onStatus(true);
    onSync(r, queue);
  }

  setInterval(flush, 2000);
  // ao sair da página, manda o que sobrou
  addEventListener("pagehide", () => {
    if (queue && !paused) rpc("aura_sync", { p_id: p.id, p_secret: p.secret, p_events: queue.slice(0, MAX_QUEUE) }, true).catch(() => {});
  });

  return {
    /** Enfileira um evento (com o argumento, para os de enfeite). */
    push(code: string) { if (!paused && queue.length + code.length <= MAX_QUEUE) queue += code; },
    /** Para de sincronizar até recarregar a página (usado pelo painel dev). */
    pause() { paused = true; queue = ""; },
    flush,
    getPlayer: () => p,
    setPlayer(newP: Player) { p = newP; queue = ""; },
    setName: (name: string) => rpc<void>("aura_set_name", { p_id: p.id, p_secret: p.secret, p_name: name }),
    top: () => rpc<RankRow[]>("aura_top", { p_limit: 10 }),
    around: () => rpc<RankRow[]>("aura_around", { p_id: p.id, p_secret: p.secret }),
  };
}

