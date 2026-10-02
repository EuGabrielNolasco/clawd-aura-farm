// Garante que as constantes de src/game.ts e de supabase/schema.sql não divergem.
// Se este teste falhar, alguém mudou uma regra de um lado só.
import { describe, expect, it } from "vitest";
import schema from "../supabase/schema.sql?raw";
import { ACHIEVEMENTS } from "./achievements";
import { COSMETICS, SLOTS } from "./cosmetics";
import { BUFF_MULT, BUFF_S, GOLDEN, LEVEL_BONUS, LV, PRESTIGE_BONUS, RANKS, THIEF, UPGRADES } from "./game";

/** Lê o primeiro array SQL que vem depois de `marker`. */
function sqlArray(marker: string): number[] {
  const at = schema.indexOf(marker);
  expect(at, `marcador não encontrado: ${marker}`).toBeGreaterThan(-1);
  const body = schema.slice(at).match(/array\[([^\]]*)\]/)![1];
  return body.split(",").map(Number);
}

describe("schema.sql espelha game.ts", () => {
  it("níveis", () => {
    const levels = RANKS.map(([min]) => min);
    expect(sqlArray("function public.aura_level")).toEqual(levels);
    expect(sqlArray("function public.aura_threshold")).toEqual(levels);
  });

  it("bônus por nível", () => {
    const m = schema.match(/power\(([\d.]+)::float8, public\.aura_level/);
    expect(Number(m![1])).toBe(LEVEL_BONUS);
  });

  it("preços, crescimento, limites e letras dos upgrades", () => {
    expect(sqlArray("v_base float8[]")).toEqual(UPGRADES.map(u => u.baseCost));
    expect(sqlArray("v_growth float8[]")).toEqual(UPGRADES.map(u => u.growth));
    expect(sqlArray("v_max int[]")).toEqual(UPGRADES.map(u => u.max));
    expect(schema).toContain(`strpos('${UPGRADES.map(u => u.code).join("")}', v_ev)`);
  });

  it("prestígio", () => {
    expect(schema).toContain(`(1 + ${PRESTIGE_BONUS}::float8 * p_prestige)`);
    expect(schema).toContain(`continue when public.aura_level(p.total) < ${LV.max};`);
  });

  it("Cérebro Dourado e ladrão", () => {
    expect(schema).toContain(`interval '${GOLDEN.show + GOLDEN.slack} seconds'`);
    expect(schema).toContain(`make_interval(secs => ${GOLDEN.min} + random() * ${GOLDEN.max - GOLDEN.min})`);
    expect(schema).toContain(`make_interval(secs => ${BUFF_S} + ${GOLDEN.min} + random() * ${GOLDEN.max - GOLDEN.min})`);
    expect(schema).toContain(`v_now + interval '${BUFF_S} seconds'`);
    expect(schema).toContain(`then ${BUFF_MULT} else 1 end`);
    expect(schema).toContain(`interval '${THIEF.show + THIEF.slack} seconds'`);
    expect(schema).toContain(`make_interval(secs => ${THIEF.min} + random() * ${THIEF.max - THIEF.min})`);
    expect(schema).toContain(`p.tokens := p.tokens + ${THIEF.tokens};`);
    expect(schema).toContain(`public.aura_level(p.total) < ${LV.coopThief}`);
  });

  it("catálogo de enfeites", () => {
    const rows = [...schema.matchAll(/\('([A-Z])', '(\w+)', '(\w+)', (\d+)\)/g)].map(m => [m[1], m[2], m[3], Number(m[4])]);
    expect(rows).toEqual(COSMETICS.map(c => [c.code, c.id, c.slot, c.price]));
    for (const sl of SLOTS) expect(schema).toContain(`when '${sl.code}' then '${sl.id}'`);
  });

  it("conquistas e recompensas", () => {
    const rows = [...schema.matchAll(/\('(\w+)', [^()]*?(?:\([^)]*\)[^()]*?)*, (\d+)\)/g)]
      .map(m => [m[1], Number(m[2])]).filter(([id]) => ACHIEVEMENTS.some(a => a.id === id));
    expect(rows).toEqual(ACHIEVEMENTS.map(a => [a.id, a.reward]));
  });
});
