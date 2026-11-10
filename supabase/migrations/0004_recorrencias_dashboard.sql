-- =====================================================================
-- Lançamentos recorrentes e dados do dashboard
-- =====================================================================

-- ---------------------------------------------------------------------
-- Recorrências (aluguel, luz, internet, assinaturas, salário...)
-- Cada mês gera um lançamento pendente (pago = false). Valores variáveis
-- (ex.: conta de luz) são ajustados no próprio lançamento do mês.
-- ---------------------------------------------------------------------
create table public.recorrencias (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  household_id   uuid references public.households(id) on delete set null,
  escopo         public.escopo not null default 'individual',
  tipo           text not null check (tipo in ('receita', 'despesa')),
  origem_receita text check (origem_receita in ('salario', 'decimo_terceiro', 'ferias', 'restituicao', 'outros')),
  descricao      text not null,
  valor_cents    bigint not null check (valor_cents > 0),
  categoria_id   uuid references public.categorias(id),
  conta_id       uuid references public.contas(id) on delete set null,
  cartao_id      uuid references public.cartoes(id) on delete set null,
  dia_do_mes     smallint not null check (dia_do_mes between 1 and 31),
  inicio         date not null,          -- 1º dia do primeiro mês
  fim            date,                   -- 1º dia do último mês (null = sem fim)
  gerada_ate     date,                   -- 1º dia do último mês já gerado
  ativa          boolean not null default true,
  created_at     timestamptz not null default now(),
  check (tipo <> 'receita' or escopo = 'individual'),
  check (fim is null or fim >= inicio)
);

alter table public.lancamentos
  add column recorrencia_id uuid references public.recorrencias(id) on delete set null;

alter table public.recorrencias enable row level security;

create policy recorrencias_select on public.recorrencias for select
  using (public.pode_ver(owner_id, escopo, household_id));
create policy recorrencias_insert on public.recorrencias for insert
  with check (owner_id = auth.uid() and (escopo = 'individual' or household_id = public.my_household_id()));
create policy recorrencias_update on public.recorrencias for update
  using (public.pode_ver(owner_id, escopo, household_id))
  with check (owner_id = auth.uid() or (escopo = 'casal' and household_id = public.my_household_id()));
create policy recorrencias_delete on public.recorrencias for delete
  using (owner_id = auth.uid() or (escopo = 'casal' and household_id = public.my_household_id()));

-- Conta/cartão referenciados precisam ser visíveis para quem grava
create or replace function public.validar_recorrencia()
returns trigger language plpgsql as $$
declare
  mudou_conta  boolean := true;
  mudou_cartao boolean := true;
begin
  if tg_op = 'UPDATE' then
    mudou_conta  := new.conta_id  is distinct from old.conta_id;
    mudou_cartao := new.cartao_id is distinct from old.cartao_id;
  end if;
  if new.conta_id is not null and mudou_conta
     and not exists (select 1 from public.contas where id = new.conta_id) then
    raise exception 'Conta inválida';
  end if;
  if new.cartao_id is not null and mudou_cartao
     and not exists (select 1 from public.cartoes where id = new.cartao_id) then
    raise exception 'Cartão inválido';
  end if;
  if new.cartao_id is not null then new.conta_id := null; end if;
  new.inicio := date_trunc('month', new.inicio)::date;
  new.fim    := date_trunc('month', new.fim)::date;
  return new;
end $$;

create trigger recorrencias_validar
  before insert or update on public.recorrencias
  for each row execute function public.validar_recorrencia();

-- ---------------------------------------------------------------------
-- Gera os lançamentos das recorrências visíveis até o mês de p_ate.
-- Idempotente: cada mês é gerado uma única vez (gerada_ate), então excluir
-- o lançamento de um mês não faz ele voltar.
-- ---------------------------------------------------------------------
create or replace function public.gerar_recorrencias(p_ate date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare
  r        public.recorrencias;
  m        date;
  v_limite date := date_trunc('month', p_ate)::date;
  v_dia    int;
  v_total  int := 0;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;

  for r in
    select * from public.recorrencias
     where ativa
       and public.pode_ver(owner_id, escopo, household_id)
       and (gerada_ate is null or gerada_ate < v_limite)
     for update skip locked
  loop
    m := greatest(r.inicio, coalesce((r.gerada_ate + interval '1 month')::date, r.inicio));
    while m <= v_limite and (r.fim is null or m <= r.fim) loop
      v_dia := least(r.dia_do_mes, extract(day from (m + interval '1 month - 1 day'))::int);
      insert into public.lancamentos
        (owner_id, household_id, escopo, tipo, origem_receita, descricao, valor_cents, data,
         categoria_id, conta_id, cartao_id, pago, recorrencia_id)
      values
        (r.owner_id, r.household_id, r.escopo, r.tipo, r.origem_receita, r.descricao, r.valor_cents,
         make_date(extract(year from m)::int, extract(month from m)::int, v_dia),
         r.categoria_id, r.conta_id, r.cartao_id, false, r.id);
      v_total := v_total + 1;
      m := (m + interval '1 month')::date;
    end loop;
    update public.recorrencias set gerada_ate = v_limite where id = r.id;
  end loop;

  return v_total;
end $$;

-- ---------------------------------------------------------------------
-- Contribuição de cada membro para o mês (base do "quanto posso gastar").
-- receitas_cents: receitas lançadas no mês (ou a renda do perfil, se nada foi lançado)
-- contribuicoes_cents: dízimo + oferta do mês (lançados, ou estimados pelo perfil)
-- Na conta conjunta retorna os dois membros: o fundo comum depende da renda de ambos.
-- ---------------------------------------------------------------------
create or replace function public.contribuicoes_fundo(p_mes date)
returns table (membro_id uuid, nome text, receitas_cents bigint, contribuicoes_cents bigint, estimado boolean)
language sql stable security definer set search_path = public as $$
  with periodo as (
    select date_trunc('month', p_mes)::date as ini,
           (date_trunc('month', p_mes) + interval '1 month - 1 day')::date as fim
  )
  select p.id,
         p.nome,
         (case when coalesce(r.total, 0) > 0 then r.total else p.renda_mensal_cents end)::bigint,
         (case when coalesce(r.total, 0) > 0 then coalesce(c.total, 0)
               else round(p.renda_mensal_cents *
                     ((case when p.dizimista then p.percentual_dizimo else 0 end)
                    + (case when p.ofertante then p.percentual_oferta else 0 end)) / 100)
          end)::bigint,
         coalesce(r.total, 0) = 0
    from public.profiles p
    cross join periodo
    left join lateral (
      select sum(l.valor_cents) as total from public.lancamentos l
       where l.owner_id = p.id and l.tipo = 'receita' and l.data between periodo.ini and periodo.fim
    ) r on true
    left join lateral (
      select sum(l.valor_cents) as total
        from public.lancamentos l
        join public.categorias k on k.id = l.categoria_id and k.owner_id is null and k.nome in ('Dízimo', 'Oferta')
       where l.owner_id = p.id and l.tipo = 'despesa' and l.data between periodo.ini and periodo.fim
    ) c on true
   where p.id = auth.uid()
      or (public.my_household_id() is not null and p.household_id = public.my_household_id())
$$;

revoke execute on function public.gerar_recorrencias(date)  from anon;
revoke execute on function public.contribuicoes_fundo(date) from anon;
