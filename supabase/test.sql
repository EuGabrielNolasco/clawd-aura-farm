-- Testes do servidor. Rodam num Postgres puro (CI e docker local), depois de test-setup.sql e schema.sql:
--   psql -v ON_ERROR_STOP=1 -f supabase/test-setup.sql -f supabase/schema.sql -f supabase/test.sql
-- As permissões são testadas como anon; o resto chama as funções direto (elas são security definer,
-- então o resultado é o mesmo) para poder preparar o estado entre os passos.
\set ON_ERROR_STOP 1
\set QUIET 1

-- ===== permissões: a API (anon) não acessa a tabela nem as funções internas =====
set role anon;
do $$ begin
  begin perform * from public.aura_players; raise exception 'anon leu a tabela';
  exception when insufficient_privilege then null; end;
  begin insert into public.aura_players (id, secret_hash, rng) values (gen_random_uuid(), 'x', 1); raise exception 'anon inseriu';
  exception when insufficient_privilege then null; end;
  begin perform public.aura_level(1); raise exception 'anon chamou aura_level';
  exception when insufficient_privilege then null; end;
  begin perform public.aura_cosmetics(); raise exception 'anon chamou aura_cosmetics';
  exception when insufficient_privilege then null; end;
  -- as funções públicas funcionam como anon
  perform public.aura_top(10);
end $$;
reset role;

create function pg_temp.sync(p_n int, p_events text default '') returns jsonb language sql as $$
  select public.aura_sync(('00000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid, repeat('s', 32), p_events)
$$;
create function pg_temp.pid(p_n int) returns uuid language sql as $$
  select ('00000000-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid
$$;

-- ===== paridade com src/game.ts: mesma sequência de eventos, mesmo resultado =====
-- 20 s parado (40 de aura passiva) e 60 cliques: 3 cliques/s, combo ×1
insert into public.aura_players (id, secret_hash, rng, last_seen)
values (pg_temp.pid(1), encode(sha256(convert_to(repeat('s', 32), 'UTF8')), 'hex'), 12345, clock_timestamp() - interval '20 seconds');
do $$ declare r jsonb; begin
  r := pg_temp.sync(1, repeat('c', 40) || 'amm' || repeat('c', 20) || 'a');
  assert (r->>'rng')::bigint = 23524415, 'rng diverge do JS: ' || r::text;
  assert (r->>'combo')::float8 = 1, 'combo deveria ser 1: ' || r::text;
  assert abs((r->>'total')::float8 - 10827) < 1, 'total diverge do JS: ' || r::text;
  assert abs((r->>'aura')::float8 - 10258) < 1, 'aura diverge do JS: ' || r::text;
  assert r->'ups' = '[2,2,0,0,0,0]'::jsonb, 'upgrades divergem do JS: ' || r::text;
  assert (r->>'clicks')::int = 60, 'contador de cliques errado: ' || r::text;
end $$;

-- segredo errado é recusado
do $$ begin
  perform public.aura_sync(pg_temp.pid(1), repeat('x', 32), 'c');
  raise exception 'aceitou segredo errado';
exception when invalid_authorization_specification then null; end $$;

-- autoclicker: o balde já foi gasto, então cliques extras na mesma hora não contam
do $$ declare r jsonb; begin
  r := pg_temp.sync(1, repeat('c', 1000));
  assert (r->>'total')::float8 < 10827 + 1, 'cliques acima do limite contaram: ' || r::text;
end $$;

-- mais de 1000 eventos por chamada é recusado
do $$ begin
  perform pg_temp.sync(1, repeat('c', 1001));
  raise exception 'aceitou eventos demais';
exception when invalid_parameter_value then null; end $$;

-- ===== aura passiva pelo relógio do servidor, com teto de 12 h =====
update public.aura_players set last_seen = now() - interval '100 seconds' where id = pg_temp.pid(1);
do $$ declare r jsonb; begin
  r := pg_temp.sync(1);
  -- 2 base + 2×2 auxiliares = 6/s, nível 0
  assert abs((r->>'total')::float8 - (10827 + 600)) < 2, 'passiva errada: ' || r::text;
  assert abs((r->>'offline_gain')::float8 - 600) < 2, 'ganho offline errado: ' || r::text;
end $$;
update public.aura_players set last_seen = now() - interval '3 days' where id = pg_temp.pid(1);
do $$ declare r jsonb; begin
  r := pg_temp.sync(1);
  assert (r->>'offline')::float8 = 43200, 'teto offline não aplicado: ' || r::text;
end $$;

-- ===== combo =====
do $$ declare r jsonb; begin
  update public.aura_players set last_seen = clock_timestamp() - interval '1 second', click_budget = 60 where id = pg_temp.pid(1);
  r := pg_temp.sync(1, repeat('c', 30));
  assert (r->>'combo')::float8 = 3, 'combo deveria ser 3 com 30 cliques em 1 s: ' || r::text;
  -- "Kc" não é clique: não pode inflar o combo
  update public.aura_players set last_seen = clock_timestamp() - interval '1 second', click_budget = 60 where id = pg_temp.pid(1);
  r := pg_temp.sync(1, repeat('Kc', 30));
  assert (r->>'combo')::float8 = 1, 'argumentos inflaram o combo: ' || r::text;
end $$;

-- ===== Cérebro Dourado =====
do $$ declare r jsonb; begin
  update public.aura_players set golden_at = now() + interval '1 minute' where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 'g');
  assert (r->>'buff_until')::float8 < extract(epoch from now()), 'pegou o cérebro fora da janela: ' || r::text;
  update public.aura_players set golden_at = now() - interval '5 seconds' where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 'g');
  assert (r->>'buff_until')::float8 > extract(epoch from now()) + 60, 'cérebro na janela não ativou o buff: ' || r::text;
  assert (r->>'goldens')::int = 1, 'contador de cérebros errado: ' || r::text;
  assert (r->>'golden_at')::float8 > extract(epoch from now()) + 67 + 170, 'próximo cérebro mal agendado: ' || r::text;
  r := pg_temp.sync(1, 'g');
  assert (r->>'goldens')::int = 1, 'pegou o mesmo cérebro duas vezes: ' || r::text;
end $$;

-- ===== ladrão: só a partir do nível Coop Thief =====
do $$ declare r jsonb; v_tokens int; begin
  update public.aura_players set thief_at = now() - interval '2 seconds' where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 't');
  assert (r->>'thieves')::int = 0, 'pegou ladrão abaixo do nível 8: ' || r::text;
  update public.aura_players set total = 4e8, thief_at = now() - interval '2 seconds' where id = pg_temp.pid(1);
  v_tokens := (pg_temp.sync(1)->>'tokens')::int;
  update public.aura_players set thief_at = now() - interval '2 seconds' where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 't');
  assert (r->>'thieves')::int = 1 and (r->>'tokens')::int >= v_tokens + 3, 'ladrão não rendeu fichas: ' || r::text;
