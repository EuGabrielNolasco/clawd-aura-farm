import "./style.css";
import { ACHIEVEMENTS, achievementProgress, checkAchievements } from "./achievements";
import { COSMETICS, cosmeticById, SLOTS, type Slot } from "./cosmetics";
import {
  allMaxed, applyEvent, buffActive, canBuy, canPrestige, clickGain, comboFor, costOf, daily, EV,
  goldenVisible, isMaxed, LEVEL_BONUS, levelOf, LV, mult, nowSec, parseEvents, passive, passivePerSecond,
  PRESTIGE_BONUS, RANKS, schedule, thiefVisible, THIEF, todayBR, UPGRADES, type State,
} from "./game";
import { createFx, reduceMotion } from "./fx";
import { clawdSvg } from "./mini";
import { createSync, onlineEnabled, toState, type RankRow, type ServerState } from "./online";
import { sfx, setMuted } from "./sound";
import {
  clearGoogleAccount, exportSaveJson, getGoogleClientId, importSaveJson,
  load, loadGoogleAccount, loadGoogleAccountVault, loadMuted,
  player, sanitize, save, saveGoogleAccount, saveGoogleAccountVault,
  saveMuted, savePlayer, type Player,
} from "./storage";
import { addSpin, loadSpins, renderWheelSvg, spinWheel } from "./wheel";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage"), mascot = $("mascot");

const saved = load();
let state: State = saved.state;
let level = -1;
let activePlayer: Player = player();
let spinsState = loadSpins(todayBR());
let wheelRot = 0;
let isSpinning = false;

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

const sync = onlineEnabled ? createSync(activePlayer, onServer, ok => {
  $("net").textContent = ok ? "Conectado: sua aura conta no ranking." : "Sem conexão. Seu progresso é enviado quando a conexão voltar.";
  const st = $("acc-status");
  if (st) st.textContent = ok ? "🟢 Conectado na Nuvem" : "🟡 Sem conexão com o servidor";
}) : null;
let firstSync = true;

const LOCAL_COS_KEY = "clawd-aura-farm:cos-v1";
interface LocalCosState {
  owned: string[];
  equipped: Partial<Record<Slot, string | null>>;
  localBought: string[];
  name?: string | null;
}
function loadLocalCos(): LocalCosState {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_COS_KEY) || "null");
    if (raw && typeof raw === "object") {
      return {
        owned: Array.isArray(raw.owned) ? raw.owned.filter((x: unknown): x is string => typeof x === "string") : [],
        equipped: raw.equipped && typeof raw.equipped === "object" ? raw.equipped : {},
        localBought: Array.isArray(raw.localBought) ? raw.localBought.filter((x: unknown): x is string => typeof x === "string") : [],
        name: typeof raw.name === "string" ? raw.name : null,
      };
    }
  } catch { /* ignore */ }
  return { owned: [...state.owned], equipped: { ...state.equipped }, localBought: [], name: null };
}
function saveLocalCos(lc: LocalCosState) {
  try { localStorage.setItem(LOCAL_COS_KEY, JSON.stringify(lc)); } catch { /* ignore */ }
}
const localCos = loadLocalCos();
if (localCos.name) myName = localCos.name;

const LOCAL_EXT_KEY = "clawd-aura-farm:ext-ups-v1";
interface LocalExtState {
  ia: number;
  portal: number;
  cosmic: number;
  bonusAura: number;
  spentAura: number;
}
function loadLocalExt(): LocalExtState {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_EXT_KEY) || "null");
    if (raw && typeof raw === "object") {
      return {
        ia: Math.max(0, Math.floor(Number(raw.ia) || 0)),
        portal: Math.max(0, Math.floor(Number(raw.portal) || 0)),
        cosmic: Math.max(0, Math.floor(Number(raw.cosmic) || 0)),
        bonusAura: Math.max(0, Number(raw.bonusAura) || 0),
        spentAura: Math.max(0, Number(raw.spentAura) || 0),
      };
    }
  } catch { /* ignore */ }
  return { ia: state.upgrades.ia, portal: state.upgrades.portal, cosmic: state.upgrades.cosmic, bonusAura: 0, spentAura: 0 };
}
function saveLocalExt(ext: LocalExtState) {
  try { localStorage.setItem(LOCAL_EXT_KEY, JSON.stringify(ext)); } catch { /* ignore */ }
}
const localExt = loadLocalExt();
state.upgrades.ia = Math.max(state.upgrades.ia, localExt.ia);
state.upgrades.portal = Math.max(state.upgrades.portal, localExt.portal);
state.upgrades.cosmic = Math.max(state.upgrades.cosmic, localExt.cosmic);

