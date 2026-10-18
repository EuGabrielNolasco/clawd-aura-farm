import { describe, expect, it } from "vitest";
import { deduplicateRankRows, type LivePlayerMeta, type RankRow } from "./online";

describe("deduplicateRankRows (ranking online)", () => {
  it("elimina entradas duplicadas do mesmo jogador mantendo maior progresso e prestígio", () => {
    const rows: RankRow[] = [
      { rank: 1, name: "Gabriel Nolasco", lifetime: 22_400_000_000_000, prestige: 4, equipped: { bg: "bg_server" } },
      { rank: 2, name: "gabriel nolasco", lifetime: 10_000_000, prestige: 1, equipped: { hat: "hat_coroa" } },
      { rank: 3, name: "Outro Jogador", lifetime: 50_000_000, prestige: 0, equipped: {} },
    ];

    const result = deduplicateRankRows(rows, undefined, "Gabriel Nolasco");

    // Gabriel Nolasco deve aparecer apenas 1 vez no ranking
    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Gabriel Nolasco");
    expect(result[0].rank).toBe(1);
    expect(result[0].lifetime).toBe(22_400_000_000_000);
    expect(result[0].prestige).toBe(4);
    expect(result[0].me).toBe(true);
    expect(result[0].equipped.bg).toBe("bg_server");
    expect(result[0].equipped.hat).toBe("hat_coroa");

    // Segundo colocado
    expect(result[1].name).toBe("Outro Jogador");
    expect(result[1].rank).toBe(2);
    expect(result[1].lifetime).toBe(50_000_000);
  });

  it("mescla metadados em tempo real de outros jogadores conectados", () => {
    const rows: RankRow[] = [
      { rank: 1, name: "Jogador Alfa", lifetime: 1_000_000, prestige: 0, equipped: {} },
    ];

    const liveMap = new Map<string, LivePlayerMeta>();
    liveMap.set("jogador alfa", {
      name: "Jogador Alfa",
      lifetime: 5_000_000, // ganhou aura ao vivo
      prestige: 1,
      equipped: { hat: "hat_megabrain" },
    });

    const result = deduplicateRankRows(rows, liveMap);
    expect(result.length).toBe(1);
    expect(result[0].lifetime).toBe(5_000_000);
    expect(result[0].prestige).toBe(1);
    expect(result[0].equipped.hat).toBe("hat_megabrain");
  });

  it("reordena e reatribui posições limpas (#1, #2, #3...)", () => {
    const rows: RankRow[] = [
      { rank: 99, name: "Bronze", lifetime: 100, prestige: 0, equipped: {} },
      { rank: 99, name: "Ouro", lifetime: 10_000, prestige: 2, equipped: {} },
      { rank: 99, name: "Prata", lifetime: 1_000, prestige: 1, equipped: {} },
    ];

    const result = deduplicateRankRows(rows);
    expect(result.map(r => r.name)).toEqual(["Ouro", "Prata", "Bronze"]);
    expect(result.map(r => r.rank)).toEqual([1, 2, 3]);
  });

  it("prioriza localProgress colocando o jogador em #1 se o progresso local for maior", () => {
    const rows: RankRow[] = [
      { rank: 1, name: "Diogo Nolasco", lifetime: 4_650_000_000_000, prestige: 3, equipped: {} },
      { rank: 2, name: "Gabriel Nolasco", lifetime: 819_000_000_000, prestige: 2, equipped: {} },
    ];

    // Jogador local possui 22.4 trilhões e 4 estrelas
    const result = deduplicateRankRows(rows, undefined, "Gabriel Nolasco", {
      lifetime: 22_400_000_000_000,
      prestige: 4,
      equipped: { hat: "hat_coroa" },
    });

    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Gabriel Nolasco");
    expect(result[0].rank).toBe(1);
    expect(result[0].lifetime).toBe(22_400_000_000_000);
    expect(result[0].prestige).toBe(4);
    expect(result[0].me).toBe(true);

    expect(result[1].name).toBe("Diogo Nolasco");
    expect(result[1].rank).toBe(2);
  });

  it("inclui jogador local mesmo se não estiver presente na lista do servidor", () => {
    const rows: RankRow[] = [
      { rank: 1, name: "Outro Jogador", lifetime: 1_000_000, prestige: 0, equipped: {} },
    ];

    const result = deduplicateRankRows(rows, undefined, "Novo Jogador", {
      lifetime: 5_000_000,
      prestige: 1,
    });

    expect(result.length).toBe(2);
    expect(result[0].name).toBe("Novo Jogador");
    expect(result[0].rank).toBe(1);
    expect(result[0].lifetime).toBe(5_000_000);
    expect(result[0].me).toBe(true);
  });

  it("propaga e preserva level e total da vida atual dos jogadores em tempo real", () => {
    // Gabriel Nolasco tem 22 Trilhões vitalício, mas renasceu e seu rank atual é Multiverso (nível 7, total 270M)
    const rows: RankRow[] = [
      { rank: 1, name: "Gabriel Nolasco", lifetime: 22_400_000_000_000, prestige: 4, equipped: {} },
    ];

    const liveMap = new Map<string, LivePlayerMeta>();
    liveMap.set("gabriel nolasco", {
      name: "Gabriel Nolasco",
      lifetime: 22_400_000_000_000,
      prestige: 4,
      total: 280_000_000,
      level: 7, // Multiverso
      equipped: { hat: "hat_coroa", bg: "bg_server" },
    });

    const result = deduplicateRankRows(rows, liveMap);
    expect(result.length).toBe(1);
    expect(result[0].level).toBe(7);
    expect(result[0].total).toBe(280_000_000);
    expect(result[0].equipped.hat).toBe("hat_coroa");
    expect(result[0].equipped.bg).toBe("bg_server");
  });

  it("garante que o progresso local repassa level e total corretos", () => {
    const rows: RankRow[] = [
      { rank: 1, name: "Gabriel Nolasco", lifetime: 22_400_000_000_000, prestige: 4, equipped: {} },
    ];

    const result = deduplicateRankRows(rows, undefined, "Gabriel Nolasco", {
      lifetime: 22_400_000_000_000,
      prestige: 4,
      total: 300_000_000,
      level: 7,
      equipped: { hat: "hat_megabrain" },
    });

    expect(result[0].level).toBe(7);
    expect(result[0].total).toBe(300_000_000);
    expect(result[0].equipped.hat).toBe("hat_megabrain");
    expect(result[0].me).toBe(true);
  });
});

