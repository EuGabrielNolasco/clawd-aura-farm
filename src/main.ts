import "./style.css";
import { ACHIEVEMENTS, achievementProgress, checkAchievements } from "./achievements";
import { COSMETICS, cosmeticById, SLOTS, type Slot } from "./cosmetics";
import {
  allMaxed, applyEvent, buffActive, canBuy, canPrestige, clickGain, comboFor, costOf, daily, earn, EV,
  goldenVisible, isMaxed, LEVEL_BONUS, levelOf, LV, mult, nowSec, passive, passivePerSecond,
  PRESTIGE_BONUS, RANKS, schedule, thiefVisible, todayBR, UPGRADES, type State,
} from "./game";
import { createFx, reduceMotion } from "./fx";
import { clawdSvg } from "./mini";
import { createSync, onlineEnabled, toState, type RankRow, type ServerState } from "./online";
import { sfx, setMuted } from "./sound";
import {
  accountShareUrl, clearGoogleAccount, derivePlayerFromGoogle, exportAccountToken,
  exportSaveJson, getGoogleClientId, importSaveJson, load, loadGoogleAccount,
  loadGoogleAccountVault, loadMuted, mergeStates, parseSyncPayload, player,
  sanitize, save, saveGoogleAccount, saveGoogleAccountVault, saveMuted, savePlayer,
  type Player,
} from "./storage";
import {
  addSpin, applySpinPrize, getWheelTokensWon, loadSpins, PRIZES, recordMissionProgress,
  renderWheelSvg, spinWheel, WHEEL_MISSIONS, type MissionStat, type WheelPrize,
} from "./wheel";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage"), mascot = $("mascot");

const saved = load();
let state: State = saved.state;
let level = -1;
let activePlayer: Player = player();

// Sincronização direta de conta e progresso via link ou QR Code (#sync=...)
try {
  const syncSource = window.location.hash || window.location.search;
  if (syncSource.includes("sync=")) {
    const syncRes = parseSyncPayload(syncSource);
    if (syncRes) {
      activePlayer = syncRes.player;
      savePlayer(activePlayer);
      if (syncRes.state) {
        state = mergeStates(state, syncRes.state);
        save(state);
      }
      history.replaceState(null, "", window.location.pathname);
    }
  }
} catch { /* ignore */ }
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

const sync = onlineEnabled ? createSync(
  activePlayer,
  onServer,
  ok => {
    $("net").textContent = ok ? "Conectado: sua aura conta no ranking." : "Sem conexão. Seu progresso é enviado quando a conexão voltar.";
    const st = $("acc-status");
    if (st) st.textContent = ok ? "🟢 Conectado na Nuvem" : "🟡 Sem conexão com o servidor";
  },
  () => {
    // Quando outro jogador envia atualização via WebSocket, atualiza o ranking ao vivo
    if (menu.open && tab === "ranking") {
      void loadRanking(true);
    }
  }
) : null;
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
  cosmic: number;
  bonusAura: number;
  spentAura: number;
  buffUntil?: number;
  prestige?: number;
}
function loadLocalExt(): LocalExtState {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_EXT_KEY) || "null");
    if (raw && typeof raw === "object") {
      return {
        cosmic: Math.max(0, Math.floor(Number(raw.cosmic) || 0)),
        bonusAura: Math.max(0, Number(raw.bonusAura) || 0),
        spentAura: Math.max(0, Number(raw.spentAura) || 0),
        buffUntil: Math.max(0, Number(raw.buffUntil) || 0),
        prestige: Math.max(0, Math.floor(Number(raw.prestige) || 0)),
      };
    }
  } catch { /* ignore */ }
  return { cosmic: state.upgrades.cosmic, bonusAura: 0, spentAura: 0, buffUntil: 0, prestige: state.prestige };
}
function saveLocalExt(ext: LocalExtState) {
  try { localStorage.setItem(LOCAL_EXT_KEY, JSON.stringify(ext)); } catch { /* ignore */ }
}
const localExt = loadLocalExt();
state.upgrades.cosmic = Math.max(state.upgrades.cosmic, localExt.cosmic);
if (localExt.buffUntil) state.buffUntil = Math.max(state.buffUntil, localExt.buffUntil);
if (localExt.prestige) state.prestige = Math.max(state.prestige, localExt.prestige);

function getAchievementTokens(): number {
  return state.achievements.reduce((sum, id) => {
    const a = ACHIEVEMENTS.find(x => x.id === id);
    return sum + (a ? a.reward : 0);
  }, 0);
}

function pushFullProfileSync() {
  if (!sync) return Promise.resolve(null);
  const upsArr = [
    state.upgrades.aux,
    state.upgrades.click,
    state.upgrades.crit,
    state.upgrades.fab,
    state.upgrades.dc,
    state.upgrades.cosmic,
  ];
  return sync.syncProfile(
    state.lifetime,
    state.prestige,
    state.total,
    state.aura,
    state.equipped as Record<string, string>,
    upsArr,
    state.tokens,
    state.achievements,
    state.owned
  );
}

