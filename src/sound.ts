// Efeitos sonoros 8-bit sintetizados com Web Audio, sem arquivos de áudio.

let ctx: AudioContext | null = null;
let muted = false;
let lastClick = 0;

export const setMuted = (m: boolean) => { muted = m; };

function audio() {
  if (muted) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Toca uma sequência de notas [frequência em Hz, duração em s]; frequência 0 é pausa. */
function play(notes: [number, number][], type: OscillatorType = "square", volume = 0.06, delay = 0) {
  const a = audio();
  if (!a) return;
  let t = a.currentTime + delay;
  for (const [freq, dur] of notes) {
    if (freq <= 0) { t += dur; continue; } // pausa
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur);
    t += dur * 0.85;
  }
}

/** Uma nota que desliza de `from` até `to` Hz. */
function sweep(from: number, to: number, dur: number, type: OscillatorType = "sawtooth", volume = 0.05, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

/** Acorde: várias notas ao mesmo tempo. */
const chord = (freqs: number[], dur: number, type: OscillatorType = "square", volume = 0.035, delay = 0) =>
  freqs.forEach(f => play([[f, dur]], type, volume, delay));

export const sfx = {
  /** "six… seven": duas notas, mais agudas quanto maior o combo. Limitado para não virar ruído. */
  click(combo = 1) {
    const now = performance.now();
    if (now - lastClick < 60) return;
    lastClick = now;
    const k = 1 + (combo - 1) * 0.3;
    play([[660 * k, 0.05], [880 * k, 0.07]], "square", 0.04);
  },
  crit: () => play([[880, 0.05], [1175, 0.05], [1568, 0.12]], "square", 0.05),
  buy: () => play([[988, 0.06], [1319, 0.14]], "triangle", 0.09),
  denied: () => play([[180, 0.12]], "sawtooth", 0.04),
  welcome: () => play([[392, 0.08], [523, 0.08], [659, 0.16]], "triangle", 0.08),

  /** Fanfarra de subida de nível em 3 tiers: curta, média e épica com grave. */
  levelUp(level: number) {
    if (level <= 5) return play([[523, 0.08], [659, 0.08], [784, 0.18]], "square", 0.06);
    if (level <= 10) {
      play([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], "square", 0.06);
      return chord([262, 330, 392], 0.5, "triangle", 0.04, 0.3);
    }
    play([[392, 0.12], [523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.45]], "square", 0.06);
    play([[98, 0.6]], "sawtooth", 0.06);
    chord([523, 659, 784, 1047], 0.8, "triangle", 0.035, 0.5);
  },

  /** Mega Brain: reator subindo (estilo arc reactor) e acorde de power-up. */
  megaBrain() {
    sweep(110, 880, 0.9, "sawtooth", 0.05);
    sweep(220, 1760, 0.9, "square", 0.02);
    chord([440, 554, 659, 880], 0.7, "square", 0.04, 0.85);
    play([[1760, 0.05], [2093, 0.05], [2637, 0.2]], "triangle", 0.04, 1.2);
  },
  /** Cérebro Dourado apareceu: brilho rápido. */
  goldenSpawn: () => play([[1568, 0.05], [2093, 0.05], [2637, 0.08], [3136, 0.12]], "triangle", 0.05),

  /** Coop Thief: passinhos furtivos em tom menor. */
  thiefSpawn: () => play([[330, 0.09], [0, 0.06], [311, 0.09], [0, 0.06], [294, 0.09], [262, 0.2]], "triangle", 0.07),
  thiefCaught: () => { play([[784, 0.06], [988, 0.06], [1319, 0.14]], "square", 0.05); sweep(1200, 300, 0.25, "sawtooth", 0.03, 0.2); },

  achievement: () => { play([[784, 0.08], [988, 0.08], [1175, 0.08], [1568, 0.25]], "triangle", 0.08); chord([784, 1175], 0.4, "square", 0.025, 0.25); },
  /** Moedinhas do login diário. */
  daily: () => [0, 0.12, 0.24].forEach(d => play([[1319, 0.05], [1760, 0.1]], "square", 0.04, d)),
  cosmetic: () => play([[1047, 0.06], [1319, 0.06], [1568, 0.06], [2093, 0.16]], "triangle", 0.08),
  equip: () => play([[659, 0.05], [988, 0.1]], "triangle", 0.07),
  prestige() {
    sweep(1760, 110, 0.8, "sawtooth", 0.04);
    chord([262, 330, 392, 523], 1.2, "triangle", 0.04, 0.7);
    play([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [1319, 0.5]], "square", 0.05, 0.7);
  },
  /** Passou alguém no ranking. */
  overtake: () => play([[587, 0.07], [784, 0.07], [988, 0.07], [1175, 0.2]], "square", 0.06),
  /** Roleta girando e prêmio. */
  wheelTick: () => play([[1200, 0.02]], "triangle", 0.03),
  wheelWin: () => {
    play([[659, 0.08], [880, 0.08], [1175, 0.08], [1760, 0.3]], "triangle", 0.08);
    chord([880, 1175, 1760], 0.5, "square", 0.03, 0.24);
  },
  copy: () => play([[1047, 0.04], [1319, 0.08]], "triangle", 0.05),
};

