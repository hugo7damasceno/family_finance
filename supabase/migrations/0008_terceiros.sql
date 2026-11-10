-- =====================================================================
-- Terceiros: pessoas que compraram no nosso cartão e precisam reembolsar
--
-- A compra entra na fatura normalmente (despesa com terceiro_id), mas não é
-- gasto da família: fica fora das estatísticas, do "disponível para gastar",
-- da saúde financeira e dos comparativos.
-- O reembolso é uma receita com terceiro_id: atualiza o saldo da conta que
-- recebeu, mas não é renda (não gera dízimo/oferta nem entra no fundo).
-- Cada parcela devida aponta para a receita que a quitou (reembolso_id);
-- excluir a receita volta as parcelas para "devendo".
-- =====================================================================

alter table public.lancamentos
  add column if not exists reembolso_id uuid references public.lancamentos(id) on delete set null;

create index if not exists lancamentos_terceiro_idx on public.lancamentos (terceiro_id) where terceiro_id is not null;

alter table public.terceiros add column if not exists observacao text;
alter table public.terceiros add column if not exists arquivado boolean not null default false;

-- ---------------------------------------------------------------------
-- Dízimo/oferta: reembolso de terceiro não é renda
-- ---------------------------------------------------------------------
create or replace function public.gerar_contribuicoes()
returns trigger language plpgsql as $$
declare
  p          public.profiles;
  cat_dizimo uuid;
  cat_oferta uuid;
begin
  -- Lançamentos gerados não geram outros
  if new.gerado_de_id is not null then
    return new;
  end if;

  -- Não é receita própria (despesa, transferência ou reembolso de terceiro):
  -- remove o que tinha sido gerado
  if new.tipo <> 'receita' or new.terceiro_id is not null then
    if tg_op = 'UPDATE' then
      delete from public.lancamentos where gerado_de_id = new.id;
    end if;
    return new;
  end if;

  select * into p from public.profiles where id = new.owner_id;
  select id into cat_dizimo from public.categorias where owner_id is null and nome = 'Dízimo' limit 1;
  select id into cat_oferta from public.categorias where owner_id is null and nome = 'Oferta' limit 1;

  perform public.sincronizar_contribuicao(new, cat_dizimo,
    case when p.dizimista then p.percentual_dizimo else 0 end, 'Dízimo');
  perform public.sincronizar_contribuicao(new, cat_oferta,
    case when p.ofertante then p.percentual_oferta else 0 end, 'Oferta');

  return new;
end $$;

drop trigger if exists lancamentos_contribuicoes on public.lancamentos;
create trigger lancamentos_contribuicoes
  after insert or update of tipo, valor_cents, data, descricao, terceiro_id on public.lancamentos
  for each row execute function public.gerar_contribuicoes();

-- ---------------------------------------------------------------------
-- Fundo do casal: ignora reembolsos de terceiros
-- ---------------------------------------------------------------------
create or replace function public.resumo_fundo(p_mes date)
returns table (
  receitas_cents      bigint,
  contribuicoes_cents bigint,
  estimado            boolean,
  fundo_cents         bigint,
  fundo_estimado      boolean,
  membros             int
)
language sql stable security definer set search_path = public as $$
  with periodo as (
    select date_trunc('month', p_mes)::date as ini,
           (date_trunc('month', p_mes) + interval '1 month - 1 day')::date as fim
  ),
  por_membro as (
    select p.id,
           coalesce(r.total, 0) = 0 as estimado,
           (case when coalesce(r.total, 0) > 0 then r.total else p.renda_mensal_cents end)::bigint as receitas,
           (case when coalesce(r.total, 0) > 0 then coalesce(c.total, 0)
                 else round(p.renda_mensal_cents *
                       ((case when p.dizimista then p.percentual_dizimo else 0 end)
                      + (case when p.ofertante then p.percentual_oferta else 0 end)) / 100)
            end)::bigint as contribuicoes
      from public.profiles p
      cross join periodo
      left join lateral (
        select sum(l.valor_cents) as total from public.lancamentos l
         where l.owner_id = p.id and l.tipo = 'receita' and l.terceiro_id is null
           and l.data between periodo.ini and periodo.fim
      ) r on true
      left join lateral (
        select sum(l.valor_cents) as total
          from public.lancamentos l
          join public.categorias k on k.id = l.categoria_id and k.owner_id is null and k.nome in ('Dízimo', 'Oferta')
         where l.owner_id = p.id and l.tipo = 'despesa' and l.data between periodo.ini and periodo.fim
      ) c on true
     where p.id = auth.uid()
        or (public.my_household_id() is not null and p.household_id = public.my_household_id())
  )
  select eu.receitas,
         eu.contribuicoes,
         eu.estimado,
         (select sum(receitas - contribuicoes) from por_membro)::bigint,
         (select bool_or(estimado) from por_membro),
         (select count(*) from por_membro)::int
    from por_membro eu
   where eu.id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Saúde financeira: ignora compras e reembolsos de terceiros