let lastLocalEquipTime = 0;

function enforceLocalCosmetics(serverTokens?: number) {
  for (const id of localCos.owned) {
    if (!state.owned.includes(id) && cosmeticById(id)) {
      state.owned.push(id);
    }
  }
  for (const [slot, val] of Object.entries(localCos.equipped) as [Slot, string | null | undefined][]) {
    if (val === null) {
      delete state.equipped[slot];
    } else if (val && state.owned.includes(val) && cosmeticById(val) && !state.equipped[slot]) {
      state.equipped[slot] = val;
    }
  }

  // Preserva e sincroniza o saldo de Fichas 67 entre os aparelhos
  const wheelTokens = getWheelTokensWon();
  const achTokens = getAchievementTokens();
  if (typeof serverTokens === "number" && serverTokens > 0) {
    state.tokens = serverTokens;
  } else {
    state.tokens = Math.max(state.tokens, achTokens + wheelTokens);
  }
}

enforceLocalCosmetics();
if (myName) sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);
let nameInputPrefilled = false;
let settingName = false;

function updateMyRankHeader() {
  const el = $("my-rank");
  if (!el) return;
  const displayNick = myName || "Você";
  const curLvl = levelOf(state.total);
  const curRankName = RANKS[curLvl][1];
  const myPrest = state.prestige || 0;
  const posText = lastRank ? `#${lastRank}` : (onlineEnabled ? "Classificando…" : "#1");
  el.innerHTML = `<b>${displayNick}</b> · <span>Posição: <b>${posText}</b></span> · <span>Rank Atual: <span class="rank-badge lv-${curLvl}">${curRankName}</span></span> · <b>⭐ ${myPrest}</b> · <small>${fmtShort(state.lifetime)} vitalícia</small>`;
}

