-- =====================================================================
-- Contas com saldo, faturas de cartão e parcelamentos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Privacidade: o perfil (com a renda) passa a ser visível só para o dono.
-- O nome do cônjuge é obtido pela função membros_familia().
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id = auth.uid());

create or replace function public.membros_familia()
returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome
    from public.profiles p
   where public.my_household_id() is not null
     and p.household_id = public.my_household_id()
$$;

-- ---------------------------------------------------------------------
-- Mês da fatura (mês do vencimento) para uma compra no cartão.
-- Compra no dia do fechamento ou depois entra na fatura seguinte.
-- Se o vencimento é antes (ou no mesmo dia) do fechamento, vence no mês seguinte ao fechamento.
-- ---------------------------------------------------------------------
create or replace function public.calcular_fatura_mes(p_data date, p_fechamento int, p_vencimento int)
returns date language sql immutable as $$
  select (date_trunc('month', p_data)
          + make_interval(months =>
              (case when extract(day from p_data) >= p_fechamento then 1 else 0 end)
            + (case when p_vencimento <= p_fechamento then 1 else 0 end)))::date
$$;

-- ---------------------------------------------------------------------
-- Antes de gravar um lançamento:
--  * garante que conta/cartão referenciados são visíveis para quem grava
--    (impede apontar para a conta de outra pessoa);
--  * calcula o mês da fatura quando a compra é no cartão.
-- ---------------------------------------------------------------------
create or replace function public.preparar_lancamento()
returns trigger language plpgsql as $$
declare
  c              public.cartoes;
  mudou_conta    boolean := true;
  mudou_destino  boolean := true;
  mudou_cartao   boolean := true;
begin
  -- Só valida referências novas/alteradas: o cônjuge pode editar uma despesa da casa
  -- paga com uma conta individual que ele não enxerga. (OLD só existe em UPDATE.)
  if tg_op = 'UPDATE' then
    mudou_conta   := new.conta_id is distinct from old.conta_id;
    mudou_destino := new.conta_destino_id is distinct from old.conta_destino_id;
    mudou_cartao  := new.cartao_id is distinct from old.cartao_id;
  end if;

  if new.conta_id is not null and mudou_conta
     and not exists (select 1 from public.contas where id = new.conta_id) then
    raise exception 'Conta inválida';
  end if;
  if new.conta_destino_id is not null and mudou_destino
     and not exists (select 1 from public.contas where id = new.conta_destino_id) then
    raise exception 'Conta de destino inválida';
  end if;

  if new.cartao_id is null then
    new.fatura_mes := null;
    return new;
  end if;

  new.conta_id := null; -- compra no cartão sai da conta só quando a fatura é paga
  select * into c from public.cartoes where id = new.cartao_id;
  if found then
    new.fatura_mes := public.calcular_fatura_mes(new.data, c.dia_fechamento, c.dia_vencimento);
  elsif mudou_cartao then
    raise exception 'Cartão inválido';
  else
    -- Cartão do cônjuge não visível: recalcula com permissão elevada
    select public.mes_fatura_cartao(new.cartao_id, new.data) into new.fatura_mes;
  end if;
  return new;
end $$;

create or replace function public.mes_fatura_cartao(p_cartao uuid, p_data date)
returns date language sql stable security definer set search_path = public as $$
  select public.calcular_fatura_mes(p_data, dia_fechamento, dia_vencimento) from public.cartoes where id = p_cartao
$$;
revoke execute on function public.mes_fatura_cartao(uuid, date) from anon;

create trigger lancamentos_preparar
  before insert or update of conta_id, conta_destino_id, cartao_id, data on public.lancamentos
  for each row execute function public.preparar_lancamento();

-- Se o cartão mudar de fechamento/vencimento, recalcula as faturas em aberto.
create or replace function public.recalcular_faturas_cartao()
returns trigger language plpgsql as $$
begin
  if new.dia_fechamento <> old.dia_fechamento or new.dia_vencimento <> old.dia_vencimento then
    update public.lancamentos
       set fatura_mes = public.calcular_fatura_mes(data, new.dia_fechamento, new.dia_vencimento)
     where cartao_id = new.id and not pago;
  end if;
  return new;
end $$;

create trigger cartoes_recalcular_faturas
  after update of dia_fechamento, dia_vencimento on public.cartoes
  for each row execute function public.recalcular_faturas_cartao();

