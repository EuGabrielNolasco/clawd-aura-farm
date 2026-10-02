import "./style.css";
import { ACHIEVEMENTS, checkAchievements } from "./achievements";
import { COSMETICS, cosmeticById, SLOTS, type Slot } from "./cosmetics";
import {
  allMaxed, applyEvent, buffActive, canBuy, canPrestige, clickGain, comboFor, costOf, daily, EV,
  goldenVisible, isMaxed, LEVEL_BONUS, levelOf, LV, nowSec, parseEvents, passive, passivePerSecond,
  PRESTIGE_BONUS, RANKS, schedule, thiefVisible, THIEF, todayBR, UPGRADES, type State,
} from "./game";
import { createFx, reduceMotion } from "./fx";
import { clawdSvg } from "./mini";
import { createSync, onlineEnabled, toState, type RankRow, type ServerState } from "./online";
import { sfx, setMuted } from "./sound";
import { load, loadMuted, player, sanitize, save, saveMuted } from "./storage";

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

// ===== avisos em fila, para um não apagar o outro =====
const toasts: string[] = [];
let toastBusy = false;
function toast(msg: string) {
  toasts.push(msg);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const t = $("toast"), msg = toasts.shift();
  if (!msg) { toastBusy = false; t.classList.remove("show"); return; }
  toastBusy = true;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(nextToast, 3800);
}

// ===== relógio: no online, o do servidor manda =====
let clockOffset = 0;
const now = () => nowSec() + clockOffset;

// ===== combo: cliques nos últimos 2 s =====
const clickTimes: number[] = [];
function combo() {
  const t = performance.now();
  while (clickTimes.length && t - clickTimes[0] > 2000) clickTimes.shift();
  return comboFor(clickTimes.length / 2);
}

// ===== online: o servidor é a fonte da verdade =====
let lastRank: number | null = null;
let lastAhead: ServerState["ahead"] = null;
let myName: string | null = null;

const sync = onlineEnabled ? createSync(player(), onServer, ok => {
  $("net").textContent = ok ? "Conectado: sua aura conta no ranking." : "Sem conexão. Seu progresso é enviado quando a conexão voltar.";
}) : null;
let firstSync = true;

function onServer(r: ServerState, pending: string) {
  clockOffset = r.now - nowSec();
  state = toState(r);
  for (const [c, a] of parseEvents(pending)) applyEvent(state, c, a, combo(), now());
  if (firstSync && r.offline >= 60) welcomeBack(r.offline, r.offline_gain);
  if (r.daily > 0) dailyReward(r.daily, state.streak);
  for (const id of r.new_achievements ?? []) achievementUnlocked(id);
  firstSync = false;

  myName = r.name;
  if (r.name && lastRank && r.rank && r.rank < lastRank && lastAhead) {
    toast(`🚀 Você passou ${lastAhead.name}! Agora é #${r.rank} no ranking.`);
    sfx.overtake();
  }
  lastRank = r.rank;
  lastAhead = r.ahead;
  $("my-rank").textContent = r.name
    ? `Você é ${r.name}, em #${r.rank} com ${fmtShort(state.lifetime)} de aura vitalícia.`
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

function dailyReward(tokens: number, streak: number) {
  toast(`🔥 Sequência de ${streak} ${streak === 1 ? "dia" : "dias"}! +${tokens} Fichas 67 pelo login de hoje.`);
  sfx.daily();
}

function achievementUnlocked(id: string) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  toast(`🎖 Conquista: ${a.name} (+${a.reward} fichas)`);
  sfx.achievement();
}

/** Aplica um evento local e, no modo online, manda para o servidor. */
function act(code: string, arg = "") {
  const r = applyEvent(state, code, arg, combo(), now());
  sync?.push(code + arg);
  return r;
}

// ===== montagem da tela =====
for (let i = 0; i < 3; i++) $("clones").appendChild($("clawd").cloneNode(true) as Element).removeAttribute("id");
for (const g of $("clones").querySelectorAll("[id]")) g.removeAttribute("id");

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
  if (l === LV.megaBrain) { sfx.megaBrain(); replay(stage, "jarvis-flash"); }
  else if (l === LV.coopThief) { sfx.levelUp(l); sfx.thiefSpawn(); }
  else sfx.levelUp(l);
  const r = mascot.getBoundingClientRect();
  fx.burst(r.left + r.width / 2, r.top + r.height / 2, null, 20 + l * 3);
  replay($("star"), "nudge");
}