end $$;

-- ===== login diário =====
do $$ declare r jsonb; begin
  r := pg_temp.sync(1);
  assert (r->>'daily')::int = 0, 'login diário dado duas vezes no mesmo dia: ' || r::text;
  update public.aura_players set last_day = last_day - 1, streak = 1 where id = pg_temp.pid(1);
  r := pg_temp.sync(1);
  assert (r->>'daily')::int = 10 and (r->>'streak')::int = 2, 'sequência de dias errada: ' || r::text;
  update public.aura_players set last_day = last_day - 3 where id = pg_temp.pid(1);
  r := pg_temp.sync(1);
  assert (r->>'streak')::int = 1, 'sequência não zerou depois de pular dias: ' || r::text;
end $$;

-- ===== conquistas: concedidas uma vez só =====
do $$ declare r jsonb; begin
  update public.aura_players set clicks = 66, click_budget = 60, achievements = array_remove(achievements, 'clicks_67')
   where id = pg_temp.pid(1);
  r := pg_temp.sync(1);
  assert not (r->'achievements' ? 'clicks_67'), 'conquista antes da hora: ' || r::text;
  r := pg_temp.sync(1, 'c');
  assert r->'new_achievements' ? 'clicks_67', 'conquista de 67 cliques não veio: ' || r::text;
  r := pg_temp.sync(1, 'c');
  assert not (r->'new_achievements' ? 'clicks_67'), 'conquista concedida duas vezes: ' || r::text;
end $$;

