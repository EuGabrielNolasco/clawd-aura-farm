import { describe, expect, it } from "vitest";
import {
  allMaxed, applyEvent, buy, click, clickGain, costOf, critChance, earn, levelOf, newState,
  nextRng, OFFLINE_CAP_S, passive, passivePerSecond, RANKS, RNG_MOD, UPGRADES,
} from "./game";

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
    for (const c of "c".repeat(40) + "amm" + "c".repeat(20) + "a") applyEvent(s, c);
    expect(s.rng).toBe(23524415);
    expect(s.total).toBe(10787);
    expect(s.aura).toBe(10218);
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
