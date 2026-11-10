import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso } from '@/components/ui/Card'
import { Carregando } from '@/components/ui/Carregando'
import { Input } from '@/components/ui/Field'
import { supabase, traduzirErro } from '@/lib/supabase'

const schema = z
  .object({
    senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    confirmacao: z.string(),
  })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' })
type Dados = z.infer<typeof schema>

/** Página aberta pelo link do e-mail de recuperação (o Supabase cria a sessão a partir da URL). */
export function RedefinirSenha() {
  const { user, carregando } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(schema) })

  async function onSubmit({ senha }: Dados) {
    setErro(null)
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) return setErro(traduzirErro(error.message))
    navigate('/', { replace: true })
  }

  if (carregando) return <Carregando telaCheia />

  if (!user) {
    return (
      <AuthLayout titulo="Link inválido">
        <Aviso tipo="atencao">Este link expirou ou já foi usado. Solicite um novo.</Aviso>
        <Link
          to="/recuperar-senha"
          className="mt-6 block text-center text-sm font-semibold text-brand-700 hover:underline"
        >
          Solicitar novo link
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout titulo="Nova senha" subtitulo="Escolha uma nova senha para sua conta">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          erro={errors.senha?.message}
          {...register('senha')}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          erro={errors.confirmacao?.message}
          {...register('confirmacao')}
        />
        <Button type="submit" carregando={isSubmitting}>
          Salvar nova senha
        </Button>
      </form>
    </AuthLayout>
  )
}
