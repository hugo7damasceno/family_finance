export function ConfiguracaoPendente() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h1 className="mb-2 text-lg font-bold">Supabase não configurado</h1>
        <p>
          Copie o arquivo <code>.env.example</code> para <code>.env.local</code>, preencha{' '}
          <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> e reinicie o <code>npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
