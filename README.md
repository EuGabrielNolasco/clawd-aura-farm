# Clawd Aura Farm

[![Jogar agora](https://img.shields.io/badge/jogar-GitHub%20Pages-ffd166?style=flat-square)](https://eugabrielnolasco.github.io/clawd-aura-farm/)
[![Deploy](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml/badge.svg)](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6?style=flat-square)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-Vite-d97757?style=flat-square)

Jogo incremental (*idle clicker*) para o navegador (PC e Celular). O Clawd, mascote do Claude Code, faz o **six seven** sem parar enquanto você farma aura, sobe por **16 níveis** cheios de memes BR, caça Cérebros Dourados, gira a **Roleta da Sorte 67**, veste o Clawd com **36 enfeites** e disputa o **Ranking Global em tempo real**.

**[▶ Jogar agora](https://eugabrielnolasco.github.io/clawd-aura-farm/)**

## Sumário

- [Documentação viva (`docs/`)](#documentação-viva)
- [Funcionalidades](#funcionalidades)
- [Como jogar](#como-jogar)
- [Sincronização com Google OAuth 2.0 (PC ⇄ Celular)](#sincronização-com-google-oauth-20-pc--celular)
- [Roleta da Sorte 67 & Missões Diárias](#roleta-da-sorte-67--missões-diárias)
- [Níveis](#níveis)
- [Loja de Aura (6 Upgrades)](#loja-de-aura-6-upgrades)
- [Eventos, conquistas e enfeites (36 itens)](#eventos-conquistas-e-enfeites-36-itens)
- [Prestígio (Renascer ⭐)](#prestígio-renascer-)
- [Ranking em tempo real e segurança](#ranking-em-tempo-real-e-segurança)
- [Rodando localmente](#rodando-localmente)
- [Configurando o ranking (Supabase)](#configurando-o-ranking-supabase)
- [Painel dev](#painel-dev)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Documentação Viva

O projeto conta com uma central de documentação completa em [`docs/`](docs/):

- **[docs/INDEX.md](docs/INDEX.md):** Hub central da documentação viva.
- **[docs/ARQUITETURA.md](docs/ARQUITETURA.md):** Arquitetura técnica, segurança, anti-cheat e CSP.
- **[docs/CONTAS_E_SINCRONIZACAO.md](docs/CONTAS_E_SINCRONIZACAO.md):** Guia de sincronização e autenticação Google OAuth 2.0.
- **[docs/MECANICAS_E_ECONOMIA.md](docs/MECANICAS_E_ECONOMIA.md):** Fórmulas matemáticas, curvas dos 16 níveis e eventos.
- **[docs/CONQUISTAS_E_COSMETICOS.md](docs/CONQUISTAS_E_COSMETICOS.md):** As 15 conquistas e os 36 enfeites em pixel art SVG.
- **[docs/CHANGELOG.md](docs/CHANGELOG.md):** Histórico completo de versões.
- **[docs/ROADMAP.md](docs/ROADMAP.md):** Próximas ideias e melhorias planejadas.

## Funcionalidades

- **Login e Sincronização com Google OAuth 2.0:** Conecte sua conta com 1 clique no botão **Continuar com o Google** para manter seu progresso salvo e sincronizado entre PC e celular, sem precisar copiar códigos ou chaves manuais.
- **Apelido Personalizável:** Escolha e altere seu apelido no jogo e no Ranking Global a qualquer momento na aba **Conta** ou **Ranking**, independente do nome da sua conta Google.
- **Roleta da Sorte 67 (10 Fatias + Missões Diárias):** Gire a roleta para ganhar pacotes de **Fichas 67** (`+5`, `+10`, `+15`, `+25` e Jackpot de `+67`), **Rajadas/Tempestades/Tsunamis de Aura** ou ativação imediata do **Modo Mega Brain (×7)** e **Overdrive 67 (134s)**.
- **Economia Exclusiva de Giros e Fichas 67:**
  - **Giros na Roleta (🎰):** Recebidos exclusivamente com **Login Diário**, **Missões Diárias concluídas** e **Rank subido** (além de conquistas desbloqueadas).
  - **Fichas 67 (🎟):** Recebidas exclusivamente com **Conquistas concluídas** e **prêmios ganhos na Roleta da Sorte**.
- **Loja de Aura com 6 Upgrades (145 níveis):** De *Clawd auxiliar* e *Mão firme* até *Datacenter do Clawd* e *Aura cósmica*, com custos e efeitos originais balanceados.
- **Loja de Enfeites com 36 Cosméticos:** 8 fundos animados, 8 chapéus, 7 acessórios de rosto, 7 roupas e 6 cores especiais para personalizar o Clawd. O visual equipado fica salvo permanentemente e aparece no avatar do jogador no Ranking Global em tempo real!
- **Prestígio (Renascer ⭐):** Ao alcançar o nível máximo (*O Próprio 67*), renasça zerando a aura atual e toda a loja para recomeçar do nível *NPC* com **+1 Estrela (⭐)** e **+25% de bônus permanente** em toda a aura, mantendo Fichas 67, Enfeites, Conquistas e Aura Vitalícia no Ranking.
- **16 níveis com memes BR:** De *NPC* a *O Próprio 67*, passando por *Cria*, *Brabo*, *O Pai Tá On*, *Sigma*, *Mega Brain* e *Coop Thief*.
- **Combo de cliques e medidor de CPS:** Clicar rápido multiplica a aura dos cliques em até **×3**.
- **Cérebro Dourado & Ladrão do Coop Thief:** Eventos dinâmicos na tela que ativam o *Modo Mega Brain* (HUD Jarvis e ×7 em toda a aura por 67s) ou recuperam aura roubada e avançam missões diárias.
- **Ranking Global em Tempo Real:** Veja o Top Geral e quem está perto de você, com transmissão instantânea de roupas equipadas, estrelas de prestígio e aura vitalícia via Supabase Realtime.
- **Mobile First & PWA Instalável:** Layout responsivo ajustado para celulares sem cortes nem rolagem lateral, vibração háptica (`navigator.vibrate`) e suporte a instalação na tela inicial.
- **Efeitos sonoros 8-bit:** Sintetizados via Web Audio API com opção de mudo.

## Como jogar

1. Clique no Clawd ou no botão **FARMAR AURA**. Clicar rápido enche a barra de **combo** (até ×3).
2. Gaste sua aura na **Loja** para comprar upgrades automáticos e de clique. Os upgrades de aura por segundo continuam rendendo mesmo com o jogo fechado (até 12h offline).
3. Fique atento ao **Cérebro Dourado** voando pela tela (ativa ×7 em toda a aura) e, a partir do nível *Coop Thief*, ao **ladrão**.
4. Conclua **Missões Diárias**, faça **Login Diário** e suba de **Rank** para ganhar giros na **Roleta da Sorte 67**.
5. Junte **Fichas 67** nas **Conquistas** e na **Roleta da Sorte** para comprar e equipar os **36 enfeites** do Clawd.
6. No nível máximo (*O Próprio 67*), clique em **Renascer** para zerar a aura e a loja da vida atual em troca de uma **Estrela (⭐)** que dá **+25% de aura para sempre**.

## Sincronização com Google OAuth 2.0 (PC ⇄ Celular)

- **Continuar com o Google:** Abra a aba **📱 Conta** e clique em **Continuar com o Google**. Sua conta é vinculada via Google OAuth 2.0 sem precisar digitar nenhuma chave ou código.
- **Troca Livre de Apelido:** Você pode definir ou mudar seu apelido no jogo a qualquer momento (de 2 a 20 caracteres), mantendo sua sincronização ativa.
- **Backup em Arquivo (`.json`):** Também é possível baixar ou carregar uma cópia de segurança do progresso em formato `.json`.

## Roleta da Sorte 67 & Missões Diárias

Na aba **🎰 Roleta**, você acompanha em tempo real seus giros disponíveis, suas Fichas 67, sua Aura e seu Buff ativo:

### Como ganhar giros (`+1 🎰`)
- **🔥 Login Diário:** +1 giro grátis garantido no primeiro acesso de cada dia.
- **🎯 Missões Diárias da Roleta:**
  - *Aquecimento 6-7:* Dar 67 cliques no dia (`+1 🎰`)
  - *Olhar Crítico:* Acertar 10 críticos no dia (`+1 🎰`)
  - *Investidor de Aura:* Comprar 3 upgrades na loja no dia (`+1 🎰`)
  - *Reflexo Rápido:* Pegar 1 Cérebro Dourado ou Ladrão no dia (`+1 🎰`)
- **🚀 Subida de Rank & Conquistas:** +1 giro a cada nível alcançado e a cada conquista desbloqueada.

### Os 10 Prêmios da Roleta
| Prêmio | Efeito Creditado na Hora |
|---|---|
| 🎟 **5 Fichas 67** | +5 Fichas 67 para a loja de enfeites |
| ⚡ **Rajada de Aura** | 3 minutos de farm passivo instantâneo |
| 🎟 **10 Fichas 67** | +10 Fichas 67 para a loja de enfeites |
| 🧠 **Mega Brain!** | Ativa ×7 em toda a aura por 67 segundos |
| 🎟 **15 Fichas 67** | +15 Fichas 67 para a loja de enfeites |
| 💥 **Tempestade 67** | 6 minutos de aura passiva instantânea |
| 💎 **25 Fichas 67** | +25 Fichas 67 para a loja de enfeites |
| 🚀 **Overdrive 67** | Ativa ×7 em toda a aura por 134 segundos (dobro de tempo!) |
| 🌊 **Tsunami de Aura** | 10 minutos de aura passiva instantânea |
| 👑 **Jackpot 67!** | +67 Fichas 67 na hora! |

## Níveis

Cada nível concede **+10% em toda a aura**, e cada estrela de prestígio (⭐) soma **+25% permanentes**.

| # | Nível | Aura total necessária | Efeito visual no palco |
|--:|---|--:|---|
| 0 | NPC | 0 | Nenhum |
| 1 | Figurante | 66 mil | Brilho fraco |
| 2 | Cria | 400 mil | Brilho mais forte |
| 3 | Brabo | 1,8 mi | Sobrancelhas bravas |
| 4 | O Pai Tá On | 17 mi | Corrente de ouro |
| 5 | Main character | 28 mi | Holofote |
| 6 | Sigma | 90 mi | Óculos escuros e fundo roxo |
| 7 | Mega Brain | 270 mi | Cérebro gigante com sinapses |
| 8 | Coop Thief | 390 mi | Saco de aura roubada e libera o evento do ladrão |
| 9 | Aura infinita | 650 mi | Anel arco-íris |
| 10 | Lenda do 6-7 | 1,2 bi | Coroa e fogo |
| 11 | Ascendido | 4,6 bi | Asas e céu estrelado |
| 12 | Deus do 6-7 | 15 bi | Clawd dourado, raios e tela tremendo |
| 13 | Multiverso | 45 bi | Clones e um 67 gigante ao fundo |
| 14 | Clawd Supremo | 98 bi | Cores da tela girando |
| 15 | O Próprio 67 | 270 bi | Chuva de 67 e libera o botão **Renascer (⭐)** |

## Loja de Aura (6 Upgrades)

Paga com aura. O preço de cada upgrade sobe exponencialmente a cada compra, somando **145 compras máximas** por vida:

| Upgrade | Efeito por compra | Preço inicial | Escalonamento | Limite |
|---|---|--:|--:|--:|
| **Clawd auxiliar** | +2 de aura por segundo | 50 | ×1,18 | 40 |
| **Mão firme** | +50% de aura por clique | 200 | ×1,30 | 30 |
| **Olhar sigma** | +3% de chance de crítico | 5 mil | ×2,20 | 10 |
| **Fábrica de 67** | +60 de aura por segundo | 20 mil | ×1,22 | 30 |
| **Datacenter do Clawd** | +4.000 de aura por segundo | 20 mi | ×1,25 | 30 |
| **Aura cósmica** | Dobra toda a aura (`×2`) | 3,2 bi | ×5,00 | 5 |

## Eventos, conquistas e enfeites (36 itens)

| Evento | Quando aparece | O que concede |
|---|---|---|
| **Cérebro Dourado** | A cada 3 a 8 min (13 s na tela) | Modo Mega Brain: ×7 em toda a aura por 67 s + avança missão diária |
| **Ladrão** | A partir do nível 8, a cada 4 a 10 min (8 s na tela) | Recupera 1 min de aura passiva + conta para conquistas e missão diária |
| **Login Diário** | Primeiro acesso do dia (horário de Brasília) | +1 giro grátis na Roleta da Sorte + sequência de dias |
| **Combo** | Clicando mais de 3 vezes por segundo | Multiplicador de até ×3 por clique (a 12 cliques/s) |

- **15 Conquistas (`src/achievements.ts`):** De *"Seis sete"* (67 cliques) a *"Uma semana de aura"* (7 dias seguidos), concedendo de **5 a 50 Fichas 67** e **+1 giro na Roleta** cada.
- **36 Enfeites (`src/cosmetics.ts`):** Divididos em 5 categorias (pagos exclusivamente com Fichas 67):
  - **Fundos (8):** *Favela neon*, *Praia de Copacabana*, *Sala de servidores*, *Cidade Cyberpunk*, *Espaço sideral*, *Vulcão de Aura*, *Matrix 67* e *Buraco Negro*.
  - **Chapéus (8):** *Boné aba reta*, *Elmo Viking*, *Headset RGB*, *Cartola Magnata*, *Coroa de ouro*, *Auréola Divina*, *Chifres de Fogo* e *Capacete Mega Brain*.
  - **Rosto (7):** *Bigodão*, *Óculos 3D*, *Óculos Juliet*, *Máscara Ninja*, *Visor Laser*, *Visor Ciborgue* e *Olhos de Fogo*.
  - **Roupa (7):** *Camisa da seleção*, *Moletom Drip 67*, *Capa de herói*, *Manto Real*, *Terno de CEO*, *Armadura Mecha* e *Asas de Anjo*.
  - **Cor (6):** *Clawd Camuflado*, *Clawd neon*, *Clawd Rubi*, *Clawd dourado*, *Clawd Diamante* e *Clawd Sombra*.

## Prestígio (Renascer ⭐)

Ao alcançar o nível 15 (*O Próprio 67*), o botão **✨ Renascer** aparece:
- **Zera a vida atual:** sua Aura atual volta a `0`, o nível volta para `NPC` e todos os 6 upgrades da Loja voltam a `0/máx`.
- **Ganha +1 Estrela (⭐):** concede **+25% permanentes** em toda a aura gerada em todas as vidas futuras.
- **Preserva conquistas e coleção:** suas Fichas 67, seus Enfeites comprados/equipados, suas Conquistas e sua Aura Vitalícia no Ranking Global permanecem intactos.

## Ranking em tempo real e segurança

- **Ranking ao vivo:** mostra a posição, o avatar customizado do Clawd com todos os enfeites equipados, o título do nível, as estrelas de prestígio (⭐) e a aura vitalícia de cada jogador.
- **Sincronização Realtime:** mudanças de roupa/enfeites, estrelas de prestígio e aura vitalícia são transmitidas em tempo real entre os jogadores conectados via Supabase Realtime (Presence + Broadcast).
- **Segurança no servidor (`supabase/schema.sql`):** RLS ativado na tabela `aura_players`, funções `security definer` com validação por hash SHA-256 do segredo da conta, limite de cliques anti-autoclicker e sanitização de apelidos e SVGs.

Os detalhes de segurança estão em [SECURITY.md](SECURITY.md).

## Rodando localmente

Requer [Node.js](https://nodejs.org/) 20 ou mais recente.

```bash
git clone https://github.com/EuGabrielNolasco/clawd-aura-farm.git
cd clawd-aura-farm
npm install
npm run dev
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento com recarga automática |
| `npm test` | Roda as 4 suítes de testes automatizados (Vitest: 41 testes) |
| `npm run build` | Checa os tipos TypeScript (`tsc --noEmit`) e gera o site estático em `dist/` |
| `npm run preview` | Serve a pasta `dist/` localmente para conferir o build de produção |

Para rodar os testes SQL do servidor com Docker:

```bash
docker run -d --rm --name aura-pg -e POSTGRES_PASSWORD=pg postgres:17-alpine
cat supabase/test-setup.sql supabase/schema.sql supabase/test.sql \
  | docker exec -i aura-pg psql -U postgres -v ON_ERROR_STOP=1 -q
```

## Configurando o ranking (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com/).
2. No **SQL Editor**, cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Configure as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `GOOGLE_CLIENT_ID` em **Settings → Secrets and variables → Actions** do repositório no GitHub.

## Painel dev

Em ambiente de desenvolvimento (`npm run dev`), um botão 🛠 aparece no canto inferior esquerdo permitindo testar níveis, eventos, loja e prestígio rapidamente. O painel é removido automaticamente no build de produção (`npm run build`).

## Estrutura do projeto

```text
.
├── index.html               # Marcação principal: palco, mascote SVG, HUD, loja e modais
├── public/
│   ├── favicon.svg          # Ícone do jogo
│   └── manifest.json        # Manifesto PWA para instalação no celular
├── src/
│   ├── main.ts              # Integração de estado, DOM, áudio, OAuth2, Roleta e Ranking
│   ├── game.ts              # Regras do jogo: níveis, 6 upgrades, combo, eventos e prestígio
│   ├── wheel.ts             # Roleta da Sorte 67 (10 fatias, login diário e 4 missões diárias)
│   ├── achievements.ts      # 15 conquistas com progresso e recompensas em Fichas 67
│   ├── cosmetics.ts         # Catálogo de 36 enfeites em pixel art SVG (5 categorias)
│   ├── mini.ts              # Renderizador de miniaturas SVG do Clawd para prévia e ranking
│   ├── online.ts            # Cliente Supabase RPC + canal Realtime de cosméticos e ranking
│   ├── storage.ts           # Persistência local, Google OAuth 2.0, cofre de conta e backup JSON
│   ├── sound.ts             # Sintetizador de efeitos sonoros 8-bit via Web Audio API
│   ├── fx.ts                # Partículas, raios e efeitos visuais em Canvas 2D
│   ├── style.css            # Estilos responsivos (mobile-first), animações e temas de fundo
│   ├── dev.ts               # Painel de testes (exclusivo para npm run dev)
│   ├── game.test.ts         # Testes de regras, loja, níveis, eventos e paridade com SQL
│   ├── wheel.test.ts        # Testes da Roleta da Sorte 67 e missões diárias
│   ├── storage.test.ts      # Testes de persistência, sanitização e backup JSON
│   └── schema-sync.test.ts  # Garante paridade exata entre src/game.ts e supabase/schema.sql
├── supabase/
│   ├── schema.sql           # Tabela, funções RPC (aura_sync, aura_top, aura_around) e RLS
│   ├── test.sql             # Suite de testes SQL executada no Postgres via GitHub Actions
│   └── test-setup.sql       # Configuração de roles para testes SQL no CI
├── .github/
│   └── workflows/deploy.yml # Pipeline CI/CD: testes SQL + Vitest + build + deploy GitHub Pages
├── vite.config.ts           # Configuração do Vite e Content Security Policy (CSP)
└── tsconfig.json
```

## Deploy

A cada push na branch `main`, o workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) executa os testes SQL no Postgres 17, roda os 41 testes unitários no Vitest, compila o projeto com Vite e publica automaticamente no GitHub Pages (`https://eugabrielnolasco.github.io/clawd-aura-farm/`).

## Contribuindo

1. Faça um fork do repositório.
2. Instale as dependências com `npm install` e crie uma branch: `git checkout -b minha-feature`.
3. Verifique se `npm test` e `npm run build` passam sem erros.
4. Caso altere constantes em `src/game.ts`, `src/achievements.ts` ou `src/cosmetics.ts`, espelhe em `supabase/schema.sql` (`src/schema-sync.test.ts` valida a sincronia automaticamente).
5. Envie sua branch e abra um Pull Request.

## Licença

O código está sob a licença [MIT](LICENSE).

> **Aviso:** este é um projeto de fã, sem vínculo oficial com a Anthropic. O nome Claude e o personagem Clawd são propriedade da Anthropic e não estão cobertos pela licença MIT.
