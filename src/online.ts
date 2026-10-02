// Cliente do ranking no Supabase. Fala direto com a API REST (PostgREST), sem SDK.
// O navegador só manda eventos; quem calcula a aura é o servidor (supabase/schema.sql).

import { RNG_MOD, UPGRADES, type State } from "./game";
import type { Player } from "./storage";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const onlineEnabled = Boolean(URL_ && KEY);

export interface ServerState {
  aura: number; total: number; best: number; ups: number[]; rng: number;
  name: string | null; rank: number | null; offline: number; offline_gain: number;
}

export interface TopEntry { name: string; best: number }

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
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const upgrades = {} as State["upgrades"];
  UPGRADES.forEach((u, i) => { upgrades[u.id] = Math.min(Math.floor(n(r.ups?.[i])), u.max); });
  const rng = Math.floor(n(r.rng));
  return { aura: n(r.aura), total: n(r.total), upgrades, rng: rng >= 1 && rng < RNG_MOD ? rng : 1 };
}

const MAX_QUEUE = 1000;

/**
 * Envia os eventos em lotes a cada 2 s. Quando o servidor responde, `onSync` recebe o estado
 * oficial e os eventos que aconteceram enquanto o lote estava a caminho, para reaplicar por cima.
 */
export function createSync(p: Player, onSync: (r: ServerState, pending: string) => void, onStatus: (ok: boolean) => void) {
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
    push(code: string) { if (!paused && queue.length < MAX_QUEUE) queue += code; },
    /** Para de sincronizar até recarregar a página (usado pelo painel dev). */
    pause() { paused = true; queue = ""; },
    flush,
    setName: (name: string) => rpc<void>("aura_set_name", { p_id: p.id, p_secret: p.secret, p_name: name }),
    reset: async () => { queue = ""; await rpc<void>("aura_reset", { p_id: p.id, p_secret: p.secret }); await flush(); },
    top: () => rpc<TopEntry[]>("aura_top", { p_limit: 10 }),
  };
}
