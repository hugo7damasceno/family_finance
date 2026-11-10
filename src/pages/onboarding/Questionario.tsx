import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, Copy } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Escolha, SimNao } from '@/components/ui/Escolha'
import { Input, MoneyInput, PercentInput } from '@/components/ui/Field'
import { formatarBRL } from '@/lib/money'
import { calcularPlanoMensal } from '@/lib/planejamento'
import { supabase, traduzirErro } from '@/lib/supabase'
import type { Household } from '@/types/database'

type TipoConta = 'individual' | 'criar_conjunta' | 'entrar_conjunta'

interface Respostas {
  nome: string
  renda_mensal_cents: number
  dizimista: boolean
  percentual_dizimo: number
  ofertante: boolean
  percentual_oferta: number
  investe: boolean
  investimento_mensal_cents: number
  percentual_reserva: number
  tipoConta: TipoConta
  nomeFamilia: string
  codigoConvite: string
}

const PASSOS = ['Renda', 'Dízimo e ofertas', 'Reserva e investimentos', 'Tipo de conta', 'Resumo'] as const

export function Questionario() {
  const { profile, household, recarregarPerfil } = useAuth()
  const navigate = useNavigate()
  const [passo, setPasso] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [familiaCriada, setFamiliaCriada] = useState<Household | null>(null)
  const [r, setR] = useState<Respostas>({
    nome: profile?.nome ?? '',
    renda_mensal_cents: profile?.renda_mensal_cents ?? 0,
    dizimista: profile?.dizimista ?? false,
    percentual_dizimo: profile?.percentual_dizimo ?? 10,
    ofertante: profile?.ofertante ?? false,
    percentual_oferta: profile?.percentual_oferta ?? 0,
    investe: profile?.investe ?? false,
    investimento_mensal_cents: profile?.investimento_mensal_cents ?? 0,
    percentual_reserva: profile?.percentual_reserva ?? 10,
    tipoConta: 'individual',
    nomeFamilia: '',
    codigoConvite: '',
  })
  const set = <K extends keyof Respostas>(campo: K, valor: Respostas[K]) => setR((a) => ({ ...a, [campo]: valor }))
  const plano = calcularPlanoMensal(r)

  function validarPasso(): string | null {
    if (passo === 0) {
      if (r.nome.trim().length < 2) return 'Informe seu nome.'
      if (r.renda_mensal_cents <= 0) return 'Informe sua renda mensal líquida.'
    }
    if (passo === 1 && r.ofertante && (r.percentual_oferta <= 0 || r.percentual_oferta > 100))
      return 'Informe o percentual da oferta (entre 0 e 100).'
    if (passo === 2) {
      if (r.percentual_reserva < 0 || r.percentual_reserva > 100) return 'O percentual da reserva deve ficar entre 0 e 100.'
      if (r.investe && r.investimento_mensal_cents <= 0) return 'Informe quanto você investe por mês.'
    }
    if (passo === 3) {
      if (r.tipoConta === 'criar_conjunta' && r.nomeFamilia.trim().length < 2) return 'Dê um nome para a conta conjunta.'
      if (r.tipoConta === 'entrar_conjunta' && r.codigoConvite.trim().length < 6) return 'Informe o código de convite.'
    }
    if (passo === 4 && plano.disponivel < 0)
      return 'Os compromissos ultrapassam a renda. Revise a reserva ou o investimento mensal.'
    return null
  }

  function avancar() {
    const problema = validarPasso()
    setErro(problema)
    if (!problema) setPasso((p) => p + 1)
  }

  async function concluir() {
    const problema = validarPasso()
    if (problema) return setErro(problema)
    setErro(null)
    setSalvando(true)
    try {
      // Se uma tentativa anterior já vinculou a família, não chama a RPC de novo.
      let familia: Household | null = household
      if (!familia && r.tipoConta === 'criar_conjunta') {
        const { data, error } = await supabase.rpc('criar_familia', { p_nome: r.nomeFamilia.trim() })
        if (error) throw error
        familia = data as Household
      } else if (!familia && r.tipoConta === 'entrar_conjunta') {
        const { data, error } = await supabase.rpc('entrar_familia', { p_codigo: r.codigoConvite })
        if (error) throw error
        familia = data as Household
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: r.nome.trim(),
          renda_mensal_cents: r.renda_mensal_cents,
          dizimista: r.dizimista,
          percentual_dizimo: r.percentual_dizimo,
          ofertante: r.ofertante,
          percentual_oferta: r.ofertante ? r.percentual_oferta : 0,
          investe: r.investe,
          investimento_mensal_cents: r.investe ? r.investimento_mensal_cents : 0,
          percentual_reserva: r.percentual_reserva,
          onboarding_concluido: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile!.id)
      if (error) throw error
      if (r.tipoConta === 'criar_conjunta' && familia) {
        setFamiliaCriada(familia)
      } else {
        await recarregarPerfil()
        navigate('/', { replace: true })
      }
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : String(e)))
      await recarregarPerfil()
    } finally {
      setSalvando(false)
    }
  }

  if (familiaCriada) {
    return (
      <Moldura>
        <ConviteCriado
          familia={familiaCriada}
          onContinuar={async () => {
            await recarregarPerfil()
            navigate('/', { replace: true })
          }}
        />
      </Moldura>
    )
  }

  return (
    <Moldura>
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-700">
          Passo {passo + 1} de {PASSOS.length}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{PASSOS[passo]}</h1>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {PASSOS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= passo ? 'bg-brand-600' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      <Card className="flex flex-col gap-5">
        {passo === 0 && (
          <>
            <Aviso tipo="atencao">
              <strong>Importante:</strong> todos os valores lançados no sistema são <strong>líquidos</strong>, ou seja, o
              que realmente cai na sua conta, já descontados INSS, IR e outros descontos.
            </Aviso>
            <Input label="Como podemos te chamar?" value={r.nome} onChange={(e) => set('nome', e.target.value)} />
            <MoneyInput
              label="Renda mensal líquida"
              valor={r.renda_mensal_cents}
              onChange={(v) => set('renda_mensal_cents', v)}
              ajuda="Salário ou média mensal do que você recebe. 13º, férias e restituição são lançados à parte."
            />
          </>
        )}

        {passo === 1 && (
          <>
            <SimNao legenda="Você é dizimista?" valor={r.dizimista} onChange={(v) => set('dizimista', v)} />
            {r.dizimista && (
              <div className="rounded-xl bg-brand-50 p-4">
                <p className="text-sm text-slate-700">
                  Separaremos automaticamente <strong>{formatarBRL(plano.dizimo)}</strong> ({r.percentual_dizimo}% da
                  renda líquida) toda vez que entrar um valor, inclusive 13º, férias e restituição.
                </p>
                <blockquote className="mt-3 border-l-4 border-brand-600 pl-3 text-sm italic text-slate-700">
                  <BookOpen className="mb-1 size-4 text-brand-700" aria-hidden />
                  “Trazei todos os dízimos à casa do tesouro, para que haja mantimento na minha casa, e depois fazei
                  prova de mim nisto, diz o Senhor dos Exércitos, se eu não vos abrir as janelas do céu e não derramar
                  sobre vós uma bênção tal até que não haja lugar suficiente para a recolherdes.”
                  <footer className="mt-1 not-italic font-semibold text-brand-800">Malaquias 3:10</footer>
                </blockquote>
              </div>
            )}
            <SimNao legenda="Você é ofertante?" valor={r.ofertante} onChange={(v) => set('ofertante', v)} />
            {r.ofertante && (
              <PercentInput
                label="Percentual da oferta"
                valor={r.percentual_oferta}
                onChange={(v) => set('percentual_oferta', v)}
                ajuda={`Sobre a renda líquida: ${formatarBRL(plano.oferta)} por mês.`}
              />
            )}
          </>
        )}

        {passo === 2 && (
          <>
            <PercentInput
              label="Percentual para a reserva de emergência"
              valor={r.percentual_reserva}
              onChange={(v) => set('percentual_reserva', v)}
              ajuda={`Calculado após dízimo e ofertas: ${formatarBRL(plano.reserva)} por mês. O ideal é acumular de 6 a 12 meses do seu custo de vida.`}
            />
            <SimNao legenda="Você investe todo mês?" valor={r.investe} onChange={(v) => set('investe', v)} />
            {r.investe && (
              <MoneyInput
                label="Quanto você investe por mês?"
                valor={r.investimento_mensal_cents}
                onChange={(v) => set('investimento_mensal_cents', v)}
              />
            )}
          </>
        )}

        {passo === 3 && household && (
          <Aviso tipo="info">
            Você já faz parte da conta conjunta <strong>{household.nome}</strong>.
          </Aviso>
        )}

        {passo === 3 && !household && (
          <>
            <Escolha<TipoConta>
              legenda="Como você vai usar o app?"
              valor={r.tipoConta}
              onChange={(v) => set('tipoConta', v)}
              opcoes={[
                { valor: 'individual', titulo: 'Só eu', descricao: 'Controle financeiro individual.' },
                {
                  valor: 'criar_conjunta',
                  titulo: 'Criar conta conjunta',
                  descricao: 'Você recebe um código para convidar seu cônjuge.',
                },
                {
                  valor: 'entrar_conjunta',
                  titulo: 'Entrar na conta conjunta',
                  descricao: 'Seu cônjuge já criou e te passou o código.',
                },
              ]}
            />
            {r.tipoConta === 'criar_conjunta' && (
              <Input
                label="Nome da família"
                placeholder="Ex.: Família Silva"
                value={r.nomeFamilia}
                onChange={(e) => set('nomeFamilia', e.target.value)}
              />
            )}
            {r.tipoConta === 'entrar_conjunta' && (
              <Input
                label="Código de convite"
                placeholder="Ex.: A1B2C3D4"
                className="uppercase tracking-widest"
                value={r.codigoConvite}
                onChange={(e) => set('codigoConvite', e.target.value)}
              />
            )}
            {r.tipoConta !== 'individual' && (
              <p className="text-sm text-slate-600">
                Na conta conjunta, cada um lança a própria renda. Depois do dízimo e das ofertas (individuais), o valor
                vai para um fundo comum que paga as contas da casa e a reserva de emergência. O que sobra é dividido entre
                os dois. Despesas individuais, investimentos e dinheiro guardado continuam visíveis só para você.
              </p>
            )}
          </>
        )}

        {passo === 4 && (
          <>
            <dl className="divide-y divide-slate-100 text-sm">
              <Linha rotulo="Renda líquida" valor={plano.renda} />
              {r.dizimista && <Linha rotulo="Dízimo" valor={-plano.dizimo} />}
              {r.ofertante && <Linha rotulo="Oferta" valor={-plano.oferta} />}
              <Linha rotulo="Reserva de emergência" valor={-plano.reserva} />
              {r.investe && <Linha rotulo="Investimento" valor={-plano.investimento} />}
              <Linha rotulo="Disponível estimado" valor={plano.disponivel} destaque />
            </dl>
            <p className="text-sm text-slate-600">
              Este é um ponto de partida. Quando você cadastrar contas fixas e parcelamentos, o valor disponível será
              recalculado.
            </p>
          </>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        <div className="flex gap-3 pt-1">
          {passo > 0 && (
            <Button variante="secundario" onClick={() => (setErro(null), setPasso((p) => p - 1))}>
              <ArrowLeft className="size-4" aria-hidden /> Voltar
            </Button>
          )}
          {passo < PASSOS.length - 1 ? (
            <Button className="flex-1" onClick={avancar}>
              Continuar
            </Button>
          ) : (
            <Button className="flex-1" onClick={concluir} carregando={salvando}>
              <Check className="size-4" aria-hidden /> Concluir
            </Button>
          )}
        </div>
      </Card>
    </Moldura>
  )
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </div>
  )
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex justify-between py-2.5 ${destaque ? 'text-base font-bold' : ''}`}>
      <dt className={destaque ? 'text-slate-900' : 'text-slate-600'}>{rotulo}</dt>
      <dd className={`tabular-nums ${valor < 0 ? 'text-red-600' : destaque ? 'text-brand-700' : 'text-slate-900'}`}>
        {formatarBRL(valor)}
      </dd>
    </div>
  )
}

function ConviteCriado({ familia, onContinuar }: { familia: Household; onContinuar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <Card className="flex flex-col gap-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Conta conjunta criada!</h1>
      <p className="text-sm text-slate-600">
        Peça para seu cônjuge criar a própria conta e informar este código no cadastro:
      </p>
      <p className="rounded-xl bg-brand-50 py-4 font-mono text-3xl font-bold tracking-[0.3em] text-brand-800">
        {familia.codigo_convite}
      </p>
      <Button
        variante="secundario"
        onClick={async () => {
          await navigator.clipboard.writeText(familia.codigo_convite)
          setCopiado(true)
        }}
      >
        {copiado ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copiado ? 'Copiado' : 'Copiar código'}
      </Button>
      <p className="text-xs text-slate-500">O código também fica disponível em Configurações.</p>
      <Button onClick={onContinuar}>Ir para o início</Button>
    </Card>
  )
}
