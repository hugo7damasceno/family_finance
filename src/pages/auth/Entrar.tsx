import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { supabase, traduzirErro } from '@/lib/supabase'

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  senha: z.string().min(1, 'Informe sua senha'),
})
type Dados = z.infer<typeof schema>

export function Entrar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(schema) })

  async function onSubmit(dados: Dados) {
    setErro(null)
    const { error } = await supabase.auth.signInWithPassword({ email: dados.email, password: dados.senha })
    if (error) return setErro(traduzirErro(error.message))
    const destino = (location.state as { de?: string } | null)?.de ?? '/'
    navigate(destino, { replace: true })
  }

  return (
    <AuthLayout titulo="Bem-vindo de volta" subtitulo="Entre para acompanhar suas finanças">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Input label="E-mail" type="email" autoComplete="email" erro={errors.email?.message} {...register('email')} />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          erro={errors.senha?.message}
          {...register('senha')}
        />
        <Link to="/recuperar-senha" className="-mt-1 self-end text-sm font-medium text-brand-700 hover:underline">
          Esqueci minha senha
        </Link>
        <Button type="submit" carregando={isSubmitting}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold text-brand-700 hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  )
}
