// Painel de desenvolvimento. Só é carregado com `npm run dev` (import.meta.env.DEV):
// o build de produção não inclui este arquivo, então ninguém usa isso no site publicado.

import { COSMETICS } from "./cosmetics";
import { earn, levelOf, RANKS, UPGRADES, type State } from "./game";

export interface DevHooks {
  state: () => State;
  render: () => void;
  toast: (msg: string) => void;
  /** Relógio do jogo (segundos Unix, já ajustado ao servidor no online). */
  now: () => number;
  /** Pausa a sincronização com o servidor. Nulo quando o jogo está em modo local. */
  pauseSync: (() => void) | null;
}

export function mountDev(h: DevHooks) {
  const css = document.createElement("style");
  css.textContent = `
    .dev-btn { position: fixed; z-index: 50; left: 12px; bottom: 12px; font-size: 1.2rem; padding: .4rem .55rem;
      background: #000c; color: #fff; border: 1px dashed #6bffb8; cursor: pointer; }
    .dev-panel { position: fixed; z-index: 50; left: 12px; bottom: 56px; width: 250px; padding: .75rem;
      display: none; gap: .45rem; background: #0b0b12f2; color: #e6ffe9; border: 1px dashed #6bffb8;
      font: 14px/1.3 ui-monospace, monospace; text-align: left; }
    .dev-panel.open { display: grid; }
    .dev-panel h3 { margin: 0; font-size: 12px; letter-spacing: .15em; color: #6bffb8; }
    .dev-row { display: flex; gap: .35rem; }
    .dev-row > * { flex: 1; }
    .dev-panel button, .dev-panel select { font: inherit; padding: .3rem; background: #1b2a22; color: inherit;
      border: 1px solid #2f5c45; cursor: pointer; }
    .dev-panel button:hover { background: #2a4536; }
    .dev-sandbox { position: fixed; z-index: 49; top: 0; left: 0; right: 0; padding: .15rem; text-align: center;
      font: 700 12px ui-monospace, monospace; letter-spacing: .3em; color: #000; background: #6bffb8; pointer-events: none; }
  `;
  document.head.append(css);

  const btn = Object.assign(document.createElement("button"), { type: "button", textContent: "🛠", title: "Painel dev" });
  btn.className = "dev-btn";
  const panel = document.createElement("div");
  panel.className = "dev-panel";
  panel.innerHTML = `
    <h3>PAINEL DEV</h3>
    <div class="dev-row"><button data-a="down">◀ nível</button><button data-a="up">nível ▶</button></div>
    <select data-a="goto" aria-label="Ir para o nível">
      ${RANKS.map(([, n], i) => `<option value="${i}">${i} · ${n}</option>`).join("")}
    </select>
    <div class="dev-row"><button data-a="aura">+aura ×10</button><button data-a="shop">completar loja</button></div>
    <div class="dev-row"><button data-a="golden">🧠 cérebro</button><button data-a="thief">🦹 ladrão</button></div>
    <div class="dev-row"><button data-a="tokens">+50 fichas</button><button data-a="cosmetics">todos enfeites</button></div>
    <div class="dev-row"><button data-a="day">+1 dia</button><button data-a="spins">🎰 +5 giros</button></div>
    <div class="dev-row"><button data-a="max">nível máx</button><button data-a="zero">zerar tudo</button></div>
  `;
  document.body.append(btn, panel);
  btn.addEventListener("click", () => panel.classList.toggle("open"));

  // no modo online, o painel nunca pode mexer no servidor
  let sandbox = false;
  function enterSandbox() {
    if (sandbox || !h.pauseSync) return;
    sandbox = true;
    h.pauseSync();
    const bar = Object.assign(document.createElement("div"), { textContent: "SANDBOX · SINCRONIZAÇÃO PAUSADA" });
    bar.className = "dev-sandbox";
    document.body.append(bar);
    h.toast("Modo sandbox: nada do que você fizer agora vai para o servidor.");
  }

  const select = panel.querySelector("select")!;
  function goTo(l: number) {
    const s = h.state();
    l = Math.max(0, Math.min(RANKS.length - 1, l));
    s.total = RANKS[l][0];
    s.aura = Math.min(s.aura, s.total);
    s.lifetime = Math.max(s.lifetime, s.total);
    h.render();
  }

  const actions: Record<string, () => void> = {
    down: () => goTo(levelOf(h.state().total) - 1),
    up: () => goTo(levelOf(h.state().total) + 1),
    goto: () => goTo(Number(select.value)),
    aura: () => { const s = h.state(); earn(s, Math.max(1e4, s.aura * 9)); h.render(); },
    shop: () => { const s = h.state(); for (const u of UPGRADES) s.upgrades[u.id] = u.max; h.render(); },
    golden: () => { h.state().goldenAt = h.now(); h.render(); },
    thief: () => {
      const s = h.state();
      if (levelOf(s.total) < 8) goTo(8);
      s.thiefAt = h.now();
      h.render();
    },
    tokens: () => { h.state().tokens += 50; h.render(); },
    cosmetics: () => { const s = h.state(); s.owned = COSMETICS.map(c => c.id); h.render(); },
    spins: () => {
      void import("./wheel").then(w => {
        for (let i = 0; i < 5; i++) w.addSpin();
        h.render();
        h.toast("🎰 +5 giros adicionados à Roleta!");
      });
    },
    // finge que o último login foi ontem: o próximo tick dá a recompensa do dia e soma na sequência
    day: () => {
      const s = h.state();
      if (s.lastDay) s.lastDay = new Date(Date.parse(s.lastDay) - 86_400_000).toISOString().slice(0, 10);
      h.render();
    },
    max: () => goTo(RANKS.length - 1),
    zero: () => {

      const s = h.state();
      s.aura = s.total = s.lifetime = s.tokens = s.prestige = 0;
      s.clicks = s.crits = s.goldens = s.thieves = s.streak = 0;
      s.achievements = []; s.owned = []; s.equipped = {}; s.buffUntil = 0;
      for (const u of UPGRADES) s.upgrades[u.id] = 0;
      h.render();
    },
  };

  panel.addEventListener("click", e => {
    const a = (e.target as HTMLElement).closest<HTMLElement>("button[data-a]")?.dataset.a;
    if (!a) return;
    enterSandbox();
    actions[a]();
  });
  select.addEventListener("change", () => { enterSandbox(); actions.goto(); });

  // Telas por URL, para revisar o layout sem clicar (ex.: ?screen=cos&level=8&clean):
  //   level=N · tokens=N · screen=shop|ranking|ach|cos|mega|golden|thief|toast|dev · clean (esconde o 🛠)
  const q = new URLSearchParams(location.search);
  if (q.size) {
    enterSandbox();
    if (q.has("clean")) btn.hidden = true;
    // na auditoria mede a posição final: sem transições (a aba pode não estar desenhando quadros)
    if (q.has("audit")) document.head.append(Object.assign(document.createElement("style"), { textContent: "*{transition:none!important}" }));
    if (q.has("level")) goTo(Number(q.get("level")));
    if (q.has("tokens")) { h.state().tokens = Number(q.get("tokens")); h.render(); }
    const screen = q.get("screen");
    const click = (sel: string) => document.querySelector<HTMLElement>(sel)?.click();
    setTimeout(() => {
      if (screen === "shop") click("#shop-toggle");
      if (screen === "ranking" || screen === "ach" || screen === "cos") click(`[data-tab="${screen}"]`);
      if (screen === "mega") { h.state().buffUntil = h.now() + 67; h.render(); }
      if (screen === "golden") actions.golden();
      if (screen === "thief") actions.thief();
      if (screen === "toast") h.toast("🎖 Conquista: Usa o Mega Brain (+15 fichas)");
      if (screen === "dev") panel.classList.add("open");
    }, 300);
    if (q.has("audit")) setTimeout(() => parent.postMessage({ audit: audit(), href: location.href, size: `${innerWidth}x${innerHeight}` }, "*"), 2000);
  }

  // mantém a lista no nível atual
  setInterval(() => { if (document.activeElement !== select) select.value = String(levelOf(h.state().total)); }, 500);
}