function onServer(r: ServerState, _pending: string) {
  clockOffset = r.now - nowSec();
  const srv = toState(r);
  let stateChanged = false;

  if (firstSync && state.lifetime === 0 && state.prestige === 0 && srv.lifetime > 0) {
    // Dispositivo/navegador novo no site: restaura o estado salvo na nuvem
    state = srv;
    state.upgrades.cosmic = Math.max(state.upgrades.cosmic, localExt.cosmic);
    localCos.owned = [...srv.owned];
    localCos.equipped = { ...srv.equipped };
    saveLocalCos(localCos);
    if (r.offline >= 60) welcomeBack(r.offline, r.offline_gain);
    stateChanged = true;
  } else {
    // 1. Sincronização inteligente de prestígio e vida atual entre aparelhos
    if (srv.prestige > state.prestige) {
      // Outro dispositivo avançou o prestígio: adota a nova vida e os upgrades dela
      state.prestige = srv.prestige;
      state.total = srv.total;
      state.aura = srv.aura;
      for (const u of UPGRADES) {
        state.upgrades[u.id] = srv.upgrades[u.id] ?? 0;
      }
      stateChanged = true;
    } else if (srv.prestige === state.prestige) {
      // Ambos no mesmo prestígio: sincroniza para o maior progresso alcançado (aura, total e upgrades)
      if (srv.total > state.total) {
        state.total = srv.total;
        stateChanged = true;
      }
      if (srv.aura > state.aura) {
        state.aura = srv.aura;
        stateChanged = true;
      }
      for (const u of UPGRADES) {
        const srvUp = srv.upgrades[u.id] ?? 0;
        if (srvUp > (state.upgrades[u.id] ?? 0)) {
          state.upgrades[u.id] = srvUp;
          stateChanged = true;
        }
      }
    }

    // 2. Progresso vitalício e estatísticas cumulativas (sempre o máximo de ambos)
    if (srv.lifetime > state.lifetime) {
      state.lifetime = srv.lifetime;
      stateChanged = true;
    }
    state.prestige = Math.max(state.prestige, srv.prestige, localExt.prestige || 0);

    const serverTokens = typeof r.tokens === "number" ? r.tokens : 0;
    if (serverTokens !== state.tokens) {
      if (serverTokens > state.tokens || (srv.owned.length >= state.owned.length && serverTokens > 0)) {
        state.tokens = serverTokens;
        stateChanged = true;
      }
    }

    state.clicks = Math.max(state.clicks, srv.clicks ?? 0);
    state.crits = Math.max(state.crits, srv.crits ?? 0);
    state.goldens = Math.max(state.goldens, srv.goldens ?? 0);
    state.thieves = Math.max(state.thieves, srv.thieves ?? 0);
    state.streak = Math.max(state.streak, srv.streak ?? 0);

    if (r.daily) dailyReward(state.streak);

    // 3. Conquistas e cosméticos comprados (sempre a união permanente de ambos)
    for (const id of srv.owned) {
      if (!state.owned.includes(id) && cosmeticById(id)) {
        state.owned.push(id);
        if (!localCos.owned.includes(id)) localCos.owned.push(id);
        stateChanged = true;
      }
    }
    for (const id of srv.achievements) {
      if (!state.achievements.includes(id)) {
        state.achievements.push(id);
        achievementUnlocked(id, true);
        stateChanged = true;
      }
    }

    // 4. Enfeites equipados: se o usuário não mudou localmente nos últimos 3 segundos,
    // adota o visual oficial da conta que está salvo na nuvem
    if (srv.equipped && typeof srv.equipped === "object" && Date.now() - lastLocalEquipTime > 3000) {
      let equippedChanged = false;
      for (const sl of SLOTS) {
        const srvItem = srv.equipped[sl.id];
        if (srvItem && cosmeticById(srvItem)) {
          if (state.equipped[sl.id] !== srvItem) {
            state.equipped[sl.id] = srvItem;
            localCos.equipped[sl.id] = srvItem;
            if (!state.owned.includes(srvItem)) state.owned.push(srvItem);
            if (!localCos.owned.includes(srvItem)) localCos.owned.push(srvItem);
            equippedChanged = true;
          }
        } else if (!srvItem && state.equipped[sl.id]) {
          delete state.equipped[sl.id];
          delete localCos.equipped[sl.id];
          equippedChanged = true;
        }
      }
      if (equippedChanged) stateChanged = true;
    }
  }

  // 5. Se o dispositivo local possui MAIS progresso que o servidor, envia syncProfile completo para atualizar a nuvem
  const serverTokens = typeof r.tokens === "number" ? r.tokens : 0;
  const localHasHigherUps = UPGRADES.some(u => (state.upgrades[u.id] ?? 0) > (srv.upgrades[u.id] ?? 0));
  const localHasMoreOwned = state.owned.some(id => !srv.owned.includes(id));
  const localHasMoreAch = state.achievements.some(id => !srv.achievements.includes(id));

  const localAhead =
    state.lifetime > srv.lifetime ||
    state.prestige > srv.prestige ||
    (state.prestige === srv.prestige && state.total > srv.total) ||
    (state.prestige === srv.prestige && state.aura > srv.aura) ||
    localHasHigherUps ||
    localHasMoreOwned ||
    localHasMoreAch ||
    (state.tokens > serverTokens && Date.now() - lastLocalEquipTime < 3000);

  if (localAhead) {
    void pushFullProfileSync();
  }

  if (Object.keys(state.equipped).length > 0 && Object.keys(srv.equipped || {}).length === 0) {
    void sync?.setEquipped(state.equipped as Record<string, string>);
  }

  enforceLocalCosmetics(r.tokens);
  save(state);
  saveLocalCos(localCos);
  saveLocalExt(localExt);
  firstSync = false;

  if (r.name && !settingName) {
    myName = r.name;
    localCos.name = r.name;
    saveLocalCos(localCos);
  }
  sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);

  if (r.name && lastRank && r.rank && r.rank < lastRank && lastAhead) {
    toast(`🚀 Você passou ${lastAhead.name}! Agora é #${r.rank} no ranking.`);
    sfx.overtake();
  }
  lastRank = r.rank;
  lastAhead = r.ahead;
  updateMyRankHeader();

  const displayNick = myName || r.name;
  if (displayNick && !nameInputPrefilled) {
    nameInputPrefilled = true;
    const nameEl = $<HTMLInputElement>("name");
    if (nameEl && document.activeElement !== nameEl) nameEl.value = displayNick;
    const accNameEl = $<HTMLInputElement>("acc-name-input");
    if (accNameEl && document.activeElement !== accNameEl) accNameEl.value = displayNick;
  }

  if (stateChanged) {
    level = levelOf(state.total);
    render();
    applyCosmetics();
    updateMyRankHeader();
    if (menu.open) renderMenu();
  }
}

function welcomeBack(seconds: number, gained: number) {
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60);
  const time = h ? `${h} h ${m} min` : `${m} min`;
  toast(`Bem-vindo de volta! Em ${time} fora, o Clawd farmou +${fmtShort(gained)} de aura.`);
  sfx.welcome();
}

const DAILY_SPIN_CLAIM_KEY = "clawd-aura-farm:daily-spin-v3";

function isDailySpinClaimedToday(): boolean {
  try {
    return localStorage.getItem(DAILY_SPIN_CLAIM_KEY) === todayBR();
  } catch {
    return true;
  }
}

function updateWheelBadge() {
  const b = $("wheel-badge");
  if (b) {
    b.hidden = spinsState.spins <= 0;
    b.textContent = String(spinsState.spins);
  }
  const val = $("wheel-spins-val");
  if (val) val.textContent = String(spinsState.spins);
  const liveStats = document.getElementById("wheel-live-stats");
  if (liveStats) {
    const buffed = buffActive(state, now());
    const buffStr = buffed ? ` · 🧠 ×7 (${Math.ceil(state.buffUntil - now())}s)` : "";
    liveStats.textContent = `🎟 Fichas 67: ${state.tokens} · ⚡ Aura: ${fmtShort(state.aura)}${buffStr}`;
  }
  const btn = $("wheel-spin-btn") as HTMLButtonElement | null;
  if (btn) btn.disabled = spinsState.spins <= 0 || isSpinning;
}

