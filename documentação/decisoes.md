# Decisões do projeto

Registro das regras de negócio definidas a partir da análise do esboço
([projeto.txt](projeto.txt)) e das respostas do cliente ([respostas.txt](respostas.txt)).
Atualize este arquivo sempre que uma nova dúvida for respondida.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| PWA | vite-plugin-pwa (manifest + service worker, instalável pelo navegador) |
| Estilo | Tailwind CSS v4 |
| Formulários | React Hook Form + Zod |
| Dados no cliente | TanStack Query |
| Gráficos | Recharts |
| Backend | Supabase (Postgres, Auth, Row Level Security, Storage, Realtime) |

## Valores monetários

- Todo valor lançado no sistema é **líquido**. O usuário é avisado disso no cadastro.
- No banco e no código, os valores são guardados em **centavos (inteiros)**. Nunca usar float.

## Dízimo e ofertas

- Incidem sobre a **renda líquida**.
- Incidem também sobre **13º, férias, restituição e outras receitas**.
- São **individuais**: cada cônjuge separa os próprios antes do fundo comum.
- São **gerados automaticamente** no banco (trigger) a cada receita lançada, com o percentual do perfil.
  Editar a receita atualiza o dízimo e a oferta; excluir a receita os exclui.
- Dízimo padrão de 10% (configurável). Versículo de apoio: Malaquias 3:10.

## Conta conjunta

Fluxo mensal:

1. Cada cônjuge lança a **própria renda** (salário, 13º, férias, restituição...).
2. Dízimo e ofertas saem **individualmente**.
3. O restante entra num **fundo comum** do casal.
4. Do fundo comum saem as **contas da casa** e a **reserva de emergência**.
5. A **sobra** é dividida entre os dois (padrão: em partes iguais; opção futura: proporcional à renda).
6. Cada um usa sua parte como quiser: gastar, investir, guardar.

Visibilidade (aplicada no banco via Row Level Security, coluna `escopo`):

| Visível só para o dono (`individual`) | Visível para o casal (`casal`) |
|---|---|
| Lançamento dos valores de renda do mês | Contas e despesas da casa |
| Despesas individuais (saem da parte de cada um) | Reserva de emergência |
| Carteira de investimentos | Crescimento patrimonial do casal |
| Dinheiro guardado | Datas comemorativas |

- O cônjuge entra na conta conjunta com um **código de convite** gerado na criação.
- Máximo de 2 membros por conta conjunta.
- O perfil (que contém a renda informada no questionário) é visível só para o dono; do cônjuge, o app só lê o nome.

## Desfazer conta conjunta / excluir conta

- Antes da exclusão, gerar um **relatório geral** dos dados.
- Ao confirmar, o relatório é **baixado** pelo usuário e os dados são **apagados** da base.

## Reserva de emergência

- O percentual é calculado sobre o valor **após dízimo e ofertas**. *(Premissa adotada; confirmar com o cliente.)*

## Cartão de crédito

- Cada cartão tem **dia de fechamento** e **dia de vencimento**. A compra feita no dia do fechamento
  ou depois entra na fatura seguinte. A "fatura de um mês" é a que **vence** naquele mês (`lancamentos.fatura_mes`).
- Compras no cartão ficam **pendentes** e só são marcadas como pagas quando a **fatura é paga**.
  O valor sai da conta escolhida no pagamento da fatura, não no dia da compra.
- Cartão **do casal**: os dois veem a fatura. As compras individuais de um cônjuge feitas nesse cartão aparecem para o outro
  apenas como um total ("Compras individuais do cônjuge").
- Limite disponível = limite − tudo que ainda não foi pago no cartão.

## Parcelamentos

- Uma única entidade (`parcelamentos`) atende compras no cartão, compras de terceiros e empréstimos.
- Ao criar, todas as parcelas são geradas como lançamentos. A diferença de centavos da divisão fica na 1ª parcela.
- No cartão, cada parcela cai na fatura correspondente. É possível cadastrar parcelamentos já iniciados ("parcelas já pagas").
- **Renda comprometida** = parcelas individuais do mês ÷ renda líquida do perfil. Faixas: até 20% verde, até 30% amarelo, acima de 30% vermelho.

## Contas e saldos

- Saldo = saldo inicial + receitas recebidas − despesas pagas (fora do cartão) ± transferências − faturas pagas com a conta.
- Transferências entre contas não contam como receita nem despesa.
- Conta arquivada some das listas, mas mantém o histórico.

## Cofrinhos / caixinhas

- **Conta** responde *onde* está o dinheiro; **cofrinho** responde *para que* ele está guardado.
- Decisão: cofrinho é um **tipo de conta** (`cofrinho`, ou `reserva` para a reserva de emergência), como as caixinhas
  dos bancos, que movem dinheiro de verdade. Não há cofrinhos "virtuais" dentro da conta corrente.
