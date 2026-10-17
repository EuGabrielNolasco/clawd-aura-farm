// Roleta da Sorte 67: minigame de retenção, missões diárias e recompensas.
import { BUFF_S, earn, passivePerSecond, type State } from "./game";

const SPINS_KEY = "clawd-aura-farm:spins";

export interface WheelPrize {
  id: string;
  name: string;
  desc: string;
  icon: string;
  color: string;
  action: (s: State, now: number) => { msg: string; tokensGain?: number; auraGain?: number };
}

export const PRIZES: readonly WheelPrize[] = [
  {
    id: "tokens_5",
    name: "5 Fichas 67",
    desc: "Fichas para a loja de enfeites",
    icon: "🎟",
    color: "#00f5d4",
    action: s => {
      s.tokens += 5;
      return { msg: "+5 Fichas 67 adicionadas!", tokensGain: 5 };
    },
  },
  {
    id: "aura_burst",
    name: "Rajada de Aura",
    desc: "3 min de farm passivo instantâneo!",
    icon: "⚡",
    color: "#9b5de5",
    action: s => {
      const rate = passivePerSecond(s);
      const gain = Math.max(670, rate * 180);
      earn(s, gain);
      return { msg: `Rajada de Aura: +${Math.floor(gain).toLocaleString("pt-BR")} de aura instantânea!`, auraGain: gain };
    },
  },
  {
    id: "tokens_10",
    name: "10 Fichas 67",
    desc: "Mais estilo para seu Clawd",
    icon: "🎟",
    color: "#ffd166",
    action: s => {
      s.tokens += 10;
      return { msg: "+10 Fichas 67 adicionadas!", tokensGain: 10 };
    },
  },
  {
    id: "megabrain",
    name: "Mega Brain!",
    desc: "×7 em toda aura por 67 segundos",
    icon: "🧠",
    color: "#00bbf9",
    action: (s, now) => {
      s.buffUntil = Math.max(s.buffUntil, now) + BUFF_S;
      s.goldens++;
      return { msg: "Mega Brain ativado! ×7 em toda a aura por 67s!" };
    },
  },
  {
    id: "tokens_15",
    name: "15 Fichas 67",
    desc: "Pacote especial de Fichas 67",
    icon: "🎟",
    color: "#ff9f1c",
    action: s => {
      s.tokens += 15;
      return { msg: "+15 Fichas 67 adicionadas!", tokensGain: 15 };
    },
  },
  {
    id: "crit_storm",
    name: "Tempestade 67",
    desc: "6 min de aura passiva instantânea!",
    icon: "💥",
    color: "#ff6b6b",
    action: s => {
      const rate = passivePerSecond(s);
      const gain = Math.max(1500, rate * 360);
      earn(s, gain);
      return { msg: `Tempestade de Aura: +${Math.floor(gain).toLocaleString("pt-BR")} de aura!`, auraGain: gain };
    },
  },
  {
    id: "tokens_25",
    name: "25 Fichas 67",
    desc: "Prêmio épico de fichas",
    icon: "💎",
    color: "#f15bb5",
    action: s => {
      s.tokens += 25;
      return { msg: "PRÊMIO ÉPICO! +25 Fichas 67 adicionadas!", tokensGain: 25 };
    },
  },
  {
    id: "overdrive_67",
    name: "Overdrive 67",
    desc: "×7 de aura por 134s (dobro de tempo!)",
    icon: "🚀",
    color: "#38bdf8",
    action: (s, now) => {
      s.buffUntil = Math.max(s.buffUntil, now) + BUFF_S * 2;
      s.goldens++;
      return { msg: "Overdrive 67! Modo Mega Brain ×7 por 134 segundos!" };
    },
  },
  {
    id: "aura_tsunami",
    name: "Tsunami de Aura",
    desc: "10 min de aura passiva instantânea!",
    icon: "🌊",
    color: "#6366f1",
    action: s => {
      const rate = passivePerSecond(s);
      const gain = Math.max(5000, rate * 600);
      earn(s, gain);
      return { msg: `Tsunami de Aura: +${Math.floor(gain).toLocaleString("pt-BR")} de aura instantânea!`, auraGain: gain };
    },
  },
  {
    id: "jackpot_67",
    name: "Jackpot 67!",
    desc: "+67 Fichas 67 na hora!",
    icon: "👑",
    color: "#a855f7",
    action: s => {
      s.tokens += 67;
      return { msg: "👑 JACKPOT SUPREMO! +67 Fichas 67 adicionadas!", tokensGain: 67 };
    },
  },
];

