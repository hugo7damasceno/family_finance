-- =====================================================================
-- Cofrinhos / caixinhas
-- Um cofrinho é uma conta do tipo 'cofrinho' (ou 'reserva', a reserva de
-- emergência) com meta opcional. Guardar e retirar são transferências entre
-- contas; o saldo continua vindo de saldos_contas().
-- =====================================================================

alter table public.contas drop constraint if exists contas_tipo_check;
alter table public.contas add constraint contas_tipo_check
  check (tipo in ('corrente', 'poupanca', 'dinheiro', 'reserva', 'cofrinho', 'outro'));

alter table public.contas
  add column meta_cents   bigint check (meta_cents is null or meta_cents > 0),
  add column data_meta    date,
  add column icone        text,
  add column concluido_em date;   -- meta conquistada (vira "conquista")

comment on column public.contas.meta_cents   is 'Cofrinho: valor que se quer juntar';
comment on column public.contas.data_meta    is 'Cofrinho: até quando se quer juntar';
comment on column public.contas.icone        is 'Cofrinho: emoji escolhido pelo usuário';
comment on column public.contas.concluido_em is 'Cofrinho: data em que a meta foi marcada como conquistada';
