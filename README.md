# Family Finance

PWA de controle financeiro individual e do casal. Funciona no navegador e pode ser
instalado no celular direto pelo navegador, sem passar por lojas de aplicativos.

As regras de negócio estão em [documentação/decisoes.md](documentação/decisoes.md).

## Pré-requisitos

- Node.js 20 ou superior
- Uma conta gratuita no [Supabase](https://supabase.com)

## Configuração

1. **Crie um projeto no Supabase.**
2. **Crie o banco:** no painel do Supabase, abra *SQL Editor* e execute, **em ordem**, cada arquivo de
   [supabase/migrations/](supabase/migrations/) (`0001_init.sql`, `0002_...`, `0003_...`).
3. **Configure a autenticação** em *Authentication > URL Configuration*:
   - Site URL: `http://localhost:5173` (em produção, a URL do app)
   - Redirect URLs: `http://localhost:5173/**`
4. **Variáveis de ambiente:** copie `.env.example` para `.env.local` e preencha com a URL e a chave *publishable* (não use o trecho "Next.js" do botão Connect) de
   *Project Settings > API Keys*.
5. Rode:

   ```bash
   npm install
   npm run dev
   ```

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checagem de tipos e build de produção (gera o service worker) |
| `npm run preview` | Serve o build. Use para testar a instalação do PWA |
| `npm run lint` | Lint com oxlint |

## Estrutura

```
src/
  auth/          sessão, perfil e guards de rota
  components/    UI reutilizável e layouts
  config/        módulos do menu e roadmap
  lib/           Supabase, dinheiro (centavos), regras de planejamento
  pages/         telas
  types/         tipos do banco
supabase/
  migrations/    esquema SQL com Row Level Security
documentação/    esboço, respostas e decisões do projeto
```

## Instalando no celular

- **Android (Chrome):** menu ⋮ > *Instalar app*.
- **iPhone (Safari):** botão Compartilhar > *Adicionar à Tela de Início*.
