// Efeitos em Canvas: números 6/7 voando, fogo, estrelas, raios e chuva de 67.

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number;
  kind: "big" | "num" | "fire" | "rain";
  text?: string;
}

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createFx(canvas: HTMLCanvasElement, mascot: HTMLElement, flashEl: HTMLElement, getLevel: () => number) {
  const ctx = canvas.getContext("2d")!;
  const particles: Particle[] = [];
  const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6 }));
  let t = 0;
  let bolt: { pts: [number, number][]; life: number } | null = null;

  function resize() {
    const dpr = devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener("resize", resize);
  resize();

  function burst(x: number, y: number, label: string | null, n = 14) {
    if (reduceMotion) return;
    if (label) particles.push({ x, y, vx: 0, vy: -1.6, life: 60, text: label, kind: "big" });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 40 + Math.random() * 20,
        text: Math.random() < .5 ? "6" : "7", kind: "num" });
    }
  }

  function flash() {
    if (reduceMotion) return;
    flashEl.classList.remove("go");
    void flashEl.offsetWidth;
    flashEl.classList.add("go");
  }

  function tick() {
    t++;
    const W = innerWidth, H = innerHeight, level = getLevel();
    ctx.clearRect(0, 0, W, H);
    const r = mascot.getBoundingClientRect();
    const cx = r.left + r.width / 2;

    if (!reduceMotion) {
      // Ascendido+: estrelas piscando
      if (level >= 6) {
        ctx.fillStyle = "#f3ecff";
        for (const s of stars) {
          ctx.globalAlpha = .3 + .7 * Math.abs(Math.sin(t / 40 + s.p));
          ctx.fillRect(s.x * W, s.y * H, 2, 2);
        }
      }
      // Lenda+: fogo subindo do Clawd
      if (level >= 5 && t % 2 === 0) {
        particles.push({ x: cx + (Math.random() - .5) * r.width * .7, y: r.bottom - r.height * .2,
          vx: (Math.random() - .5) * .5, vy: -1.5 - Math.random() * 1.5, life: 40, kind: "fire" });
      }
      // Deus do 6-7+: raios de vez em quando
      if (level >= 7 && !bolt && Math.random() < .008) {
        const pts: [number, number][] = [[Math.random() * W, 0]];
        while (pts[pts.length - 1][1] < H * .7) {
          const [px, py] = pts[pts.length - 1];
          pts.push([px + (Math.random() - .5) * 80, py + 30 + Math.random() * 40]);
        }
        bolt = { pts, life: 10 };
        flash();
      }
      if (bolt) {
        ctx.globalAlpha = bolt.life / 10;
        ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 3; ctx.beginPath();
        bolt.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.stroke();
        if (--bolt.life <= 0) bolt = null;
      }
      // O Próprio 67: chuva de 67
      if (level >= 10 && t % 4 === 0) {
        particles.push({ x: Math.random() * W, y: -20, vx: 0, vy: 2 + Math.random() * 3, life: H / 2, text: "67", kind: "rain" });
      }
    }

    ctx.textAlign = "center";
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.kind === "num") p.vy += 0.06;
      if (p.life <= 0 || p.y > H + 30) { particles.splice(i, 1); continue; }
      if (p.kind === "fire") {
        ctx.globalAlpha = p.life / 40;
        ctx.fillStyle = p.life > 25 ? "#ffd166" : p.life > 12 ? "#d97757" : "#ff6b6b";
        const s = 3 + p.life / 8;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        continue;
      }
      ctx.globalAlpha = p.kind === "rain" ? .5 : Math.min(1, p.life / 30);
      ctx.fillStyle = p.kind === "big" ? "#ffd166" : p.kind === "rain" ? "#d97757" : (p.text === "6" ? "#d97757" : "#f3ecff");
      ctx.font = (p.kind === "big" ? "700 26px " : "500 18px ") + '"Pixelify Sans", monospace';
      ctx.fillText(p.text!, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  tick();

  return { burst, flash };
}
