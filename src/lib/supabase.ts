import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Chave pública "publishable" (sb_publishable_...). Nunca usar a chave secret/service_role no frontend.
const chavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigurado = Boolean(url && chavePublica)

export const supabase = createClient(url ?? 'http://localhost:54321', chavePublica ?? 'nao-configurado', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Traduz as mensagens de erro mais comuns do Supabase Auth. */
export function traduzirErro(mensagem: string): string {
  const m = mensagem.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (m.includes('user already registered')) return 'Já existe uma conta com este e-mail.'
  if (m.includes('password should be at least')) return 'A senha deve ter pelo menos 8 caracteres.'
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (m.includes('failed to fetch')) return 'Sem conexão com o servidor. Verifique sua internet.'
  return mensagem
}
