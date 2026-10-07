import { describe, expect, it } from "vitest";
import { newState } from "./game";
import { loadSpins, PRIZES, renderWheelSvg, saveSpins, spinWheel } from "./wheel";

describe("Roleta da Sorte 67", () => {
  it("carrega giros diários e adiciona 1 no primeiro acesso do dia", () => {
    saveSpins({ spins: 0, lastDailyDate: "2026-10-01" });
    const s = loadSpins("2026-10-02");
    expect(s.spins).toBe(1);
    expect(s.lastDailyDate).toBe("2026-10-02");
  });

  it("não duplica giros se já pegou no mesmo dia", () => {
    saveSpins({ spins: 1, lastDailyDate: "2026-10-02" });
    const s = loadSpins("2026-10-02");
    expect(s.spins).toBe(1);
  });

  it("gira a roleta quando tem giros disponíveis e aplica o prêmio", () => {
    saveSpins({ spins: 1, lastDailyDate: "2026-10-02" });
    const state = newState();
    const res = spinWheel(state, 1000);
    expect(res).not.toBeNull();
    expect(res!.remainingSpins).toBe(0);
    expect(res!.degrees).toBeGreaterThanOrEqual(360 * 5);
    expect(PRIZES).toContain(res!.prize);
  });

  it("bloqueia giro se não houver giros restantes", () => {
    saveSpins({ spins: 0, lastDailyDate: "2026-10-02" });
    const state = newState();
    const res = spinWheel(state, 1000);
    expect(res).toBeNull();
  });

  it("gera SVG das fatias com todos os prêmios", () => {
    const svg = renderWheelSvg(PRIZES);
    expect(svg).toContain("<path");
    expect(svg).toContain("<text");
    for (const p of PRIZES) {
      expect(svg).toContain(p.name);
    }
  });
});