function enforceLocalCosmetics(serverOwned?: string[]) {
  for (const id of localCos.owned) {
    if (!state.owned.includes(id) && cosmeticById(id)) {
      state.owned.push(id);
    }
  }
  if (serverOwned) {
    for (const id of localCos.localBought) {
      if (!serverOwned.includes(id) && cosmeticById(id)) {
        const price = cosmeticById(id)?.price ?? 0;
        state.tokens = Math.max(0, state.tokens - price);
      }
    }
  }
  for (const [slot, val] of Object.entries(localCos.equipped) as [Slot, string | null | undefined][]) {
    if (val === null) {
      delete state.equipped[slot];
    } else if (val && state.owned.includes(val) && cosmeticById(val)) {
      state.equipped[slot] = val;
    }
  }
}

enforceLocalCosmetics();
if (myName) sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>);
let nameInputPrefilled = false;
let settingName = false;

function onServer(r: ServerState, pending: string) {
  clockOffset = r.now - nowSec();
  const prevState = state;
  state = toState(r);

  if (r.ups.length < 8) {
    state.upgrades.ia = Math.max(state.upgrades.ia, localExt.ia);
    state.upgrades.portal = Math.max(state.upgrades.portal, localExt.portal);
    state.upgrades.cosmic = Math.max(state.upgrades.cosmic, localExt.cosmic);
    state.aura = Math.max(0, state.aura + localExt.bonusAura - localExt.spentAura);
    state.total += localExt.bonusAura;
    state.lifetime += localExt.bonusAura;
  }

  // Se o progresso local for maior (ex: jogou offline ou restaurou backup), preserva os maiores valores
  if (prevState.lifetime > state.lifetime) {
    state.aura = Math.max(state.aura, prevState.aura);
    state.total = Math.max(state.total, prevState.total);
    state.lifetime = Math.max(state.lifetime, prevState.lifetime);
    state.prestige = Math.max(state.prestige, prevState.prestige);
    state.tokens = Math.max(state.tokens, prevState.tokens);
    for (const u of UPGRADES) {
      state.upgrades[u.id] = Math.max(state.upgrades[u.id], prevState.upgrades[u.id]);
    }
    for (const a of prevState.achievements) {
      if (!state.achievements.includes(a)) state.achievements.push(a);
    }
  }

  enforceLocalCosmetics(r.owned ?? []);

  for (const [c, a] of parseEvents(pending)) applyEvent(state, c, a, combo(), now());
  enforceLocalCosmetics();
  save(state);
  if (firstSync && r.offline >= 60) welcomeBack(r.offline, r.offline_gain);
  if (r.daily > 0) dailyReward(r.daily, state.streak);
  for (const id of r.new_achievements ?? []) achievementUnlocked(id);
  firstSync = false;

  if (r.name && !settingName) {
    myName = r.name;
    localCos.name = r.name;
    saveLocalCos(localCos);
  }
  sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>);
  if (r.name && lastRank && r.rank && r.rank < lastRank && lastAhead) {
    toast(`🚀 Você passou ${lastAhead.name}! Agora é #${r.rank} no ranking.`);
    sfx.overtake();
  }
  lastRank = r.rank;
  lastAhead = r.ahead;
  const displayNick = myName || r.name;
  const myLvl = levelOf(state.lifetime);
  const myPrest = state.prestige || 0;
  $("my-rank").textContent = displayNick
    ? `Você é ${displayNick} · #${r.rank ?? 1} · ${RANKS[myLvl][1]} · ⭐ ${myPrest} · ${fmtShort(state.lifetime)} de aura`
    : "Escolha um apelido abaixo para aparecer no ranking com seu Rank e suas Estrelas!";
  if (displayNick && !nameInputPrefilled) {
    nameInputPrefilled = true;
    const nameEl = $<HTMLInputElement>("name");
    if (nameEl && document.activeElement !== nameEl) nameEl.value = displayNick;
    const accNameEl = $<HTMLInputElement>("acc-name-input");
    if (accNameEl && document.activeElement !== accNameEl) accNameEl.value = displayNick;
  }
  render();
}

