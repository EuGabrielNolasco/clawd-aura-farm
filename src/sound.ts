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

/** Toca uma sequência de notas [frequência em Hz, duração em s]. */
function play(notes: [number, number][], type: OscillatorType = "square", volume = 0.06) {
  const a = audio();
  if (!a) return;
  let t = a.currentTime;
  for (const [freq, dur] of notes) {
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

export const sfx = {
  /** "six… seven": duas notas. Limitado para não virar ruído com cliques muito rápidos. */
  click() {
    const now = performance.now();
    if (now - lastClick < 60) return;
    lastClick = now;
    play([[660, 0.05], [880, 0.07]], "square", 0.04);
  },
  crit: () => play([[880, 0.05], [1175, 0.05], [1568, 0.12]], "square", 0.05),
  buy: () => play([[988, 0.06], [1319, 0.14]], "triangle", 0.09),
  denied: () => play([[180, 0.12]], "sawtooth", 0.04),
  levelUp: () => play([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]], "square", 0.06),
  welcome: () => play([[392, 0.08], [523, 0.08], [659, 0.16]], "triangle", 0.08),
};