function dailyReward(streak: number) {
  const today = todayBR();
  try {
    if (localStorage.getItem(DAILY_SPIN_CLAIM_KEY) !== today) {
      localStorage.setItem(DAILY_SPIN_CLAIM_KEY, today);
      spinsState.spins = addSpin();
    } else {
      spinsState = loadSpins(today);
    }
  } catch {
    spinsState = loadSpins(today);
  }
  updateWheelBadge();
  const s = Math.max(1, streak);
  toast(`🔥 Login Diário (${s} ${s === 1 ? "dia" : "dias"}): +1 giro grátis na Roleta da Sorte!`);
  sfx.daily();
}

function achievementUnlocked(id: string, addReward = false) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  if (addReward) state.tokens += a.reward;
  spinsState.spins = addSpin();
  updateWheelBadge();
  save(state);
  toast(`🎖 Conquista: ${a.name} (+${a.reward} Fichas 67 e +1 giro na Roleta!)`);
  sfx.achievement();
}

function trackMission(stat: MissionStat, amount = 1) {
  const completed = recordMissionProgress(todayBR(), stat, amount);
  spinsState = loadSpins(todayBR());
  if (completed.length > 0) {
    updateWheelBadge();
    for (const m of completed) {
      toast(`🎯 Missão concluída: ${m.name}! +1 giro na Roleta!`);
      sfx.achievement();
    }
  }
}

/** Aplica um evento local e, no modo online, manda para o servidor. */
function act(code: string, arg = "") {
  const r = applyEvent(state, code, arg, combo(), now());
  if (code === EV.prestige || code === EV.reset) {
    localExt.cosmic = 0;
    localExt.bonusAura = 0;
    localExt.spentAura = 0;
    localExt.buffUntil = 0;
    localExt.prestige = state.prestige;
    saveLocalExt(localExt);
    save(state);
    const gAcc = loadGoogleAccount();
    if (gAcc) saveGoogleAccountVault(gAcc.email, activePlayer, state);
    sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);
    sync?.push(code === EV.prestige ? "p" : "z");
    void sync?.flush();
    return r;
  } else {
    localExt.cosmic = state.upgrades.cosmic;
    localExt.prestige = state.prestige;
    saveLocalExt(localExt);
  }
  if (code === EV.buyCosmetic || code === EV.equip || code === EV.unequip) {
    lastLocalEquipTime = Date.now();
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
    sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);
    void sync?.setEquipped(state.equipped as Record<string, string>);
    void pushFullProfileSync();
  }
  save(state);
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
    trackMission("upgrades", 1);
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
  toast(`🎰 Rank subido: ${RANKS[l][1]}! +1 giro grátis na Roleta da Sorte.`);
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
  const prevGoldens = state.goldens;
  act(EV.golden);
  $("golden").hidden = true;
  if (state.goldens > prevGoldens || buffActive(state, now())) {
    trackMission("events", 1);
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
  const prevThieves = state.thieves;
  act(EV.thief);
  $("thief").hidden = true;
  if (state.thieves > prevThieves) {
    const recoveredAura = Math.max(670, Math.floor(passivePerSecond(state) * 60));
    earn(state, recoveredAura);
    localExt.bonusAura += recoveredAura;
    saveLocalExt(localExt);
    trackMission("events", 1);
    sfx.thiefCaught();
    if ("vibrate" in navigator) navigator.vibrate([40, 50, 40]);
    toast(`🦹 Pegou o ladrão! Recuperou +${fmtShort(recoveredAura)} de aura!`);
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
  updateMyRankHeader();
  if (menu.open) renderMenu();
  save(state);
}

function farm(ev?: MouseEvent) {
  clickTimes.push(performance.now());
  const r = act(EV.click)!;
  trackMission("clicks", 1);
  if (r.crit) trackMission("crits", 1);
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


// ===== verificação contínua de eventos, login diário, conquistas e cofre Google =====
function localTick() {
  schedule(state, now());
  const reward = daily(state, todayBR());
  if (reward || !isDailySpinClaimedToday()) dailyReward(state.streak);
  for (const a of checkAchievements(state, levelOf(state.total), allMaxed(state))) achievementUnlocked(a.id);
  const gAcc = loadGoogleAccount();
  if (gAcc) saveGoogleAccountVault(gAcc.email, activePlayer, state);
}

// aura passiva local, para o contador andar suave e salvar sempre
let lastTick = performance.now();
setInterval(() => {
  const t = performance.now();
  const dt = (t - lastTick) / 1000;
  passive(state, dt, now());
  lastTick = t;
  localTick();
  render();
}, 250);

// ===== controles =====
$("farm").addEventListener("click", farm);
mascot.addEventListener("click", farm);
mascot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); farm(); } });

