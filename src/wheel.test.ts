import { describe, expect, it } from "vitest";
import { newState } from "./game";
import { loadSpins, PRIZES, recordMissionProgress, renderWheelSvg, saveSpins, spinWheel } from "./wheel";

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

  it("concede +1 giro ao concluir missão diária da roleta (sem dar fichas)", () => {
    saveSpins({ spins: 0, lastDailyDate: "2026-10-02" });
    const done1 = recordMissionProgress("2026-10-02", "events", 1);
    expect(done1).toHaveLength(1);
    expect(loadSpins("2026-10-02").spins).toBe(1);
    // não repete a mesma missão no mesmo dia
    const done2 = recordMissionProgress("2026-10-02", "events", 1);
    expect(done2).toHaveLength(0);
    expect(loadSpins("2026-10-02").spins).toBe(1);
  });

  it("gira a roleta quando tem giros disponíveis e aplica o prêmio", () => {
    saveSpins({ spins: 1, lastDailyDate: "2026-10-02" });
    const state = newState();
    const res = spinWheel(state, 1000);
    expect(res).not.toBeNull();
    expect(res!.remainingSpins).toBe(0);
    expect(res!.degrees).toBeGreaterThanOrEqual(360 * 5);
    expect(PRIZES).toHaveLength(10);
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