function welcomeBack(seconds: number, gained: number) {
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60);
  const time = h ? `${h} h ${m} min` : `${m} min`;
  toast(`Bem-vindo de volta! Em ${time} fora, o Clawd farmou +${fmtShort(gained)} de aura.`);
  sfx.welcome();
}

function updateWheelBadge() {
  const b = $("wheel-badge");
  if (b) {
    b.hidden = spinsState.spins <= 0;
    b.textContent = String(spinsState.spins);
  }
  const val = $("wheel-spins-val");
  if (val) val.textContent = String(spinsState.spins);
  const btn = $("wheel-spin-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = spinsState.spins <= 0 || isSpinning;
}

function dailyReward(tokens: number, streak: number) {
  toast(`🔥 Sequência de ${streak} ${streak === 1 ? "dia" : "dias"}! +${tokens} Fichas 67 pelo login de hoje.`);
  sfx.daily();
  spinsState.spins = addSpin();
  updateWheelBadge();
}

function achievementUnlocked(id: string) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  toast(`🎖 Conquista: ${a.name} (+${a.reward} fichas)`);
  sfx.achievement();
}

/** Aplica um evento local e, no modo online, manda para o servidor. */
function act(code: string, arg = "") {
  const prevAura = state.aura;
  const prevIa = state.upgrades.ia;
  const prevPortal = state.upgrades.portal;
  const prevCosmic = state.upgrades.cosmic;
  const r = applyEvent(state, code, arg, combo(), now());
  if (code === EV.prestige || code === EV.reset) {
    localExt.ia = 0;
    localExt.portal = 0;
    localExt.cosmic = 0;
    localExt.bonusAura = 0;
    localExt.spentAura = 0;
    saveLocalExt(localExt);
  } else if (code === "i" && state.upgrades.ia > prevIa) {
    localExt.ia = state.upgrades.ia;
    localExt.spentAura += prevAura - state.aura;
    saveLocalExt(localExt);
    save(state);
  } else if (code === "o" && state.upgrades.portal > prevPortal) {
    localExt.portal = state.upgrades.portal;
    localExt.spentAura += prevAura - state.aura;
    saveLocalExt(localExt);
    save(state);
  } else if (code === "x" && state.upgrades.cosmic > prevCosmic) {
    localExt.cosmic = state.upgrades.cosmic;
    saveLocalExt(localExt);
    save(state);
  } else if (code === EV.click && r && state.upgrades.portal > 0) {
    const portalShare = (1.0 * state.upgrades.portal) / (1 + 0.5 * state.upgrades.click + 1.0 * state.upgrades.portal);
    localExt.bonusAura += r.gain * portalShare;
    saveLocalExt(localExt);
  }
  if (code === EV.buyCosmetic || code === EV.equip || code === EV.unequip) {
    if (code === EV.buyCosmetic) {
      const bought = COSMETICS.find(x => x.code === arg);
      if (bought && state.owned.includes(bought.id) && !localCos.localBought.includes(bought.id)) {
        localCos.localBought.push(bought.id);
      }
    }
    for (const id of state.owned) {
      if (!localCos.owned.includes(id)) localCos.owned.push(id);
    }
    for (const sl of SLOTS) {
      localCos.equipped[sl.id] = state.equipped[sl.id] ?? null;
    }
    saveLocalCos(localCos);
    save(state);
    sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>);
  }
  sync?.push(code + arg);
  return r;
}

// ===== montagem da tela =====
for (let i = 0; i < 3; i++) $("clones").appendChild($("clawd").cloneNode(true) as Element).removeAttribute("id");
for (const g of $("clones").querySelectorAll("[id]")) g.removeAttribute("id");

$("ladder").innerHTML = RANKS.map(([, n]) => `<span>${n}</span>`).join("");
const ladderEls = [...$("ladder").children] as HTMLElement[];

const wheelSlices = $("wheel-slices");
if (wheelSlices) wheelSlices.innerHTML = renderWheelSvg();
updateWheelBadge();

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
  spinsState.spins = addSpin();
  updateWheelBadge();
  toast(`🎰 Nível ${RANKS[l][1]}! +1 giro grátis na Roleta da Sorte.`);
}


// ===== enfeites no Clawd =====
function applyBgClass(el: HTMLElement | null, bgId: string | undefined) {
  if (!el) return;
  for (const c of COSMETICS) if (c.bgClass) el.classList.remove(c.bgClass);
  const bg = bgId ? cosmeticById(bgId) : undefined;
  if (bg?.bgClass) el.classList.add(bg.bgClass);
}

