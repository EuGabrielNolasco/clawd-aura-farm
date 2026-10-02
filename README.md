# Clawd Aura Farm

[![Jogar agora](https://img.shields.io/badge/jogar-GitHub%20Pages-ffd166?style=flat-square)](https://eugabrielnolasco.github.io/clawd-aura-farm/)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-8b5cf6?style=flat-square)](LICENSE)
![Sem dependências](https://img.shields.io/badge/depend%C3%AAncias-0-d97757?style=flat-square)

Jogo incremental (*clicker*) para o navegador. O Clawd, mascote do Claude Code, faz o **six seven** sem parar enquanto você acumula aura e sobe por 11 níveis, cada um com efeitos visuais próprios.

**[▶ Jogar agora](https://eugabrielnolasco.github.io/clawd-aura-farm/)**

## Sumário

- [Funcionalidades](#funcionalidades)
- [Como jogar](#como-jogar)
- [Níveis](#níveis)
- [Rodando localmente](#rodando-localmente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Funcionalidades

- **Progressão exponencial:** o ganho por clique é multiplicado por 5 a cada nível.
- **Golpes críticos:** 10% dos cliques valem 10 vezes mais.
- **Aura passiva:** o Clawd também farma sozinho, mesmo sem cliques.
- **Efeitos que se acumulam:** holofote, óculos, anel arco-íris, coroa, asas, raios, clones e chuva de 67, renderizados com CSS e Canvas.
- **Progresso salvo:** a aura fica guardada no `localStorage` do navegador.
- **Acessível:** dá para jogar pelo teclado (`Enter` ou `Espaço` sobre o Clawd), e as animações são desligadas quando o sistema pede movimento reduzido (`prefers-reduced-motion`).
- **Responsivo:** funciona no celular e no desktop.

## Como jogar

1. Clique no Clawd ou no botão **FARMAR AURA**.
2. Cada clique rende `67 × 5^nível` de aura.
3. Ao bater o mínimo de aura de um nível, você sobe e ganha um novo efeito visual.
4. O botão **zerar aura** recomeça o jogo do zero.

## Níveis

| # | Nível | Aura mínima | Multiplicador | Efeito |
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

## Rodando localmente

O jogo não tem build nem dependências. Basta abrir o arquivo no navegador:

```bash
git clone https://github.com/EuGabrielNolasco/clawd-aura-farm.git
cd clawd-aura-farm
xdg-open index.html   # macOS: open index.html | Windows: start index.html
```

Se preferir servir por HTTP:

```bash
python3 -m http.server 8000
# depois acesse http://localhost:8000
```

## Estrutura do projeto

```
.
├── index.html   # jogo completo: marcação, estilos (CSS) e lógica (JavaScript)
├── LICENSE      # licença MIT
└── README.md
```

| Camada | Tecnologia |
|---|---|
| Interface e mascote | HTML + SVG em pixel art |
| Animações e efeitos por nível | CSS (classes `l1` a `l10` aplicadas ao palco) |
| Partículas, fogo, raios e estrelas | Canvas 2D |
| Persistência | `localStorage` |
| Fontes | [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans) e [VT323](https://fonts.google.com/specimen/VT323) (Google Fonts) |

A publicação é feita pelo GitHub Pages direto da branch `main`.

## Contribuindo

Contribuições são bem-vindas.

1. Faça um fork do repositório.
2. Crie uma branch: `git checkout -b minha-feature`.
3. Faça o commit das mudanças: `git commit -m "Adiciona minha feature"`.
4. Envie a branch: `git push origin minha-feature`.
5. Abra um Pull Request.

Bugs e sugestões podem ser enviados pelas [issues](https://github.com/EuGabrielNolasco/clawd-aura-farm/issues).

## Licença

O código está sob a licença [MIT](LICENSE).

> **Aviso:** este é um projeto de fã, sem vínculo oficial com a Anthropic. O nome Claude e o personagem Clawd são propriedade da Anthropic e não estão cobertos pela licença MIT.

---

Desenvolvido com o [Claude Code](https://claude.com/claude-code).