// ===== enfeites no Clawd =====
let appliedLook = "";
function applyCosmetics() {
  const look = JSON.stringify(state.equipped);
  if (look === appliedLook) return;
  appliedLook = look;
  const get = (slot: Slot) => (state.equipped[slot] ? cosmeticById(state.equipped[slot]!) : undefined);
  for (const c of COSMETICS) if (c.bgClass) stage.classList.remove(c.bgClass);
  const bg = get("bg");
  if (bg?.bgClass) stage.classList.add(bg.bgClass);
  const color = get("color");
  stage.classList.toggle("has-color", Boolean(color));
  if (color?.fill) stage.style.setProperty("--body", color.fill);
  for (const slot of ["hat", "face", "outfit"] as const) {
    $(`cos-${slot}`).innerHTML = get(slot)?.svg ?? ""; // desenho do catálogo, nunca texto do servidor
    stage.classList.toggle(`has-${slot}`, Boolean(get(slot)));
  }
  $("cos-preview").innerHTML = clawdSvg(state.equipped);
}

// ===== eventos na tela: Cérebro Dourado e ladrão =====
let goldenShown = false, thiefShown = false;
function updateEvents() {
  const t = now();
  const g = goldenVisible(state, t);
  if (g !== goldenShown) {
    goldenShown = g;
    const el = $("golden");
    el.hidden = !g;
    if (g) {
      el.style.top = 15 + Math.random() * 45 + "%";
      replay(el, "fly");
      sfx.goldenSpawn();
    }
  }
  const th = thiefVisible(state, t);
  if (th !== thiefShown) {
    thiefShown = th;
    $("thief").hidden = !th;
    if (th) { replay($("thief"), "run"); sfx.thiefSpawn(); }
  }
  const buffed = buffActive(state, t);
  stage.classList.toggle("megabrain", buffed);
  $("jarvis-time").textContent = buffed ? `×7 em toda a aura · ${Math.ceil(state.buffUntil - t)} s` : "";
}

$("golden").addEventListener("click", () => {
  act(EV.golden);
  $("golden").hidden = true;
  if (buffActive(state, now())) {
    sfx.megaBrain();
    const b = $("banner");
    b.innerHTML = `<small>JARVIS, ATIVAR</small>MEGA BRAIN`;
    replay(b, "show");
    fx.flash();
    toast("🧠 Modo Mega Brain: ×7 em toda a aura por 67 segundos!");
  }
  render();
});

$("thief").addEventListener("click", () => {
  const before = state.tokens;
  act(EV.thief);
  $("thief").hidden = true;
  if (state.tokens > before) {
    sfx.thiefCaught();
    toast(`🦹 Pegou o ladrão! +${THIEF.tokens} Fichas 67.`);
  }
  render();
});