let appliedLook = "";
function applyCosmetics() {
  const look = JSON.stringify(state.equipped);
  if (look === appliedLook) return;
  appliedLook = look;
  const get = (slot: Slot) => (state.equipped[slot] ? cosmeticById(state.equipped[slot]!) : undefined);
  applyBgClass(stage, state.equipped.bg);
  const color = get("color");
  stage.classList.toggle("has-color", Boolean(color));
  if (color?.fill) stage.style.setProperty("--body", color.fill);
  for (const slot of ["hat", "face", "outfit"] as const) {
    $(`cos-${slot}`).innerHTML = get(slot)?.svg ?? ""; // desenho do catálogo, nunca texto do servidor
    stage.classList.toggle(`has-${slot}`, Boolean(get(slot)));
  }
  const preview = $("cos-preview");
  applyBgClass(preview, state.equipped.bg);
  preview.innerHTML = clawdSvg(state.equipped);
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
    if ("vibrate" in navigator) navigator.vibrate([40, 50, 40]);
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
    if ("vibrate" in navigator) navigator.vibrate([40, 50, 40]);
    spinsState.spins = addSpin();
    updateWheelBadge();
    toast(`🦹 Pegou o ladrão! +${THIEF.tokens} Fichas 67 e +1 giro na Roleta!`);
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

  const currentCps = clickTimes.length / 2;
  const cpsEl = $("cps-text");
  if (cpsEl) cpsEl.textContent = `${currentCps.toFixed(1)} CPS`;

  for (const it of shopItems) {
    const n = state.upgrades[it.u.id];
    it.owned.textContent = `${n}/${it.u.max}`;
    it.cost.textContent = isMaxed(state, it.u.id) ? "completo" : fmtShort(costOf(state, it.u.id)) + " de aura";
    it.btn.classList.toggle("maxed", isMaxed(state, it.u.id));
    it.btn.setAttribute("aria-disabled", String(!canBuy(state, it.u.id)));
  }
  applyCosmetics();
  updateEvents();
  updateWheelBadge();
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
  if (r.crit) {
    sfx.crit();
    if ("vibrate" in navigator) navigator.vibrate(25);
  } else {
    sfx.click(combo());
    if ("vibrate" in navigator) navigator.vibrate(10);
  }
  if (level >= LV.deus && !reduceMotion) replay(stage, "shake");
  render();
}


// ===== modo local: o navegador faz o papel do servidor =====
function localTick() {
  schedule(state, now());
  const reward = daily(state, todayBR());
  if (reward) dailyReward(reward, state.streak);
  for (const a of checkAchievements(state, levelOf(state.total), allMaxed(state))) achievementUnlocked(a.id);
  const gAcc = loadGoogleAccount();
  if (gAcc) saveGoogleAccountVault(gAcc.email, activePlayer, state);
}

// aura passiva local, para o contador andar suave; no online o servidor corrige a cada sincronização
let lastTick = performance.now();
setInterval(() => {
  const t = performance.now();
  const dt = (t - lastTick) / 1000;
  passive(state, dt, now());
  if (state.upgrades.ia > 0 || state.upgrades.portal > 0) {
    const extraRate = (150000 * state.upgrades.ia + 5000000 * state.upgrades.portal) * mult(state) * (buffActive(state, now()) ? 7 : 1);
    localExt.bonusAura += extraRate * Math.min(dt, 10);
    saveLocalExt(localExt);
  }
  lastTick = t;
  if (!sync) localTick();
  render();
}, 250);

// ===== controles =====
$("farm").addEventListener("click", farm);
mascot.addEventListener("click", farm);
mascot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); farm(); } });

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

// ===== menu: conta, roleta, ranking, conquistas, enfeites, stats e guia =====
const menu = $<HTMLDialogElement>("menu");
let tab = "ach";
let list: "around" | "top" = "top";

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
$("menu-close").addEventListener("click", () => {
  if (menu.classList.contains("auth-required")) return;
  menu.close();
});
menu.addEventListener("cancel", e => {
  if (menu.classList.contains("auth-required")) e.preventDefault();
});

