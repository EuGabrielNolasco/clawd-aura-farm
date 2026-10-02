// Painel de desenvolvimento. Só é carregado com `npm run dev` (import.meta.env.DEV):
// o build de produção não inclui este arquivo, então ninguém usa isso no site publicado.

import { earn, levelOf, RANKS, UPGRADES, type State } from "./game";

export interface DevHooks {
  state: () => State;
  render: () => void;
  toast: (msg: string) => void;
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
    <button data-a="zero">zerar tudo</button>
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
    h.render();
  }

  const actions: Record<string, () => void> = {
    down: () => goTo(levelOf(h.state().total) - 1),
    up: () => goTo(levelOf(h.state().total) + 1),
    goto: () => goTo(Number(select.value)),
    aura: () => { const s = h.state(); earn(s, Math.max(1e4, s.aura * 9)); h.render(); },
    shop: () => { const s = h.state(); for (const u of UPGRADES) s.upgrades[u.id] = u.max; h.render(); },
    zero: () => {
      const s = h.state();
      s.aura = s.total = 0;
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

  // mantém a lista no nível atual
  setInterval(() => { if (document.activeElement !== select) select.value = String(levelOf(h.state().total)); }, 500);
}
