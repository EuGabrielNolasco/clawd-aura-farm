import { describe, expect, it } from "vitest";
import {
  exportAccountToken, parseAccountToken, exportSaveJson, importSaveJson,
  sanitize, type Player
} from "./storage";
import { newState } from "./game";

describe("storage e sincronização de contas", () => {
  const samplePlayer: Player = {
    id: "e4eaaaf2-d142-11e1-b3e4-080027620cdd",
    secret: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  it("exporta e decodifica token de conta perfeitamente", () => {
    const token = exportAccountToken(samplePlayer);
    expect(token).toMatch(/^AURA_/);
    const parsed = parseAccountToken(token);
    expect(parsed).toEqual(samplePlayer);
  });

  it("decodifica URL completa com #sync= ou ?sync=", () => {
    const token = exportAccountToken(samplePlayer);
    const urlHash = `https://eugabrielnolasco.github.io/clawd-aura-farm/#sync=${token}`;
    expect(parseAccountToken(urlHash)).toEqual(samplePlayer);

    const urlQuery = `http://localhost:5173/?sync=${token}`;
    expect(parseAccountToken(urlQuery)).toEqual(samplePlayer);
  });

  it("decodifica id:secret direto caso o usuário cole cru", () => {
    const raw = `${samplePlayer.id}:${samplePlayer.secret}`;
    expect(parseAccountToken(raw)).toEqual(samplePlayer);
  });

  it("rejeita tokens corrompidos ou inválidos", () => {
    expect(parseAccountToken("")).toBeNull();
    expect(parseAccountToken("AURA_invalid123")).toBeNull();
    expect(parseAccountToken("123:abc")).toBeNull();
  });

  it("exporta e importa backup JSON com integridade", () => {
    const state = newState();
    state.aura = 1234;
    state.total = 5678;
    state.lifetime = 9999;
    state.tokens = 42;

    const jsonStr = exportSaveJson(state, samplePlayer);
    const restored = importSaveJson(jsonStr);
    expect(restored).not.toBeNull();
    expect(restored!.player).toEqual(samplePlayer);
    expect(restored!.state.aura).toBe(1234);
    expect(restored!.state.total).toBe(5678);
    expect(restored!.state.tokens).toBe(42);
  });

  it("sanitiza dados externos com segurança", () => {
    const dirty = {
      aura: -50,
      total: "invalido",
      lifetime: 500,
      tokens: 10,
      upgrades: { aux: 999 }, // limite do aux é 40
    };
    const clean = sanitize(dirty as any);
    expect(clean.aura).toBe(0);
    expect(clean.total).toBe(0);
    expect(clean.lifetime).toBe(500);
    expect(clean.tokens).toBe(10);
    expect(clean.upgrades.aux).toBe(40);
  });
});