let renderedMenu = "";
function renderMenu() {
  for (const b of document.querySelectorAll<HTMLElement>(".tabs [data-tab]")) {
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  }
  for (const p of document.querySelectorAll<HTMLElement>("[data-panel]")) {
    p.hidden = p.dataset.panel !== tab;
  }
  // só redesenha quando algo que aparece no menu mudou
  const key = JSON.stringify([tab, state.tokens, state.achievements, state.owned, state.equipped, spinsState.spins, activePlayer.id, myName, lastRank]);
  if (key === renderedMenu) return;
  renderedMenu = key;
  if (tab === "account") renderAccount();
  if (tab === "wheel") updateWheelBadge();
  if (tab === "ach") renderAchievements();
  if (tab === "cos") renderCosmetics();
  if (tab === "stats") renderStats();
}

function renderAccount() {
  const avatar = $("acc-avatar");
  applyBgClass(avatar, state.equipped.bg);
  avatar.innerHTML = clawdSvg(state.equipped);
  const gAcc = loadGoogleAccount();
  $("acc-name").textContent = myName || gAcc?.name || "Jogador Anônimo";
  $("acc-status").textContent = sync ? "🟢 Sincronizado na Nuvem" : "🟡 Modo Local (Offline)";
  $("acc-id-short").textContent = "Conta Principal Preservada";
  $("acc-rank-label").textContent = lastRank ? `#${lastRank} no ranking` : (myName ? `Apelido: ${myName}` : "Sem apelido no ranking");

  const accNameInput = document.getElementById("acc-name-input") as HTMLInputElement | null;
  if (accNameInput && document.activeElement !== accNameInput && !accNameInput.value && myName) {
    accNameInput.value = myName;
  }

  const badge = $("acc-linked-badge");
  const signoutBtn = $("google-signout-btn");
  if (badge) {
    if (gAcc) {
      badge.hidden = false;
      badge.textContent = `✅ Conectado via Google OAuth 2.0: ${gAcc.email}`;
    } else {
      badge.hidden = true;
    }
  }
  if (signoutBtn) {
    signoutBtn.hidden = !gAcc;
  }
}

