import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Aviso } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { supabase, traduzirErro } from '@/lib/supabase'

const schema = z.object({ email: z.email('Informe um e-mail válido') })
type Dados = z.infer<typeof schema>

export function RecuperarSenha() {
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(schema) })

  async function onSubmit({ email }: Dados) {
    setErro(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) return setErro(traduzirErro(error.message))
    setEnviado(true)
  }

  return (
    <AuthLayout titulo="Recuperar senha" subtitulo="Enviaremos um link para você criar uma nova senha">
      {enviado ? (
        <Aviso tipo="sucesso">
          Se existir uma conta com este e-mail, você receberá o link em instantes. Confira também a caixa de spam.
        </Aviso>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Input label="E-mail" type="email" autoComplete="email" erro={errors.email?.message} {...register('email')} />
          <Button type="submit" carregando={isSubmitting}>
            Enviar link
          </Button>
        </form>
      )}
      <Link to="/entrar" className="mt-6 block text-center text-sm font-semibold text-brand-700 hover:underline">
        Voltar para o login
      </Link>
    </AuthLayout>
  )
}
