import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { Cabecalho } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso, Card } from '@/components/ui/Card'
import { Escolha } from '@/components/ui/Escolha'
import { PercentInput } from '@/components/ui/Field'
import { mensagemDeErro } from '@/lib/queries'
import { supabase, traduzirErro } from '@/lib/supabase'
import type { Household } from '@/types/database'
import { formatarBRL } from '@/lib/money'

export function Configuracoes() {
  const { profile, household, membros, user } = useAuth()
  if (!profile) return null

  return (
    <>
      <Cabecalho titulo="Configurações" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Perfil</h2>
          <dl className="space-y-2 text-sm">
            <Item rotulo="Nome" valor={profile.nome} />
            <Item rotulo="E-mail" valor={user?.email ?? ''} />
            <Item rotulo="Renda líquida" valor={formatarBRL(profile.renda_mensal_cents)} />
            <Item rotulo="Dízimo" valor={profile.dizimista ? `${profile.percentual_dizimo}%` : 'Não'} />
            <Item rotulo="Oferta" valor={profile.ofertante ? `${profile.percentual_oferta}%` : 'Não'} />
            <Item rotulo="Reserva de emergência" valor={`${profile.percentual_reserva}%`} />
            <Item
              rotulo="Investimento mensal"
              valor={profile.investe ? formatarBRL(profile.investimento_mensal_cents) : 'Não'}
            />
          </dl>
          <Link to="/bem-vindo" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Refazer questionário
          </Link>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">Conta conjunta</h2>
          {household ? (
            <dl className="space-y-2 text-sm">
              <Item rotulo="Família" valor={household.nome} />
              <Item rotulo="Membros" valor={membros.map((m) => m.nome).join(' e ')} />
              {membros.length < 2 && (
                <Item
                  rotulo="Código de convite"
                  valor={<span className="font-mono tracking-widest">{household.codigo_convite}</span>}
                />
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-600">Você está usando uma conta individual.</p>
          )}
          {household && <RegrasDoCasal key={household.id} household={household} />}
        </Card>
      </div>
    </>
  )
}

/** Regras do fundo comum: percentual da reserva e divisão da sobra. */
function RegrasDoCasal({ household }: { household: Household }) {
  const { recarregarPerfil } = useAuth()
  const [reserva, setReserva] = useState(household.percentual_reserva)
  const [divisao, setDivisao] = useState(household.divisao_sobra)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null)
  const alterado = reserva !== household.percentual_reserva || divisao !== household.divisao_sobra

  async function salvar() {
    if (reserva < 0 || reserva > 100) return setMensagem({ tipo: 'erro', texto: 'O percentual deve ficar entre 0 e 100.' })
    setSalvando(true)
    setMensagem(null)
    const { error } = await supabase
      .from('households')
      .update({ percentual_reserva: reserva, divisao_sobra: divisao })
      .eq('id', household.id)
    setSalvando(false)
    if (error) return setMensagem({ tipo: 'erro', texto: traduzirErro(mensagemDeErro(error)) })
    await recarregarPerfil()
    setMensagem({ tipo: 'sucesso', texto: 'Regras do casal atualizadas.' })
  }

  return (
    <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">Regras do fundo comum</h3>
      <PercentInput
        label="Reserva de emergência do casal"
        valor={reserva}
        onChange={setReserva}
        ajuda="Percentual do fundo comum (após dízimo e ofertas) separado todo mês."
      />
      <Escolha<Household['divisao_sobra']>
        legenda="Como dividir a sobra entre vocês?"
        valor={divisao}
        onChange={setDivisao}
        opcoes={[
          { valor: 'igual', titulo: 'Em partes iguais', descricao: 'Cada um fica com metade.' },
          {
            valor: 'proporcional_renda',
            titulo: 'Proporcional à renda',
            descricao: 'Quem contribui mais para o fundo fica com uma parte maior.',
          },
        ]}
      />
      {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}
      <Button onClick={salvar} disabled={!alterado} carregando={salvando}>
        Salvar regras
      </Button>
      <p className="text-xs text-slate-500">As alterações valem para os dois membros da conta conjunta.</p>
    </div>
  )
}

function Item({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{rotulo}</dt>
      <dd className="text-right font-medium text-slate-900">{valor}</dd>
    </div>
  )
}
