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

export function savePlayer(p: Player) {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
  } catch {
    // ignora se storage estiver bloqueado
  }
}

/**
 * Codifica a identidade do jogador em um token compacto seguro para compartilhar e usar no link de sincronização.
 * Formato: AURA_<base64url(id:secret)>
 */
export function exportAccountToken(p: Player): string {
  const raw = `${p.id}:${p.secret}`;
  const b64 = btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `AURA_${b64}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_RE = /^[0-9a-f]{32,128}$/i;

/**
 * Codifica a identidade do jogador junto com o progresso atual em um token seguro e compacto.
 * Formato: AURA_SYNC_<base64url(JSON)>
 */
export function exportSyncPayload(p: Player, s: State): string {
  const payload = {
    p,
    s: {
      aura: Math.floor(s.aura),
      total: Math.floor(s.total),
      lifetime: Math.floor(s.lifetime),
      prestige: s.prestige,
      tokens: s.tokens,
      upgrades: s.upgrades,
      owned: s.owned,
      equipped: s.equipped,
      achievements: s.achievements,
      clicks: s.clicks,
      crits: s.crits,
      goldens: s.goldens,
      thieves: s.thieves,
      streak: s.streak,
    },
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `AURA_SYNC_${b64}`;
}

/**
 * Decodifica o payload de sincronização (com save incluído) ou token simples de conta.
 */
export function parseSyncPayload(input: string): { player: Player; state?: Partial<State> } | null {
  if (!input || typeof input !== "string") return null;
  let str = input.trim();
  if (str.includes("sync=")) {
    const m = str.match(/sync=([^&#\s]+)/);
    if (m) str = decodeURIComponent(m[1]);
  }
  if (str.startsWith("AURA_SYNC_")) {
    try {
      let b64 = str.slice(10).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4 !== 0) b64 += "=";
      const json = decodeURIComponent(escape(atob(b64)));
      const obj = JSON.parse(json);
      if (obj && obj.p && UUID_RE.test(obj.p.id) && SECRET_RE.test(obj.p.secret)) {
        return {
          player: { id: obj.p.id.toLowerCase(), secret: obj.p.secret.toLowerCase() },
          state: obj.s ? sanitize(obj.s) : undefined,
        };
      }
    } catch { /* ignora */ }
  }
  const p = parseAccountToken(str);
  if (p) return { player: p };
  return null;
}

/**
 * Mescla de forma inteligente e segura o estado local com o estado remoto,
 * mantendo o maior progresso em todas as métricas para nada ser perdido.
 */
export function mergeStates(local: State, remote: Partial<State>): State {
  const merged = { ...local };
  const remPrestige = typeof remote.prestige === "number" ? remote.prestige : local.prestige;

  if (remPrestige > local.prestige) {
    // O progresso remoto está em uma vida de prestígio mais avançada: adota a nova vida
    merged.prestige = remPrestige;
    merged.total = remote.total ?? local.total;
    merged.aura = remote.aura ?? local.aura;
    if (remote.upgrades) {
      merged.upgrades = { ...local.upgrades };
      for (const u of UPGRADES) {
        merged.upgrades[u.id] = (remote.upgrades as any)[u.id] ?? 0;
      }
    }
  } else if (remPrestige === local.prestige) {
    // Ambos no mesmo nível de prestígio: adota o maior progresso alcançado na vida atual
    merged.total = Math.max(local.total, remote.total ?? 0);
    merged.aura = Math.max(local.aura, remote.aura ?? 0);
    if (remote.upgrades) {
      merged.upgrades = { ...local.upgrades };
      for (const u of UPGRADES) {
        merged.upgrades[u.id] = Math.max(local.upgrades[u.id] ?? 0, (remote.upgrades as any)[u.id] ?? 0);
      }
    }
  } else {
    // local.prestige > remPrestige: local já renasceu e está à frente, preserva a vida atual local
  }

  merged.lifetime = Math.max(local.lifetime, remote.lifetime ?? 0);
  merged.tokens = Math.max(local.tokens, remote.tokens ?? 0);
  merged.clicks = Math.max(local.clicks, remote.clicks ?? 0);
  merged.crits = Math.max(local.crits, remote.crits ?? 0);
  merged.goldens = Math.max(local.goldens, remote.goldens ?? 0);
  merged.thieves = Math.max(local.thieves, remote.thieves ?? 0);
  merged.streak = Math.max(local.streak, remote.streak ?? 0);

  if (Array.isArray(remote.owned)) {
    merged.owned = [...new Set([...local.owned, ...remote.owned])];
  }
  if (Array.isArray(remote.achievements)) {
    merged.achievements = [...new Set([...local.achievements, ...remote.achievements])];
  }
  if (remote.equipped && typeof remote.equipped === "object") {
    merged.equipped = { ...local.equipped, ...remote.equipped };
  }
  return sanitize(merged);
}

/**
 * Deriva deterministicamente um par (id, secret) a partir do Google Sub.
 * Garante que qualquer aparelho que logar com a mesma conta Google tenha a mesma identidade no Supabase.
 */
export async function derivePlayerFromGoogle(sub: string): Promise<Player> {
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(`clawd-aura-google:${sub.trim()}`));
  const bytes = new Uint8Array(hashBuf);
  // UUID v4 formatado a partir dos primeiros 16 bytes
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  const secretBuf = await crypto.subtle.digest("SHA-256", enc.encode(`clawd-aura-secret:${sub.trim()}:${id}`));
  const secret = [...new Uint8Array(secretBuf)].map(b => b.toString(16).padStart(2, "0")).join("");
  return { id, secret };
}

/**
 * Decodifica uma chave de conta. Aceita:
 * - Token no formato AURA_<base64> ou base64 direto
 * - URL completa contendo #sync= ou ?sync=
 * - Formato bruto id:secret
 */
export function parseAccountToken(input: string): Player | null {
  if (!input || typeof input !== "string") return null;
  let str = input.trim();

  // se colou a URL inteira, extrai o parâmetro sync
  if (str.includes("sync=")) {
    const m = str.match(/sync=([^&#\s]+)/);
    if (m) str = decodeURIComponent(m[1]);
  }

  // remove prefixo se houver
  if (str.startsWith("AURA_")) str = str.slice(5);

  // tenta primeiro como id:secret direto
  if (str.includes(":")) {
    const [id, secret] = str.split(":");
    if (UUID_RE.test(id) && SECRET_RE.test(secret)) return { id: id.toLowerCase(), secret: secret.toLowerCase() };
  }

  // tenta decodificar base64url
  try {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const decoded = atob(b64);
    const parts = decoded.split(":");
    if (parts.length === 2 && UUID_RE.test(parts[0]) && SECRET_RE.test(parts[1])) {
      return { id: parts[0].toLowerCase(), secret: parts[1].toLowerCase() };
    }
  } catch {
    // string inválida
  }

  return null;
}

/** Gera a URL direta com a chave da conta no fragmento (#sync=...) para abrir no PC ou celular. */
export function accountShareUrl(p: Player, s?: State): string {
  const token = s ? exportSyncPayload(p, s) : exportAccountToken(p);
  try {
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}#sync=${token}`;
  } catch {
    return `#sync=${token}`;
  }
}