export type MissionStat = "clicks" | "crits" | "upgrades" | "events";

export interface WheelMission {
  id: string;
  name: string;
  desc: string;
  stat: MissionStat;
  target: number;
}

export const WHEEL_MISSIONS: readonly WheelMission[] = [
  { id: "m_clicks", name: "Aquecimento 6-7", desc: "Dar 67 cliques hoje", stat: "clicks", target: 67 },
  { id: "m_crits", name: "Olhar Crítico", desc: "Acertar 10 críticos hoje", stat: "crits", target: 10 },
  { id: "m_upgrades", name: "Investidor de Aura", desc: "Comprar 3 upgrades na loja hoje", stat: "upgrades", target: 3 },
  { id: "m_events", name: "Reflexo Rápido", desc: "Pegar 1 Cérebro Dourado ou Ladrão hoje", stat: "events", target: 1 },
];

export interface DailyMissionProgress {
  date: string;
  clicks: number;
  crits: number;
  upgrades: number;
  events: number;
  claimed: string[];
}

export interface SpinsState {
  spins: number;
  lastDailyDate: string | null;
  wheelTokens?: number;
  dailyProgress?: DailyMissionProgress;
}

const emptyDailyProgress = (date: string): DailyMissionProgress => ({
  date,
  clicks: 0,
  crits: 0,
  upgrades: 0,
  events: 0,
  claimed: [],
});

let memSpins: SpinsState = { spins: 0, lastDailyDate: null, wheelTokens: 0 };