- Meta (valor) e data-alvo opcionais, com progresso e sugestão de quanto guardar por mês até a data.
- **Guardar**, **retirar** e **transferir entre cofrinhos** são transferências: não contam como receita nem despesa.
- Individual ou do casal, como as contas.
- Meta atingida pode ser marcada como **conquista** (sai da lista de ativos e vai para "Conquistas").
- O módulo de **Sonhos** usará os cofrinhos por baixo, para não duplicar funcionalidades.
- No painel: "Saldo em contas" não inclui cofrinhos; os cofrinhos têm um bloco próprio com o progresso das metas.

## Lançamentos recorrentes

- Aluguel, contas fixas, assinaturas e salário podem ser cadastrados como **recorrentes** (dia do mês, início e fim opcional).
- Ao abrir o app, os lançamentos do mês são criados automaticamente como **pendentes**. Valores que variam (ex.: luz)
  são ajustados no lançamento do próprio mês.
- Cada mês é gerado uma única vez: excluir o lançamento de um mês não faz ele voltar.
- Em meses mais curtos, o dia 29/30/31 vira o último dia do mês.

## Dashboard: "Disponível para gastar"

- As despesas contam no mês de **competência**: compra no cartão pesa no mês da fatura; o resto, no mês da data.
- Se ainda não há receita lançada no mês, usa a renda do questionário (marcado como **estimativa**).
- **Individual:** (receitas − dízimo/oferta) − reserva − investimento − despesas do mês.
- **Conta conjunta:**
  1. Fundo comum = receitas de ambos − dízimo/oferta de cada um.
  2. Do fundo saem as despesas da casa e a reserva (percentual definido pelo casal em Configurações).
  3. A sobra é dividida **em partes iguais** (padrão) ou **proporcional à renda** (configurável).
  4. Da minha parte saem meu investimento e minhas despesas individuais.
- **Privacidade:** o banco devolve só os números do próprio usuário e o total do fundo (função `resumo_fundo`); a renda
  do cônjuge nunca é enviada ao app. O detalhamento mostra a *minha contribuição* e a *minha parte*.
  Limite conhecido: como a sobra é dividida entre os dois, cada um consegue deduzir a renda do outro por conta.
  Isso é inerente ao modelo de fundo comum e foi aceito.
- Se ainda não há receita lançada, o painel mostra a renda do cadastro como **prevista** e oferece "Lançar salário do mês".
- **Despesas fixas** = recorrentes + parcelas + categorias marcadas como fixas (moradia, contas, assinaturas). O resto é variável.

## Saúde financeira

Nota de 0 a 100 (média ponderada de 5 indicadores). Na conta conjunta usa os totais do casal, sem expor valores de cada um.

| Indicador | Saudável | Atenção | Crítico | Peso |
|---|---|---|---|---|
| Taxa de poupança: (renda − despesas) ÷ renda | ≥ 20% | 10–20% | < 10% | 25 |
| Reserva de emergência (cofrinhos tipo reserva) ÷ custo de vida mensal | ≥ 6 meses | 3–6 | < 3 | 25 |
| Parcelas do mês ÷ renda | ≤ 10% | até 30% | > 30% | 20 |
| Despesas fixas ÷ renda (regra 50/30/20) | ≤ 50% | até 70% | > 70% | 15 |
| Contas em atraso | nenhuma | 1 | 3 ou mais | 15 |

- Renda = receitas − dízimo/oferta. Dízimo e ofertas não contam como despesa.
- Base: média dos últimos 3 meses fechados com receita; sem histórico, usa o mês atual.
- Sem receitas e despesas lançadas, mostra "Sem dados suficientes" (não dá nota).
- Faixas: 80+ Saudável · 60–79 Estável · 40–59 Atenção · abaixo de 40 Crítica.
- Cada indicador fora do ideal traz uma dica de como melhorar.

## Ocultar valores

- O ícone do olho (no topo de cada tela) troca todos os valores por "R$ •••••". A preferência fica salva no aparelho.
- Campos de digitação continuam mostrando o valor real.
- Cores dos gráficos: receitas sempre azul (`#2a78d6`), despesas sempre laranja (`#eb6834`). A paleta foi validada para daltonismo e contraste.

## Integrações futuras (botão desabilitado com selo "Em breve")

- Open Finance (extratos bancários): via agregador (Pluggy/Belvo).
- Leitura de nota fiscal: via QR Code da NFC-e (página da SEFAZ).
- B3: importação da planilha de movimentações da Área do Investidor.

## Roadmap

- **Fase 1:** autenticação, questionário, conta conjunta, contas, categorias, lançamentos, cartões, parcelamentos, recorrentes e dashboard ✅
- **Fase 2:** lista de compras (offline e sincronizada), terceiros, rendas extras, orçamento por categoria, importação OFX, sonhos.
- **Fase 3:** investimentos, projetos e empréstimos (amortização), datas comemorativas, patrimônio, relatórios e exclusão de conta com relatório.
- **Fase 4:** integrações (Open Finance, nota fiscal, B3).
