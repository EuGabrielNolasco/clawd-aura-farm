import { describe, expect, it } from "vitest";
import {
  allMaxed, applyEvent, BUFF_MULT, buy, catchGolden, catchThief, click, clickGain, comboFor, costOf, critChance,
  daily, earn, EV, GOLDEN, levelOf, newState, nextRng, OFFLINE_CAP_S, parseEvents, passive, passivePerSecond,
  prestige, RANKS, RNG_MOD, schedule, UPGRADES,
} from "./game";
import { checkAchievements } from "./achievements";

/** Estado do gerador cujo próximo valor não é crítico (10.000 × 48.271 ≈ 22% do módulo). */
const NO_CRIT = 10_000;

describe("níveis", () => {
  it("usa o mínimo de cada nível", () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(6.6e4 - 1)).toBe(0);
    expect(levelOf(6.6e4)).toBe(1);
    expect(levelOf(2.7e11)).toBe(RANKS.length - 1);
    expect(RANKS).toHaveLength(16);
  });

  it("não cai de nível ao gastar aura", () => {
    const s = newState();
    earn(s, 3e5);
    expect(buy(s, "click")).toBe(true);
    expect(levelOf(s.total)).toBe(1);
  });

  it("cada nível dá +10% de aura", () => {
    const s = newState();
    expect(clickGain(s)).toBe(67);
    earn(s, 6.6e4);
    expect(clickGain(s)).toBeCloseTo(67 * 1.1);
  });
});

describe("cliques", () => {
  it("crítico vale 10x e segue o gerador do servidor", () => {
    const s = newState(1);
    // primeiro valor do gerador a partir de 1 é 48271, bem abaixo de 10%: crítico
    expect(click(s)).toEqual({ gain: 670, crit: true });
    expect(s.rng).toBe(48271);
  });

  it("o gerador fica sempre entre 1 e RNG_MOD - 1", () => {
    let r = 12345;
    for (let i = 0; i < 10_000; i++) {
      r = nextRng(r);
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(RNG_MOD);
    }
  });

  it("bate com o servidor (mesma sequência do supabase/test.sql)", () => {
    const s = newState(12345);
    passive(s, 20);
    for (const c of "c".repeat(40) + "amm" + "c".repeat(20) + "a") applyEvent(s, c);
    expect(s.rng).toBe(23524415);
    expect(s.total).toBeCloseTo(10827);
    expect(s.aura).toBeCloseTo(10258);
    expect(s.clicks).toBe(60);
  });

  it("combo vai de ×1 a ×3 entre 3 e 12 cliques/s", () => {
    expect(comboFor(2)).toBe(1);
    expect(comboFor(3)).toBe(1);
    expect(comboFor(7.5)).toBe(2);
    expect(comboFor(12)).toBe(3);
    expect(comboFor(50)).toBe(3);
    const s = newState(NO_CRIT);
    expect(click(s, 3).gain).toBe(67 * 3);
  });
});

describe("aura passiva", () => {
  it("rende por segundo e tem teto de 12 h", () => {
    const s = newState();
    passive(s, 100);
    expect(s.total).toBeCloseTo(200);
    const t = newState();
    passive(t, OFFLINE_CAP_S * 10);
    const u = newState();
    passive(u, OFFLINE_CAP_S);
    expect(t.total).toBeCloseTo(u.total);
  });

  it("recalcula o ganho ao subir de nível no meio do período", () => {
    const s = newState();
    s.upgrades.dc = 10;
    passive(s, 3600);
    // sem recalcular, seria exatamente 3600 × (2 + 40.000)
    expect(s.total).toBeGreaterThan(3600 * 40002);
  });
});

