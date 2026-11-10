-- =====================================================================
-- Fatura paga sempre consistente
--
-- Regra: uma compra no cartão está paga se, e somente se, a fatura em que
-- ela cai foi paga. Antes, só as compras existentes no momento do pagamento
-- eram marcadas; compras lançadas depois (data retroativa, recorrência ou
-- parcela gerada depois, data editada) ficavam "a pagar" numa fatura paga.
--
-- Também: o valor do pagamento acompanha o total da fatura. Se a fatura paga
-- ganhar ou perder compras, o pagamento é ajustado (a fatura paga ao banco já
-- incluía a compra esquecida) e o saldo da conta reflete isso.
-- =====================================================================

create or replace function public.fatura_esta_paga(p_cartao uuid, p_fatura_mes date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pagamentos_fatura where cartao_id = p_cartao and fatura_mes = p_fatura_mes)
$$;
-- Chamada pelo trigger (com as permissões do usuário): fica liberada para usuários logados.
revoke execute on function public.fatura_esta_paga(uuid, date) from anon;

-- Mesmo comportamento anterior + "pago" das compras no cartão derivado da fatura.
create or replace function public.preparar_lancamento()
returns trigger language plpgsql as $$
declare
  c              public.cartoes;
  mudou_conta    boolean := true;
  mudou_destino  boolean := true;
  mudou_cartao   boolean := true;
begin
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
    select public.mes_fatura_cartao(new.cartao_id, new.data) into new.fatura_mes;
  end if;

  new.pago := public.fatura_esta_paga(new.cartao_id, new.fatura_mes);
  return new;
end $$;

-- Ajusta o valor do pagamento de uma fatura paga ao total atual das compras.
create or replace function public.sincronizar_pagamento_fatura(p_cartao uuid, p_fatura_mes date)
returns void language plpgsql security definer set search_path = public as $$
declare v_total bigint;
begin
  if p_cartao is null or p_fatura_mes is null then return; end if;
  if not exists (select 1 from public.pagamentos_fatura where cartao_id = p_cartao and fatura_mes = p_fatura_mes) then
    return;
  end if;
  select coalesce(sum(valor_cents), 0) into v_total
    from public.lancamentos where cartao_id = p_cartao and fatura_mes = p_fatura_mes and tipo = 'despesa';
  if v_total = 0 then
    delete from public.pagamentos_fatura where cartao_id = p_cartao and fatura_mes = p_fatura_mes;
  else
    update public.pagamentos_fatura set valor_cents = v_total
     where cartao_id = p_cartao and fatura_mes = p_fatura_mes and valor_cents <> v_total;
  end if;
end $$;
revoke execute on function public.sincronizar_pagamento_fatura(uuid, date) from anon;

create or replace function public.lancamento_alterou_fatura()
returns trigger language plpgsql as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.cartao_id is not null then
    perform public.sincronizar_pagamento_fatura(old.cartao_id, old.fatura_mes);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.cartao_id is not null
     and (tg_op = 'INSERT' or new.cartao_id is distinct from old.cartao_id
          or new.fatura_mes is distinct from old.fatura_mes) then
    perform public.sincronizar_pagamento_fatura(new.cartao_id, new.fatura_mes);
  end if;
  return null;
end $$;

drop trigger if exists lancamentos_sincronizar_fatura on public.lancamentos;
create trigger lancamentos_sincronizar_fatura
  after insert or delete or update of valor_cents, tipo, cartao_id, fatura_mes on public.lancamentos
  for each row execute function public.lancamento_alterou_fatura();

-- Mudança de fechamento/vencimento do cartão: compras em aberto mudam de
-- fatura e herdam a situação (paga ou não) da fatura de destino.
create or replace function public.recalcular_faturas_cartao()
returns trigger language plpgsql as $$
begin
  if new.dia_fechamento <> old.dia_fechamento or new.dia_vencimento <> old.dia_vencimento then
    update public.lancamentos l
       set fatura_mes = x.mes,
           pago       = public.fatura_esta_paga(new.id, x.mes)
      from (select id, public.calcular_fatura_mes(data, new.dia_fechamento, new.dia_vencimento) as mes
              from public.lancamentos where cartao_id = new.id and not pago) x
     where l.id = x.id;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Corrige os dados existentes
-- ---------------------------------------------------------------------
update public.lancamentos l
   set pago = public.fatura_esta_paga(l.cartao_id, l.fatura_mes)
 where l.cartao_id is not null
   and l.pago is distinct from public.fatura_esta_paga(l.cartao_id, l.fatura_mes);

do $$
declare f record;
begin
  for f in select cartao_id, fatura_mes from public.pagamentos_fatura loop
    perform public.sincronizar_pagamento_fatura(f.cartao_id, f.fatura_mes);
  end loop;
end $$;
