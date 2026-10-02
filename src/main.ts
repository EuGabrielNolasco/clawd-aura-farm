import "./style.css";
import {
  allMaxed, applyEvent, canBuy, CLICK_CODE, clickGain, costOf, isMaxed, LEVEL_BONUS, levelOf,
  LV, newState, passive, passivePerSecond, RANKS, UPGRADES, type State,
} from "./game";
import { createFx, reduceMotion } from "./fx";
import { createSync, onlineEnabled, toState, type ServerState } from "./online";
import { sfx, setMuted } from "./sound";
import { load, loadMuted, player, save, saveMuted } from "./storage";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage"), mascot = $("mascot");

const saved = load();
let state: State = saved.state;
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

let toastTimer = 0;
function toast(msg: string) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove("show"), 4500);
}

// ===== online: o servidor é a fonte da verdade =====
const sync = onlineEnabled ? createSync(player(), onServer, ok => {
  $("net").textContent = ok ? "Conectado: sua aura conta no ranking." : "Sem conexão. Seu progresso é enviado quando a conexão voltar.";
}) : null;
let firstSync = true;

function onServer(r: ServerState, pending: string) {
  state = toState(r);
  for (const c of pending) applyEvent(state, c);
  if (firstSync && r.offline >= 60) welcomeBack(r.offline, r.offline_gain);
  firstSync = false;
  $("my-rank").textContent = r.name
    ? `Você é ${r.name}, em #${r.rank} com recorde de ${fmtShort(r.best)}.`
    : "Escolha um apelido para aparecer no ranking.";
  if (r.name && !$<HTMLInputElement>("name").value) $<HTMLInputElement>("name").value = r.name;
  render();
}

function welcomeBack(seconds: number, gained: number) {
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60);
  const time = h ? `${h} h ${m} min` : `${m} min`;
  toast(`Bem-vindo de volta! Em ${time} fora, o Clawd farmou +${fmtShort(gained)} de aura.`);
  sfx.welcome();
}

/** Aplica um evento local e, no modo online, manda para o servidor. */
function act(code: string) {
  const r = applyEvent(state, code);
  sync?.push(code);
  return r;
}

// ===== montagem da tela =====
for (let i = 0; i < 3; i++) $("clones").appendChild($("clawd").cloneNode(true) as Element).removeAttribute("id");

$("ladder").innerHTML = RANKS.map(([, n]) => `<span>${n}</span>`).join("");
const ladderEls = [...$("ladder").children] as HTMLElement[];

const shopItems = UPGRADES.map(u => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "item";
  btn.innerHTML = `<span class="item-name">${u.name} <em></em></span><span class="item-desc">${u.desc}</span><span class="item-cost"></span>`;
  btn.addEventListener("click", () => {
    if (!canBuy(state, u.id)) { sfx.denied(); return; }
    act(u.code);
    sfx.buy();
    const r = btn.getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top, null, 10);
    if (allMaxed(state)) toast("Loja completa! Você comprou tudo. Lenda absoluta do 6-7.");
    render();
  });
  $("shop-items").appendChild(btn);
  return { u, btn, owned: btn.querySelector("em")!, cost: btn.querySelector<HTMLElement>(".item-cost")! };
});

function levelUp(l: number) {
  const b = $("banner");
  b.innerHTML = `<small>SUBIU DE NÍVEL</small>${RANKS[l][1]}`;
  replay(b, "show");
  fx.flash();
  sfx.levelUp();
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
    $("mult").textContent = `×${(LEVEL_BONUS ** l).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} de nível`;
    if (up) levelUp(l);
  }
  $("count").textContent = fmt(state.aura);
  $("gain").textContent = "+" + fmtShort(clickGain(state));
  $("rate").textContent = `+${fmtShort(passivePerSecond(state))}/s no automático`;
  const cur = RANKS[level][0], nxt = RANKS[level + 1];
  $("bar").style.width = nxt ? Math.min(100, (state.total - cur) / (nxt[0] - cur) * 100) + "%" : "100%";
  $("next").textContent = nxt ? `Próximo nível: ${fmtShort(nxt[0])} de aura total` : "Nível máximo!";

  for (const it of shopItems) {
    const n = state.upgrades[it.u.id];
    it.owned.textContent = `${n}/${it.u.max}`;
    it.cost.textContent = isMaxed(state, it.u.id) ? "completo" : fmtShort(costOf(state, it.u.id)) + " de aura";
    it.btn.classList.toggle("maxed", isMaxed(state, it.u.id));
    it.btn.setAttribute("aria-disabled", String(!canBuy(state, it.u.id)));
  }
  if (!sync) save(state);
}

