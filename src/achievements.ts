// Conquistas. O servidor confere as mesmas condições (supabase/schema.sql) e é quem concede no
// modo online; aqui elas servem para o modo local e para a tela de medalhas.

import type { State } from "./game";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** Fichas 67 dadas ao desbloquear. */
  reward: number;
  done: (s: State, level: number, shopFull: boolean) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "clicks_67", name: "Seis sete", desc: "Clicar 67 vezes", reward: 5, done: s => s.clicks >= 67 },
  { id: "clicks_6767", name: "Dedo de aço", desc: "Clicar 6.767 vezes", reward: 15, done: s => s.clicks >= 6767 },
  { id: "clicks_67k", name: "Tendinite de aura", desc: "Clicar 67.000 vezes", reward: 40, done: s => s.clicks >= 67000 },
  { id: "crit_1", name: "Foi crítico", desc: "Dar o primeiro crítico", reward: 5, done: s => s.crits >= 1 },
  { id: "crit_100", name: "Só crítico", desc: "Dar 100 críticos", reward: 15, done: s => s.crits >= 100 },
  { id: "lvl_sigma", name: "Sigma", desc: "Chegar no nível Sigma", reward: 10, done: (_s, l) => l >= 6 },
  { id: "lvl_megabrain", name: "Usa o Mega Brain", desc: "Chegar no nível Mega Brain", reward: 15, done: (_s, l) => l >= 7 },
  { id: "lvl_max", name: "O Próprio 67", desc: "Chegar no último nível", reward: 50, done: (_s, l) => l >= 15 },
  { id: "shop_full", name: "Comprei tudo", desc: "Completar a loja de upgrades", reward: 50, done: (_s, _l, full) => full },
  { id: "golden_1", name: "Ativar Mega Brain", desc: "Pegar um Cérebro Dourado", reward: 10, done: s => s.goldens >= 1 },
  { id: "golden_10", name: "Jarvis, liga tudo", desc: "Pegar 10 Cérebros Dourados", reward: 25, done: s => s.goldens >= 10 },
  { id: "thief_5", name: "Pega ladrão", desc: "Capturar 5 ladrões", reward: 20, done: s => s.thieves >= 5 },
  { id: "streak_3", name: "Viciado", desc: "Jogar 3 dias seguidos", reward: 15, done: s => s.streak >= 3 },
  { id: "streak_7", name: "Uma semana de aura", desc: "Jogar 7 dias seguidos", reward: 40, done: s => s.streak >= 7 },
  { id: "prestige_1", name: "Renascido", desc: "Renascer pela primeira vez", reward: 50, done: s => s.prestige >= 1 },
];

/** Concede as conquistas novas (modo local). Devolve as que foram desbloqueadas agora. */
export function checkAchievements(s: State, level: number, shopFull: boolean): Achievement[] {
  const fresh = ACHIEVEMENTS.filter(a => !s.achievements.includes(a.id) && a.done(s, level, shopFull));
  for (const a of fresh) {
    s.achievements.push(a.id);
    s.tokens += a.reward;
  }
  return fresh;
}

export interface ProgressInfo {
  current: number;
  target: number;
  label: string;
  pct: number;
}

/** Calcula o progresso visual de uma conquista para a barra de progresso. */
export function achievementProgress(a: Achievement, s: State, level: number, shopFull: boolean): ProgressInfo {
  const done = s.achievements.includes(a.id) || a.done(s, level, shopFull);
  let current = 0;
  let target = 1;
  let label = "";

  switch (a.id) {
    case "clicks_67":
      current = s.clicks; target = 67; label = `${Math.min(current, target)} / 67 cliques`; break;
    case "clicks_6767":
      current = s.clicks; target = 6767; label = `${Math.min(current, target).toLocaleString("pt-BR")} / 6.767 cliques`; break;
    case "clicks_67k":
      current = s.clicks; target = 67000; label = `${Math.min(current, target).toLocaleString("pt-BR")} / 67.000 cliques`; break;
    case "crit_1":
      current = s.crits; target = 1; label = `${Math.min(current, target)} / 1 crítico`; break;
    case "crit_100":
      current = s.crits; target = 100; label = `${Math.min(current, target)} / 100 críticos`; break;
    case "lvl_sigma":
      current = level; target = 6; label = `Nível ${Math.min(current, target)} / 6`; break;
    case "lvl_megabrain":
      current = level; target = 7; label = `Nível ${Math.min(current, target)} / 7`; break;
    case "lvl_max":
      current = level; target = 15; label = `Nível ${Math.min(current, target)} / 15`; break;
    case "shop_full":
      current = Object.values(s.upgrades).reduce((acc, v) => acc + v, 0);
      target = 40 + 30 + 10 + 30 + 30 + 5; // 145 upgrades no total
      label = `${current} / ${target} itens`;
      break;
    case "golden_1":
      current = s.goldens; target = 1; label = `${Math.min(current, target)} / 1 cérebro`; break;
    case "golden_10":
      current = s.goldens; target = 10; label = `${Math.min(current, target)} / 10 cérebros`; break;
    case "thief_5":
      current = s.thieves; target = 5; label = `${Math.min(current, target)} / 5 ladrões`; break;
    case "streak_3":
      current = s.streak; target = 3; label = `${Math.min(current, target)} / 3 dias`; break;
    case "streak_7":
      current = s.streak; target = 7; label = `${Math.min(current, target)} / 7 dias`; break;
    case "prestige_1":
      current = s.prestige; target = 1; label = `${Math.min(current, target)} / 1 renascimento`; break;
    default:
      current = done ? 1 : 0; target = 1; label = done ? "Completo" : "Em andamento";
  }

  const pct = done ? 100 : Math.min(100, Math.max(0, Math.floor((current / target) * 100)));
  return { current, target, label, pct };
}

