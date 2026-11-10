-- =====================================================================
-- Family Finance - esquema inicial (Fase 1)
-- Todos os valores monetários são armazenados em CENTAVOS (bigint) e
-- representam valores LÍQUIDOS.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Família (conta conjunta). Máximo de 2 membros.
-- ---------------------------------------------------------------------
create table public.households (
  id                     uuid primary key default gen_random_uuid(),
  nome                   text not null,
  codigo_convite         text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  percentual_reserva     numeric(5,2) not null default 10 check (percentual_reserva between 0 and 100),
  -- Como a sobra (após contas da casa e reserva) é dividida entre o casal
  divisao_sobra          text not null default 'igual' check (divisao_sobra in ('igual', 'proporcional_renda')),
  data_casamento         date,
  criado_por             uuid not null references auth.users(id),
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfil do usuário + respostas do questionário de cadastro
-- ---------------------------------------------------------------------
create table public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  nome                     text not null default '',
  household_id             uuid references public.households(id) on delete set null,
  renda_mensal_cents       bigint not null default 0 check (renda_mensal_cents >= 0),
  dizimista                boolean not null default false,
  percentual_dizimo        numeric(5,2) not null default 10 check (percentual_dizimo between 0 and 100),
  ofertante                boolean not null default false,
  percentual_oferta        numeric(5,2) not null default 0 check (percentual_oferta between 0 and 100),
  investe                  boolean not null default false,
  investimento_mensal_cents bigint not null default 0 check (investimento_mensal_cents >= 0),
  percentual_reserva       numeric(5,2) not null default 10 check (percentual_reserva between 0 and 100),
  onboarding_concluido     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Cria o perfil automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Família do usuário logado (security definer evita recursão nas policies)
create or replace function public.my_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Escopo de visibilidade:
--   'individual' -> só o dono vê (renda, despesas individuais, investimentos, dinheiro guardado)
--   'casal'      -> ambos os membros da família veem (contas da casa, reserva de emergência)
-- ---------------------------------------------------------------------
create type public.escopo as enum ('individual', 'casal');

create or replace function public.pode_ver(p_owner uuid, p_escopo public.escopo, p_household uuid)
returns boolean language sql stable as $$
  select p_owner = auth.uid()
      or (p_escopo = 'casal' and p_household is not null and p_household = public.my_household_id())
$$;

-- ---------------------------------------------------------------------
-- Categorias (padrão do sistema quando owner_id é nulo)
-- ---------------------------------------------------------------------
create table public.categorias (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  escopo       public.escopo not null default 'individual',
  nome         text not null,
  tipo         text not null check (tipo in ('receita', 'despesa')),
  icone        text,
  cor          text,
  fixa         boolean not null default false,
  created_at   timestamptz not null default now()
);

insert into public.categorias (nome, tipo, icone, fixa) values
  ('Salário',            'receita', 'briefcase',    false),
  ('13º salário',        'receita', 'gift',         false),
  ('Férias',             'receita', 'palmtree',     false),
  ('Restituição IR',     'receita', 'receipt',      false),
  ('Outras receitas',    'receita', 'plus-circle',  false),
  ('Dízimo',             'despesa', 'church',       true),
  ('Oferta',             'despesa', 'heart',        false),
  ('Moradia',            'despesa', 'home',         true),
  ('Energia / Água / Gás','despesa','zap',          true),
  ('Internet / Telefone','despesa', 'wifi',         true),
  ('Mercado',            'despesa', 'shopping-cart',false),
  ('Lanches',            'despesa', 'coffee',       false),
  ('Combustível',        'despesa', 'fuel',         false),
  ('Mecânica',           'despesa', 'wrench',       false),
  ('Saúde',              'despesa', 'stethoscope',  false),
  ('Educação',           'despesa', 'graduation-cap',false),
  ('Lazer',              'despesa', 'party-popper', false),
  ('Assinaturas',        'despesa', 'repeat',       true),
  ('Vestuário',          'despesa', 'shirt',        false),
  ('Outras despesas',    'despesa', 'circle',       false);

-- ---------------------------------------------------------------------
-- Contas / carteiras (conta corrente, poupança, dinheiro)
-- ---------------------------------------------------------------------
create table public.contas (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  household_id        uuid references public.households(id) on delete set null,
  escopo              public.escopo not null default 'individual',
  nome                text not null,
  tipo                text not null default 'corrente' check (tipo in ('corrente', 'poupanca', 'dinheiro', 'reserva', 'outro')),
  saldo_inicial_cents bigint not null default 0,
  arquivada           boolean not null default false,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cartões de crédito (ex.: "Cartão Inter Hugo")
-- A compra feita após o dia de fechamento entra na fatura do mês seguinte.
-- ---------------------------------------------------------------------
create table public.cartoes (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  household_id    uuid references public.households(id) on delete set null,
  escopo          public.escopo not null default 'individual',
  nome            text not null,
  bandeira        text,
  limite_cents    bigint check (limite_cents >= 0),
  dia_fechamento  smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento  smallint not null check (dia_vencimento between 1 and 31),
  arquivado       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Terceiros: pessoas que compraram no nosso cartão e precisam reembolsar
-- ---------------------------------------------------------------------
create table public.terceiros (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  escopo       public.escopo not null default 'individual',
  nome         text not null,
  telefone     text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Parcelamentos (entidade única usada por cartão, terceiros e empréstimos)
-- ---------------------------------------------------------------------
create table public.parcelamentos (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  household_id       uuid references public.households(id) on delete set null,
  escopo             public.escopo not null default 'individual',
  descricao          text not null,
  valor_total_cents  bigint not null check (valor_total_cents > 0),
  num_parcelas       smallint not null check (num_parcelas between 1 and 480),
  data_primeira      date not null,
  categoria_id       uuid references public.categorias(id),
  cartao_id          uuid references public.cartoes(id) on delete set null,
  terceiro_id        uuid references public.terceiros(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Lançamentos (receitas, despesas e transferências)
-- ---------------------------------------------------------------------
create table public.lancamentos (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users(id) on delete cascade,  -- quem lançou
  household_id     uuid references public.households(id) on delete set null,
  escopo           public.escopo not null default 'individual',
  tipo             text not null check (tipo in ('receita', 'despesa', 'transferencia')),
  -- Para receitas: origem do valor (salário, 13º, férias, restituição...)
  origem_receita   text check (origem_receita in ('salario', 'decimo_terceiro', 'ferias', 'restituicao', 'outros')),
  descricao        text not null,
  valor_cents      bigint not null check (valor_cents > 0),
  data             date not null,
  categoria_id     uuid references public.categorias(id),
  conta_id         uuid references public.contas(id) on delete set null,
  conta_destino_id uuid references public.contas(id) on delete set null,     -- transferências
  cartao_id        uuid references public.cartoes(id) on delete set null,
  fatura_mes       date,                                                     -- 1º dia do mês da fatura
  parcelamento_id  uuid references public.parcelamentos(id) on delete cascade,
  parcela_numero   smallint,
  terceiro_id      uuid references public.terceiros(id) on delete set null,
  pago             boolean not null default false,
  -- Lançamento gerado automaticamente (ex.: dízimo a partir de uma receita)
  gerado_de_id     uuid references public.lancamentos(id) on delete cascade,
  observacao       text,
  created_at       timestamptz not null default now(),
  check (tipo <> 'transferencia' or (conta_id is not null and conta_destino_id is not null))
);

create index lancamentos_owner_data_idx     on public.lancamentos (owner_id, data);
create index lancamentos_household_data_idx on public.lancamentos (household_id, data) where escopo = 'casal';
create index lancamentos_fatura_idx         on public.lancamentos (cartao_id, fatura_mes);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.households    enable row level security;
alter table public.profiles      enable row level security;
alter table public.categorias    enable row level security;
alter table public.contas        enable row level security;
alter table public.cartoes       enable row level security;
alter table public.terceiros     enable row level security;
alter table public.parcelamentos enable row level security;
alter table public.lancamentos   enable row level security;

create policy households_select on public.households for select
  using (id = public.my_household_id());
create policy households_update on public.households for update
  using (id = public.my_household_id());

-- Perfil: cada um vê o seu e o nome do cônjuge; só edita o próprio.
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or (household_id is not null and household_id = public.my_household_id()));
create policy profiles_update on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and household_id is not distinct from public.my_household_id());

create policy categorias_select on public.categorias for select
  using (owner_id is null or public.pode_ver(owner_id, escopo, household_id));
create policy categorias_write on public.categorias for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Tabelas com escopo: leitura conforme visibilidade; escrita pelo dono
-- ou, para itens do casal, por qualquer membro da família.
do $$
declare t text;
begin
  foreach t in array array['contas', 'cartoes', 'terceiros', 'parcelamentos', 'lancamentos'] loop
    execute format($f$
      create policy %1$s_select on public.%1$s for select
        using (public.pode_ver(owner_id, escopo, household_id));
      create policy %1$s_insert on public.%1$s for insert
        with check (owner_id = auth.uid()
                    and (escopo = 'individual' or household_id = public.my_household_id()));
      create policy %1$s_update on public.%1$s for update
        using (public.pode_ver(owner_id, escopo, household_id))
        with check (owner_id = auth.uid() or (escopo = 'casal' and household_id = public.my_household_id()));
      create policy %1$s_delete on public.%1$s for delete
        using (owner_id = auth.uid() or (escopo = 'casal' and household_id = public.my_household_id()));
    $f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RPCs da conta conjunta
-- ---------------------------------------------------------------------
create or replace function public.criar_familia(p_nome text)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if public.my_household_id() is not null then
    raise exception 'Você já faz parte de uma conta conjunta';
  end if;
  insert into public.households (nome, criado_por) values (p_nome, auth.uid()) returning * into h;
  update public.profiles set household_id = h.id where id = auth.uid();
  return h;
end $$;

create or replace function public.entrar_familia(p_codigo text)
returns public.households language plpgsql security definer set search_path = public as $$
declare h public.households; membros int;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if public.my_household_id() is not null then
    raise exception 'Você já faz parte de uma conta conjunta';
  end if;
  select * into h from public.households where codigo_convite = upper(trim(p_codigo)) for update;
  if not found then raise exception 'Código de convite inválido'; end if;
  select count(*) into membros from public.profiles where household_id = h.id;
  if membros >= 2 then raise exception 'Esta conta conjunta já possui dois membros'; end if;
  update public.profiles set household_id = h.id where id = auth.uid();
  return h;
end $$;

revoke execute on function public.criar_familia(text)  from anon;
revoke execute on function public.entrar_familia(text) from anon;
