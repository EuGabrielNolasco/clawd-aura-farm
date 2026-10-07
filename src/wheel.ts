// Roleta da Sorte 67: minigame de retenção e recompensas diárias.
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
    id: "aura_burst",
    name: "Rajada de Aura",
    desc: "10 min de farm passivo instantâneo!",
    icon: "⚡",
    color: "#9b5de5",
    action: s => {
      const rate = passivePerSecond(s);
      const gain = Math.max(670, rate * 600); // 10 minutos
      earn(s, gain);
      return { msg: `Rajada de Aura: +${Math.floor(gain).toLocaleString("pt-BR")} de aura instantânea!`, auraGain: gain };
    },
  },
  {
    id: "megabrain",
    name: "Mega Brain!",
    desc: "×7 em toda aura por 67 segundos",
    icon: "🧠",
    color: "#00bbf9",
    action: (s, now) => {
      s.buffUntil = Math.max(s.buffUntil, now + BUFF_S);
      s.goldens++;
      return { msg: "Mega Brain ativado! ×7 em toda a aura por 67s!" };
    },
  },
  {
    id: "tokens_25",
    name: "Jackpot: 25 Fichas!",
    desc: "Prêmio épico da roleta",
    icon: "💎",
    color: "#f15bb5",
    action: s => {
      s.tokens += 25;
      return { msg: "JACKPOT! +25 Fichas 67 adicionadas!", tokensGain: 25 };
    },
  },
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
    id: "crit_storm",
    name: "Tempestade de Aura",
    desc: "15 min de aura passiva instantânea!",
    icon: "💥",
    color: "#ff6b6b",
    action: s => {
      const rate = passivePerSecond(s);
      const gain = Math.max(1000, rate * 900); // 15 minutos
      earn(s, gain);
      return { msg: `Tempestade de Aura: +${Math.floor(gain).toLocaleString("pt-BR")} de aura!`, auraGain: gain };
    },
  },
];

export interface SpinsState {
  spins: number;
  lastDailyDate: string | null;
}

let memSpins: SpinsState = { spins: 1, lastDailyDate: null };

export function loadSpins(today: string): SpinsState {
  let data: SpinsState = { spins: 0, lastDailyDate: null };
  try {
    if (typeof localStorage !== "undefined" && localStorage?.getItem) {
      const raw = localStorage.getItem(SPINS_KEY);
      if (raw) data = JSON.parse(raw);
      else data = { ...memSpins };
    } else {
      data = { ...memSpins };
    }
  } catch {
    data = { ...memSpins };
  }

  // Se for um novo dia e ainda não pegou o giro diário, ganha +1 giro grátis!
  if (data.lastDailyDate !== today) {
    data.spins = (data.spins || 0) + 1;
    data.lastDailyDate = today;
    saveSpins(data);
  }
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
  let data: SpinsState = { ...memSpins };
  try {
    if (typeof localStorage !== "undefined" && localStorage?.getItem) {
      const raw = localStorage.getItem(SPINS_KEY);
      if (raw) data = JSON.parse(raw);
    }
  } catch {
    //
  }
  data.spins = (data.spins || 0) + 1;
  saveSpins(data);
  return data.spins;
}

export interface SpinResult {
  prizeIndex: number;
  prize: WheelPrize;
  message: string;
  degrees: number;
  remainingSpins: number;
}

/** Roda a roleta e calcula os graus de rotação (mínimo 5 voltas completas). */
export function spinWheel(
  s: State,
  now: number,
  currentDegrees = 0
): SpinResult | null {
  let data: SpinsState = { ...memSpins };
  try {
    if (typeof localStorage !== "undefined" && localStorage?.getItem) {
      const raw = localStorage.getItem(SPINS_KEY);
      if (raw) data = JSON.parse(raw);
    }
  } catch {
    //
  }

  if (data.spins <= 0) return null;

  data.spins--;
  saveSpins(data);


  const prizeIndex = Math.floor(Math.random() * PRIZES.length);
  const prize = PRIZES[prizeIndex];
  const { msg } = prize.action(s, now);

  // Cada fatia ocupa 360 / PRIZES.length graus (60 graus)
  const sliceSize = 360 / PRIZES.length;
  // Centro da fatia premiada (o ponteiro fica no topo: 0 graus / 360 graus)
  const targetAngle = 360 - (prizeIndex * sliceSize + sliceSize / 2);
  const fullRotations = 360 * 5; // 5 voltas completas
  const newDegrees = Math.ceil(currentDegrees / 360) * 360 + fullRotations + targetAngle;

  return {
    prizeIndex,
    prize,
    message: msg,
    degrees: newDegrees,
    remainingSpins: data.spins,
  };
}

/** Gera a marcação SVG das fatias da roleta com cores, ícones e textos. */
export function renderWheelSvg(prizes = PRIZES): string {
  const n = prizes.length;
  const sliceSize = 360 / n;
  let paths = "";
  for (let i = 0; i < n; i++) {
    const p = prizes[i];
    const a1 = ((i * sliceSize - 90) * Math.PI) / 180;
    const a2 = (((i + 1) * sliceSize - 90) * Math.PI) / 180;
    const x1 = 150 + 146 * Math.cos(a1);
    const y1 = 150 + 146 * Math.sin(a1);
    const x2 = 150 + 146 * Math.cos(a2);
    const y2 = 150 + 146 * Math.sin(a2);

    const midAngle = ((i * sliceSize + sliceSize / 2 - 90) * Math.PI) / 180;
    const tx = 150 + 96 * Math.cos(midAngle);
    const ty = 150 + 96 * Math.sin(midAngle);
    const textRot = i * sliceSize + sliceSize / 2 + 90;

    paths += `
      <path d="M 150 150 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 146 146 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${p.color}" stroke="#140f24" stroke-width="2"/>
      <g transform="translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) rotate(${textRot.toFixed(2)})">
        <text text-anchor="middle" dominant-baseline="central" fill="#140f24" font-weight="bold" font-family="'Pixelify Sans', monospace" font-size="11">
          ${p.icon} ${p.name}
        </text>
      </g>
    `;
  }
  return paths;
}

