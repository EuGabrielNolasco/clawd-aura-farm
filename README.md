# Clawd Aura Farm

[![Jogar agora](https://img.shields.io/badge/jogar-GitHub%20Pages-ffd166?style=flat-square)](https://eugabrielnolasco.github.io/clawd-aura-farm/)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6?style=flat-square)](LICENSE)
[![Deploy](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml/badge.svg)](https://github.com/EuGabrielNolasco/clawd-aura-farm/actions/workflows/deploy.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-Vite-d97757?style=flat-square)

Jogo incremental (*clicker*) para o navegador. O Clawd, mascote do Claude Code, faz o **six seven** sem parar enquanto você acumula aura e sobe por 11 níveis, cada um com efeitos visuais próprios, e gasta essa aura numa loja de upgrades.

**[▶ Jogar agora](https://eugabrielnolasco.github.io/clawd-aura-farm/)**

## Sumário

- [Funcionalidades](#funcionalidades)
- [Como jogar](#como-jogar)
- [Níveis](#níveis)
- [Loja](#loja)
- [Rodando localmente](#rodando-localmente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Funcionalidades

- **Progressão exponencial:** o ganho por clique é multiplicado por 5 a cada nível.
- **Golpes críticos:** 10% dos cliques valem 10 vezes mais.
- **Aura passiva:** o Clawd também farma sozinho, mesmo sem cliques.
- **Loja de upgrades:** compre Clawds auxiliares, cliques mais fortes e mais chance de crítico.
- **Efeitos que se acumulam:** holofote, óculos, anel arco-íris, coroa, asas, raios, clones e chuva de 67, renderizados com CSS e Canvas.
- **Progresso salvo:** aura e upgrades ficam guardados no `localStorage` do navegador. Saves da versão antiga são migrados automaticamente.
- **Acessível:** dá para jogar pelo teclado (`Enter` ou `Espaço` sobre o Clawd), e as animações são desligadas quando o sistema pede movimento reduzido (`prefers-reduced-motion`).
- **Responsivo:** funciona no celular e no desktop.

## Como jogar

1. Clique no Clawd ou no botão **FARMAR AURA**.
2. Cada clique rende `67 × 5^nível` de aura, mais o bônus da loja.
3. O nível é definido pela **aura total farmada**. Gastar na loja não faz você cair de nível.
4. Ao bater o mínimo de um nível, você sobe e ganha um novo efeito visual.
5. O botão **zerar aura** recomeça o jogo do zero, depois de pedir confirmação.

## Níveis

| # | Nível | Aura total | Multiplicador | Efeito |
|--:|---|--:|--:|---|
| 0 | NPC | 0 | ×1 | nenhum |
| 1 | Figurante | 67 | ×5 | brilho fraco |
| 2 | Main character | 670 | ×25 | holofote |
| 3 | Sigma | 6.700 | ×125 | óculos escuros e fundo roxo |
| 4 | Aura infinita | 67 mil | ×625 | anel arco-íris |
| 5 | Lenda do 6-7 | 670 mil | ×3.125 | coroa e fogo |
| 6 | Ascendido | 6,7 mi | ×15.625 | asas e céu estrelado |
| 7 | Deus do 6-7 | 67 mi | ×78.125 | Clawd dourado, raios e tela tremendo |
| 8 | Multiverso | 670 mi | ×390.625 | clones e um 67 gigante ao fundo |
| 9 | Clawd Supremo | 6,7 bi | ×1.953.125 | cores da tela girando |
| 10 | O Próprio 67 | 67 bi | ×9.765.625 | chuva de 67 |

## Loja

O preço de cada upgrade sobe a cada compra.

| Upgrade | Efeito por nível | Preço inicial | Aumento por compra | Limite |
|---|---|--:|--:|--:|
| Clawd auxiliar | +100% de aura passiva | 200 | ×1,7 | — |
| Mão firme | +50% de aura por clique | 670 | ×2,2 | — |
| Olhar sigma | +3% de chance de crítico | 6.700 | ×3 | 10 (40% de crítico) |

No desktop a loja fica fixa à direita. Em telas menores, ela abre como gaveta pelo botão **Loja**.

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
| `npm run dev` | servidor de desenvolvimento com recarga automática |
| `npm test` | roda os testes das regras do jogo (Vitest) |
| `npm run build` | checa os tipos e gera o site estático em `dist/` |
| `npm run preview` | serve o `dist/` localmente para conferir o build |

## Estrutura do projeto

```
.
├── index.html               # marcação: palco, mascote em SVG, HUD e loja
├── src/
│   ├── main.ts              # liga o DOM às regras: render, cliques, loja
│   ├── game.ts              # regras puras: níveis, ganhos, críticos, upgrades
│   ├── game.test.ts         # testes das regras
│   ├── fx.ts                # efeitos em Canvas: partículas, fogo, raios, estrelas
│   ├── storage.ts           # save no localStorage e migração do formato antigo
│   └── style.css            # visual e efeitos por nível (classes l1 a l10)
├── .github/workflows/
│   └── deploy.yml           # testa, gera o build e publica no GitHub Pages
├── vite.config.ts
└── tsconfig.json
```

| Camada | Tecnologia |
|---|---|
| Linguagem e build | TypeScript + [Vite](https://vite.dev/) |
| Testes | [Vitest](https://vitest.dev/) |
| Mascote | SVG em pixel art |
| Animações e efeitos por nível | CSS |
| Partículas, fogo, raios e estrelas | Canvas 2D |
| Persistência | `localStorage` |
| Fontes | [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) e [VT323](https://fonts.google.com/specimen/VT323) (Google Fonts) |

O jogo não tem dependências em produção: o build gera só HTML, CSS e JavaScript estáticos.

## Deploy

A cada push na `main`, o GitHub Actions roda os testes, gera o build e publica o `dist/` no GitHub Pages. Pull Requests também rodam testes e build, mas não publicam.

## Contribuindo

Contribuições são bem-vindas.

1. Faça um fork do repositório.
2. Instale as dependências com `npm install` e crie uma branch: `git checkout -b minha-feature`.
3. Confira se `npm test` e `npm run build` passam e faça o commit: `git commit -m "Adiciona minha feature"`.
4. Envie a branch: `git push origin minha-feature`.
5. Abra um Pull Request.

Bugs e sugestões podem ser enviados pelas [issues](https://github.com/EuGabrielNolasco/clawd-aura-farm/issues).

## Licença

O código está sob a licença [MIT](LICENSE).

> **Aviso:** este é um projeto de fã, sem vínculo oficial com a Anthropic. O nome Claude e o personagem Clawd são propriedade da Anthropic e não estão cobertos pela licença MIT.

---

Desenvolvido com o [Claude Code](https://claude.com/claude-code).