function farm(ev?: MouseEvent) {
  const r = act(CLICK_CODE)!;
  const rect = mascot.getBoundingClientRect();
  const x = ev?.clientX || rect.left + rect.width / 2;
  const y = ev?.clientY || rect.top + rect.height / 3;
  fx.burst(x, y, "+" + fmtShort(r.gain) + (r.crit ? " CRÍTICO" : ""), level >= LV.auraInfinita ? 24 : 14);
  if (r.crit) sfx.crit(); else sfx.click();
  if (level >= LV.deus && !reduceMotion) replay(stage, "shake");
  render();
}

// aura passiva local, para o contador andar suave; no online o servidor corrige a cada sincronização
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  passive(state, (now - lastTick) / 1000);
  lastTick = now;
  render();
}, 250);

// ===== controles =====
$("farm").addEventListener("click", farm);
mascot.addEventListener("click", farm);
mascot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); farm(); } });

$("reset").addEventListener("click", async () => {
  const msg = sync ? "Zerar a aura e os upgrades? Seu recorde continua no ranking. Não dá para desfazer."
    : "Zerar toda a aura e os upgrades? Não dá para desfazer.";
  if (!confirm(msg)) return;
  state = newState(state.rng);
  render();
  try { await sync?.reset(); } catch { toast("Não deu para zerar no servidor. Tente de novo."); }
});

function setShopOpen(open: boolean) {
  $("shop").classList.toggle("open", open);
  $("shop-toggle").setAttribute("aria-expanded", String(open));
}
$("shop-toggle").addEventListener("click", () => setShopOpen(!$("shop").classList.contains("open")));
$("shop-close").addEventListener("click", () => setShopOpen(false));

let muted = loadMuted();
function applyMute() {
  setMuted(muted);
  $("mute").textContent = muted ? "🔇" : "🔊";
  $("mute").setAttribute("aria-label", muted ? "Ligar som" : "Desligar som");
  $("mute").setAttribute("aria-pressed", String(muted));
}
$("mute").addEventListener("click", () => { muted = !muted; saveMuted(muted); applyMute(); });
applyMute();

// ===== ranking =====
const dialog = $<HTMLDialogElement>("ranking");
async function showTop() {
  const list = $("top");
  list.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Carregando…" }));
  try {
    const top = await sync!.top();
    list.replaceChildren(...(top.length ? top : [{ name: "Ninguém ainda. Seja o primeiro!", best: 0 }]).map(e => {
      const li = document.createElement("li");
      const name = document.createElement("span"), best = document.createElement("b");
      name.textContent = e.name; // textContent: apelidos nunca viram HTML
      best.textContent = e.best ? fmtShort(e.best) : "";
      li.append(name, best);
      return li;
    }));
  } catch {
    list.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Não foi possível carregar o ranking." }));
  }
}

if (sync) {
  $("ranking-open").hidden = false;
  $("ranking-open").addEventListener("click", () => { dialog.showModal(); void showTop(); });
  $("ranking-close").addEventListener("click", () => dialog.close());
  $<HTMLFormElement>("name-form").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("name-msg");
    msg.textContent = "Salvando…";
    try {
      await sync.setName($<HTMLInputElement>("name").value);
      msg.textContent = "Apelido salvo!";
      await sync.flush();
      void showTop();
    } catch (err) {
      msg.textContent = (err as Error).message;
    }
  });
  void sync.flush();
} else if (saved.away >= 60) {
  // modo local: credita o tempo fora, com o mesmo teto do servidor
  const before = state.total;
  passive(state, saved.away);
  welcomeBack(saved.away, state.total - before);
}

render();

if (import.meta.env.DEV) {
  void import("./dev").then(m => m.mountDev({
    state: () => state,
    render,
    toast,
    pauseSync: sync ? () => sync.pause() : null,
  }));
}
