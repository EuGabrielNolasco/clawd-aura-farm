-- Clawd Aura Farm: servidor do ranking (Supabase / Postgres 15+).
--
-- Modelo de segurança: o navegador NUNCA envia a quantidade de aura. Ele envia só eventos
-- ("c" = clique, letra = compra de upgrade) e o servidor aplica as regras de src/game.ts.
--   * a tabela não é acessível pela API: nenhum select/insert/update direto para anon;
--   * tudo passa por funções security definer, que conferem o segredo do jogador;
--   * cliques são limitados por um balde de fichas (15/s, rajada de 60);
--   * aura passiva é calculada pelo relógio do servidor, com teto de 12 h offline;
--   * críticos são rolados no servidor;
--   * criação de jogadores é limitada por IP e globalmente.
-- Rode este arquivo inteiro no SQL Editor do Supabase. Ele pode ser rodado de novo.

create table if not exists public.aura_players (
  id uuid primary key,
  secret_hash text not null,
  name text check (name ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{3,20}$'),
  aura double precision not null default 0,
  total double precision not null default 0,
  best double precision not null default 0,
  ups int[] not null default '{0,0,0,0,0,0}',
  rng bigint not null,
  click_budget double precision not null default 60,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ip_hash text
);
create unique index if not exists aura_players_name_key on public.aura_players (lower(name)) where name is not null;
create index if not exists aura_players_best_idx on public.aura_players (best desc) where name is not null;
create index if not exists aura_players_created_idx on public.aura_players (created_at);

alter table public.aura_players enable row level security;
-- sem policies: com RLS ligado e sem grants, a API não lê nem escreve a tabela
revoke all on public.aura_players from public, anon, authenticated;

-- ===== regras do jogo (espelho de src/game.ts) =====

create or replace function public.aura_level(p_total double precision) returns int
language sql immutable set search_path = '' as $$
  select coalesce(max(i) - 1, 0)::int from unnest(array[
    0, 2.7e5, 3.6e6, 2.6e7, 6.7e7, 9.1e7, 1.3e8, 1.2e9, 7.5e9, 4.4e10, 1.5e11
  ]::float8[]) with ordinality as t(min, i) where p_total >= min
$$;

create or replace function public.aura_threshold(p_level int) returns double precision
language sql immutable set search_path = '' as $$
  select (array[0, 2.7e5, 3.6e6, 2.6e7, 6.7e7, 9.1e7, 1.3e8, 1.2e9, 7.5e9, 4.4e10, 1.5e11]::float8[])[p_level + 1]
$$;

create or replace function public.aura_mult(p_total double precision, p_ups int[]) returns double precision
language sql immutable set search_path = '' as $$
  select power(1.15::float8, public.aura_level(p_total)) * power(2::float8, p_ups[6])
$$;

-- ===== API pública =====

create or replace function public.aura_sync(p_id uuid, p_secret text, p_events text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.aura_players;
  v_hash text;
  v_ip text;
  v_now timestamptz := clock_timestamp();
  v_elapsed float8;
  v_offline float8;
  v_before float8;
  v_left float8;
  v_rate float8;
  v_dt float8;
  v_lvl int;
  v_ev text;
  v_idx int;
  v_cost float8;
  v_gain float8;
  v_rank bigint;
  v_base float8[] := array[50, 200, 5000, 2e4, 2e7, 2.7e9]::float8[];
  v_growth float8[] := array[1.18, 1.3, 2.2, 1.22, 1.25, 5]::float8[];
  v_max int[] := array[40, 30, 10, 30, 30, 5];
begin
  if p_secret is null or length(p_secret) < 32 or length(p_secret) > 128 then
    raise exception 'segredo inválido' using errcode = '22023';
  end if;
  if p_events is null then p_events := ''; end if;
  if length(p_events) > 1000 then
    raise exception 'eventos demais' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');

  select * into p from public.aura_players where id = p_id for update;

  if not found then
    -- cf-connecting-ip vem do Cloudflare na frente do Supabase e não pode ser forjado pelo cliente
    v_ip := nullif(btrim(coalesce(
      current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
      current_setting('request.headers', true)::json ->> 'x-real-ip', '')), '');
    if v_ip is not null then
      v_ip := encode(sha256(convert_to(v_ip, 'UTF8')), 'hex');
      if (select count(*) from public.aura_players
          where ip_hash = v_ip and created_at > v_now - interval '1 hour') >= 10 then
        raise exception 'muitos jogadores novos deste IP' using errcode = '54000';
      end if;
    end if;
    if (select count(*) from public.aura_players where created_at > v_now - interval '1 minute') >= 300 then
      raise exception 'muitos jogadores novos agora, tente de novo' using errcode = '54000';
    end if;
    insert into public.aura_players (id, secret_hash, rng, last_seen, created_at, ip_hash)
    values (p_id, v_hash, 1 + floor(random() * 2147483645)::bigint, v_now, v_now, v_ip)
    returning * into p;
  elsif p.secret_hash <> v_hash then
    raise exception 'jogador inválido' using errcode = '28000';
  end if;

  -- aura passiva pelo relógio do servidor
  v_elapsed := greatest(extract(epoch from v_now - p.last_seen), 0);
  v_offline := least(v_elapsed, 12 * 3600);
  v_left := v_offline;
  v_before := p.total;
  for i in 1..20 loop
    exit when v_left <= 0;
    v_lvl := public.aura_level(p.total);
    v_rate := (2 + 2 * p.ups[1] + 60 * p.ups[4] + 4000 * p.ups[5]) * public.aura_mult(p.total, p.ups);
    if v_lvl < 10 then
      v_dt := least(v_left, greatest((public.aura_threshold(v_lvl + 1) - p.total) / v_rate, 0.001));
    else
      v_dt := v_left;
    end if;
    p.aura := p.aura + v_rate * v_dt;
    p.total := p.total + v_rate * v_dt;
    v_left := v_left - v_dt;
  end loop;

  v_before := p.total - v_before;

  -- balde de fichas dos cliques: 15 por segundo, acumula até 60
  p.click_budget := least(60, p.click_budget + v_elapsed * 15);

  foreach v_ev in array regexp_split_to_array(p_events, '') loop
    continue when v_ev = '';
    if v_ev = 'c' then
      continue when p.click_budget < 1;
      p.click_budget := p.click_budget - 1;
      p.rng := (p.rng * 48271) % 2147483647;
      v_gain := 67 * (1 + 0.5::float8 * p.ups[2]) * public.aura_mult(p.total, p.ups);
      if p.rng::float8 / 2147483647 < 0.1::float8 + 0.03::float8 * p.ups[3] then
        v_gain := v_gain * 10;
      end if;
      p.aura := p.aura + v_gain;
      p.total := p.total + v_gain;
    else
      v_idx := strpos('amsfdx', v_ev);
      continue when v_idx = 0 or p.ups[v_idx] >= v_max[v_idx];
      v_cost := ceil(v_base[v_idx] * power(v_growth[v_idx], p.ups[v_idx]));
      continue when p.aura < v_cost;
      p.aura := p.aura - v_cost;
      p.ups[v_idx] := p.ups[v_idx] + 1;
    end if;
  end loop;

  p.best := greatest(p.best, p.total);
  update public.aura_players
     set aura = p.aura, total = p.total, best = p.best, ups = p.ups, rng = p.rng,
         click_budget = p.click_budget, last_seen = v_now
   where id = p.id;

  if p.name is not null then
    select count(*) + 1 into v_rank from public.aura_players where name is not null and best > p.best;
  end if;

  return jsonb_build_object(
    'aura', p.aura, 'total', p.total, 'best', p.best, 'ups', to_jsonb(p.ups), 'rng', p.rng,
    'name', p.name, 'rank', v_rank, 'offline', case when v_offline >= 60 then v_offline else 0 end,
    'offline_gain', case when v_offline >= 60 then v_before else 0 end
  );
end $$;

create or replace function public.aura_set_name(p_id uuid, p_secret text, p_name text)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if v_name !~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{3,20}$' then
    raise exception 'apelido inválido: use de 3 a 20 letras, números, espaço, _ . ou -' using errcode = '22023';
  end if;
  update public.aura_players set name = v_name
   where id = p_id and secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');
  if not found then
    raise exception 'jogador inválido' using errcode = '28000';
  end if;
exception when unique_violation then
  raise exception 'esse apelido já está em uso' using errcode = '23505';
end $$;

create or replace function public.aura_reset(p_id uuid, p_secret text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- zera o progresso, mas o recorde (best) continua valendo no ranking
  update public.aura_players set aura = 0, total = 0, ups = '{0,0,0,0,0,0}'
   where id = p_id and secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');
  if not found then
    raise exception 'jogador inválido' using errcode = '28000';
  end if;
end $$;

create or replace function public.aura_top(p_limit int default 10)
returns table (name text, best double precision)
language sql stable security definer set search_path = '' as $$
  select name, best from public.aura_players
   where name is not null and best > 0
   order by best desc, created_at
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

revoke all on function public.aura_level(double precision) from public, anon, authenticated;
revoke all on function public.aura_threshold(int) from public, anon, authenticated;
revoke all on function public.aura_mult(double precision, int[]) from public, anon, authenticated;
revoke all on function public.aura_sync(uuid, text, text) from public, anon, authenticated;
revoke all on function public.aura_set_name(uuid, text, text) from public, anon, authenticated;
revoke all on function public.aura_reset(uuid, text) from public, anon, authenticated;
revoke all on function public.aura_top(int) from public, anon, authenticated;
grant execute on function public.aura_sync(uuid, text, text) to anon, authenticated;
grant execute on function public.aura_set_name(uuid, text, text) to anon, authenticated;
grant execute on function public.aura_reset(uuid, text) to anon, authenticated;
grant execute on function public.aura_top(int) to anon, authenticated;
