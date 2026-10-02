-- Clawd Aura Farm: servidor do ranking (Supabase / Postgres 15+).
--
-- Modelo de segurança: o navegador NUNCA envia aura, fichas ou itens. Ele envia só eventos
-- (ver EV em src/game.ts) e o servidor aplica as regras de src/game.ts.
--   * a tabela não é acessível pela API: nenhum select/insert/update direto para anon;
--   * tudo passa por funções security definer, que conferem o segredo do jogador;
--   * cliques são limitados por um balde de fichas (15/s, rajada de 60), e o combo vem da
--     taxa que o servidor mede;
--   * aura passiva, Cérebro Dourado, ladrão e login diário usam o relógio do servidor;
--   * críticos são rolados no servidor;
--   * criação de jogadores é limitada por IP e globalmente.
-- Rode este arquivo inteiro no SQL Editor do Supabase. Ele pode ser rodado de novo.

create table if not exists public.aura_players (
  id uuid primary key,
  secret_hash text not null,
  name text check (name ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _.-]{3,20}$'),
  aura double precision not null default 0,
  total double precision not null default 0,
  ups int[] not null default '{0,0,0,0,0,0}',
  rng bigint not null,
  click_budget double precision not null default 60,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ip_hash text
);
-- colunas adicionadas depois da primeira versão
alter table public.aura_players
  add column if not exists lifetime double precision not null default 0,
  add column if not exists prestige int not null default 0,
  add column if not exists tokens int not null default 0,
  add column if not exists clicks bigint not null default 0,
  add column if not exists crits bigint not null default 0,
  add column if not exists goldens int not null default 0,
  add column if not exists thieves int not null default 0,
  add column if not exists streak int not null default 0,
  add column if not exists last_day date,
  add column if not exists achievements text[] not null default '{}',
  add column if not exists owned text[] not null default '{}',
  add column if not exists equipped jsonb not null default '{}',
  add column if not exists golden_at timestamptz,
  add column if not exists buff_until timestamptz not null default 'epoch',
  add column if not exists thief_at timestamptz;
-- a versão anterior guardava o recorde em "best": leva para "lifetime" antes de remover
do $$ begin
  if exists (select from information_schema.columns where table_schema = 'public' and table_name = 'aura_players' and column_name = 'best') then
    update public.aura_players set lifetime = greatest(lifetime, best, total);
    alter table public.aura_players drop column best;
  end if;
end $$;

create unique index if not exists aura_players_name_key on public.aura_players (lower(name)) where name is not null;
drop index if exists public.aura_players_best_idx;
create index if not exists aura_players_lifetime_idx on public.aura_players (lifetime desc) where name is not null;
create index if not exists aura_players_created_idx on public.aura_players (created_at);

alter table public.aura_players enable row level security;
-- sem policies: com RLS ligado e sem grants, a API não lê nem escreve a tabela
revoke all on public.aura_players from public, anon, authenticated;

-- ===== regras do jogo (espelho de src/game.ts) =====

create or replace function public.aura_level(p_total double precision) returns int
language sql immutable set search_path = '' as $$
  select coalesce(max(i) - 1, 0)::int from unnest(array[
    0, 6.6e4, 4e5, 1.8e6, 1.7e7, 2.8e7, 9e7, 2.7e8, 3.9e8, 6.5e8, 1.2e9, 4.6e9, 1.5e10, 4.5e10, 9.8e10, 2.7e11
  ]::float8[]) with ordinality as t(min, i) where p_total >= min
$$;

create or replace function public.aura_threshold(p_level int) returns double precision
language sql immutable set search_path = '' as $$
  select (array[0, 6.6e4, 4e5, 1.8e6, 1.7e7, 2.8e7, 9e7, 2.7e8, 3.9e8, 6.5e8, 1.2e9, 4.6e9, 1.5e10, 4.5e10, 9.8e10, 2.7e11]::float8[])[p_level + 1]
$$;

create or replace function public.aura_mult(p_total double precision, p_ups int[], p_prestige int) returns double precision
language sql immutable set search_path = '' as $$
  select power(1.1::float8, public.aura_level(p_total)) * power(2::float8, p_ups[6]) * (1 + 0.25::float8 * p_prestige)
$$;
drop function if exists public.aura_mult(double precision, int[]);

