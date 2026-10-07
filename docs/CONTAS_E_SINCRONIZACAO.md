# 📱 Contas & Sincronização entre Dispositivos (PC & Celular)

Uma das maiores dores relatadas pelos jogadores nas versões iniciais do jogo era:
> *"O login é por navegador, não consigo acessar no PC a mesma conta que estava jogando no celular."*

Na versão **v2.1.0**, esse problema foi **100% solucionado** com um sistema elegante de sincronização de dispositivos, chaves criptográficas de conta, links diretos e QR Codes escaneáveis.

---

## 🔍 Por que o problema acontecia?

Originalmente, a identidade do jogador (um identificador UUID aleatório e um segredo de 32 bytes) era gerada silenciosamente na primeira visita e salva no `localStorage` do navegador daquele aparelho específico.

- Quando o jogador abria o jogo no **celular**, o Safari/Chrome criava o Jogador A no armazenamento local do telefone.
- Quando o jogador abria o jogo no **computador**, o Chrome do PC tinha um `localStorage` completamente vazio, gerando o Jogador B.
- Não existia nenhuma tela ou botão no jogo para visualizar a chave da conta, transferi-la ou conectar em uma conta existente.

---

## 🚀 Como Funciona a Solução (v2.1.0)

Agora o jogo possui o painel completo **📱 Conta & PC**, acessível diretamente na barra de botões ou pelo menu.

### 1. A Chave da Conta (`Token AURA_...`)
Cada jogador tem uma chave de sincronização no formato:
```
AURA_<base64url(id:secret)>
```
Exemplo:
```
AURA_ZTRlYWFhZjItZDE0Mi0xMWUxLWIzZTQtMDgwMDI3NjIwY2RkOjAxMjM0NTY3ODlhYmNkZWYwMTIzNDU2Nzg5YWJjZGVm...
```
- Contém com segurança o UUID do jogador e o seu segredo de autenticação.
- É totalmente segura para ser copiada e colada em qualquer lugar (WhatsApp, bloco de notas, e-mail).
- O servidor valida o hash do segredo com SHA-256 ao receber a requisição.

### 2. Sincronização Instantânea via QR Code 📷
Quando você está jogando no computador e quer continuar no celular (ou vice-versa):
1. No PC, abra o menu **Conta & PC**.
2. Um **QR Code nítido em SVG** é desenhado na tela instantaneamente.
3. Aponte a câmera do seu celular para a tela do computador.
4. O celular abrirá a URL do jogo contendo o parâmetro de sincronização.
5. O jogo detecta a conta, baixa todo o seu progresso da nuvem (aura, compras, conquistas, fichas e enfeites) e ativa a mesma conta no celular!

### 3. Sincronização por Link Direto de Acesso 📋
Se preferir, clique no botão **"📋 Copiar Link de Acesso Direto"**:
- O jogo copia uma URL no formato: `https://...#sync=AURA_...`
- Envie esse link para você mesmo (WhatsApp, Telegram, Discord, e-mail).
- Ao clicar no link no outro dispositivo, o jogo:
  - Lê o token da URL;
  - Conecta no Supabase e carrega o estado da sua conta;
  - Salva a chave no `localStorage` do novo aparelho;
  - Remove automaticamente o token do endereço (`history.replaceState`) para não poluir o histórico nem expor sua chave.

### 4. Conexão Manual via Chave 🔄
Se você já tem a sua chave copiada:
1. Abra o jogo no novo aparelho;
2. Vá em **Conta & PC ➔ Entrar em uma conta existente**;
3. Cole sua chave `AURA_...` ou a URL completa e clique em **Conectar**;
4. O jogo autentica e sincroniza tudo na hora.

### 5. Backup e Restauração em Arquivo JSON (Offline) 💾
Para jogadores que não utilizam o Supabase ou que desejam uma cópia física de segurança:
- **Baixar Backup (.json):** Gera um arquivo contendo a data, a chave do jogador e todos os dados de progresso.
- **Carregar Backup (.json):** Permite selecionar um arquivo de save do disco e restaurar seu jogo instantaneamente.

---

## 🔒 Segurança da Transferência

| Vetor | Proteção |
|---|---|
| **Exposição na Barra de URL** | O fragmento `#sync=...` é consumido e apagado da barra de navegação imediatamente após o carregamento via `history.replaceState`. |
| **Troca Acidental de Conta** | Se você já tiver progresso significativo no aparelho e abrir um link com outra conta, o jogo solicita confirmação explícita antes de sobrescrever o save. |
| **Validação Rigorosa** | Expressões regulares checam a estrutura UUID v4 e o tamanho exato do segredo hexadecimal antes de qualquer requisição. |