describe("Cérebro Dourado e ladrão", () => {
  it("só pega dentro da janela e ativa ×7", () => {
    const s = newState(2), now = 1000;
    s.goldenAt = now + 60;
    expect(catchGolden(s, now)).toBe(false);
    s.goldenAt = now - 5;
    expect(catchGolden(s, now)).toBe(true);
    expect(s.goldens).toBe(1);
    s.rng = NO_CRIT;
    expect(click(s, 1, now + 1).gain).toBe(67 * BUFF_MULT);
    s.rng = NO_CRIT;
    expect(click(s, 1, now + 100).gain).toBe(67);
    expect(catchGolden(s, now + 1)).toBe(false);
  });

  it("aura passiva para de multiplicar quando o buff acaba", () => {
    const s = newState(), now = 1000;
    s.buffUntil = now - 50;
    passive(s, 100, now);
    expect(s.total).toBeCloseTo(50 * 2 * BUFF_MULT + 50 * 2);
  });

  it("ladrão só aparece a partir do Coop Thief e rende fichas", () => {
    const s = newState(), now = 1000;
    s.thiefAt = now - 2;
    expect(catchThief(s, now)).toBe(false);
    earn(s, 3.9e8);
    expect(catchThief(s, now)).toBe(true);
    expect(s.tokens).toBe(3);
  });

  it("reagenda o que passou sem ser pego", () => {
    const s = newState();
    schedule(s, 1000, () => 0);
    expect(s.goldenAt).toBe(1000 + GOLDEN.min);
    schedule(s, 1000 + GOLDEN.min + 1, () => 0.5);
    expect(s.goldenAt).toBe(1000 + GOLDEN.min);
    schedule(s, 1000 + GOLDEN.min + GOLDEN.show + GOLDEN.slack + 1, () => 0);
    expect(s.goldenAt).toBeGreaterThan(1000 + GOLDEN.min * 2);
  });
});

describe("login diário, conquistas e prestígio", () => {
  it("sequência de dias e recompensa", () => {
    const s = newState();
    expect(daily(s, "2026-10-01")).toBe(5);
    expect(daily(s, "2026-10-01")).toBe(0);
    expect(daily(s, "2026-10-02")).toBe(10);
    expect(s.streak).toBe(2);
    expect(daily(s, "2026-10-05")).toBe(5);
    expect(s.streak).toBe(1);
  });

  it("conquista é concedida uma vez só", () => {
    const s = newState();
    s.clicks = 67;
    expect(checkAchievements(s, 0, false).map(a => a.id)).toEqual(["clicks_67"]);
    expect(s.tokens).toBe(5);
    expect(checkAchievements(s, 0, false)).toEqual([]);
  });

  it("renascer só no nível máximo, mantendo o vitalício e dando +25%", () => {
    const s = newState(2);
    expect(prestige(s)).toBe(false);
    earn(s, 2.7e11);
    s.upgrades.click = 3;
    expect(prestige(s)).toBe(true);
    expect(s.total).toBe(0);
    expect(s.lifetime).toBe(2.7e11);
    expect(s.upgrades.click).toBe(0);
    expect(clickGain(s)).toBe(67 * 1.25);
  });
});

describe("enfeites", () => {
  it("compra com fichas, uma vez só, e equipa só o que tem", () => {
    const s = newState();
    applyEvent(s, EV.buyCosmetic, "E");
    expect(s.owned).toEqual([]);
    s.tokens = 30;
    for (const [c, a] of parseEvents("KEKEEE")) applyEvent(s, c, a);
    expect(s.owned).toEqual(["hat_bone"]);
    expect(s.tokens).toBe(10);
    expect(s.equipped.hat).toBe("hat_bone");
    for (const [c, a] of parseEvents("UHEF")) applyEvent(s, c, a);
    expect(s.equipped.hat).toBeUndefined();
  });

  it("parse do protocolo respeita argumentos", () => {
    expect(parseEvents("cKcEAUBg")).toEqual([["c", ""], ["K", "c"], ["E", "A"], ["U", "B"], ["g", ""]]);
  });
});

describe("loja", () => {
  it("não compra sem aura e encarece a cada compra", () => {
    const s = newState();
    expect(buy(s, "click")).toBe(false);
    earn(s, 1e4);
    const first = costOf(s, "click");
    buy(s, "click");
    expect(costOf(s, "click")).toBeGreaterThan(first);
  });

  it("aplica os efeitos dos upgrades", () => {
    const s = newState();
    s.upgrades = { aux: 2, click: 2, crit: 5, fab: 1, dc: 1, cosmic: 1 };
    expect(passivePerSecond(s)).toBe((2 + 4 + 60 + 4000) * 2);
    expect(clickGain(s)).toBe(67 * 2 * 2);
    expect(critChance(s)).toBeCloseTo(0.25);
  });

  it("todo upgrade tem limite, então dá para completar a loja", () => {
    const s = newState();
    earn(s, 1e30);
    for (const u of UPGRADES) while (buy(s, u.id));
    for (const u of UPGRADES) expect(s.upgrades[u.id]).toBe(u.max);
    expect(allMaxed(s)).toBe(true);
  });
});
