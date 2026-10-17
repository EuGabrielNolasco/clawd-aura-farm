import { describe, expect, it } from "vitest";
import {
  exportAccountToken, parseAccountToken, exportSaveJson, importSaveJson,
  parseGoogleJwt, sanitize, type Player, exportSyncPayload, parseSyncPayload,
  mergeStates, derivePlayerFromGoogle
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

  it("decodifica payload JWT do Google OAuth 2.0", () => {
    const payload = btoa(JSON.stringify({
      sub: "10987654321",
      email: "JogadorTeste@exemplo.com",
      name: "Jogador Teste",
    }));
    const fakeJwt = `eyJhbGciOiJSUzI1NiJ9.${payload}.assinatura`;
    const parsed = parseGoogleJwt(fakeJwt);
    expect(parsed).toEqual({
      sub: "10987654321",
      email: "jogadorteste@exemplo.com",
      name: "Jogador Teste",
      picture: undefined,
    });
    expect(parseGoogleJwt("invalido")).toBeNull();
  });

  it("exporta e decodifica payload de sincronização com progresso completo (PC ⇄ Celular)", () => {
    const s = newState();
    s.aura = 141_223_625_618;
    s.total = 141_223_625_618;
    s.lifetime = 141_223_625_618;
    s.prestige = 3;
    s.upgrades.aux = 40;
    s.upgrades.click = 30;

    const token = exportSyncPayload(samplePlayer, s);
    expect(token).toMatch(/^AURA_SYNC_/);

    const parsed = parseSyncPayload(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.player).toEqual(samplePlayer);
    expect(parsed!.state?.aura).toBe(141_223_625_618);
    expect(parsed!.state?.prestige).toBe(3);
    expect(parsed!.state?.upgrades?.aux).toBe(40);
  });

  it("mescla estados priorizando o maior progresso de cada aparelho", () => {
    const local = newState();
    local.aura = 121_273_357; // celular antigo
    local.lifetime = 121_273_357;
    local.tokens = 505; // celular tem fichas da roleta
    local.prestige = 3;

    const pcState = newState();
    pcState.aura = 141_223_625_618; // PC com muito mais aura
    pcState.lifetime = 141_223_625_618;
    pcState.tokens = 0;
    pcState.prestige = 3;
    pcState.upgrades.aux = 40;

    const merged = mergeStates(local, pcState);
    expect(merged.aura).toBe(141_223_625_618);
    expect(merged.lifetime).toBe(141_223_625_618);
    expect(merged.tokens).toBe(505); // preserva as fichas
    expect(merged.upgrades.aux).toBe(40); // preserva a loja no máximo
  });

  it("deriva par (id, secret) determinístico a partir do Google sub", async () => {
    const p1 = await derivePlayerFromGoogle("104829104810294819204");
    const p2 = await derivePlayerFromGoogle("104829104810294819204");

    // Mesmo Google sub em aparelhos diferentes deve gerar exatamente o mesmo id e secret
    expect(p1.id).toBe(p2.id);
    expect(p1.secret).toBe(p2.secret);
    expect(p1.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(p1.secret.length).toBe(64);
  });
});