function readStoredSpins(): SpinsState {
  try {
    if (typeof localStorage !== "undefined" && localStorage?.getItem) {
      const raw = localStorage.getItem(SPINS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {
    //
  }
  return { ...memSpins };
}

export function loadSpins(today: string): SpinsState {
  const data = readStoredSpins();
  if (typeof data.spins !== "number" || data.spins < 0) data.spins = 0;
  if (typeof data.wheelTokens !== "number" || data.wheelTokens < 0) data.wheelTokens = 0;

  let changed = false;
  // Login diário: ganha exatamente +1 giro por dia
  if (data.lastDailyDate !== today) {
    data.spins = (data.spins || 0) + 1;
    data.lastDailyDate = today;
    changed = true;
  }
  if (!data.dailyProgress || data.dailyProgress.date !== today) {
    data.dailyProgress = emptyDailyProgress(today);
    changed = true;
  }
  if (changed) saveSpins(data);
  return data;
}

export function saveSpins(s: SpinsState) {
  memSpins = { ...s };
  try {
    if (typeof localStorage !== "undefined" && localStorage?.setItem) {
      localStorage.setItem(SPINS_KEY, JSON.stringify(s));
    }
  } catch {
    // ignora
  }
}

export function addSpin(): number {
  const data = readStoredSpins();
  data.spins = (data.spins || 0) + 1;
  saveSpins(data);
  return data.spins;
}

export function getWheelTokensWon(): number {
  const data = readStoredSpins();
  return Math.max(0, Math.floor(Number(data.wheelTokens) || 0));
}

/** Registra progresso nas missões diárias da roleta e concede +1 giro para cada missão concluída. */
export function recordMissionProgress(today: string, stat: MissionStat, amount = 1): WheelMission[] {
  const data = loadSpins(today);
  const prog = data.dailyProgress ?? emptyDailyProgress(today);
  prog[stat] = (prog[stat] || 0) + amount;

  const completed: WheelMission[] = [];
  for (const m of WHEEL_MISSIONS) {
    if (!prog.claimed.includes(m.id) && prog[m.stat] >= m.target) {
      prog.claimed.push(m.id);
      data.spins = (data.spins || 0) + 1;
      completed.push(m);
    }
  }
  data.dailyProgress = prog;
  saveSpins(data);
  return completed;
}

export interface SpinResult {
  prizeIndex: number;
  prize: WheelPrize;
  message: string;
  degrees: number;
  remainingSpins: number;
  tokensGain: number;
  auraGain: number;
}

/** Aplica o prêmio da fatia sorteada diretamente no estado atual do jogador. */
export function applySpinPrize(s: State, prize: WheelPrize, now: number): { msg: string; tokensGain: number; auraGain: number } {
  const { msg, tokensGain = 0, auraGain = 0 } = prize.action(s, now);
  if (tokensGain > 0) {
    const data = readStoredSpins();
    data.wheelTokens = (data.wheelTokens || 0) + tokensGain;
    saveSpins(data);
  }
  return { msg, tokensGain, auraGain };
}

/** Roda a roleta e calcula os graus de rotação (mínimo 5 voltas completas). */
export function spinWheel(
  s: State,
  now: number,
  currentDegrees = 0,
  applyImmediately = true
): SpinResult | null {
  const data = readStoredSpins();

  if (data.spins <= 0) return null;

  data.spins--;
  saveSpins(data);

  const prizeIndex = Math.floor(Math.random() * PRIZES.length);
  const prize = PRIZES[prizeIndex];
  const applied = applyImmediately
    ? applySpinPrize(s, prize, now)
    : { msg: prize.desc, tokensGain: 0, auraGain: 0 };

  // Cada fatia ocupa 360 / PRIZES.length graus (36 graus para 10 fatias)
  const sliceSize = 360 / PRIZES.length;
  // Centro da fatia premiada (o ponteiro fica no topo: 0 graus / 360 graus)
  const targetAngle = 360 - (prizeIndex * sliceSize + sliceSize / 2);
  const fullRotations = 360 * 5; // 5 voltas completas
  const newDegrees = Math.ceil(currentDegrees / 360) * 360 + fullRotations + targetAngle;

  return {
    prizeIndex,
    prize,
    message: applied.msg,
    degrees: newDegrees,
    remainingSpins: data.spins,
    tokensGain: applied.tokensGain,
    auraGain: applied.auraGain,
  };
}

/** Gera a marcação SVG das fatias da roleta com cores, ícones e textos. */
export function renderWheelSvg(prizes = PRIZES): string {
  const n = prizes.length;
  const sliceSize = 360 / n;
  const fontSize = n > 8 ? "9" : "11";
  const textRadius = n > 8 ? 98 : 96;
  let paths = "";
  for (let i = 0; i < n; i++) {
    const p = prizes[i];
    const a1 = ((i * sliceSize - 90) * Math.PI) / 180;
    const a2 = (((i + 1) * sliceSize - 90) * Math.PI) / 180;
    const x1 = 150 + 146 * Math.cos(a1);
    const y1 = 150 + 146 * Math.sin(a1);
    const x2 = 150 + 146 * Math.cos(a2);
    const y2 = 146 * Math.sin(a2) + 150;

    const midAngle = ((i * sliceSize + sliceSize / 2 - 90) * Math.PI) / 180;
    const tx = 150 + textRadius * Math.cos(midAngle);
    const ty = 150 + textRadius * Math.sin(midAngle);
    const textRot = i * sliceSize + sliceSize / 2 + 90;

    paths += `
      <path d="M 150 150 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 146 146 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${p.color}" stroke="#140f24" stroke-width="2"/>
      <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) rotate(${textRot.toFixed(2)})">
        <text text-anchor="middle" dominant-baseline="central" fill="#140f24" font-weight="bold" font-family="'Pixelify Sans', monospace" font-size="${fontSize}">
          ${p.icon} ${p.name}
        </text>
      </g>
    `;
  }
  return paths;
}