-- ===== enfeites: fichas não podem ser forjadas nem gastas duas vezes =====
do $$ declare r jsonb; begin
  update public.aura_players set tokens = 10 where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 'KE');
  assert not (r->'owned' ? 'hat_bone'), 'comprou enfeite sem fichas: ' || r::text;
  r := pg_temp.sync(1, 'EE');
  assert not (r->'equipped' ? 'hat'), 'equipou enfeite que não tem: ' || r::text;
  update public.aura_players set tokens = 30 where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 'KEKEEE');
  assert r->'owned' = '["hat_bone"]'::jsonb and (r->>'tokens')::int = 10, 'compra repetida ou preço errado: ' || r::text;
  assert r->'equipped'->>'hat' = 'hat_bone', 'não equipou: ' || r::text;
  r := pg_temp.sync(1, 'UHK?E?');
  assert not (r->'equipped' ? 'hat') and (r->>'tokens')::int = 10, 'tirar/código inválido falhou: ' || r::text;
end $$;

-- ===== prestígio e zerar =====
do $$ declare r jsonb; v_life float8; begin
  r := pg_temp.sync(1, 'p');
  assert (r->>'prestige')::int = 0, 'renasceu antes do nível máximo: ' || r::text;
  update public.aura_players set total = 3e11, lifetime = 3e11, ups = '{5,5,5,5,5,0}' where id = pg_temp.pid(1);
  r := pg_temp.sync(1, 'p');
  assert (r->>'prestige')::int = 1 and (r->>'total')::float8 < 1e6 and r->'ups' = '[0,0,0,0,0,0]'::jsonb, 'prestígio errado: ' || r::text;
  assert (r->>'lifetime')::float8 >= 3e11, 'prestígio apagou a aura vitalícia: ' || r::text;
  v_life := (r->>'lifetime')::float8;
  r := pg_temp.sync(1, 'z');
  assert (r->>'total')::float8 < 1e6 and (r->>'lifetime')::float8 >= v_life and (r->>'prestige')::int = 1, 'zerar errado: ' || r::text;
end $$;

-- ===== apelido, ranking e "perto de você" =====
do $$ begin
  perform public.aura_set_name(pg_temp.pid(1), repeat('s', 32), '<script>');
  raise exception 'aceitou apelido inválido';
exception when invalid_parameter_value then null; end $$;
select public.aura_set_name(pg_temp.pid(1), repeat('s', 32), 'Clawd Fan');
do $$ begin
  perform pg_temp.sync(2, 'c');
  perform public.aura_set_name(pg_temp.pid(2), repeat('s', 32), 'clawd fan');
  raise exception 'aceitou apelido repetido';
exception when unique_violation then null; end $$;
insert into public.aura_players (id, secret_hash, rng, name, lifetime) values
  (gen_random_uuid(), 'x', 1, 'Acima Um', 9e11), (gen_random_uuid(), 'x', 1, 'Acima Dois', 5e11),
  (gen_random_uuid(), 'x', 1, 'Abaixo Um', 1e3), (gen_random_uuid(), 'x', 1, 'Abaixo Dois', 1e2);
do $$ declare r jsonb; v_names text[]; begin
  r := pg_temp.sync(1);
  assert (r->>'rank')::int = 3, 'posição errada: ' || r::text;
  assert r->'ahead'->>'name' = 'Acima Dois' and (r->'ahead'->>'rank')::int = 2, 'quem está à frente errado: ' || r::text;
  select array_agg(name order by rank) into v_names from public.aura_around(pg_temp.pid(1), repeat('s', 32));
  assert v_names = array['Acima Um', 'Acima Dois', 'Clawd Fan', 'Abaixo Um', 'Abaixo Dois'], 'perto de você errado: ' || v_names::text;
  assert (select name from public.aura_top(10) limit 1) = 'Acima Um', 'top errado';
  assert (select rank from public.aura_around(pg_temp.pid(1), repeat('s', 32)) where me) = 3, 'posição no perto de você errada';
end $$;
do $$ begin
  perform * from public.aura_around(pg_temp.pid(1), repeat('x', 32));
  raise exception 'aura_around aceitou segredo errado';
exception when invalid_authorization_specification then null; end $$;

\echo 'servidor: todos os testes passaram'
