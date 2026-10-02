// Regras do jogo, sem DOM. As mesmas regras rodam no servidor (supabase/schema.sql):
// qualquer mudança aqui precisa ser espelhada lá, senão o ranking diverge do que o jogador vê.
// src/schema-sync.test.ts confere as constantes e src/game.test.ts a paridade dos cálculos.
//
// Economia calibrada por simulação (3 sessões de 40 min por dia, 4 cliques/s, pegando os
// Cérebros Dourados): primeiros níveis em segundos, nível máximo em ~3 dias e loja em ~1 semana.

import { cosmeticByCode, slotByCode, type Slot } from "./cosmetics";

/** [aura total mínima, nome]. */
export const RANKS: readonly (readonly [number, string])[] = [
  [0, "NPC"], [6.6e4, "Figurante"], [4e5, "Cria"], [1.8e6, "Brabo"], [1.7e7, "O Pai Tá On"],
  [2.8e7, "Main character"], [9e7, "Sigma"], [2.7e8, "Mega Brain"], [3.9e8, "Coop Thief"],
  [6.5e8, "Aura infinita"], [1.2e9, "Lenda do 6-7"], [4.6e9, "Ascendido"], [1.5e10, "Deus do 6-7"],
  [4.5e10, "Multiverso"], [9.8e10, "Clawd Supremo"], [2.7e11, "O Próprio 67"],
];

/** Índices dos níveis que ligam efeitos especiais, para não espalhar números mágicos. */
export const LV = {
  figurante: 1, cria: 2, brabo: 3, paiTaOn: 4, mainCharacter: 5, sigma: 6, megaBrain: 7, coopThief: 8,
  auraInfinita: 9, lenda: 10, ascendido: 11, deus: 12, multiverso: 13, supremo: 14, max: 15,
} as const;

export const BASE_CLICK = 67;
export const BASE_PASSIVE = 2;
export const LEVEL_BONUS = 1.1;
export const CRIT_MULT = 10;
export const BASE_CRIT = 0.1;
/** Bônus permanente por prestígio (renascer). */
export const PRESTIGE_BONUS = 0.25;
/** Máximo de aura passiva creditada enquanto o jogador está fora. */
export const OFFLINE_CAP_S = 12 * 3600;

/** Combo pela taxa de cliques: ×1 até 3 cliques/s, subindo até ×3 a 12 cliques/s. */
export const comboFor = (clicksPerSecond: number) => 1 + 2 * Math.min(Math.max((clicksPerSecond - 3) / 9, 0), 1);

/**
 * Eventos que aparecem na tela por alguns segundos. O servidor aceita o clique até `slack`
 * segundos depois do fim da janela visível, para cobrir o atraso do lote de eventos.
 */
export const GOLDEN = { min: 180, max: 480, show: 13, slack: 4 } as const;
export const THIEF = { min: 240, max: 600, show: 8, slack: 4, tokens: 3 } as const;
/** Modo Mega Brain, ativado pelo Cérebro Dourado. */
export const BUFF_S = 67;
export const BUFF_MULT = 7;

export type UpgradeId = "aux" | "click" | "crit" | "fab" | "dc" | "cosmic";

export interface Upgrade {
  id: UpgradeId;
  /** Letra usada no protocolo de eventos com o servidor. */
  code: string;
  name: string;
  desc: string;
  baseCost: number;
  growth: number;
  max: number;
}

// A ordem importa: é a mesma do array `ups` no servidor.
export const UPGRADES: readonly Upgrade[] = [
  { id: "aux", code: "a", name: "Clawd auxiliar", desc: "+2 de aura por segundo", baseCost: 50, growth: 1.18, max: 40 },
  { id: "click", code: "m", name: "Mão firme", desc: "+50% de aura por clique", baseCost: 200, growth: 1.3, max: 30 },
  { id: "crit", code: "s", name: "Olhar sigma", desc: "+3% de chance de crítico", baseCost: 5000, growth: 2.2, max: 10 },
  { id: "fab", code: "f", name: "Fábrica de 67", desc: "+60 de aura por segundo", baseCost: 2e4, growth: 1.22, max: 30 },
  { id: "dc", code: "d", name: "Datacenter do Clawd", desc: "+4.000 de aura por segundo", baseCost: 2e7, growth: 1.25, max: 30 },
  { id: "cosmic", code: "x", name: "Aura cósmica", desc: "Dobra toda a aura", baseCost: 3.2e9, growth: 5, max: 5 },
];

/**
 * Protocolo de eventos (uma letra cada, menos os enfeites, que levam a letra do item ou do slot):
 *   c clique · g Cérebro Dourado · t ladrão · a m s f d x compra de upgrade · p renascer · z zerar
 *   K<item> comprar enfeite · E<item> equipar · U<slot> tirar
 */
export const EV = { click: "c", golden: "g", thief: "t", prestige: "p", reset: "z", buyCosmetic: "K", equip: "E", unequip: "U" } as const;