$("prestige").addEventListener("click", () => {
  if (!canPrestige(state)) return;
  const nextPrestige = state.prestige + 1;
  if (!confirm(`Renascer? Você volta para NPC sem upgrades, mas ganha o SUPER PRÊMIO DE PRESTÍGIO:\n\n⭐ +1 Estrela (+25% de aura permanente para sempre, fica ⭐×${nextPrestige})\n🎟 +50 Fichas 67 para a Loja de Enfeites\n🎰 +3 Giros grátis na Roleta da Sorte 67\n\nFichas, conquistas, enfeites e ranking continuam intactos!`)) return;

  // 1. Executa o renascimento no motor do jogo
  act(EV.prestige);

  // 2. Prêmios garantidos de renascimento: Fichas 67 e Giros na Roleta!
  state.tokens += 50;
  spinsState.spins = addSpin(3);
  updateWheelBadge();

  // 3. Conquista prestige_1 (Renascido) no primeiro renascimento
  if (!state.achievements.includes("prestige_1")) {
    state.achievements.push("prestige_1");
    state.tokens += 50;
    spinsState.spins = addSpin(1);
    updateWheelBadge();
    toast("🎖 Conquista Desbloqueada: Renascido (+50 Fichas 67 e +1 giro na Roleta!)");
  }

  save(state);
  const gAcc = loadGoogleAccount();
  if (gAcc) saveGoogleAccountVault(gAcc.email, activePlayer, state);

  // 4. Som e banner comemorativo
  sfx.prestige();
  const b = $("banner");
  b.innerHTML = `<small>RENASCEU!</small>⭐ × ${state.prestige} (+25% AURA)`;
  replay(b, "show");
  fx.flash();
  applyCosmetics();

  toast(`⭐ PRÊMIO DE PRESTÍGIO CREDITADO! +1 Estrela (+25% aura), +50 Fichas 67 e +3 giros na Roleta!`);

  // 5. Atualiza o rank atual da vida (volta para NPC)
  level = -1;
  render();
  updateMyRankHeader();

  // 6. Atualiza imediatamente o ranking
  if (sync) {
    sync.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);
    void sync.setEquipped(state.equipped as Record<string, string>);
    void pushFullProfileSync();
    void sync.flush().then(() => {
      void loadRanking();
      updateMyRankHeader();
    });
  } else {
    void loadRanking();
  }
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

let rankingAutoInterval: ReturnType<typeof setInterval> | null = null;
function stopRankingTimer() {
  if (rankingAutoInterval) {
    clearInterval(rankingAutoInterval);
    rankingAutoInterval = null;
  }
}
function startRankingTimer() {
  stopRankingTimer();
  rankingAutoInterval = setInterval(() => {
    if (menu.open && tab === "ranking") {
      void loadRanking(true);
    } else {
      stopRankingTimer();
    }
  }, 8000);
}

function openMenu(t: string) {
  tab = t;
  renderedMenu = "";
  if (!menu.open) menu.showModal();
  renderMenu();
  if (t === "ranking") {
    updateMyRankHeader();
    void loadRanking();
    startRankingTimer();
  } else {
    stopRankingTimer();
  }
}
for (const b of document.querySelectorAll<HTMLElement>(".menu-open, .tabs [data-tab]")) {
  b.addEventListener("click", () => openMenu(b.dataset.tab!));
}
$("menu-close").addEventListener("click", () => {
  menu.classList.remove("auth-required");
  stopRankingTimer();
  menu.close();
});
menu.addEventListener("close", () => {
  stopRankingTimer();
});
menu.addEventListener("cancel", () => {
  menu.classList.remove("auth-required");
  stopRankingTimer();
});

let renderedMenu = "";
function renderMenu() {
  for (const b of document.querySelectorAll<HTMLElement>(".tabs [data-tab]")) {
    b.setAttribute("aria-selected", String(b.dataset.tab === tab));
  }
  for (const p of document.querySelectorAll<HTMLElement>("[data-panel]")) {
    p.hidden = p.dataset.panel !== tab;
  }
  if (tab === "wheel") updateWheelBadge();
  // só redesenha quando algo que aparece no menu mudou
  const key = JSON.stringify([tab, state.tokens, state.streak, state.achievements, state.owned, state.equipped, spinsState.spins, spinsState.dailyProgress, activePlayer.id, myName, lastRank]);
  if (key === renderedMenu) return;
  renderedMenu = key;
  if (tab === "account") renderAccount();
  if (tab === "wheel") renderWheelPanel();
  if (tab === "ach") renderAchievements();
  if (tab === "cos") renderCosmetics();
  if (tab === "stats") renderStats();
}

function renderWheelPanel() {
  const mList = document.getElementById("wheel-missions-list");
  if (mList) {
    const prog = spinsState.dailyProgress;
    const streakDays = Math.max(1, state.streak || 1);
    const dailyLi = document.createElement("li");
    dailyLi.className = "done";
    dailyLi.innerHTML = `
      <span class="medal">🔥</span>
      <span>
        <b>Login Diário (${streakDays} ${streakDays === 1 ? "dia" : "dias"})</b>
        <small>Entrar no jogo hoje garante +1 giro grátis na Roleta</small>
        <div class="ach-prog"><i style="width: 100%"></i><span>1 / 1 (Recebido hoje!)</span></div>
      </span>
      <em>+1 🎰</em>
    `;

    mList.replaceChildren(dailyLi, ...WHEEL_MISSIONS.map(m => {
      const cur = prog ? Math.min(prog[m.stat] || 0, m.target) : 0;
      const done = Boolean(prog?.claimed.includes(m.id)) || cur >= m.target;
      const pct = done ? 100 : Math.min(100, Math.floor((cur / m.target) * 100));
      const li = document.createElement("li");
      li.className = done ? "done" : "";
      li.innerHTML = `
        <span class="medal">${done ? "✅" : "🎯"}</span>
        <span>
          <b></b>
          <small></small>
          <div class="ach-prog"><i style="width: ${pct}%"></i><span>${cur} / ${m.target}</span></div>
        </span>
        <em>+1 🎰</em>
      `;
      li.querySelector("b")!.textContent = m.name;
      li.querySelector("small")!.textContent = m.desc;
      return li;
    }));
  }

  const pList = document.getElementById("wheel-prizes-list");
  if (pList && !pList.children.length) {
    pList.replaceChildren(...PRIZES.map(p => {
      const card = document.createElement("div");
      card.className = "wheel-prize-chip";
      card.style.borderColor = p.color;
      card.innerHTML = `<span class="wp-icon">${p.icon}</span><div><b></b><small></small></div>`;
      card.querySelector("b")!.textContent = p.name;
      card.querySelector("small")!.textContent = p.desc;
      return card;
    }));
  }
}

function renderAccount() {
  const avatar = $("acc-avatar");
  applyBgClass(avatar, state.equipped.bg);
  avatar.innerHTML = clawdSvg(state.equipped);
  const gAcc = loadGoogleAccount();
  $("acc-name").textContent = myName || gAcc?.name || "Jogador Anônimo";
  $("acc-status").textContent = sync ? "🟢 Sincronizado na Nuvem" : "🟡 Modo Local (Offline)";
  $("acc-id-short").textContent = "Conta Principal Preservada";
  $("acc-rank-label").textContent = `${lastRank ? `#${lastRank} no ranking` : "Classificado"} · Rank Atual: ${RANKS[levelOf(state.total)][1]} · ⭐ ${state.prestige}`;

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
  const multVal = mult(state);
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
    { label: "Upgrades Comprados", val: `${totalBought}/145` },
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
    (myName && e.name.trim().toLowerCase() === myName.trim().toLowerCase())
  );
  if (isMe) li.className = "me";

  const rowLifetime = isMe ? Math.max(e.lifetime, state.lifetime) : e.lifetime;
  const rowPrestige = isMe ? Math.max(e.prestige || 0, state.prestige || 0) : (e.prestige || 0);
  const curLvl = isMe ? levelOf(state.total) : levelOf(rowLifetime);
  const rankTitle = RANKS[curLvl][1];
  const rebirths = rowPrestige;

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
  badge.className = `rank-badge lv-${curLvl}`;
  badge.textContent = isMe ? `Rank Atual: ${rankTitle}` : rankTitle;
  subLine.append(badge);

  info.append(topLine, subLine);

  const aura = document.createElement("b");
  aura.className = "rank-aura";
  aura.textContent = fmtShort(rowLifetime);

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

async function loadRanking(silent = false) {
  const ol = $("top");
  const dist = $("rank-distribution");
  for (const b of document.querySelectorAll<HTMLElement>(".subtabs [data-list]")) b.classList.toggle("on", b.dataset.list === list);
  if (!sync) {
    const localRow: RankRow = { rank: 1, name: myName || "Você (Modo Local)", lifetime: state.lifetime, prestige: state.prestige, equipped: state.equipped as Record<string, string>, me: true };
    updateMyRankHeader();
    renderRankDistribution([localRow]);
    ol.replaceChildren(rankRow(localRow));
    return;
  }
  if (!silent && !ol.children.length) {
    ol.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Carregando…" }));
  }
  try {
    const myProg = { lifetime: state.lifetime, prestige: state.prestige, equipped: state.equipped as Record<string, string> };
    const rows = list === "top" ? await sync.top(myProg, myName) : await sync.around(myProg, myName);
    updateMyRankHeader();
    if (!rows.length) {
      ol.replaceChildren(Object.assign(document.createElement("li"), {
        textContent: list === "around" ? "Escolha um apelido acima para ver quem está perto de você, ou veja a aba Todos!" : "Ninguém ainda. Seja o primeiro!",
      }));
      if (dist) dist.hidden = true;
      return;
    }
    renderRankDistribution(rows);
    ol.replaceChildren(...rows.map(rankRow));
  } catch {
    if (!silent) {
      ol.replaceChildren(Object.assign(document.createElement("li"), { textContent: "Não foi possível carregar o ranking." }));
    }
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

async function completeGoogleSignIn(info: { sub: string; email: string; name?: string; picture?: string }) {
  const normEmail = info.email.trim().toLowerCase();
  const displayName = info.name?.trim() || null;

  // 1. Deriva par (id, secret) determinístico para esta conta Google (garante mesmo ID no PC e celular mesmo sem RPC)
  const googlePlayer = await derivePlayerFromGoogle(info.sub);
  let adoptedPlayer = activePlayer;

  if (sync) {
    try {
      const authRes = await sync.googleAuth(activePlayer, normEmail, info.sub, displayName);
      if (authRes && authRes.id) {
        adoptedPlayer = { id: authRes.id, secret: authRes.secret || activePlayer.secret };
      }
    } catch {
      // Fallback: unificação determinística via Google sub
      adoptedPlayer = googlePlayer;
    }
  } else {
    adoptedPlayer = googlePlayer;
  }

  // 2. Se o ID da conta mudou (ex: adotou a conta unificada do Google):
  if (adoptedPlayer.id !== activePlayer.id) {
    activePlayer = adoptedPlayer;
    savePlayer(activePlayer);
    sync?.setPlayer(activePlayer);
    try {
      const srv = await sync?.fetchState();
      if (srv) {
        state = mergeStates(state, toState(srv));
        state.upgrades.cosmic = Math.max(state.upgrades.cosmic, localExt.cosmic);
        save(state);
      }
    } catch { /* ignore */ }
  } else {
    // Mescla com cofre local caso exista progresso maior registrado
    const vault = loadGoogleAccountVault(normEmail);
    if (vault) {
      state = mergeStates(state, vault.state);
      save(state);
    }
  }

  // 3. Sincroniza o perfil atualizado na nuvem
  if (sync) {
    void sync.setEquipped(state.equipped as Record<string, string>);
    void pushFullProfileSync();
    void sync.flush();
  }

  // 2. Se o usuário ainda não tem apelido no jogo e o Google tem nome, define automaticamente
  if ((!myName || myName.startsWith("Clawd #")) && displayName) {
    const candidate = displayName.slice(0, 20);
    if (candidate.length >= 2) {
      void handleNicknameChange(candidate, null);
    }
  }

  // 3. Salva no cofre local e no registro da conta Google
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
  if (msg) msg.textContent = `✅ Conectado via Google (${normEmail})! Sua conta está unificada em todos os dispositivos.`;
  sfx.welcome();
  toast(`🎉 Conectado com Google (${normEmail})! Conta unificada.`);

  if (menu.classList.contains("auth-required")) {
    menu.classList.remove("auth-required");
    menu.close();
  }
  renderedMenu = "";
  renderAccount();
  render();
  void loadRanking();
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
      await completeGoogleSignIn({
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

$("google-skip-btn")?.addEventListener("click", () => {
  menu.classList.remove("auth-required");
  stopRankingTimer();
  menu.close();
  toast("🎮 Jogando como convidado! Conecte seu Google quando quiser na aba Conta.");
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

$("btn-sync-now")?.addEventListener("click", async () => {
  const msg = $("token-sync-msg");
  if (msg) msg.textContent = "🔄 Sincronizando com a nuvem...";
  if (sync) {
    try {
      const srv = await sync.fetchState();
      if (srv) {
        state = mergeStates(state, toState(srv));
        save(state);
      }
      await pushFullProfileSync();
      if (Object.keys(state.equipped).length > 0) {
        await sync.setEquipped(state.equipped as Record<string, string>);
      }
      await sync.flush();
      await loadRanking();
      level = levelOf(state.total);
      render();
      applyCosmetics();
      updateMyRankHeader();
      toast("✅ Progresso sincronizado com sucesso!");
      if (msg) msg.textContent = "✅ Progresso 100% sincronizado com a nuvem!";
      sfx.welcome();
    } catch {
      toast("❌ Erro ao sincronizar com a nuvem.");
      if (msg) msg.textContent = "❌ Falha ao conectar ao servidor.";
    }
  }
});

$("btn-qr-sync")?.addEventListener("click", () => {
  const qrBox = $("qr-modal-box");
  const imgWrap = $("qr-img-wrap");
  if (!qrBox || !imgWrap) return;
  const url = accountShareUrl(activePlayer, state);
  imgWrap.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}" alt="QR Code de Sincronização">`;
  qrBox.hidden = !qrBox.hidden;
  if (!qrBox.hidden) {
    toast("📷 Aponte a câmera do celular para o QR Code para carregar o jogo!");
    const msg = $("token-sync-msg");
    if (msg) msg.textContent = "📷 Aponte a câmera do celular para este QR Code para sincronizar!";
  }
});

$("btn-copy-sync-link")?.addEventListener("click", async () => {
  const url = accountShareUrl(activePlayer, state);
  try {
    await navigator.clipboard.writeText(url);
    toast("📋 Link com save copiado! Abra no celular para carregar o jogo.");
    const msg = $("token-sync-msg");
    if (msg) msg.textContent = "✅ Link de sincronização copiado! Abra no celular.";
    sfx.copy();
  } catch {
    prompt("Copie o link abaixo e abra no navegador do seu celular:", url);
  }
});

$("btn-copy-token")?.addEventListener("click", async () => {
  const token = exportAccountToken(activePlayer);
  try {
    await navigator.clipboard.writeText(token);
    toast("📋 Chave copiada! Cole no outro dispositivo para sincronizar.");
    const msg = $("token-sync-msg");
    if (msg) msg.textContent = "✅ Chave copiada! Cole no outro dispositivo em 'Conectar por Chave'.";
    sfx.copy();
  } catch {
    prompt("Copie sua chave da conta abaixo:", token);
  }
});

$("btn-paste-token")?.addEventListener("click", async () => {
  const input = prompt("Cole a Chave da Conta ou Link com #sync=:");
  if (!input) return;
  const parsed = parseSyncPayload(input);
  if (!parsed) {
    toast("❌ Chave ou link inválido.");
    const msg = $("token-sync-msg");
    if (msg) msg.textContent = "❌ Chave inválida. Verifique o código digitado.";
    return;
  }
  activePlayer = parsed.player;
  savePlayer(activePlayer);
  if (parsed.state) {
    state = mergeStates(state, parsed.state);
    save(state);
  }
  if (sync) {
    sync.setPlayer(activePlayer);
    try {
      const srv = await sync.fetchState();
      if (srv) {
        state = mergeStates(state, toState(srv));
        state.upgrades.cosmic = Math.max(state.upgrades.cosmic, localExt.cosmic);
        save(state);
      }
    } catch { /* ignore */ }
    void sync.setEquipped(state.equipped as Record<string, string>);
    void pushFullProfileSync();
    void sync.flush();
  }
  sfx.welcome();
  toast("✅ Conta sincronizada com sucesso!");
  const msg = $("token-sync-msg");
  if (msg) msg.textContent = "✅ Conta conectada e sincronizada!";
  renderedMenu = "";
  renderAccount();
  applyCosmetics();
  render();
  void loadRanking();
});

// ===== eventos da roleta da sorte 67 =====
let pendingWheelPrize: WheelPrize | null = null;

function claimPendingWheelPrize(): { msg: string; prize: WheelPrize } | null {
  if (!pendingWheelPrize) return null;
  const prize = pendingWheelPrize;
  pendingWheelPrize = null;
  const applied = applySpinPrize(state, prize, now());
  if (applied.auraGain > 0) {
    localExt.bonusAura += applied.auraGain;
    saveLocalExt(localExt);
  }
  if (state.buffUntil > (localExt.buffUntil || 0)) {
    localExt.buffUntil = state.buffUntil;
    saveLocalExt(localExt);
  }
  save(state);
  const gAcc = loadGoogleAccount();
  if (gAcc) saveGoogleAccountVault(gAcc.email, activePlayer, state);
  return { msg: applied.msg, prize };
}

window.addEventListener("beforeunload", () => {
  claimPendingWheelPrize();
});

$("wheel-spin-btn")?.addEventListener("click", () => {
  if (isSpinning || spinsState.spins <= 0) return;
  isSpinning = true;
  const res = spinWheel(state, now(), wheelRot, false);
  if (!res) { isSpinning = false; return; }

  pendingWheelPrize = res.prize;
  wheelRot = res.degrees;
  spinsState = loadSpins(todayBR());
  $("wheel-result").textContent = "🎰 Girando a Roleta da Sorte 67…";
  updateWheelBadge();

  const disc = $("wheel-disc");
  if (disc) disc.style.transform = `rotate(${wheelRot}deg)`;

  const tickInterval = setInterval(() => { sfx.wheelTick(); }, 160);

  setTimeout(() => {
    clearInterval(tickInterval);
    isSpinning = false;
    const claimed = claimPendingWheelPrize();
    const finalMsg = claimed ? claimed.msg : res.message;
    sfx.wheelWin();
    if (res.prize.id === "megabrain" || res.prize.id === "overdrive_67") {
      sfx.megaBrain();
      const b = $("banner");
      b.innerHTML = `<small>ROLETA 67 ATIVOU</small>MEGA BRAIN`;
      replay(b, "show");
      fx.flash();
    }
    $("wheel-result").textContent = `🎉 ${finalMsg}`;
    toast(`🎰 Roleta: ${finalMsg}`);
    const r = $("wheel-disc").getBoundingClientRect();
    fx.burst(r.left + r.width / 2, r.top + r.height / 2, null, 25);
    sync?.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);
    spinsState = loadSpins(todayBR());
    updateWheelBadge();
    renderedMenu = "";
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
      sync.broadcastCosmetics(myName, state.equipped as Record<string, string>, state.lifetime, state.prestige);
      void sync.setEquipped(state.equipped as Record<string, string>);
      void pushFullProfileSync();
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

if (saved.away >= 60 && state.lifetime > 0) {
  const before = state.total;
  passive(state, saved.away, now());
  if (state.total > before) welcomeBack(saved.away, state.total - before);
}
localTick();

if (sync) {
  $("ranking-open").hidden = false;
  $("tab-ranking").hidden = false;
  $<HTMLFormElement>("name-form").addEventListener("submit", e => {
    e.preventDefault();
    const val = $<HTMLInputElement>("name").value;
    void handleNicknameChange(val, $("name-msg"));
  });
  void sync.flush();
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

