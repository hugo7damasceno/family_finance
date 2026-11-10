-- =====================================================================
-- Saúde financeira (individual ou do casal)
-- Devolve apenas TOTAIS do usuário ou da família (nunca valores por membro).
-- O cálculo da nota e das recomendações é feito no app.
-- =====================================================================

-- Membros considerados: o próprio usuário e, na conta conjunta, o cônjuge.
create or replace function public.ids_da_familia()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
   where p.id = auth.uid()
      or (public.my_household_id() is not null and p.household_id = public.my_household_id())
$$;
revoke execute on function public.ids_da_familia() from anon, authenticated;

-- Totais por mês de competência (compra no cartão conta no mês da fatura),
-- de p_mes − (p_meses − 1) até p_mes.
create or replace function public.saude_mensal(p_mes date, p_meses int default 4)
returns table (
  mes                 date,
  receitas_cents      bigint,  -- receitas lançadas
  contribuicoes_cents bigint,  -- dízimo + oferta
  despesas_cents      bigint,  -- despesas sem dízimo/oferta
  fixas_cents         bigint,  -- recorrentes, parcelas e categorias fixas
  parcelas_cents      bigint,
  renda_cadastro_cents bigint  -- soma da renda do questionário (fallback para quem está começando)
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

-- Situação atual: reserva de emergência acumulada e contas em atraso.
create or replace function public.saude_situacao()
returns table (reserva_cents bigint, atrasadas_qtd int, atrasadas_cents bigint)
language sql stable security definer set search_path = public as $$
  with reservas as (
    select c.id, c.saldo_inicial_cents
      from public.contas c
     where c.tipo = 'reserva' and not c.arquivada
       and c.owner_id in (select public.ids_da_familia())
  ),
  saldo_reservas as (
    select coalesce(sum(
             r.saldo_inicial_cents
           + coalesce((select sum(case
                                    when l.tipo = 'receita' and l.conta_id = r.id then l.valor_cents
                                    when l.tipo in ('despesa', 'transferencia') and l.conta_id = r.id then -l.valor_cents
                                    when l.tipo = 'transferencia' and l.conta_destino_id = r.id then l.valor_cents
                                    else 0 end)
                         from public.lancamentos l
                        where (l.conta_id = r.id or l.conta_destino_id = r.id) and l.pago and l.cartao_id is null), 0)
           - coalesce((select sum(pf.valor_cents) from public.pagamentos_fatura pf where pf.conta_id = r.id), 0)
           ), 0)::bigint as total
      from reservas r
  ),
  atrasadas as (
    select l.valor_cents
      from public.lancamentos l
      left join public.cartoes c on c.id = l.cartao_id
     where l.owner_id in (select public.ids_da_familia())
       and l.tipo = 'despesa' and not l.pago
       and case
             when l.cartao_id is null then l.data < current_date
             else make_date(extract(year from l.fatura_mes)::int, extract(month from l.fatura_mes)::int,
                            least(c.dia_vencimento,
                                  extract(day from (l.fatura_mes + interval '1 month - 1 day'))::int)) < current_date
           end
  )
  select (select total from saldo_reservas),
         (select count(*) from atrasadas)::int,
         (select coalesce(sum(valor_cents), 0) from atrasadas)::bigint
$$;

revoke execute on function public.saude_mensal(date, int) from anon;
revoke execute on function public.saude_situacao()        from anon;
