import { describe, expect, it } from "vitest";
import { buy, click, clickGain, costOf, critChance, earn, levelOf, newState, passivePerTick, RANKS } from "./game";

describe("níveis", () => {
  it("usa o mínimo de cada nível", () => {
    expect(levelOf(0)).toBe(0);
    expect(levelOf(66)).toBe(0);
    expect(levelOf(67)).toBe(1);
    expect(levelOf(6.7e10)).toBe(RANKS.length - 1);
  });

  it("não cai de nível ao gastar aura", () => {
    const s = newState();
    earn(s, 1000);
    expect(buy(s, "passive")).toBe(true);
    expect(s.aura).toBe(800);
    expect(levelOf(s.total)).toBe(2);
  });
});

describe("cliques", () => {
  it("multiplica por 5 a cada nível", () => {
    const s = newState();
    expect(clickGain(s)).toBe(67);
    earn(s, 670);
    expect(clickGain(s)).toBe(67 * 25);
  });

  it("crítico vale 10x", () => {
    const s = newState();
    expect(click(s, () => 0)).toEqual({ gain: 670, crit: true });
    expect(click(newState(), () => 0.99)).toEqual({ gain: 67, crit: false });
  });
});

describe("loja", () => {
  it("não compra sem aura e encarece a cada compra", () => {
    const s = newState();
    expect(buy(s, "click")).toBe(false);
    earn(s, 10_000);
    const first = costOf(s, "click");
    buy(s, "click");
    expect(costOf(s, "click")).toBeGreaterThan(first);
  });

  it("aplica os efeitos dos upgrades", () => {
    const s = newState();
    s.upgrades = { passive: 2, click: 2, crit: 5 };
    expect(passivePerTick(s)).toBe(6 * 3);
    expect(clickGain(s)).toBe(67 * 2);
    expect(critChance(s)).toBeCloseTo(0.25);
  });

  it("respeita o limite do Olhar sigma", () => {
    const s = newState();
    s.upgrades.crit = 10;
    earn(s, 1e30);
    expect(buy(s, "crit")).toBe(false);
  });
});
