-- =====================================================================
-- Listas de compras (mercado, feira, farmácia...)
-- Listas recorrentes: ao finalizar a compra os itens são desmarcados e a
-- lista fica pronta para a próxima vez. A compra vira um lançamento.
-- =====================================================================

create table public.listas_compras (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  escopo       public.escopo not null default 'individual',
  nome         text not null check (length(trim(nome)) > 0),
  icone        text,
  arquivada    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.itens_lista (
  id          uuid primary key default gen_random_uuid(),
  lista_id    uuid not null references public.listas_compras(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  quantidade  numeric(10, 3) not null default 1 check (quantidade > 0),
  unidade     text not null default 'un'
              check (unidade in ('un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'dz')),
  setor       text not null default 'outros'
              check (setor in ('hortifruti', 'acougue', 'frios', 'padaria', 'mercearia', 'bebidas',
                               'congelados', 'limpeza', 'higiene', 'pet', 'outros')),
  -- Preço unitário estimado (opcional), para prever o total da compra.
  preco_cents bigint check (preco_cents >= 0),
  comprado    boolean not null default false,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index itens_lista_lista_idx on public.itens_lista (lista_id);

-- Compra finalizada: o lançamento guarda de qual lista veio (histórico).
alter table public.lancamentos
  add column if not exists lista_compra_id uuid references public.listas_compras(id) on delete set null;
create index if not exists lancamentos_lista_idx on public.lancamentos (lista_compra_id) where lista_compra_id is not null;

create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger itens_lista_updated_at before update on public.itens_lista
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------
-- RLS: listas seguem o mesmo modelo das demais tabelas com escopo;
-- itens herdam a visibilidade da lista.
-- ---------------------------------------------------------------------
alter table public.listas_compras enable row level security;
alter table public.itens_lista    enable row level security;

create policy listas_compras_select on public.listas_compras for select
  using (public.pode_ver(owner_id, escopo, household_id));
create policy listas_compras_insert on public.listas_compras for insert
  with check (owner_id = auth.uid() and (escopo = 'individual' or household_id = public.my_household_id()));
create policy listas_compras_update on public.listas_compras for update
  using (public.pode_ver(owner_id, escopo, household_id))
  with check (owner_id = auth.uid() or (escopo = 'casal' and household_id = public.my_household_id()));
create policy listas_compras_delete on public.listas_compras for delete
  using (owner_id = auth.uid() or (escopo = 'casal' and household_id = public.my_household_id()));

create or replace function public.pode_ver_lista(p_lista uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.listas_compras l
     where l.id = p_lista and public.pode_ver(l.owner_id, l.escopo, l.household_id)
  )
$$;
revoke execute on function public.pode_ver_lista(uuid) from anon;

create policy itens_lista_all on public.itens_lista for all
  using (public.pode_ver_lista(lista_id))
  with check (public.pode_ver_lista(lista_id));

-- ---------------------------------------------------------------------
-- Tempo real: quando um marca um item no mercado, o outro vê na hora.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.itens_lista;
  end if;
end $$;