function renderStats() {
  const grid = $("stats-grid");
  if (!grid) return;
  const lvl = levelOf(state.total);
  const multVal = LEVEL_BONUS ** lvl * 2 ** state.upgrades.cosmic * (1 + PRESTIGE_BONUS * state.prestige);
  const critPct = state.clicks > 0 ? ((state.crits / state.clicks) * 100).toFixed(1) : "0.0";
  const totalBought = Object.values(state.upgrades).reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Aura Atual", val: fmtShort(state.aura) },
    { label: "Aura Vitalícia", val: fmtShort(state.lifetime) },
    { label: "Nível Atual", val: `${lvl} (${RANKS[lvl][1]})` },
    { label: "Multiplicador Total", val: `×${multVal.toFixed(2)}` },
    { label: "Prestígio", val: `⭐ ×${state.prestige}` },
    { label: "Cliques Totais", val: state.clicks.toLocaleString("pt-BR") },
    { label: "Críticos Desferidos", val: state.crits.toLocaleString("pt-BR") },
    { label: "Taxa Real de Crítico", val: `${critPct}%` },
    { label: "Cérebros Dourados", val: String(state.goldens) },
    { label: "Ladrões Capturados", val: String(state.thieves) },
    { label: "Sequência de Dias", val: `${state.streak} dias` },
    { label: "Fichas 67 Disponíveis", val: String(state.tokens) },
    { label: "Upgrades Comprados", val: `${totalBought}/190` },
    { label: "Conquistas Concluídas", val: `${state.achievements.length}/${ACHIEVEMENTS.length}` },
    { label: "Enfeites Possuídos", val: `${state.owned.length}/${COSMETICS.length}` },
    { label: "Sincronização", val: onlineEnabled ? "🟢 Supabase" : "🟡 Local" },
  ];

  grid.replaceChildren(...stats.map(s => {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<b>${s.val}</b><small>${s.label}</small>`;
    return div;
  }));
}

function renderAchievements() {
  $("ach-summary").textContent = `${state.achievements.length} de ${ACHIEVEMENTS.length} conquistas · cada uma dá Fichas 67.`;
  $("ach-list").replaceChildren(...ACHIEVEMENTS.map(a => {
    const done = state.achievements.includes(a.id);
    const prog = achievementProgress(a, state, levelOf(state.total), allMaxed(state));
    const li = document.createElement("li");
    li.className = done ? "done" : "";
    li.innerHTML = `
      <span class="medal">${done ? "🎖" : "🔒"}</span>
      <span>
        <b></b>
        <small></small>
        <div class="ach-prog"><i style="width: ${prog.pct}%"></i><span>${prog.label}</span></div>
      </span>
      <em></em>
    `;
    li.querySelector("b")!.textContent = a.name;
    li.querySelector("small")!.textContent = a.desc;
    li.querySelector("em")!.textContent = `+${a.reward} 🎟`;
    return li;
  }));
}

function renderCosmetics() {
  $("cos-tokens").textContent = String(state.tokens);
  const preview = $("cos-preview");
  applyBgClass(preview, state.equipped.bg);
  preview.innerHTML = clawdSvg(state.equipped);
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
  const isMe = Boolean(
    e.me ||
    (myName && e.name.toLowerCase() === myName.toLowerCase()) ||
    (lastRank !== null && e.rank === lastRank)
  );
  if (isMe) li.className = "me";

  const lvl = levelOf(e.lifetime);
  const rankTitle = RANKS[lvl][1];
  const rebirths = e.prestige || 0;

  const pos = document.createElement("span");
  pos.className = "pos";
  pos.textContent = `#${e.rank}`;

  const pic = document.createElement("span");
  pic.className = "pic";
  const serverEq = sanitize({ owned: Object.values(e.equipped ?? {}), equipped: e.equipped }).equipped;
  const eq: Partial<Record<Slot, string>> = isMe ? { ...serverEq, ...state.equipped } : serverEq;
  applyBgClass(pic, eq.bg);
  pic.innerHTML = clawdSvg(eq);

  const info = document.createElement("div");
  info.className = "rank-info";

  const topLine = document.createElement("div");
  topLine.className = "rank-line";
  const nameEl = document.createElement("span");
  nameEl.className = "rank-name";
  nameEl.textContent = isMe && myName ? myName : e.name;

  const starsEl = document.createElement("span");
  starsEl.className = "rank-stars";
  starsEl.title = `${rebirths} ${rebirths === 1 ? "renascimento" : "renascimentos"}`;
  starsEl.textContent = `⭐ ${rebirths}`;
  topLine.append(nameEl, starsEl);

  const subLine = document.createElement("div");
  subLine.className = "rank-sub";
  const badge = document.createElement("span");
  badge.className = `rank-badge lv-${lvl}`;
  badge.textContent = rankTitle;
  subLine.append(badge);

  info.append(topLine, subLine);

  const aura = document.createElement("b");
  aura.className = "rank-aura";
  aura.textContent = fmtShort(e.lifetime);

  li.append(pos, pic, info, aura);
  return li;
}

function renderRankDistribution(rows: RankRow[]) {
  const box = $("rank-distribution");
  if (!box) return;
  if (!rows.length) {
    box.hidden = true;
    return;
  }
  const counts = new Map<number, number>();
  for (const r of rows) {
    const l = levelOf(r.lifetime);
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const sortedLevels = [...counts.entries()].sort((a, b) => b[0] - a[0]);
  box.hidden = false;
  box.innerHTML = `<small class="dist-title">📊 Onde a galera está (${rows.length} jogadores):</small><div class="dist-chips"></div>`;
  const chips = box.querySelector(".dist-chips")!;
  for (const [lvl, count] of sortedLevels) {
    const chip = document.createElement("span");
    chip.className = "dist-chip";
    chip.textContent = `${RANKS[lvl][1]}: ${count}`;
    chips.append(chip);
  }
}

async function loadRanking() {
  const ol = $("top");
  const dist = $("rank-distribution");
  if (dist) dist.hidden = true;
  for (const b of document.querySelectorAll<HTMLElement>(".subtabs [data-list]")) b.classList.toggle("on", b.dataset.list === list);
  if (!sync) {
    const localRow: RankRow = { rank: 1, name: myName || "Você (Modo Local)", lifetime: state.lifetime, prestige: state.prestige, equipped: state.equipped as Record<string, string>, me: true };
    renderRankDistribution([localRow]);
    ol.replaceChildren(rankRow(localRow));
    return;
  }
  ol.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Carregando…" }));
  try {
    const rows = list === "top" ? await sync.top() : await sync.around();
    if (!rows.length) {
      ol.replaceChildren(Object.assign(document.createElement("li"), {
        textContent: list === "around" ? "Escolha um apelido acima para ver quem está perto de você, ou veja a aba Todos!" : "Ninguém ainda. Seja o primeiro!",
      }));
      return;
    }
    renderRankDistribution(rows);
    ol.replaceChildren(...rows.map(rankRow));
  } catch {
    ol.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Não foi possível carregar o ranking." }));
  }
}
for (const b of document.querySelectorAll<HTMLElement>(".subtabs [data-list]")) {
  b.addEventListener("click", () => { list = b.dataset.list as typeof list; void loadRanking(); });
}

// ===== Autenticação Exclusiva Google OAuth 2.0 (Google Identity Services) =====
interface GoogleWindow {
  google?: {
    accounts?: {
      id?: {
        initialize: (cfg: { client_id: string; callback: (res: { credential?: string }) => void }) => void;
        prompt: () => void;
      };
      oauth2?: {
        initTokenClient: (cfg: {
          client_id: string;
          scope: string;
          prompt?: string;
          callback: (resp: { access_token?: string; error?: string }) => void;
        }) => { requestAccessToken: () => void };
      };
    };
  };
}

function completeGoogleSignIn(info: { sub: string; email: string; name?: string; picture?: string }) {
  const normEmail = info.email.trim().toLowerCase();

  // Se o cofre desse Google tiver mais progresso que o navegador atual, restaura o cofre sem criar chave nova
  const vault = loadGoogleAccountVault(normEmail);
  if (vault && vault.state.lifetime > state.lifetime) {
    activePlayer = vault.player;
    state = vault.state;
    savePlayer(activePlayer);
    save(state);
    sync?.setPlayer(activePlayer);
    void sync?.flush();
  }

  // NUNCA cria chave nova nem reseta a conta atual: apenas vincula ao Google OAuth 2.0
  saveGoogleAccountVault(normEmail, activePlayer, state);
  saveGoogleAccount({
    sub: info.sub,
    email: normEmail,
    name: info.name,
    picture: info.picture,
    linkedAt: Date.now(),
    playerId: activePlayer.id,
  });

  const msg = $("google-oauth-msg");
  if (msg) msg.textContent = `✅ Conectado via Google (${normEmail})! Sua conta está sincronizada e protegida.`;
  sfx.welcome();
  toast(`🎉 Conectado com Google (${normEmail})!`);

  if (menu.classList.contains("auth-required")) {
    menu.classList.remove("auth-required");
    menu.close();
  }
  renderedMenu = "";
  renderAccount();
  render();
}

async function fetchGoogleUserProfile(accessToken: string) {
  const msg = $("google-oauth-msg");
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error("Falha ao obter perfil do Google.");
    const data = await r.json();
    if (data && data.sub && data.email) {
      completeGoogleSignIn({
        sub: String(data.sub),
        email: String(data.email),
        name: data.name ? String(data.name) : undefined,
        picture: data.picture ? String(data.picture) : undefined,
      });
    }
  } catch (err) {
    if (msg) msg.textContent = "Erro ao conectar com Google: " + (err as Error).message;
  }
}

// Captura retorno OAuth2 se vier via hash (#access_token=...) na janela ou popup
try {
  if (window.location.hash.includes("access_token=")) {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("access_token");
    if (token) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      if (window.opener && window.opener !== window) {
        window.opener.postMessage({ type: "clawd-google-oauth", accessToken: token }, window.location.origin);
        window.close();
      } else {
        void fetchGoogleUserProfile(token);
      }
    }
  }
} catch { /* ignore */ }

window.addEventListener("message", ev => {
  if (ev.origin !== window.location.origin) return;
  if (ev.data && ev.data.type === "clawd-google-oauth" && typeof ev.data.accessToken === "string") {
    void fetchGoogleUserProfile(ev.data.accessToken);
  }
});

$("google-oauth-btn")?.addEventListener("click", () => {
  const clientId = getGoogleClientId();
  const gWin = window as unknown as GoogleWindow;

  if (gWin.google?.accounts?.oauth2) {
    const tokenClient = gWin.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      prompt: "select_account",
      callback: resp => {
        if (resp.access_token) void fetchGoogleUserProfile(resp.access_token);
      },
    });
    tokenClient.requestAccessToken();
    return;
  }

  // Fallback direto para a janela oficial do Google OAuth 2.0 caso o script externo tenha sido bloqueado
  const redirectUri = window.location.origin + window.location.pathname;
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&prompt=select_account`;
  const w = 500, h = 620;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2));
  const popup = window.open(authUrl, "google_oauth2_popup", `width=${w},height=${h},left=${left},top=${top}`);
  if (!popup) {
    window.location.href = authUrl;
  }
});

$("google-signout-btn")?.addEventListener("click", () => {
  clearGoogleAccount();
  const msg = $("google-oauth-msg");
  if (msg) msg.textContent = "Sessão do Google desconectada (seu progresso local foi mantido).";
  renderedMenu = "";
  renderAccount();
});

$("btn-export-json")?.addEventListener("click", () => {
  const json = exportSaveJson(state, activePlayer);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `clawd-aura-save-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  sfx.copy();
  toast("💾 Backup salvo com sucesso!");
});

