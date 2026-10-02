import "./style.css";
import {
  buy, canBuy, click, clickGain, costOf, earn, isMaxed, levelMult, levelOf,
  passivePerSecond, passivePerTick, RANKS, TICK_MS, UPGRADES,
} from "./game";
import { createFx, reduceMotion } from "./fx";
import { load, save } from "./storage";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage"), mascot = $("mascot");

const state = load();
let level = -1;
const fx = createFx($<HTMLCanvasElement>("fx"), mascot, $("flash"), () => level);

const fmt = (n: number) => Math.floor(n).toLocaleString("pt-BR");
const short = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtShort = (n: number) => (n < 1e4 ? fmt(n) : short.format(n));

/** Reinicia uma animação CSS removendo e recolocando a classe. */
function replay(el: HTMLElement, cls: string) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// clones pro Multiverso
for (let i = 0; i < 3; i++) $("clones").appendChild($("clawd").cloneNode(true) as Element).removeAttribute("id");

$("ladder").innerHTML = RANKS.map(([, n]) => `<span>${n}</span>`).join("");
const ladderEls = [...$("ladder").children] as HTMLElement[];

// Loja: um botão por upgrade, montado uma vez e atualizado a cada render
const shopItems = UPGRADES.map(u => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "item";
  btn.innerHTML = `<span class="item-name">${u.name} <em></em></span><span class="item-desc">${u.desc}</span><span class="item-cost"></span>`;
  btn.addEventListener("click", () => {
    if (buy(state, u.id)) {
      const r = btn.getBoundingClientRect();
      fx.burst(r.left + r.width / 2, r.top, null, 10);
      render();
    }
  });
  $("shop-items").appendChild(btn);
  return { u, btn, owned: btn.querySelector("em")!, cost: btn.querySelector<HTMLElement>(".item-cost")! };
});

function levelUp(l: number) {
  const b = $("banner");
  b.innerHTML = `<small>SUBIU DE NÍVEL</small>${RANKS[l][1]}`;
  replay(b, "show");
  fx.flash();
  const r = mascot.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, null, 40);
  replay($("star"), "nudge");
}

function render() {
  const l = levelOf(state.total);
  if (l !== level) {
    const up = level >= 0 && l > level;
    level = l;
    for (let i = 1; i < RANKS.length; i++) stage.classList.toggle("l" + i, i <= l);
    ladderEls.forEach((el, i) => { el.classList.toggle("on", i <= l); el.classList.toggle("now", i === l); });
    $("rank").textContent = RANKS[l][1];
    $("mult").textContent = `×${fmt(levelMult(l))} de nível`;
    if (up) levelUp(l);
  }
  $("count").textContent = fmt(state.aura);
  $("gain").textContent = "+" + fmtShort(clickGain(state));
  $("rate").textContent = `+${fmtShort(passivePerSecond(state))}/s no automático`;
  const cur = RANKS[level][0], nxt = RANKS[level + 1];
  $("bar").style.width = nxt ? Math.min(100, (state.total - cur) / (nxt[0] - cur) * 100) + "%" : "100%";

  for (const it of shopItems) {
    const maxed = isMaxed(state, it.u.id);
    it.owned.textContent = state.upgrades[it.u.id] ? `nv. ${state.upgrades[it.u.id]}` : "";
    it.cost.textContent = maxed ? "máximo" : fmtShort(costOf(state, it.u.id)) + " de aura";
    it.btn.disabled = !canBuy(state, it.u.id);
  }
  save(state);
}

function farm(ev?: MouseEvent) {
  const { gain, crit } = click(state);
  const rect = mascot.getBoundingClientRect();
  const x = ev?.clientX || rect.left + rect.width / 2;
  const y = ev?.clientY || rect.top + rect.height / 3;
  fx.burst(x, y, "+" + fmtShort(gain) + (crit ? " CRÍTICO" : ""), level >= 4 ? 24 : 14);
  if (level >= 7 && !reduceMotion) replay(stage, "shake");
  render();
}

// aura passiva: o Clawd (e os auxiliares) farmam sozinhos
setInterval(() => { earn(state, passivePerTick(state)); render(); }, TICK_MS);

$("farm").addEventListener("click", farm);
mascot.addEventListener("click", farm);
mascot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); farm(); } });
$("reset").addEventListener("click", () => {
  if (!confirm("Zerar toda a aura e os upgrades? Não dá para desfazer.")) return;
  state.aura = state.total = 0;
  for (const u of UPGRADES) state.upgrades[u.id] = 0;
  render();
});
function setShopOpen(open: boolean) {
  $("shop").classList.toggle("open", open);
  $("shop-toggle").setAttribute("aria-expanded", String(open));
}
$("shop-toggle").addEventListener("click", () => setShopOpen(!$("shop").classList.contains("open")));
$("shop-close").addEventListener("click", () => setShopOpen(false));

render();