export interface State {
  /** Saldo que pode ser gasto na loja. */
  aura: number;
  /** Farmado nesta vida. Define o nível, então gastar não faz cair de nível. */
  total: number;
  /** Farmado em todas as vidas. É o que conta no ranking. */
  lifetime: number;
  upgrades: Record<UpgradeId, number>;
  /** Estado do gerador de críticos, compartilhado com o servidor para os dois rolarem igual. */
  rng: number;
  /** Segundos Unix: próximo Cérebro Dourado, fim do Modo Mega Brain, próximo ladrão (0 = não agendado). */
  goldenAt: number;
  buffUntil: number;
  thiefAt: number;
  prestige: number;
  /** Fichas 67, a moeda dos enfeites. */
  tokens: number;
  clicks: number;
  crits: number;
  goldens: number;
  thieves: number;
  /** Dias seguidos jogando e o último dia contado (AAAA-MM-DD, horário de Brasília). */
  streak: number;
  lastDay: string | null;
  achievements: string[];
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
}

export const RNG_MOD = 2147483647;

/** Gerador Park–Miller: inteiro, exato em double e idêntico ao do servidor. */
export const nextRng = (r: number) => (r * 48271) % RNG_MOD;

export const randomSeed = () => 1 + Math.floor(Math.random() * (RNG_MOD - 2));

export const nowSec = () => Date.now() / 1000;

const zeroUpgrades = (): Record<UpgradeId, number> => ({ aux: 0, click: 0, crit: 0, fab: 0, dc: 0, cosmic: 0 });

export const newState = (rng = randomSeed()): State => ({
  aura: 0, total: 0, lifetime: 0, upgrades: zeroUpgrades(), rng,
  goldenAt: 0, buffUntil: 0, thiefAt: 0, prestige: 0, tokens: 0,
  clicks: 0, crits: 0, goldens: 0, thieves: 0, streak: 0, lastDay: null,
  achievements: [], owned: [], equipped: {},
});

export function levelOf(total: number): number {
  let l = 0;
  RANKS.forEach(([min], i) => { if (total >= min) l = i; });
  return l;
}

const mult = (s: State) =>
  LEVEL_BONUS ** levelOf(s.total) * 2 ** s.upgrades.cosmic * (1 + PRESTIGE_BONUS * s.prestige);

export const buffActive = (s: State, now: number) => now < s.buffUntil;

/** Ganho de um clique sem crítico, sem combo e sem Mega Brain. */
export const clickGain = (s: State) => BASE_CLICK * (1 + 0.5 * s.upgrades.click) * mult(s);

export const critChance = (s: State) => BASE_CRIT + 0.03 * s.upgrades.crit;

export const passivePerSecond = (s: State) =>
  (BASE_PASSIVE + 2 * s.upgrades.aux + 60 * s.upgrades.fab + 4000 * s.upgrades.dc) * mult(s);

export function earn(s: State, amount: number) {
  s.aura += amount;
  s.total += amount;
  s.lifetime += amount;
}

/**
 * Credita aura passiva do período que termina em `end`. O ganho é recalculado quando um nível
 * é atingido e quando o Modo Mega Brain acaba no meio do período.
 */
export function passive(s: State, seconds: number, end = nowSec()) {
  let t = end - Math.min(Math.max(seconds, 0), OFFLINE_CAP_S);
  for (let i = 0; t < end && i < 40; i++) {
    const l = levelOf(s.total), buffed = t < s.buffUntil;
    const rate = passivePerSecond(s) * (buffed ? BUFF_MULT : 1);
    const next = RANKS[l + 1];
    let dt = end - t;
    if (next) dt = Math.min(dt, Math.max((next[0] - s.total) / rate, 0.001));
    if (buffed) dt = Math.min(dt, s.buffUntil - t);
    earn(s, rate * dt);
    t += dt;
  }
}

export function click(s: State, combo = 1, now = nowSec()) {
  s.rng = nextRng(s.rng);
  const crit = s.rng / RNG_MOD < critChance(s);
  const gain = clickGain(s) * (crit ? CRIT_MULT : 1) * combo * (buffActive(s, now) ? BUFF_MULT : 1);
  earn(s, gain);
  s.clicks++;
  if (crit) s.crits++;
  return { gain, crit };
}

// ===== eventos na tela =====

type Timed = { min: number; max: number; show: number; slack: number };
const inWindow = (at: number, ev: Timed, now: number, slack: number) => at > 0 && now >= at && now <= at + ev.show + slack;

export const goldenVisible = (s: State, now: number) => inWindow(s.goldenAt, GOLDEN, now, 0);
export const thiefVisible = (s: State, now: number) => levelOf(s.total) >= LV.coopThief && inWindow(s.thiefAt, THIEF, now, 0);

/** Agenda o próximo Cérebro Dourado e o próximo ladrão quando o atual já passou. No online, quem agenda é o servidor. */
export function schedule(s: State, now: number, rand = Math.random) {
  const next = (ev: Timed) => now + ev.min + rand() * (ev.max - ev.min);
  if (s.goldenAt === 0 || now > s.goldenAt + GOLDEN.show + GOLDEN.slack) s.goldenAt = next(GOLDEN);
  if (s.thiefAt === 0 || now > s.thiefAt + THIEF.show + THIEF.slack) s.thiefAt = next(THIEF);
}