/** Catálogo de enfeites: código do protocolo, id, slot e preço (espelho de src/cosmetics.ts). */
create or replace function public.aura_cosmetics()
returns table (code text, id text, slot text, price int)
language sql immutable set search_path = '' as $$
  values
    ('A', 'bg_favela', 'bg', 40), ('B', 'bg_praia', 'bg', 40), ('C', 'bg_server', 'bg', 60), ('D', 'bg_espaco', 'bg', 90),
    ('E', 'hat_bone', 'hat', 20), ('F', 'hat_coroa', 'hat', 80), ('G', 'hat_megabrain', 'hat', 120),
    ('H', 'face_juliet', 'face', 30), ('I', 'face_3d', 'face', 25), ('J', 'face_bigode', 'face', 15),
    ('K', 'outfit_selecao', 'outfit', 50), ('L', 'outfit_capa', 'outfit', 70), ('M', 'outfit_terno', 'outfit', 100),
    ('N', 'color_dourado', 'color', 60), ('P', 'color_neon', 'color', 45), ('Q', 'color_camuflado', 'color', 35)
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
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  v_elapsed float8;
  v_offline float8;
  v_before float8;
  v_t float8;
  v_end float8;
  v_buff float8;
  v_rate float8;
  v_dt float8;
  v_lvl int;
  v_i int;
  v_ev text;
  v_arg text;
  v_idx int;
  v_cost float8;
  v_gain float8;
  v_combo float8;
  v_accepted float8;
  v_crit boolean;
  v_rank bigint;
  v_daily int := 0;
  v_new text[] := '{}';
  v_ach record;
  v_item record;
  v_ahead jsonb;
  v_slot text;
  v_base float8[] := array[50, 200, 5000, 2e4, 2e7, 3.2e9]::float8[];
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

  -- login diário (horário de Brasília): 5 fichas × dias seguidos, até 7
  if p.last_day is distinct from v_today then
    p.streak := case when p.last_day = v_today - 1 then p.streak + 1 else 1 end;
    p.last_day := v_today;
    v_daily := 5 * least(p.streak, 7);
    p.tokens := p.tokens + v_daily;
  end if;

  -- aura passiva pelo relógio do servidor, dividindo o período nas mudanças de nível e no fim do buff
  v_elapsed := greatest(extract(epoch from v_now - p.last_seen), 0);
  v_offline := least(v_elapsed, 12 * 3600);
  v_end := extract(epoch from v_now);
  v_t := v_end - v_offline;
  v_buff := extract(epoch from p.buff_until);
  v_before := p.total;
  for i in 1..40 loop
    exit when v_t >= v_end;
    v_lvl := public.aura_level(p.total);
    v_rate := (2 + 2 * p.ups[1] + 60 * p.ups[4] + 4000 * p.ups[5]) * public.aura_mult(p.total, p.ups, p.prestige)
              * case when v_t < v_buff then 7 else 1 end;
    v_dt := v_end - v_t;
    if v_lvl < 15 then
      v_dt := least(v_dt, greatest((public.aura_threshold(v_lvl + 1) - p.total) / v_rate, 0.001));
    end if;
    if v_t < v_buff then v_dt := least(v_dt, v_buff - v_t); end if;
    p.aura := p.aura + v_rate * v_dt;
    p.total := p.total + v_rate * v_dt;
    p.lifetime := p.lifetime + v_rate * v_dt;
    v_t := v_t + v_dt;
  end loop;
  v_before := p.total - v_before;

  -- balde de fichas dos cliques: 15 por segundo, acumula até 60
  p.click_budget := least(60, p.click_budget + v_elapsed * 15);
  -- combo pela taxa de cliques aceitos neste lote (contados com o mesmo parse dos eventos,
  -- para um 'c' usado como argumento não inflar o combo)
  v_accepted := 0;
  v_i := 1;
  while v_i <= length(p_events) loop
    v_ev := substr(p_events, v_i, 1);
    if v_ev = 'c' then v_accepted := v_accepted + 1; end if;
    if v_ev in ('K', 'E', 'U') then v_i := v_i + 2; else v_i := v_i + 1; end if;
  end loop;
  v_accepted := least(v_accepted, floor(p.click_budget));
  v_combo := 1 + 2 * least(greatest((v_accepted / greatest(v_elapsed, 1) - 3) / 9, 0), 1);

  -- eventos na tela que passaram sem ser pegos são reagendados
  if p.golden_at is null or v_now > p.golden_at + interval '17 seconds' then
    p.golden_at := v_now + make_interval(secs => 180 + random() * 300);
  end if;
  if p.thief_at is null or v_now > p.thief_at + interval '12 seconds' then
    p.thief_at := v_now + make_interval(secs => 240 + random() * 360);
  end if;

  v_i := 1;
  while v_i <= length(p_events) loop
    v_ev := substr(p_events, v_i, 1);
    v_arg := substr(p_events, v_i + 1, 1);
    if v_ev in ('K', 'E', 'U') then v_i := v_i + 2; else v_i := v_i + 1; end if;

    if v_ev = 'c' then
      continue when p.click_budget < 1;
      p.click_budget := p.click_budget - 1;
      p.rng := (p.rng * 48271) % 2147483647;
      v_crit := p.rng::float8 / 2147483647 < 0.1::float8 + 0.03::float8 * p.ups[3];
      v_gain := 67 * (1 + 0.5::float8 * p.ups[2]) * public.aura_mult(p.total, p.ups, p.prestige)
                * case when v_crit then 10 else 1 end * v_combo * case when v_now < p.buff_until then 7 else 1 end;
      p.aura := p.aura + v_gain;
      p.total := p.total + v_gain;
      p.lifetime := p.lifetime + v_gain;
      p.clicks := p.clicks + 1;
      if v_crit then p.crits := p.crits + 1; end if;

    elsif v_ev = 'g' then
      continue when not (v_now between p.golden_at and p.golden_at + interval '17 seconds');
      p.buff_until := v_now + interval '67 seconds';
      p.golden_at := v_now + make_interval(secs => 67 + 180 + random() * 300);
      p.goldens := p.goldens + 1;

    elsif v_ev = 't' then
      continue when public.aura_level(p.total) < 8
        or not (v_now between p.thief_at and p.thief_at + interval '12 seconds');
      p.tokens := p.tokens + 3;
      p.thieves := p.thieves + 1;
      p.thief_at := v_now + make_interval(secs => 240 + random() * 360);

    elsif v_ev = 'p' then
      continue when public.aura_level(p.total) < 15;
      p.aura := 0; p.total := 0; p.ups := '{0,0,0,0,0,0}'; p.buff_until := 'epoch';
      p.prestige := p.prestige + 1;

    elsif v_ev = 'z' then
      p.aura := 0; p.total := 0; p.ups := '{0,0,0,0,0,0}'; p.buff_until := 'epoch';

    elsif v_ev = 'K' then
      select * into v_item from public.aura_cosmetics() c where c.code = v_arg;
      continue when not found or v_item.id = any(p.owned) or p.tokens < v_item.price;
      p.tokens := p.tokens - v_item.price;
      p.owned := p.owned || v_item.id;

    elsif v_ev = 'E' then
      select * into v_item from public.aura_cosmetics() c where c.code = v_arg;
      continue when not found or not (v_item.id = any(p.owned));
      p.equipped := p.equipped || jsonb_build_object(v_item.slot, v_item.id);

    elsif v_ev = 'U' then
      v_slot := case v_arg when 'B' then 'bg' when 'H' then 'hat' when 'F' then 'face' when 'O' then 'outfit' when 'C' then 'color' end;
      continue when v_slot is null;
      p.equipped := p.equipped - v_slot;

    else
      v_idx := strpos('amsfdx', v_ev);
      continue when v_idx = 0 or p.ups[v_idx] >= v_max[v_idx];
      v_cost := ceil(v_base[v_idx] * power(v_growth[v_idx], p.ups[v_idx]));
      continue when p.aura < v_cost;
      p.aura := p.aura - v_cost;
      p.ups[v_idx] := p.ups[v_idx] + 1;
    end if;
  end loop;

  -- conquistas (espelho de src/achievements.ts): concedidas uma vez só
  v_lvl := public.aura_level(p.total);
  for v_ach in select * from (values
      ('clicks_67', p.clicks >= 67, 5), ('clicks_6767', p.clicks >= 6767, 15), ('clicks_67k', p.clicks >= 67000, 40),
      ('crit_1', p.crits >= 1, 5), ('crit_100', p.crits >= 100, 15),
      ('lvl_sigma', v_lvl >= 6, 10), ('lvl_megabrain', v_lvl >= 7, 15), ('lvl_max', v_lvl >= 15, 50),
      ('shop_full', p.ups[1] >= 40 and p.ups[2] >= 30 and p.ups[3] >= 10 and p.ups[4] >= 30 and p.ups[5] >= 30 and p.ups[6] >= 5, 50),
      ('golden_1', p.goldens >= 1, 10), ('golden_10', p.goldens >= 10, 25), ('thief_5', p.thieves >= 5, 20),
      ('streak_3', p.streak >= 3, 15), ('streak_7', p.streak >= 7, 40), ('prestige_1', p.prestige >= 1, 50)
    ) as a(id, ok, reward)
  loop
    if v_ach.ok and not (v_ach.id = any(p.achievements)) then
      p.achievements := p.achievements || v_ach.id;
      p.tokens := p.tokens + v_ach.reward;
      v_new := v_new || v_ach.id;
    end if;
  end loop;

  update public.aura_players
     set aura = p.aura, total = p.total, lifetime = p.lifetime, ups = p.ups, rng = p.rng,
         click_budget = p.click_budget, last_seen = v_now, prestige = p.prestige, tokens = p.tokens,
         clicks = p.clicks, crits = p.crits, goldens = p.goldens, thieves = p.thieves,
         streak = p.streak, last_day = p.last_day, achievements = p.achievements, owned = p.owned,
         equipped = p.equipped, golden_at = p.golden_at, buff_until = p.buff_until, thief_at = p.thief_at
   where id = p.id;

  -- posição no ranking e quem está logo à frente
  if p.name is not null then
    select count(*) + 1 into v_rank from public.aura_players where name is not null and lifetime > p.lifetime;
    select jsonb_build_object('name', a.name, 'lifetime', a.lifetime, 'rank', v_rank - 1) into v_ahead
      from public.aura_players a
     where a.name is not null and a.lifetime > p.lifetime
     order by a.lifetime asc limit 1;
  end if;

  return jsonb_build_object(
    'now', extract(epoch from v_now),
    'aura', p.aura, 'total', p.total, 'lifetime', p.lifetime, 'ups', to_jsonb(p.ups), 'rng', p.rng,
    'prestige', p.prestige, 'tokens', p.tokens, 'clicks', p.clicks, 'crits', p.crits,
    'goldens', p.goldens, 'thieves', p.thieves, 'streak', p.streak, 'last_day', p.last_day,
    'achievements', to_jsonb(p.achievements), 'owned', to_jsonb(p.owned), 'equipped', p.equipped,
    'golden_at', extract(epoch from p.golden_at), 'buff_until', extract(epoch from p.buff_until),
    'thief_at', extract(epoch from p.thief_at), 'combo', v_combo,
    'name', p.name, 'rank', v_rank, 'ahead', v_ahead,
    'daily', v_daily, 'new_achievements', to_jsonb(v_new),
    'offline', case when v_offline >= 60 then v_offline else 0 end,
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

-- zerar agora é o evento 'z' do aura_sync
drop function if exists public.aura_reset(uuid, text);

drop function if exists public.aura_top(int);
create or replace function public.aura_top(p_limit int default 10)
returns table (rank bigint, name text, lifetime double precision, prestige int, equipped jsonb)
language sql stable security definer set search_path = '' as $$
  select row_number() over (order by lifetime desc, created_at), name, lifetime, prestige, equipped
    from public.aura_players
   where name is not null and lifetime > 0
   order by lifetime desc, created_at
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
$$;

/** Os 3 jogadores logo acima, você e os 2 logo abaixo. */
create or replace function public.aura_around(p_id uuid, p_secret text)
returns table (rank bigint, name text, lifetime double precision, prestige int, equipped jsonb, me boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  me public.aura_players;
  v_rank bigint;
begin
  select * into me from public.aura_players
   where id = p_id and secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex');
  if not found then
    raise exception 'jogador inválido' using errcode = '28000';
  end if;
  if me.name is null then return; end if;
  select count(*) + 1 into v_rank from public.aura_players a where a.name is not null and a.lifetime > me.lifetime;
  return query
    select * from (
      select v_rank - row_number() over (order by a.lifetime asc), a.name, a.lifetime, a.prestige, a.equipped, false
        from (select * from public.aura_players a
               where a.name is not null and a.lifetime > me.lifetime
               order by a.lifetime asc limit 3) a
      union all
      select v_rank, me.name, me.lifetime, me.prestige, me.equipped, true
      union all
      select v_rank + row_number() over (order by a.lifetime desc, a.created_at), a.name, a.lifetime, a.prestige, a.equipped, false
        from (select * from public.aura_players a
               where a.name is not null and a.lifetime <= me.lifetime and a.id <> me.id
               order by a.lifetime desc, a.created_at limit 2) a
    ) t order by 1;
end $$;

revoke all on function public.aura_level(double precision) from public, anon, authenticated;
revoke all on function public.aura_threshold(int) from public, anon, authenticated;
revoke all on function public.aura_mult(double precision, int[], int) from public, anon, authenticated;
revoke all on function public.aura_cosmetics() from public, anon, authenticated;
revoke all on function public.aura_sync(uuid, text, text) from public, anon, authenticated;
revoke all on function public.aura_set_name(uuid, text, text) from public, anon, authenticated;
revoke all on function public.aura_top(int) from public, anon, authenticated;
revoke all on function public.aura_around(uuid, text) from public, anon, authenticated;
grant execute on function public.aura_sync(uuid, text, text) to anon, authenticated;
grant execute on function public.aura_set_name(uuid, text, text) to anon, authenticated;
grant execute on function public.aura_top(int) to anon, authenticated;
grant execute on function public.aura_around(uuid, text) to anon, authenticated;
