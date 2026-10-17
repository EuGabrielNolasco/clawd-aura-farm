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
export function accountShareUrl(p: Player): string {
  try {
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}#sync=${exportAccountToken(p)}`;
  } catch {
    return `#sync=${exportAccountToken(p)}`;
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

export type AuthProvider = "google" | "facebook" | "apple" | "phone";

export interface LinkedAccount {
  provider: AuthProvider;
  identifier: string;
  verified: boolean;
  linkedAt: number;
  playerId: string;
}

const LINKED_ACCOUNT_KEY = "clawd-aura-farm:linked-account-v2";
const EXTERNAL_VAULT_PREFIX = "clawd-aura-farm:ext-vault:";

export const PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: "Google",
  facebook: "Facebook",
  apple: "Apple ID",
  phone: "Número de Celular",
};

/** Normaliza e valida o identificador (e-mail para Google/Facebook/Apple ou dígitos para celular). */
export function normalizeIdentifier(provider: AuthProvider, raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (provider === "phone") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return digits.length <= 11 && !digits.startsWith("55") ? `55${digits}` : digits;
  }
  const lower = trimmed.toLowerCase();
  if (provider === "google" || provider === "apple") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return null;
    return lower;
  }
  // facebook aceita e-mail ou nome de usuário (mín. 3 caracteres)
  if (lower.length < 3) return null;
  return lower;
}

/** Gera um código numérico de 6 dígitos para confirmação da conta. */
export function generateConfirmationCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const n = 100000 + (arr[0] % 900000);
  return String(n);
}

export function loadLinkedAccount(): LinkedAccount | null {
  try {
    const raw = localStorage.getItem(LINKED_ACCOUNT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      data &&
      typeof data === "object" &&
      (data.provider === "google" || data.provider === "facebook" || data.provider === "apple" || data.provider === "phone") &&
      typeof data.identifier === "string" &&
      data.verified === true
    ) {
      return data as LinkedAccount;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveLinkedAccount(acc: LinkedAccount) {
  try {
    localStorage.setItem(LINKED_ACCOUNT_KEY, JSON.stringify(acc));
  } catch { /* ignore */ }
}

/**
 * Salva a conta atual (sem alterar a chave/ID da conta) vinculada ao provedor externo confirmado.
 */
export function saveExternalAccountVault(provider: AuthProvider, identifier: string, p: Player, s: State) {
  const norm = normalizeIdentifier(provider, identifier);
  if (!norm) return;
  try {
    const key = `${EXTERNAL_VAULT_PREFIX}${provider}:${norm}`;
    localStorage.setItem(key, JSON.stringify({
      player: p,
      state: { ...s, savedAt: Date.now() },
      updatedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

/**
 * Busca uma conta previamente salva neste navegador para o provedor/identificador confirmado,
 * sem gerar uma chave nova.
 */
export function loadExternalAccountVault(provider: AuthProvider, identifier: string): { player: Player; state: State } | null {
  const norm = normalizeIdentifier(provider, identifier);
  if (!norm) return null;
  try {
    const key = `${EXTERNAL_VAULT_PREFIX}${provider}:${norm}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const res = importSaveJson(JSON.stringify(parsed));
    if (res && res.player) return { player: res.player, state: res.state };
  } catch { /* ignore */ }
  return null;
}


