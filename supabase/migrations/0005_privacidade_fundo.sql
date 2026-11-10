-- =====================================================================
-- Privacidade do fundo comum
-- A versão anterior de contribuicoes_fundo devolvia a renda de cada membro.
-- Agora devolve só os números do próprio usuário + o total do fundo do casal.
-- =====================================================================

drop function if exists public.contribuicoes_fundo(date);

create or replace function public.resumo_fundo(p_mes date)
returns table (
  receitas_cents      bigint,   -- minhas receitas do mês (ou a renda do perfil, se nada lançado)
  contribuicoes_cents bigint,   -- meu dízimo + oferta do mês (lançados ou estimados)
  estimado            boolean,  -- meus números são estimativa?
  fundo_cents         bigint,   -- soma das contribuições líquidas de todos os membros
  fundo_estimado      boolean,  -- algum membro ainda sem receita lançada?
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

revoke execute on function public.resumo_fundo(date) from anon;
