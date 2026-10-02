# Segurança

## Reportando uma falha

Encontrou uma falha? Não abra uma issue pública. Use o [aviso privado de vulnerabilidade](https://github.com/EuGabrielNolasco/clawd-aura-farm/security/advisories/new) do GitHub.

## Modelo de segurança

O jogo roda no navegador, e qualquer coisa que o navegador envia pode ser forjada. Por isso, no modo online, **o servidor é a fonte da verdade**:

| Ameaça | Proteção |
|---|---|
| Editar a aura no `localStorage` ou no console | O servidor ignora o valor local. O navegador só envia eventos, e a aura é calculada em `supabase/schema.sql`. |
| Robô de cliques ou requisições forjadas | Balde de fichas no servidor: 15 cliques por segundo, rajada de 60. Cliques acima disso são descartados. No máximo 1000 eventos por chamada. |
| Adiantar o relógio para ganhar aura passiva | A aura passiva usa o relógio do servidor, com teto de 12 h. |
| Forçar críticos | Os críticos são rolados no servidor. |
| Inflar o combo | O combo vem da taxa de cliques aceitos que o servidor mede em cada lote, contados com o mesmo parse dos eventos. |
| Forjar Cérebro Dourado ou ladrão | O servidor agenda os dois e só aceita o clique dentro da janela em que aparecem (mais 4 s de folga para o atraso da rede). |
| Ganhar fichas, conquistas ou enfeites | Fichas só vêm de login diário (uma vez por dia, horário do servidor), conquistas (uma vez cada) e ladrões. Compra e equipamento de enfeites são conferidos no servidor. |
| Renascer antes da hora | O prestígio só é aceito no nível máximo. |
| HTML malicioso nos enfeites de outro jogador | O ranking só desenha enfeites que existem no catálogo do jogo; ids desconhecidos são descartados. |
| Usar o painel dev no site | O painel só existe em `npm run dev`; o Vite o remove do build de produção. |
| Ler ou alterar a tabela direto pela API | RLS ligado, sem policies e sem grants para `anon`/`authenticated`. Só as funções `aura_*` públicas são acessíveis. |
| Usar a conta de outro jogador | Cada jogador tem um segredo aleatório de 256 bits, guardado só no navegador dele. O servidor guarda apenas o hash SHA-256. |
| XSS pelo apelido | Apelido validado no servidor (3 a 20 letras, números, espaço, `_ . -`) e exibido com `textContent`. O site publicado tem Content Security Policy. |
| Criar jogadores em massa | No máximo 10 jogadores novos por IP por hora e 300 por minuto no total. |
| Funções `security definer` sequestradas | Todas usam `set search_path = ''` e nomes totalmente qualificados. |

Os testes em `supabase/test.sql` cobrem essas proteções e rodam no CI a cada push.

## Limites conhecidos

- **Um robô ainda pode clicar no limite humano.** Quem rodar um script a 15 cliques por segundo, 24 horas por dia, sobe no ranking mais rápido do que uma pessoa. O teto impede ganhos absurdos, mas não distingue um humano rápido de um robô. Para isso seria preciso captcha ou login.
- **Contas múltiplas:** uma pessoa pode criar várias contas, dentro do limite por IP.
- **Perder o navegador é perder a conta:** o segredo fica só no `localStorage`. Limpar os dados do site cria um jogador novo.
- **Apelidos ofensivos** não são filtrados automaticamente. Para remover um, apague o nome no painel do Supabase.
- **O modo offline** (sem Supabase configurado) não tem proteção nenhuma, e nem precisa: não há ranking.