-- ---------------------------------------------------------------------
-- Pagamentos de fatura
-- ---------------------------------------------------------------------
create table public.pagamentos_fatura (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  escopo       public.escopo not null default 'individual',
  cartao_id    uuid not null references public.cartoes(id) on delete cascade,
  fatura_mes   date not null,
  conta_id     uuid references public.contas(id) on delete set null,
  valor_cents  bigint not null check (valor_cents > 0),
  data         date not null,
  created_at   timestamptz not null default now(),
  unique (cartao_id, fatura_mes)
);

alter table public.pagamentos_fatura enable row level security;
create policy pagamentos_fatura_select on public.pagamentos_fatura for select
  using (public.pode_ver(owner_id, escopo, household_id));
-- Escrita somente pelas funções pagar_fatura / desfazer_pagamento_fatura.

-- Resumo de uma fatura. Inclui o total das compras individuais do cônjuge
-- num cartão do casal, sem revelar quais são.
create or replace function public.resumo_fatura(p_cartao uuid, p_fatura_mes date)
returns table (total_cents bigint, privado_cents bigint, pago boolean, data_pagamento date, conta_pagamento uuid)
language plpgsql stable security definer set search_path = public as $$
declare c public.cartoes;
begin
  select * into c from public.cartoes where id = p_cartao;
  if not found or not public.pode_ver(c.owner_id, c.escopo, c.household_id) then
    raise exception 'Cartão não encontrado';
  end if;
  return query
    select coalesce(sum(l.valor_cents), 0)::bigint,
           coalesce(sum(l.valor_cents) filter (where not public.pode_ver(l.owner_id, l.escopo, l.household_id)), 0)::bigint,
           pf.id is not null,
           pf.data,
           pf.conta_id
      from (select 1) x
      left join public.lancamentos l on l.cartao_id = p_cartao and l.fatura_mes = p_fatura_mes and l.tipo = 'despesa'
      left join public.pagamentos_fatura pf on pf.cartao_id = p_cartao and pf.fatura_mes = p_fatura_mes
     group by pf.id, pf.data, pf.conta_id;
end $$;

