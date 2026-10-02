// Regras do jogo, sem DOM: tudo aqui é testável em src/game.test.ts.

/** [aura total mínima, nome]. Cada nível multiplica os ganhos por 5. */
export const RANKS: readonly (readonly [number, string])[] = [
  [0, "NPC"], [67, "Figurante"], [670, "Main character"], [6700, "Sigma"],
  [67000, "Aura infinita"], [670000, "Lenda do 6-7"], [6.7e6, "Ascendido"],
  [6.7e7, "Deus do 6-7"], [6.7e8, "Multiverso"], [6.7e9, "Clawd Supremo"], [6.7e10, "O Próprio 67"],
];

export const BASE_CLICK = 67;
export const BASE_PASSIVE = 6;
export const TICK_MS = 700;
export const CRIT_MULT = 10;
export const BASE_CRIT = 0.1;

export type UpgradeId = "passive" | "click" | "crit";

export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: string;
  baseCost: number;
  growth: number;
  max?: number;
}

export const UPGRADES: readonly Upgrade[] = [
  { id: "passive", name: "Clawd auxiliar", desc: "Mais um Clawd farmando sozinho", baseCost: 200, growth: 1.7 },
  { id: "click", name: "Mão firme", desc: "+50% de aura por clique", baseCost: 670, growth: 2.2 },
  { id: "crit", name: "Olhar sigma", desc: "+3% de chance de crítico", baseCost: 6700, growth: 3, max: 10 },
];

export interface State {
  /** Saldo que pode ser gasto na loja. */
  aura: number;
  /** Tudo que já foi farmado. Define o nível, então gastar não faz cair de nível. */
  total: number;
  upgrades: Record<UpgradeId, number>;
}

export const newState = (): State => ({ aura: 0, total: 0, upgrades: { passive: 0, click: 0, crit: 0 } });

export function levelOf(total: number): number {
  let l = 0;
  RANKS.forEach(([min], i) => { if (total >= min) l = i; });
  return l;
}

export const levelMult = (level: number) => 5 ** level;

export const clickGain = (s: State) => BASE_CLICK * levelMult(levelOf(s.total)) * (1 + 0.5 * s.upgrades.click);

export const critChance = (s: State) => BASE_CRIT + 0.03 * s.upgrades.crit;

export const passivePerTick = (s: State) => BASE_PASSIVE * levelMult(levelOf(s.total)) * (1 + s.upgrades.passive);

export const passivePerSecond = (s: State) => passivePerTick(s) * 1000 / TICK_MS;

export function earn(s: State, amount: number) {
  s.aura += amount;
  s.total += amount;
}

export function click(s: State, rand: () => number = Math.random) {
  const crit = rand() < critChance(s);
  const gain = clickGain(s) * (crit ? CRIT_MULT : 1);
  earn(s, gain);
  return { gain, crit };
}

export const upgrade = (id: UpgradeId) => UPGRADES.find(u => u.id === id)!;

export const costOf = (s: State, id: UpgradeId) => {
  const u = upgrade(id);
  return Math.ceil(u.baseCost * u.growth ** s.upgrades[id]);
};

export const isMaxed = (s: State, id: UpgradeId) => {
  const max = upgrade(id).max;
  return max !== undefined && s.upgrades[id] >= max;
};

export const canBuy = (s: State, id: UpgradeId) => !isMaxed(s, id) && s.aura >= costOf(s, id);

export function buy(s: State, id: UpgradeId): boolean {
  if (!canBuy(s, id)) return false;
  s.aura -= costOf(s, id);
  s.upgrades[id]++;
  return true;
}
