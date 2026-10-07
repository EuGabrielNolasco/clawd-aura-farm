# 📚 Central da Documentação Viva — Clawd Aura Farm

> **Status:** Documentação Ativa & Viva  
> **Versão do Jogo:** v2.1.0  
> **Stack:** TypeScript 7, Vite 8, Vitest 5, Supabase (PostgreSQL 15+ / PostgREST)  
> **Deploy:** GitHub Pages + GitHub Actions  

Bem-vindo à **Documentação Viva** do **Clawd Aura Farm**! Esta base de conhecimento não é estática: ela reflete com exatidão a arquitetura do código-fonte, as regras sincronizadas no servidor de banco de dados, os cálculos matemáticos da economia e as instruções de operação do sistema.

---

## 🧭 Índice Geral

1. **[Arquitetura & Engenharia de Software](ARQUITETURA.md)**
   - Filosofia zero-dependências em produção e offline-first.
   - Divisão de responsabilidades: Regras puras (`src/game.ts`), DOM (`src/main.ts`), Áudio 8-bit (`src/sound.ts`), Canvas FX (`src/fx.ts`) e Servidor Seguro (`supabase/schema.sql`).
   - Política de Segurança de Conteúdo (CSP) e antifraude.

2. **[Contas & Sincronização entre Dispositivos (PC & Celular)](CONTAS_E_SINCRONIZACAO.md)**
   - Como funciona a identidade do jogador (`id` UUID + `secret` 256 bits).
   - O problema histórico do login isolado em navegador e como foi resolvido na v2.1.0.
   - Token de Conta `AURA_<base64url>`, Link Direto (`#sync=...`) e **QR Code Interativo**.
   - Fluxo de importação/exportação de backups em formato JSON.

3. **[Mecânicas de Jogo, Economia & Progressão](MECANICAS_E_ECONOMIA.md)**
   - Curva de progressão matemática dos 16 níveis com memes brasileiros.
   - Upgrades da loja, multiplicadores e prestígio (renascimento permanente).
   - Eventos aleatórios: Cérebro Dourado (Modo Mega Brain ×7), Ladrão do Coop Thief e Roleta da Sorte 67.
   - Medidor de CPS e feedback tátil (háptico) para smartphones.

4. **[Conquistas & Catálogo de Cosméticos](CONQUISTAS_E_COSMETICOS.md)**
   - Lista completa das 15 conquistas, critérios de validação e Fichas 67.
   - Barras de progresso em tempo real.
   - Catálogo dos 16 enfeites SVG: cenários, chapéus, rostos, trajes e cores.

5. **[Histórico de Desenvolvimento (Changelog Vivo)](CHANGELOG.md)**
   - Resumo das sessões anteriores com o Claude e criação da base do jogo.
   - Detalhes de todas as versões: v1.0.0 (HTML puro) ➔ v1.5.0 (Vite + TS) ➔ v2.0.0 (Memes BR + Ranking) ➔ v2.1.0 (Login Cross-Device, Roleta 67, PWA, Haptics).

6. **[Roadmap & Futuras Melhorias](ROADMAP.md)**
   - Próximas ideias de retenção, clãs/cooperativo de aura e novos eventos.

---

## ⚡ Princípios da Documentação Viva

- **Paridade Absoluta:** O arquivo `src/schema-sync.test.ts` garante que constantes no código TypeScript e no script SQL do Supabase nunca divirjam.
- **Transparência de Protocolo:** Todas as mensagens trocadas entre o cliente e o servidor são documentadas e auditadas em testes automatizados.
- **Fácil para Leigos, Poderoso para Desenvolvedores:** Documentação técnica para quem coda, e explicações intuitivas dentro da interface do próprio jogo para os jogadores.