function render() {
  const l = levelOf(state.total);
  if (l !== level) {
    const up = level >= 0 && l > level;
    level = l;
    for (let i = 1; i < RANKS.length; i++) stage.classList.toggle("l" + i, i <= l);
    ladderEls.forEach((el, i) => { el.classList.toggle("on", i <= l); el.classList.toggle("now", i === l); });
    // no celular a escada rola de lado: centraliza o nível atual sem mexer na rolagem da página
    const ladder = $("ladder"), now = ladderEls[l];
    ladder.scrollLeft = now.offsetLeft - (ladder.clientWidth - now.clientWidth) / 2;
    $("rank").textContent = RANKS[l][1];
    if (up) levelUp(l);
  }
  const bonus = LEVEL_BONUS ** l * (1 + PRESTIGE_BONUS * state.prestige);
  $("mult").textContent = `×${bonus.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} de bônus` + (state.prestige ? ` · ⭐×${state.prestige}` : "");
  $("count").textContent = fmt(state.aura);
  $("gain").textContent = "+" + fmtShort(clickGain(state));
  $("rate").textContent = `+${fmtShort(passivePerSecond(state) * (buffActive(state, now()) ? 7 : 1))}/s no automático`;
  const cur = RANKS[level][0], nxt = RANKS[level + 1];
  $("bar").style.width = nxt ? Math.min(100, (state.total - cur) / (nxt[0] - cur) * 100) + "%" : "100%";
  $("next").textContent = nxt ? `Próximo nível: ${fmtShort(nxt[0])} de aura total` : "Nível máximo! Renasça para ganhar +25% para sempre.";
  $("tokens").textContent = `🎟 ${state.tokens} ${state.tokens === 1 ? "ficha" : "fichas"}`;
  $("prestige").hidden = !canPrestige(state);

  const ahead = $("ahead");
  ahead.hidden = !sync || !myName;
  if (!ahead.hidden) {
    ahead.textContent = lastAhead
      ? `Faltam ${fmtShort(Math.max(0, lastAhead.lifetime - state.lifetime))} para passar ${lastAhead.name} (#${lastAhead.rank})`
      : "👑 Você é o #1 do ranking!";
  }

  const c = combo();
  $("combo-bar").style.width = ((c - 1) / 2) * 100 + "%";
  $("combo-text").textContent = `COMBO ×${c.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;
  $("combo").classList.toggle("hot", c >= 2);

  for (const it of shopItems) {
    const n = state.upgrades[it.u.id];
    it.owned.textContent = `${n}/${it.u.max}`;
    it.cost.textContent = isMaxed(state, it.u.id) ? "completo" : fmtShort(costOf(state, it.u.id)) + " de aura";
    it.btn.classList.toggle("maxed", isMaxed(state, it.u.id));
    it.btn.setAttribute("aria-disabled", String(!canBuy(state, it.u.id)));
  }
  applyCosmetics();
  updateEvents();
  if (menu.open) renderMenu();
  if (!sync) save(state);
}

function farm(ev?: MouseEvent) {
  clickTimes.push(performance.now());
  const r = act(EV.click)!;
  const rect = mascot.getBoundingClientRect();
  const x = ev?.clientX || rect.left + rect.width / 2;
  const y = ev?.clientY || rect.top + rect.height / 3;
  fx.burst(x, y, "+" + fmtShort(r.gain) + (r.crit ? " CRÍTICO" : ""), level >= LV.auraInfinita ? 24 : 14);
  if (r.crit) sfx.crit(); else sfx.click(combo());
  if (level >= LV.deus && !reduceMotion) replay(stage, "shake");
  render();
}

// ===== modo local: o navegador faz o papel do servidor =====
function localTick() {
  schedule(state, now());
  const reward = daily(state, todayBR());
  if (reward) dailyReward(reward, state.streak);
  for (const a of checkAchievements(state, levelOf(state.total), allMaxed(state))) achievementUnlocked(a.id);
}

// aura passiva local, para o contador andar suave; no online o servidor corrige a cada sincronização
let lastTick = performance.now();
setInterval(() => {
  const t = performance.now();
  passive(state, (t - lastTick) / 1000, now());
  lastTick = t;
  if (!sync) localTick();
  render();
}, 250);

// ===== controles =====
$("farm").addEventListener("click", farm);
mascot.addEventListener("click", farm);
mascot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); farm(); } });

$("reset").addEventListener("click", () => {
  if (!confirm("Zerar a aura e os upgrades desta vida? Fichas, enfeites, conquistas e o ranking continuam. Não dá para desfazer.")) return;
  act(EV.reset);
  render();
});

$("prestige").addEventListener("click", () => {
  if (!confirm(`Renascer? Você volta para NPC sem upgrades, mas ganha +25% de aura para sempre (fica ⭐×${state.prestige + 1}). Fichas, enfeites e ranking continuam.`)) return;
  act(EV.prestige);
  sfx.prestige();
  const b = $("banner");
  b.innerHTML = `<small>RENASCEU</small>⭐ × ${state.prestige}`;
  replay(b, "show");
  fx.flash();
  render();
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

// ===== menu: ranking, conquistas e enfeites =====
const menu = $<HTMLDialogElement>("menu");
let tab = "ach";
let list: "around" | "top" = "around";

function openMenu(t: string) {
  tab = t;
  renderedMenu = "";
  if (!menu.open) menu.showModal();
  renderMenu();
  if (t === "ranking") void loadRanking();
}
for (const b of document.querySelectorAll<HTMLElement>(".menu-open, .tabs [data-tab]")) {
  b.addEventListener("click", () => openMenu(b.dataset.tab!));
}
$("menu-close").addEventListener("click", () => menu.close());

let renderedMenu = "";
function renderMenu() {
  for (const b of document.querySelectorAll<HTMLElement>(".tabs [data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  for (const p of document.querySelectorAll<HTMLElement>("[data-panel]")) p.hidden = p.dataset.panel !== tab;
  // só redesenha quando algo que aparece no menu mudou
  const key = JSON.stringify([tab, state.tokens, state.achievements, state.owned, state.equipped]);
  if (key === renderedMenu) return;
  renderedMenu = key;
  if (tab === "ach") renderAchievements();
  if (tab === "cos") renderCosmetics();
}

function renderAchievements() {
  $("ach-summary").textContent = `${state.achievements.length} de ${ACHIEVEMENTS.length} conquistas · cada uma dá Fichas 67.`;
  $("ach-list").replaceChildren(...ACHIEVEMENTS.map(a => {
    const done = state.achievements.includes(a.id);
    const li = document.createElement("li");
    li.className = done ? "done" : "";
    li.innerHTML = `<span class="medal">${done ? "🎖" : "🔒"}</span><span><b></b><small></small></span><em></em>`;
    li.querySelector("b")!.textContent = a.name;
    li.querySelector("small")!.textContent = a.desc;
    li.querySelector("em")!.textContent = `+${a.reward} 🎟`;
    return li;
  }));
}

function renderCosmetics() {
  $("cos-tokens").textContent = String(state.tokens);
  $("cos-preview").innerHTML = clawdSvg(state.equipped);
  $("cos-list").replaceChildren(...SLOTS.map(slot => {
    const group = document.createElement("div");
    group.className = "cos-group";
    const h = document.createElement("h3");
    h.textContent = slot.name;
    const row = document.createElement("div");
    row.className = "cos-row";
    for (const c of COSMETICS.filter(x => x.slot === slot.id)) {
      const owned = state.owned.includes(c.id), on = state.equipped[c.slot] === c.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cos-item" + (on ? " on" : "") + (owned ? " owned" : "");
      btn.innerHTML = `<span class="cos-thumb"></span><b></b><small></small>`;
      btn.querySelector(".cos-thumb")!.innerHTML = c.bgClass ? `<span class="bg-swatch ${c.bgClass}"></span>` : clawdSvg({ [c.slot]: c.id });
      btn.querySelector("b")!.textContent = c.name;
      btn.querySelector("small")!.textContent = on ? "equipado ✓" : owned ? "equipar" : `${c.price} 🎟`;
      btn.addEventListener("click", () => {
        if (on) { act(EV.unequip, slot.code); sfx.equip(); }
        else if (owned) { act(EV.equip, c.code); sfx.equip(); }
        else if (state.tokens >= c.price) {
          act(EV.buyCosmetic, c.code);
          act(EV.equip, c.code);
          sfx.cosmetic();
          toast(`👕 ${c.name} comprado e equipado!`);
        } else { sfx.denied(); toast(`Faltam ${c.price - state.tokens} Fichas 67 para ${c.name}.`); }
        render();
      });
      row.append(btn);
    }
    group.append(h, row);
    return group;
  }));
}

function rankRow(e: RankRow) {
  const li = document.createElement("li");
  if (e.me) li.className = "me";
  const pos = document.createElement("span"), pic = document.createElement("span"), name = document.createElement("span"), aura = document.createElement("b");
  pos.className = "pos";
  pos.textContent = `#${e.rank}`;
  pic.className = "pic";
  // enfeites de outro jogador: valida contra o catálogo antes de desenhar
  pic.innerHTML = clawdSvg(sanitize({ owned: Object.values(e.equipped ?? {}), equipped: e.equipped }).equipped);
  name.textContent = e.name + (e.prestige ? ` ⭐${e.prestige}` : ""); // textContent: apelidos nunca viram HTML
  aura.textContent = fmtShort(e.lifetime);
  li.append(pos, pic, name, aura);
  return li;
}