-- ---------------------------------------------------------------------
create or replace function public.saude_mensal(p_mes date, p_meses int default 4)
returns table (
  mes                 date,
  receitas_cents      bigint,
  contribuicoes_cents bigint,
  despesas_cents      bigint,
  fixas_cents         bigint,
  parcelas_cents      bigint,
  renda_cadastro_cents bigint
)
language sql stable security definer set search_path = public as $$
  with meses as (
    select (date_trunc('month', p_mes) - make_interval(months => g))::date as mes
      from generate_series(0, greatest(p_meses, 1) - 1) g
  ),
  movs as (
    select l.*,
           date_trunc('month', coalesce(l.fatura_mes, l.data))::date as competencia,
           coalesce(k.owner_id is null and k.nome in ('Dízimo', 'Oferta'), false) as contribuicao,
           coalesce(k.fixa, false) as categoria_fixa
      from public.lancamentos l
      left join public.categorias k on k.id = l.categoria_id
     where l.owner_id in (select public.ids_da_familia())
       and l.tipo <> 'transferencia'
       and l.terceiro_id is null
  )
  select m.mes,
         coalesce(sum(v.valor_cents) filter (where v.tipo = 'receita'), 0)::bigint,
         coalesce(sum(v.valor_cents) filter (where v.tipo = 'despesa' and v.contribuicao), 0)::bigint,
         coalesce(sum(v.valor_cents) filter (where v.tipo = 'despesa' and not v.contribuicao), 0)::bigint,
         coalesce(sum(v.valor_cents) filter (
           where v.tipo = 'despesa' and not v.contribuicao
             and (v.recorrencia_id is not null or v.parcelamento_id is not null or v.categoria_fixa)), 0)::bigint,
         coalesce(sum(v.valor_cents) filter (where v.tipo = 'despesa' and v.parcelamento_id is not null), 0)::bigint,
         (select coalesce(sum(p.renda_mensal_cents), 0) from public.profiles p
           where p.id in (select public.ids_da_familia()))::bigint
    from meses m
    left join movs v on v.competencia = m.mes
   group by m.mes
   order by m.mes
$$;

-- ---------------------------------------------------------------------
-- Parcelamento com terceiro (novo parâmetro p_terceiro)
-- ---------------------------------------------------------------------
drop function if exists public.criar_parcelamento(text, bigint, int, date, uuid, public.escopo, uuid, uuid, int);

create or replace function public.criar_parcelamento(
  p_descricao     text,
  p_valor_total   bigint,
  p_num_parcelas  int,
  p_data_primeira date,
  p_categoria     uuid,
  p_escopo        public.escopo,
  p_cartao        uuid default null,
  p_conta         uuid default null,
  p_pagas         int  default 0,
  p_terceiro      uuid default null
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
  if p_terceiro is not null and not exists (select 1 from public.terceiros where id = p_terceiro) then
    raise exception 'Terceiro inválido';
  end if;

  insert into public.parcelamentos
    (owner_id, household_id, escopo, descricao, valor_total_cents, num_parcelas, data_primeira, categoria_id,
     cartao_id, terceiro_id)
  values
    (auth.uid(), v_hh, p_escopo, p_descricao, p_valor_total, p_num_parcelas, p_data_primeira, p_categoria,
     p_cartao, p_terceiro)
  returning id into v_id;

  v_base  := p_valor_total / p_num_parcelas;
  v_resto := p_valor_total - v_base * p_num_parcelas;

  for i in 1..p_num_parcelas loop
    insert into public.lancamentos
      (owner_id, household_id, escopo, tipo, descricao, valor_cents, data, categoria_id,
       cartao_id, conta_id, parcelamento_id, parcela_numero, pago, terceiro_id)
    values
      (auth.uid(), v_hh, p_escopo, 'despesa',
       p_descricao || ' (' || i || '/' || p_num_parcelas || ')',
       v_base + case when i = 1 then v_resto else 0 end,
       (p_data_primeira + make_interval(months => i - 1))::date,
       p_categoria, p_cartao, case when p_cartao is null then p_conta end,
       v_id, i, i <= p_pagas, p_terceiro);
  end loop;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- Registrar reembolso: cria a receita e liga as parcelas quitadas a ela.
-- Roda com as permissões do usuário (RLS vale para tudo).
-- ---------------------------------------------------------------------
create or replace function public.registrar_reembolso(
  p_ids   uuid[],
  p_data  date,
  p_conta uuid default null
) returns uuid language plpgsql as $$
declare
  v_terceiro  uuid;
  v_nome      text;
  v_escopo    public.escopo;
  v_total     bigint;
  v_qtd       int;
  v_pessoas   int;
  v_id        uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception 'Escolha ao menos uma compra'; end if;

  select count(*), count(distinct l.terceiro_id), min(l.terceiro_id::text)::uuid, sum(l.valor_cents)
    into v_qtd, v_pessoas, v_terceiro, v_total
    from public.lancamentos l
   where l.id = any(p_ids) and l.tipo = 'despesa' and l.terceiro_id is not null and l.reembolso_id is null;
  if v_qtd <> cardinality(p_ids) then raise exception 'Compras inválidas ou já reembolsadas'; end if;
  if v_pessoas <> 1 then raise exception 'As compras devem ser da mesma pessoa'; end if;

  select t.nome, t.escopo into v_nome, v_escopo from public.terceiros t where t.id = v_terceiro;
  if v_nome is null then raise exception 'Terceiro inválido'; end if;
  if p_conta is not null then
    select c.escopo into v_escopo from public.contas c where c.id = p_conta;
    if not found then raise exception 'Conta inválida'; end if;
  end if;

  insert into public.lancamentos
    (owner_id, household_id, escopo, tipo, origem_receita, descricao, valor_cents, data, conta_id, terceiro_id, pago)
  values
    (auth.uid(), public.my_household_id(), v_escopo, 'receita', 'outros', 'Reembolso — ' || v_nome,
     v_total, coalesce(p_data, current_date), p_conta, v_terceiro, true)
  returning id into v_id;

  update public.lancamentos set reembolso_id = v_id where id = any(p_ids);
  return v_id;
end $$;

revoke execute on function public.criar_parcelamento(text, bigint, int, date, uuid, public.escopo, uuid, uuid, int, uuid) from anon;
revoke execute on function public.registrar_reembolso(uuid[], date, uuid) from anon;