create or replace function public.pagar_fatura(p_cartao uuid, p_fatura_mes date, p_conta uuid, p_data date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.cartoes; v_total bigint;
begin
  select * into c from public.cartoes where id = p_cartao;
  if not found or not public.pode_ver(c.owner_id, c.escopo, c.household_id) then
    raise exception 'Cartão não encontrado';
  end if;
  if p_conta is not null and not exists (
    select 1 from public.contas ct where ct.id = p_conta and public.pode_ver(ct.owner_id, ct.escopo, ct.household_id)
  ) then
    raise exception 'Conta inválida';
  end if;
  select coalesce(sum(valor_cents), 0) into v_total
    from public.lancamentos where cartao_id = p_cartao and fatura_mes = p_fatura_mes and tipo = 'despesa';
  if v_total <= 0 then raise exception 'Esta fatura não tem lançamentos'; end if;

  insert into public.pagamentos_fatura (owner_id, household_id, escopo, cartao_id, fatura_mes, conta_id, valor_cents, data)
  values (auth.uid(), c.household_id, c.escopo, p_cartao, p_fatura_mes, p_conta, v_total, p_data);
  update public.lancamentos set pago = true where cartao_id = p_cartao and fatura_mes = p_fatura_mes;
end $$;

create or replace function public.desfazer_pagamento_fatura(p_cartao uuid, p_fatura_mes date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.cartoes;
begin
  select * into c from public.cartoes where id = p_cartao;
  if not found or not public.pode_ver(c.owner_id, c.escopo, c.household_id) then
    raise exception 'Cartão não encontrado';
  end if;
  delete from public.pagamentos_fatura where cartao_id = p_cartao and fatura_mes = p_fatura_mes;
  update public.lancamentos set pago = false where cartao_id = p_cartao and fatura_mes = p_fatura_mes;
end $$;

-- Valor ainda não pago em cada cartão (para mostrar o limite disponível)
create or replace function public.utilizado_cartoes()
returns table (cartao_id uuid, utilizado_cents bigint)
language sql stable security definer set search_path = public as $$
  select c.id, coalesce(sum(l.valor_cents) filter (where not l.pago and l.tipo = 'despesa'), 0)::bigint
    from public.cartoes c
    left join public.lancamentos l on l.cartao_id = c.id
   where public.pode_ver(c.owner_id, c.escopo, c.household_id)
   group by c.id
$$;

-- ---------------------------------------------------------------------
-- Saldo das contas = saldo inicial + receitas − despesas (pagas, fora do cartão)
--                    ± transferências − pagamentos de fatura
-- ---------------------------------------------------------------------
create or replace function public.saldos_contas()
returns table (conta_id uuid, saldo_cents bigint)
language sql stable security definer set search_path = public as $$
  select c.id,
         (c.saldo_inicial_cents + coalesce(m.mov, 0) - coalesce(p.pag, 0))::bigint
    from public.contas c
    left join lateral (
      select sum(case
                   when l.tipo = 'receita' and l.conta_id = c.id then l.valor_cents
                   when l.tipo in ('despesa', 'transferencia') and l.conta_id = c.id then -l.valor_cents
                   when l.tipo = 'transferencia' and l.conta_destino_id = c.id then l.valor_cents
                   else 0
                 end) as mov
        from public.lancamentos l
       where (l.conta_id = c.id or l.conta_destino_id = c.id) and l.pago and l.cartao_id is null
    ) m on true
    left join lateral (
      select sum(pf.valor_cents) as pag from public.pagamentos_fatura pf where pf.conta_id = c.id
    ) p on true
   where public.pode_ver(c.owner_id, c.escopo, c.household_id)
$$;

-- ---------------------------------------------------------------------
-- Parcelamentos: cria o registro e todas as parcelas de uma vez.
-- A diferença de centavos da divisão fica na 1ª parcela.
-- p_pagas: quantas parcelas já foram pagas (compra antiga sendo cadastrada agora).
-- ---------------------------------------------------------------------
create or replace function public.criar_parcelamento(
  p_descricao     text,
  p_valor_total   bigint,
  p_num_parcelas  int,
  p_data_primeira date,
  p_categoria     uuid,
  p_escopo        public.escopo,
  p_cartao        uuid default null,
  p_conta         uuid default null,
  p_pagas         int  default 0
) returns uuid language plpgsql as $$
declare
  v_id    uuid;
  v_hh    uuid := public.my_household_id();
  v_base  bigint;
  v_resto bigint;
  i       int;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if p_num_parcelas < 1 or p_num_parcelas > 480 then raise exception 'Número de parcelas inválido'; end if;
  if p_valor_total <= 0 then raise exception 'Valor inválido'; end if;
  if p_pagas < 0 or p_pagas > p_num_parcelas then raise exception 'Parcelas pagas inválidas'; end if;
  if p_cartao is not null and not exists (select 1 from public.cartoes where id = p_cartao) then
    raise exception 'Cartão inválido';
  end if;

  insert into public.parcelamentos
    (owner_id, household_id, escopo, descricao, valor_total_cents, num_parcelas, data_primeira, categoria_id, cartao_id)
  values
    (auth.uid(), v_hh, p_escopo, p_descricao, p_valor_total, p_num_parcelas, p_data_primeira, p_categoria, p_cartao)
  returning id into v_id;

  v_base  := p_valor_total / p_num_parcelas;
  v_resto := p_valor_total - v_base * p_num_parcelas;

  for i in 1..p_num_parcelas loop
    insert into public.lancamentos
      (owner_id, household_id, escopo, tipo, descricao, valor_cents, data, categoria_id,
       cartao_id, conta_id, parcelamento_id, parcela_numero, pago)
    values
      (auth.uid(), v_hh, p_escopo, 'despesa',
       p_descricao || ' (' || i || '/' || p_num_parcelas || ')',
       v_base + case when i = 1 then v_resto else 0 end,
       (p_data_primeira + make_interval(months => i - 1))::date,
       p_categoria, p_cartao, case when p_cartao is null then p_conta end,
       v_id, i, i <= p_pagas);
  end loop;

  return v_id;
end $$;

-- Funções disponíveis só para usuários logados
revoke execute on function public.membros_familia()                         from anon;
revoke execute on function public.resumo_fatura(uuid, date)                 from anon;
revoke execute on function public.pagar_fatura(uuid, date, uuid, date)      from anon;
revoke execute on function public.desfazer_pagamento_fatura(uuid, date)     from anon;
revoke execute on function public.utilizado_cartoes()                       from anon;
revoke execute on function public.saldos_contas()                           from anon;
revoke execute on function public.criar_parcelamento(text, bigint, int, date, uuid, public.escopo, uuid, uuid, int) from anon;