async function loadRanking() {
  const ol = $("top");
  for (const b of document.querySelectorAll<HTMLElement>(".subtabs [data-list]")) b.classList.toggle("on", b.dataset.list === list);
  ol.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Carregando…" }));
  try {
    const rows = list === "top" ? await sync!.top() : await sync!.around();
    if (!rows.length) {
      ol.replaceChildren(Object.assign(document.createElement("li"), {
        textContent: list === "around" ? "Escolha um apelido para ver quem está perto de você." : "Ninguém ainda. Seja o primeiro!",
      }));
      return;
    }
    ol.replaceChildren(...rows.map(rankRow));
  } catch {
    ol.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Não foi possível carregar o ranking." }));
  }
}
for (const b of document.querySelectorAll<HTMLElement>(".subtabs [data-list]")) {
  b.addEventListener("click", () => { list = b.dataset.list as typeof list; void loadRanking(); });
}

if (sync) {
  $("ranking-open").hidden = false;
  $("tab-ranking").hidden = false;
  $<HTMLFormElement>("name-form").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("name-msg");
    msg.textContent = "Salvando…";
    try {
      await sync.setName($<HTMLInputElement>("name").value);
      msg.textContent = "Apelido salvo!";
      await sync.flush();
      void loadRanking();
    } catch (err) {
      msg.textContent = (err as Error).message;
    }
  });
  void sync.flush();
} else {
  // modo local: credita o tempo fora, com o mesmo teto do servidor
  if (saved.away >= 60) {
    const before = state.total;
    passive(state, saved.away, now());
    welcomeBack(saved.away, state.total - before);
  }
  localTick();
}

render();

if (import.meta.env.DEV) {
  void import("./dev").then(m => m.mountDev({
    state: () => state,
    render,
    toast,
    now,
    pauseSync: sync ? () => sync.pause() : null,
  }));
}
