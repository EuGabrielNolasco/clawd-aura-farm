# 📜 Histórico de Desenvolvimento (Changelog Vivo)

Este documento registra a evolução completa do projeto **Clawd Aura Farm**, desde os primeiros protótipos com o Claude até a versão mais recente.

---

## 🌟 Versão 2.1.0 (Atual) — Experiência Definitiva, Sincronização & Retenção

### 📱 Contas & Sincronização Cross-Device (Celular ⇄ PC)
- **Fim do Login Isolado por Navegador:** Introdução do sistema de chaves de conta portáveis no formato `AURA_<base64url>`.
- **Sincronização por QR Code:** O jogo agora gera um QR Code em SVG na tela do PC para ser lido com a câmera do celular, abrindo a mesma conta instantaneamente.
- **Link Direto de Acesso:** Botão para copiar a URL com `#sync=...`, permitindo mandar para si mesmo no WhatsApp/Telegram. O token é consumido e apagado da barra de endereço para manter a privacidade.
- **Backup & Restauração JSON:** Exportação e importação de arquivo de progresso para segurança offline.

### 🎰 Minigame "Roleta da Sorte 67"
- Sistema de giros da sorte para aumentar a retenção diária dos jogadores.
- 1 giro grátis a cada novo dia no login diário, +1 giro a cada subida de nível e +1 giro a cada captura de ladrão.
- Prêmios sorteados: Fichas 67, Rajadas de Aura Passiva, Ativação Instantânea do Mega Brain e Jackpots.
- Efeitos sonoros dedicados de rotação (`wheelTick`) e vitória (`wheelWin`).

### 📊 Painel de Estatísticas da Carreira
- Aba no menu detalhando métricas do jogador: Aura total, cliques totais, críticos, taxa real de crítico (%), recordes de combo e eventos capturados.

### 🎖️ Barras de Progresso nas Conquistas
- Exibição de barras visuais com porcentagem e contadores (ex: `45 / 67 cliques`, `2 / 3 dias`, `Nível 4 / 6`) para o jogador saber exatamente o que falta para completar cada conquista.

### 📱 Melhorias Mobile & Hápticos
- Vibrações táteis (`navigator.vibrate`) em cliques normais (10ms), críticos (25ms) e eventos especiais (cérebro e ladrão).
- Medidor de CPS (Cliques por Segundo) em tempo real.
- PWA configurado com `manifest.webmanifest` para instalação como aplicativo na tela inicial do celular e PC.

### 📖 Central de Ajuda & Documentação Viva
- Criação da pasta `docs/` com arquitetura, economia, sincronização e roadmap.
- Aba **📖 Guia** integrada no menu do próprio jogo para explicar as regras de forma acessível para jogadores leigos.

---

## ⚡ Versão 2.0.0 — Os 16 Níveis, Memes BR & Ranking Seguro (Sessão com Claude)

- **Expansão para 16 Níveis:** De *NPC* a *O Próprio 67*, passando por *Cria*, *Brabo*, *O Pai Tá On*, *Mega Brain*, *Coop Thief*, *Aura Infinita* e *Deus do 6-7*.
- **Ranking Global Seguro no Supabase:**
  - Banco de dados PostgreSQL com funções `SECURITY DEFINER`.
  - Servidor calcula aura, críticos, combos e eventos para impedir trapaças no cliente.
  - Tabela com Top 10 e modo "Perto de Você" mostrando os jogadores adjacentes.
- **Eventos Dinâmicos:**
  - *Cérebro Dourado:* Ativa o Modo Mega Brain (×7 em toda a aura por 67 segundos) com visual HUD estilo Jarvis.
  - *Ladrão do Coop Thief:* Atravessa a tela e concede Fichas 67 ao ser pego.
- **Loja de Cosméticos:** 16 itens customizáveis desenhados em pixel art SVG (óculos Juliet, camisa da seleção, favela neon, terno, cores e coroas).
- **Prestígio:** Sistema de renascimento no último nível com bônus de +25% permanente.
- **Áudio Sintetizado 8-bit:** Web Audio API com fanfarras épicas por nível e efeitos sonoros retrô.
- **Layout Responsivo:** Adaptação completa para smartphones, tablets e desktops (gaveta lateral no mobile).

---

## 🛠️ Versão 1.5.0 — Migração para Vite + TypeScript

- Migração do protótipo inicial para uma base moderna com Vite, TypeScript e testes automatizados com Vitest.
- Criação da loja com 6 upgrades escaláveis.
- Implementação dos testes de paridade `schema-sync.test.ts`.
- Content Security Policy (CSP) injetada no build de produção.

---

## 🌱 Versão 1.0.0 — O Protótipo Inicial

- HTML puro com o Clawd fazendo o movimento clássico do *six-seven* em loop infinito.
- Contador de cliques e farm de aura inicial.
