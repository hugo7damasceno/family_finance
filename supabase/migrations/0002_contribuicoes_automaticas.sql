-- =====================================================================
-- Dízimo e oferta automáticos
-- Toda receita (salário, 13º, férias, restituição, outros) gera, para o
-- dono da receita, os lançamentos de dízimo e oferta conforme o perfil.
-- Os lançamentos gerados ficam ligados à receita (gerado_de_id): ao editar
-- a receita eles são atualizados e ao excluí-la são excluídos (cascade).
-- =====================================================================

create or replace function public.sincronizar_contribuicao(
  r public.lancamentos,
  p_categoria uuid,
  p_percentual numeric,
  p_rotulo text
) returns void language plpgsql as $$
declare
  v_valor bigint := round(r.valor_cents * p_percentual / 100);
begin
  if v_valor <= 0 then
    delete from public.lancamentos where gerado_de_id = r.id and categoria_id = p_categoria;
    return;
  end if;

  update public.lancamentos
     set valor_cents = v_valor,
         data        = r.data,
         descricao   = p_rotulo || ' — ' || r.descricao
   where gerado_de_id = r.id and categoria_id = p_categoria;

  if not found then
    insert into public.lancamentos
      (owner_id, household_id, escopo, tipo, descricao, valor_cents, data, categoria_id, gerado_de_id)
    values
      (r.owner_id, r.household_id, 'individual', 'despesa', p_rotulo || ' — ' || r.descricao,
       v_valor, r.data, p_categoria, r.id);
  end if;
end $$;

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

  -- Receita que virou despesa/transferência: remove o que tinha sido gerado
  if new.tipo <> 'receita' then
    if tg_op = 'UPDATE' and old.tipo = 'receita' then
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

create trigger lancamentos_contribuicoes
  after insert or update of tipo, valor_cents, data, descricao on public.lancamentos
  for each row execute function public.gerar_contribuicoes();