/** Exporta backup em JSON (inclui o save e a chave da conta). */
export function exportSaveJson(s: State, p: Player): string {
  return JSON.stringify(
    {
      app: "clawd-aura-farm",
      version: "2.1.0",
      exportedAt: new Date().toISOString(),
      player: p,
      state: { ...s, savedAt: Date.now() },
    },
    null,
    2
  );
}

/** Restaura backup em JSON. */
export function importSaveJson(raw: string): { state: State; player?: Player } | null {
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    const stateData = obj.state || obj;
    const s = sanitize(stateData);
    let p: Player | undefined;
    if (obj.player && typeof obj.player === "object") {
      const maybe = obj.player as Record<string, unknown>;
      if (typeof maybe.id === "string" && typeof maybe.secret === "string" && UUID_RE.test(maybe.id) && SECRET_RE.test(maybe.secret)) {
        p = { id: maybe.id.toLowerCase(), secret: maybe.secret.toLowerCase() };
      }
    }
    return { state: s, player: p };
  } catch {
    return null;
  }
}

export function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

export function saveMuted(muted: boolean) {
  try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* ignora */ }
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  linkedAt: number;
  playerId: string;
}

const GOOGLE_ACCOUNT_KEY = "clawd-aura-farm:google-oauth-v1";
const GOOGLE_VAULT_PREFIX = "clawd-aura-farm:google-vault:";
const FALLBACK_CID_B64 = "MzY1ODQ3OTAxODcyLXJsYWtpZ3V2MzRuMTQ1aXZ2bHU4a2xjNDI1MmoyZ2ZxLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t";

/** Retorna o Client ID do Google OAuth 2.0 configurado. */
export function getGoogleClientId(): string {
  try {
    const envId = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_CLIENT_ID?.trim();
    if (envId) return envId;
    return atob(FALLBACK_CID_B64);
  } catch {
    return "";
  }
}

/** Decodifica o token JWT (credential) retornado pelo Google OAuth 2.0 (Google Identity Services). */
export function parseGoogleJwt(credential: string): { sub: string; email: string; name?: string; picture?: string } | null {
  try {
    const parts = credential.split(".");
    if (parts.length !== 3) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const payload = JSON.parse(json);
    if (!payload || typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

export function loadGoogleAccount(): GoogleProfile | null {
  try {
    const raw = localStorage.getItem(GOOGLE_ACCOUNT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === "object" && typeof data.email === "string" && typeof data.sub === "string") {
      return data as GoogleProfile;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveGoogleAccount(profile: GoogleProfile) {
  try {
    localStorage.setItem(GOOGLE_ACCOUNT_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
}

export function clearGoogleAccount() {
  try {
    localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
  } catch { /* ignore */ }
}

/** Salva a conta atual vinculada ao e-mail do Google OAuth 2.0 (sem alterar a chave da conta). */
export function saveGoogleAccountVault(email: string, p: Player, s: State) {
  const norm = email.trim().toLowerCase();
  if (!norm) return;
  try {
    localStorage.setItem(`${GOOGLE_VAULT_PREFIX}${norm}`, JSON.stringify({
      player: p,
      state: { ...s, savedAt: Date.now() },
      updatedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

/** Carrega a conta salva para o e-mail autenticado via Google OAuth 2.0 (sem criar chave nova). */
export function loadGoogleAccountVault(email: string): { player: Player; state: State } | null {
  const norm = email.trim().toLowerCase();
  if (!norm) return null;
  try {
    const raw = localStorage.getItem(`${GOOGLE_VAULT_PREFIX}${norm}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const res = importSaveJson(JSON.stringify(parsed));
    if (res && res.player) return { player: res.player, state: res.state };
  } catch { /* ignore */ }
  return null;
}