$<HTMLInputElement>("input-import-json")?.addEventListener("change", async e => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const res = importSaveJson(text);
    if (!res) throw new Error("Arquivo de backup inválido.");
    state = res.state;
    save(state);
    if (res.player) {
      activePlayer = res.player;
      savePlayer(activePlayer);
      sync?.setPlayer(activePlayer);
    }
    sfx.welcome();
    toast("📂 Backup restaurado com sucesso!");
    render();
  } catch (err) {
    toast("Falha ao restaurar: " + (err as Error).message);
  }
});

// ===== eventos da roleta da sorte 67 =====
$("wheel-spin-btn")?.addEventListener("click", () => {
  if (isSpinning || spinsState.spins <= 0) return;
  isSpinning = true;
  const res = spinWheel(state, now(), wheelRot);
  if (!res) { isSpinning = false; return; }

  wheelRot = res.degrees;
  spinsState.spins = res.remainingSpins;
  updateWheelBadge();

  const disc = $("wheel-disc");
  if (disc) disc.style.transform = `rotate(${wheelRot}deg)`;

  const tickInterval = setInterval(() => { sfx.wheelTick(); }, 160);

  setTimeout(() => {
    clearInterval(tickInterval);
    isSpinning = false;
    sfx.wheelWin();
    $("wheel-result").textContent = `🎉 ${res.message}`;
    toast(`🎰 Roleta: ${res.message}`);
    const r = $("wheel-disc").getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, null, 25);
    updateWheelBadge();
    render();
  }, 4000);
});

