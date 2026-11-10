import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { supabase, traduzirErro } from '@/lib/supabase'

const schema = z
  .object({
    nome: z.string().trim().min(2, 'Informe seu nome'),
    email: z.email('Informe um e-mail válido'),
    senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' })
type Dados = z.infer<typeof schema>

export function Cadastro() {
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [confirmarEmail, setConfirmarEmail] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(schema) })

  async function onSubmit(dados: Dados) {
    setErro(null)
    const { data, error } = await supabase.auth.signUp({
      email: dados.email,
      password: dados.senha,
      options: { data: { nome: dados.nome }, emailRedirectTo: `${window.location.origin}/bem-vindo` },
    })
    if (error) return setErro(traduzirErro(error.message))
    // Se a confirmação de e-mail estiver ativa no Supabase, não há sessão ainda.
    if (!data.session) return setConfirmarEmail(dados.email)
    navigate('/bem-vindo', { replace: true })
  }

  if (confirmarEmail) {
    return (
      <AuthLayout titulo="Confirme seu e-mail">
        <p className="text-sm text-slate-700">
          Enviamos um link de confirmação para <strong>{confirmarEmail}</strong>. Abra o e-mail e toque no link para
          continuar o cadastro.
        </p>
        <Link to="/entrar" className="mt-6 block text-center text-sm font-semibold text-brand-700 hover:underline">
          Voltar para o login
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Criar conta" subtitulo="Comece a organizar suas finanças e as da sua família">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Input label="Nome" autoComplete="name" erro={errors.nome?.message} {...register('nome')} />
        <Input label="E-mail" type="email" autoComplete="email" erro={errors.email?.message} {...register('email')} />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          erro={errors.senha?.message}
          {...register('senha')}
        />
        <Input
          label="Confirmar senha"
          type="password"
          autoComplete="new-password"
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />
        <p className="text-xs text-slate-500">
          Vai usar em casal? Cada um cria a própria conta. A conta conjunta é configurada no próximo passo.
        </p>
        <Button type="submit" carregando={isSubmitting}>
          Criar conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  )
}
