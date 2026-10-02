-- Testes do servidor. Rodam num Postgres puro (CI e docker local), depois de test-setup.sql e schema.sql:
--   psql -v ON_ERROR_STOP=1 -f supabase/test-setup.sql -f supabase/schema.sql -f supabase/test.sql
\set ON_ERROR_STOP 1
\set QUIET 1

-- a API (anon) não acessa a tabela diretamente
set role anon;
do $$ begin
  begin perform * from public.aura_players; raise exception 'anon leu a tabela';
  exception when insufficient_privilege then null; end;
  begin insert into public.aura_players (id, secret_hash, rng) values (gen_random_uuid(), 'x', 1); raise exception 'anon inseriu';
  exception when insufficient_privilege then null; end;
  begin perform public.aura_level(1); raise exception 'anon chamou função interna';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- paridade com src/game.ts: mesma sequência de eventos, mesmo resultado
insert into public.aura_players (id, secret_hash, rng)
values ('00000000-0000-0000-0000-000000000001', encode(sha256(convert_to(repeat('s', 32), 'UTF8')), 'hex'), 12345);
set role anon;
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32),
    repeat('c', 40) || 'amm' || repeat('c', 20) || 'a');
  assert (r->>'rng')::bigint = 23524415, 'rng diverge do JS: ' || r::text;
  assert abs((r->>'total')::float8 - 10787) < 1, 'total diverge do JS: ' || r::text;
  assert abs((r->>'aura')::float8 - 10218) < 1, 'aura diverge do JS: ' || r::text;
  assert r->'ups' = '[2,2,0,0,0,0]'::jsonb, 'upgrades divergem do JS: ' || r::text;
end $$;

-- segredo errado é recusado
do $$ begin
  perform public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('x', 32), 'c');
  raise exception 'aceitou segredo errado';
exception when invalid_authorization_specification then null; end $$;

-- autoclicker: o balde já foi gasto, então cliques extras na mesma hora não contam
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), repeat('c', 1000));
  assert (r->>'total')::float8 < 10787 + 1, 'cliques acima do limite contaram: ' || r::text;
end $$;

-- mais de 1000 eventos por chamada é recusado
do $$ begin
  perform public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), repeat('c', 1001));
  raise exception 'aceitou eventos demais';
exception when invalid_parameter_value then null; end $$;
reset role;

-- aura passiva pelo relógio do servidor, com teto de 12 h
update public.aura_players set last_seen = now() - interval '100 seconds' where id = '00000000-0000-0000-0000-000000000001';
set role anon;
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), '');
  -- 2 base + 2×2 auxiliares = 6/s, nível 0
  assert abs((r->>'total')::float8 - (10787 + 600)) < 2, 'passiva errada: ' || r::text;
  assert (r->>'offline')::float8 between 99 and 101, 'offline errado: ' || r::text;
  assert abs((r->>'offline_gain')::float8 - 600) < 2, 'ganho offline errado: ' || r::text;
end $$;
reset role;
update public.aura_players set last_seen = now() - interval '3 days' where id = '00000000-0000-0000-0000-000000000001';
set role anon;
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), '');
  assert (r->>'offline')::float8 = 43200, 'teto offline não aplicado: ' || r::text;
end $$;

-- compra sem aura é ignorada e o limite de cada upgrade é respeitado
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), 'x');
  assert (r->'ups'->>5)::int = 0, 'comprou Aura cósmica sem aura: ' || r::text;
end $$;
reset role;
update public.aura_players set aura = 1e15, ups = '{0,0,10,0,0,0}' where id = '00000000-0000-0000-0000-000000000001';
set role anon;
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), 'ss');
  assert (r->'ups'->>2)::int = 10, 'passou do limite do Olhar sigma: ' || r::text;
end $$;

-- apelido: validação, unicidade e ranking
do $$ begin
  perform public.aura_set_name('00000000-0000-0000-0000-000000000001', repeat('s', 32), '<script>');
  raise exception 'aceitou apelido inválido';
exception when invalid_parameter_value then null; end $$;
select public.aura_set_name('00000000-0000-0000-0000-000000000001', repeat('s', 32), 'Clawd Fan');
do $$ declare r jsonb; begin
  r := public.aura_sync('00000000-0000-0000-0000-000000000002', repeat('t', 32), 'c');
  perform public.aura_set_name('00000000-0000-0000-0000-000000000002', repeat('t', 32), 'clawd fan');
  raise exception 'aceitou apelido repetido';
exception when unique_violation then null; end $$;
do $$ declare r jsonb; begin
  assert (select name from public.aura_top(10) limit 1) = 'Clawd Fan', 'ranking errado';
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), '');
  assert (r->>'rank')::int = 1, 'posição errada: ' || r::text;
end $$;

-- zerar mantém o recorde no ranking
do $$ declare r jsonb; begin
  perform public.aura_reset('00000000-0000-0000-0000-000000000001', repeat('s', 32));
  r := public.aura_sync('00000000-0000-0000-0000-000000000001', repeat('s', 32), '');
  assert (r->>'total')::float8 < 1000 and (r->>'best')::float8 > 10787, 'reset errado: ' || r::text;
end $$;
reset role;

\echo 'servidor: todos os testes passaram'
