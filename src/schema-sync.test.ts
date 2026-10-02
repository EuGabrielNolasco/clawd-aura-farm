// Garante que as constantes de src/game.ts e de supabase/schema.sql não divergem.
// Se este teste falhar, alguém mudou uma regra de um lado só.
import { describe, expect, it } from "vitest";
import schema from "../supabase/schema.sql?raw";
import { LEVEL_BONUS, RANKS, UPGRADES } from "./game";

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
});
