# 🎮 Mecânicas de Jogo, Economia & Progressão

O balanceamento do **Clawd Aura Farm** foi calibrado matematicamente para proporcionar uma experiência incremental viciante: os primeiros níveis são rápidos e recompensadores, enquanto os níveis avançados oferecem objetivos de longo prazo (cerca de 3 dias para o nível máximo e 1 semana para fechar a loja).

---

## 📈 Fórmulas de Ganho

### 1. Ganho por Clique
```
Aura por Clique = BASE_CLICK × (1 + 0.5 × Mão Firme) × Multiplicador Total × Bônus Crítico × Bônus Combo × Bônus Mega Brain
```
- `BASE_CLICK`: **67 de aura**
- `Mão Firme`: Cada nível na loja adiciona **+50%** ao ganho base por clique
- `Bônus Crítico`: **×10** quando o clique é crítico
- `Chance de Crítico`: `10% base + 3% por nível de Olhar Sigma`
- `Bônus Combo`: Escala de **×1** (até 3 cliques/s) até **×3** (a 12 cliques/s)
- `Bônus Mega Brain`: **×7** durante o Modo Mega Brain (67 segundos)

### 2. Ganho Passivo Automático (por Segundo)
```
Aura Passiva/s = (BASE_PASSIVE + 2 × Clawd Auxiliar + 60 × Fábrica + 4.000 × Datacenter) × Multiplicador Total × Bônus Mega Brain
```
- `BASE_PASSIVE`: **2 de aura/s**
- **Teto Offline:** O jogo continua farmando aura com a aba fechada por até **12 horas**. Ao retornar, o jogador recebe um aviso de boas-vindas com o total acumulado.

### 3. Multiplicador Total
```
Multiplicador Total = (1.1 ^ Nível) × (2 ^ Aura Cósmica) × (1 + 0.25 × Prestígio)
```
- Cada nível alcançado concede **+10% permanente** em toda a aura.
- Cada nível de *Aura Cósmica* na loja **dobra (×2)** toda a produção.
- Cada *Prestígio* (renascimento) concede **+25% permanente**.

---

## 🇧🇷 Os 16 Níveis e a Cultura BR

| # | Nível | Aura Mínima Total | Tempo Médio | Efeito Visual no Mascote |
|--:|---|--:|--:|---|
| 0 | **NPC** | 0 | Início | Mascote padrão fazendo six-seven |
| 1 | **Figurante** | 66 mil | ~20 s | Brilho suave |
| 2 | **Cria** | 400 mil | ~1 min | Halo de energia mais intenso |
| 3 | **Brabo** | 1,8 mi | ~2,5 min | Sobrancelhas bravas pixeladas |
| 4 | **O Pai Tá On** | 17 mi | ~5 min | Corrente dourada no peito |
| 5 | **Main character** | 28 mi | ~10 min | Holofote de luz vertical |
| 6 | **Sigma** | 90 mi | ~20 min | Óculos escuros e aura roxa |
| 7 | **Mega Brain** | 270 mi | ~40 min | Cérebro gigante animado com sinapses elétricas |
| 8 | **Coop Thief** | 390 mi | ~1,5 h | Saco de aura roubada e ativação do evento do Ladrão |
| 9 | **Aura infinita** | 650 mi | ~3 h | Anel arco-íris girando ao redor do Clawd |
| 10 | **Lenda do 6-7** | 1,2 bi | ~6 h | Coroa de ouro e labaredas de fogo |
| 11 | **Ascendido** | 4,6 bi | ~12 h | Asas celestiais batendo e céu estrelado |
| 12 | **Deus do 6-7** | 15 bi | ~1 dia | Clawd dourado brilhante, raios elétricos e tela tremendo |
| 13 | **Multiverso** | 45 bi | ~40 h | Clones do Clawd fazendo six-seven e 67 gigante |
| 14 | **Clawd Supremo** | 98 bi | ~56 h | Efeito hipnótico de cores cósmicas rotativas |
| 15 | **O Próprio 67** | 270 bi | ~3 dias | Chuva de números 67 caindo pela tela inteira |

> **Importante:** O nível é calculado pela **Aura Farmada nesta vida (`total`)**, não pelo saldo atual. Gastar aura na loja de upgrades nunca faz o jogador perder nível.

---

## 🛒 Loja de Upgrades

| Upgrade | Código | Efeito por Compra | Custo Inicial | Crescimento | Limite |
|---|:---:|---|--:|--:|:---:|
| **Clawd auxiliar** | `a` | +2 de aura passiva por segundo | 50 | ×1,18 | 40 |
| **Mão firme** | `m` | +50% de ganho por clique | 200 | ×1,30 | 30 |
| **Olhar sigma** | `s` | +3% de chance de crítico | 5.000 | ×2,20 | 10 |
| **Fábrica de 67** | `f` | +60 de aura passiva por segundo | 20.000 | ×1,22 | 30 |
| **Datacenter do Clawd** | `d` | +4.000 de aura passiva por segundo | 20.000.000 | ×1,25 | 30 |
| **Aura cósmica** | `x` | Dobra (×2) toda a produção de aura | 3.200.000.000 | ×5,00 | 5 |

---

## 🎲 Eventos Dinâmicos & Retenção

### 1. Cérebro Dourado 🧠
- **Janela de Aparição:** A cada 3 a 8 minutos.
- **Duração:** Fica na tela por 13 segundos voando horizontalmente.
- **Recompensa:** Ativa o **Modo Mega Brain**: interface HUD estilo Jarvis, efeito sonoro de reator e **×7 em toda a aura** (cliques e passiva) por **67 segundos**!

### 2. O Ladrão do Coop Thief 🦹
- **Desbloqueio:** Disponível a partir do nível 8 (*Coop Thief*).
- **Janela de Aparição:** A cada 4 a 10 minutos.
- **Duração:** Atravessa correndo a tela em 8 segundos.
- **Recompensa:** Capturá-lo rende **3 Fichas 67** e **+1 giro grátis na Roleta da Sorte**!

### 3. Roleta da Sorte 67 (Minigame Diário) 🎰
- **Como Funciona:**
  - 1 giro grátis todo dia no primeiro login (horário de Brasília).
  - +1 giro grátis toda vez que você subir de nível.
  - +1 giro grátis toda vez que capturar um ladrão.
- **Prêmios:**
  - 🎟 10 Fichas 67
  - ⚡ Rajada de Aura (10 minutos de farm passivo instantâneo)
  - 🧠 Ativação do Modo Mega Brain
  - 💎 Jackpot: 25 Fichas 67
  - 🎟 5 Fichas 67
  - 💥 Tempestade de Aura (15 minutos de farm passivo instantâneo)

### 4. Sequência Diária (Daily Streak) 🔥
- Ao fazer o primeiro acesso do dia (horário de Brasília), você ganha:
  ```
  Fichas 67 = 5 × min(dias_seguidos, 7)
  ```
  Podendo acumular até **35 Fichas 67 por dia** apenas mantendo a sequência!