async function handleNicknameChange(rawName: string, msgEl: HTMLElement | null) {
  const enteredName = rawName.trim().replace(/\s+/g, " ");
  if (enteredName.length < 2 || enteredName.length > 20) {
    if (msgEl) msgEl.textContent = "O apelido precisa ter de 2 a 20 caracteres.";
    return;
  }
  settingName = true;
  if (msgEl) msgEl.textContent = "Salvando…";
  try {
    myName = enteredName;
    localCos.name = enteredName;
    saveLocalCos(localCos);
    nameInputPrefilled = true;
    const nameInp = document.getElementById("name") as HTMLInputElement | null;
    if (nameInp) nameInp.value = enteredName;
    const accInp = document.getElementById("acc-name-input") as HTMLInputElement | null;
    if (accInp) accInp.value = enteredName;

    if (sync) {
      await sync.setName(enteredName);
      sync.broadcastCosmetics(myName, state.equipped as Record<string, string>);
      await sync.flush();
      void loadRanking();
    }
    if (msgEl) msgEl.textContent = "✅ Apelido salvo!";
    renderedMenu = "";
    renderAccount();
    render();
  } catch (err) {
    if (msgEl) msgEl.textContent = (err as Error).message;
  } finally {
    settingName = false;
  }
}

document.getElementById("acc-name-form")?.addEventListener("submit", e => {
  e.preventDefault();
  const val = (document.getElementById("acc-name-input") as HTMLInputElement | null)?.value ?? "";
  void handleNicknameChange(val, document.getElementById("acc-name-msg"));
});

if (sync) {
  $("ranking-open").hidden = false;
  $("tab-ranking").hidden = false;
  $<HTMLFormElement>("name-form").addEventListener("submit", e => {
    e.preventDefault();
    const val = $<HTMLInputElement>("name").value;
    void handleNicknameChange(val, $("name-msg"));
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

if (!loadGoogleAccount() && state.lifetime === 0 && getGoogleClientId()) {
  menu.classList.add("auth-required");
  openMenu("account");
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

