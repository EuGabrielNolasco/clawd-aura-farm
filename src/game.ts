// Regras do jogo, sem DOM. As mesmas regras rodam no servidor (supabase/schema.sql):
// qualquer mudança aqui precisa ser espelhada lá, senão o ranking diverge do que o jogador vê.
//
// Economia calibrada por simulação (3 sessões de 40 min por dia, 4 cliques/s, pegando os
// Cérebros Dourados): primeiros níveis em segundos, nível máximo em ~3 dias e loja em ~1 semana.

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
/** Máximo de aura passiva creditada enquanto o jogador está fora. */
export const OFFLINE_CAP_S = 12 * 3600;

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

export const CLICK_CODE = "c";

export interface State {
  /** Saldo que pode ser gasto na loja. */
  aura: number;
  /** Tudo que já foi farmado. Define o nível, então gastar não faz cair de nível. */
  total: number;
  upgrades: Record<UpgradeId, number>;
  /** Estado do gerador de críticos, compartilhado com o servidor para os dois rolarem igual. */
  rng: number;
}

export const RNG_MOD = 2147483647;

/** Gerador Park–Miller: inteiro, exato em double e idêntico ao do servidor. */
export const nextRng = (r: number) => (r * 48271) % RNG_MOD;

export const randomSeed = () => 1 + Math.floor(Math.random() * (RNG_MOD - 2));

export const newState = (rng = randomSeed()): State => ({
  aura: 0, total: 0, rng,
  upgrades: { aux: 0, click: 0, crit: 0, fab: 0, dc: 0, cosmic: 0 },
});

export function levelOf(total: number): number {
  let l = 0;
  RANKS.forEach(([min], i) => { if (total >= min) l = i; });
  return l;
}

const mult = (s: State) => LEVEL_BONUS ** levelOf(s.total) * 2 ** s.upgrades.cosmic;

export const clickGain = (s: State) => BASE_CLICK * (1 + 0.5 * s.upgrades.click) * mult(s);

export const critChance = (s: State) => BASE_CRIT + 0.03 * s.upgrades.crit;

export const passivePerSecond = (s: State) =>
  (BASE_PASSIVE + 2 * s.upgrades.aux + 60 * s.upgrades.fab + 4000 * s.upgrades.dc) * mult(s);

export function earn(s: State, amount: number) {
  s.aura += amount;
  s.total += amount;
}

/** Credita aura passiva, recalculando o ganho quando um nível é atingido no meio do período. */
export function passive(s: State, seconds: number) {
  let left = Math.min(seconds, OFFLINE_CAP_S);
  for (let i = 0; left > 0 && i < 20; i++) {
    const l = levelOf(s.total), rate = passivePerSecond(s);
    const next = RANKS[l + 1];
    const dt = next ? Math.min(left, Math.max((next[0] - s.total) / rate, 0.001)) : left;
    earn(s, rate * dt);
    left -= dt;
  }
}

export function click(s: State) {
  s.rng = nextRng(s.rng);
  const crit = s.rng / RNG_MOD < critChance(s);
  const gain = clickGain(s) * (crit ? CRIT_MULT : 1);
  earn(s, gain);
  return { gain, crit };
}

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

/** Aplica um evento do protocolo ("c" = clique, letra de upgrade = compra). */
export function applyEvent(s: State, code: string) {
  if (code === CLICK_CODE) return click(s);
  const u = UPGRADES.find(x => x.code === code);
  if (u) buy(s, u.id);
  return null;
}