/** Pega o Cérebro Dourado se ele estiver na janela; ativa o Modo Mega Brain. */
export function catchGolden(s: State, now: number, rand = Math.random): boolean {
  if (!inWindow(s.goldenAt, GOLDEN, now, GOLDEN.slack)) return false;
  s.buffUntil = now + BUFF_S;
  s.goldenAt = now + BUFF_S + GOLDEN.min + rand() * (GOLDEN.max - GOLDEN.min);
  s.goldens++;
  return true;
}

/** Pega o ladrão (só a partir do nível Coop Thief); rende Fichas 67. */
export function catchThief(s: State, now: number, rand = Math.random): boolean {
  if (levelOf(s.total) < LV.coopThief || !inWindow(s.thiefAt, THIEF, now, THIEF.slack)) return false;
  s.tokens += THIEF.tokens;
  s.thieves++;
  s.thiefAt = now + THIEF.min + rand() * (THIEF.max - THIEF.min);
  return true;
}

// ===== loja =====

export const upgrade = (id: UpgradeId) => UPGRADES.find(u => u.id === id)!;

export const costOf = (s: State, id: UpgradeId) => {
  const u = upgrade(id);
  return Math.ceil(u.baseCost * u.growth ** s.upgrades[id]);
};

export const isMaxed = (s: State, id: UpgradeId) => s.upgrades[id] >= upgrade(id).max;

export const canBuy = (s: State, id: UpgradeId) => !isMaxed(s, id) && s.aura >= costOf(s, id);

export function buy(s: State, id: UpgradeId): boolean {
  if (!canBuy(s, id)) return false;
  s.aura -= costOf(s, id);
  s.upgrades[id]++;
  return true;
}

export const allMaxed = (s: State) => UPGRADES.every(u => isMaxed(s, u.id));

// ===== prestígio e zerar =====

export const canPrestige = (s: State) => levelOf(s.total) >= LV.max;

/** Começa uma vida nova. Mantém o que é permanente: aura vitalícia, fichas, enfeites, conquistas. */
function newLife(s: State) {
  s.aura = 0;
  s.total = 0;
  s.upgrades = zeroUpgrades();
  s.buffUntil = 0;
}

export function prestige(s: State): boolean {
  if (!canPrestige(s)) return false;
  newLife(s);
  s.prestige++;
  return true;
}

// ===== enfeites =====

export function buyCosmetic(s: State, code: string): boolean {
  const c = cosmeticByCode(code);
  if (!c || s.owned.includes(c.id) || s.tokens < c.price) return false;
  s.tokens -= c.price;
  s.owned.push(c.id);
  return true;
}

export function equip(s: State, code: string): boolean {
  const c = cosmeticByCode(code);
  if (!c || !s.owned.includes(c.id)) return false;
  s.equipped[c.slot] = c.id;
  return true;
}

export function unequip(s: State, slotCode: string): boolean {
  const slot = slotByCode(slotCode);
  if (!slot) return false;
  delete s.equipped[slot];
  return true;
}

// ===== login diário =====

/** Dia de hoje no horário de Brasília (AAAA-MM-DD), igual ao servidor. */
export const todayBR = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Recompensa do primeiro acesso do dia: 5 fichas × dias seguidos, até 7. Devolve as fichas dadas. */
export function daily(s: State, today: string): number {
  if (s.lastDay === today) return 0;
  s.streak = s.lastDay && dayDiff(s.lastDay, today) === 1 ? s.streak + 1 : 1;
  s.lastDay = today;
  const reward = 5 * Math.min(s.streak, 7);
  s.tokens += reward;
  return reward;
}

// ===== protocolo =====

/** Aplica um evento e devolve o resultado do clique, quando for um. */
export function applyEvent(s: State, code: string, arg = "", combo = 1, now = nowSec()) {
  switch (code) {
    case EV.click: return click(s, combo, now);
    case EV.golden: catchGolden(s, now); return null;
    case EV.thief: catchThief(s, now); return null;
    case EV.prestige: prestige(s); return null;
    case EV.reset: newLife(s); return null;
    case EV.buyCosmetic: buyCosmetic(s, arg); return null;
    case EV.equip: equip(s, arg); return null;
    case EV.unequip: unequip(s, arg); return null;
  }
  const u = UPGRADES.find(x => x.code === code);
  if (u) buy(s, u.id);
  return null;
}

/** Eventos que levam um caractere de argumento logo depois. */
export const takesArg = (code: string) => code === EV.buyCosmetic || code === EV.equip || code === EV.unequip;

/** Divide uma fila de eventos em [código, argumento]. */
export function parseEvents(events: string): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < events.length; i++) {
    const code = events[i];
    if (takesArg(code)) { out.push([code, events[i + 1] ?? ""]); i++; } else out.push([code, ""]);
  }
  return out;
}