/** Problemas de layout visíveis: coisas cortadas nas bordas e blocos principais se sobrepondo. */
function audit(): string[] {
  const W = innerWidth, H = innerHeight, out: string[] = [];
  const name = (el: Element) => el.id ? `#${el.id}` : `.${[...el.classList].join(".") || el.tagName.toLowerCase()}`;
  const visible = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && !(el as HTMLElement).hidden;
  };
  // elementos interativos ou de texto cortados pelas bordas da tela
  const sel = "button, a, input, .count, .rank, .mult, .next-label, .tokens, .ahead, .ladder span, .item, .cos-item, .ach-list li, .top li, .toast.show, .banner.show, .jarvis-text, .combo";
  for (const el of document.querySelectorAll(sel)) {
    if (!visible(el) || el.closest(".golden, .thief, .dev-panel:not(.open), .shop:not(.open) .item, dialog:not([open])")) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    // dentro de um container com rolagem, só conta se o container estiver cortado
    if (el.closest(".menu, .shop") && !el.matches(".menu, .shop")) continue;
    const scroller = el.parentElement && getComputedStyle(el.parentElement).overflowX;
    if (scroller === "auto" || scroller === "scroll") continue;
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1)
      out.push(`cortado: ${name(el)} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  for (const el of document.querySelectorAll(".menu[open], .shop.open")) {
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push(`cortado: ${name(el)} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}]`);
  }
  // blocos principais não podem se sobrepor
  const blocks = [".hud", ".mascot-wrap", ".combo", ".controls", ".ladder", ".shop"].map(s => document.querySelector(s)).filter((e): e is Element => !!e && visible(e));
  const rects = blocks.map(b => [name(b), b.getBoundingClientRect()] as const);
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const [an, a] = rects[i], [bn, b] = rects[j];
    // a gaveta da loja (celular) cobre o jogo de propósito quando aberta e fica fora da tela fechada
    const drawer = (k: number) => getComputedStyle(blocks[k]).position === "fixed";
    if ((an.includes("shop") && drawer(i)) || (bn.includes("shop") && drawer(j))) continue;
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 4 && oy > 4) out.push(`sobreposição: ${an} × ${bn} (${Math.round(ox)}×${Math.round(oy)} px)`);
  }
  if (document.documentElement.scrollWidth > W + 1) out.push(`rolagem horizontal: ${document.documentElement.scrollWidth}px > ${W}px`);
  return out;
}

