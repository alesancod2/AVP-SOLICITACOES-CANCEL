# Guia Completo: Migrar AVP System para Supabase + Deploy na Vercel

## Indice

1. [Visao Geral da Arquitetura](#1-visao-geral-da-arquitetura)
2. [Configurar Supabase (Banco de Dados)](#2-configurar-supabase-banco-de-dados)
3. [Schema SQL - Criar Tabelas](#3-schema-sql---criar-tabelas)
4. [Row Level Security (RLS)](#4-row-level-security-rls)
5. [Configurar Supabase Auth](#5-configurar-supabase-auth)
6. [Adaptar o Codigo Next.js](#6-adaptar-o-codigo-nextjs)
7. [Variaveis de Ambiente](#7-variaveis-de-ambiente)
8. [Deploy na Vercel](#8-deploy-na-vercel)
9. [Checklist Final](#9-checklist-final)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Visao Geral da Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser   │────▶│  Vercel Edge │────▶│   Supabase   │
│  (Next.js)  │◀────│  (API Routes)│◀────│  (PostgreSQL)│
└─────────────┘     └──────────────┘     └──────────────┘
                                          │
                                          ├── Auth (login por email)
                                          ├── Database (PostgreSQL)
                                          ├── Storage (opcional, para uploads)
                                          └── Realtime (opcional)
```

**Vantagens da migracao:**
- PostgreSQL real (queries complexas, indices, joins)
- Supabase Auth (login por email com Magic Link ou OTP)
- Row Level Security (seguranca no banco)
- Sem limites de escrita do Google Sheets
- Performance superior (+5000 registros sem problema)
- Vercel: deploy automatico a cada push

---

## 2. Configurar Supabase (Banco de Dados)

### 2.1 Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta
2. Clique em **"New Project"**
3. Preencha:
   - **Name:** `avp-system`
   - **Database Password:** (anote, sera necessaria)
   - **Region:** Escolha a mais proxima (ex: `South America (Sao Paulo)`)
4. Aguarde a criacao (~2 minutos)

### 2.2 Obter Credenciais

No painel do Supabase, va em **Settings > API**:

| Credencial | Onde usar |
|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon (public) key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role key** | `SUPABASE_SERVICE_ROLE_KEY` (NUNCA expor no frontend) |

---

## 3. Schema SQL - Criar Tabelas

No Supabase, va em **SQL Editor** e execute cada bloco:

### 3.1 Tabela de Usuarios

```sql
-- Tabela de usuarios do sistema (separada do auth.users do Supabase)
CREATE TABLE public.usuarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'User' CHECK (perfil IN ('Admin', 'User')),
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  permissoes JSONB NOT NULL DEFAULT '{"cancelamentos": true, "suspensos": true, "dashboard": true}',
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  ultimo_acesso TIMESTAMPTZ,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index para buscas por email
CREATE INDEX idx_usuarios_email ON public.usuarios(email);
CREATE INDEX idx_usuarios_auth_id ON public.usuarios(auth_user_id);
```

### 3.2 Tabela de Cancelamentos

```sql
CREATE TABLE public.cancelamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_associado TEXT NOT NULL,
  placa TEXT NOT NULL,
  valor_parcela TEXT DEFAULT '',
  valor_pago TEXT DEFAULT '',
  consultor TEXT DEFAULT '',
  motivo_cancelamento TEXT DEFAULT '',
  status_atual TEXT NOT NULL DEFAULT 'Ativo'
    CHECK (status_atual IN ('Ativo', 'Inadimplente', 'Cancelado', 'Retido', 'Pendente', 'Em negociacao')),
  observacao TEXT DEFAULT '',
  atendente TEXT DEFAULT '',
  mes_referencia TEXT DEFAULT '',
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_cancelamentos_status ON public.cancelamentos(status_atual);
CREATE INDEX idx_cancelamentos_mes ON public.cancelamentos(mes_referencia);
CREATE INDEX idx_cancelamentos_placa ON public.cancelamentos(placa);
CREATE INDEX idx_cancelamentos_data ON public.cancelamentos(data_criacao);
```

### 3.3 Tabela de Suspensos

```sql
CREATE TABLE public.suspensos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  associado TEXT NOT NULL,
  dt_recebimento TEXT DEFAULT '',
  dt_vencimento TEXT DEFAULT '',
  placa TEXT NOT NULL,
  situacao TEXT DEFAULT ''
    CHECK (situacao IN ('', 'Pendente', 'Pago', 'Parcial', 'Nao localizado', 'Recusa')),
  forma_pagamento TEXT DEFAULT ''
    CHECK (forma_pagamento IN ('', 'PIX', 'Boleto', 'Cartao', 'Transferencia', 'Dinheiro')),
  valor_recebido TEXT DEFAULT '',
  valor_original TEXT DEFAULT '',
  atendente TEXT DEFAULT '',
  observacoes TEXT DEFAULT '',
  conferencia TEXT DEFAULT '' CHECK (conferencia IN ('', 'OK', 'Verificar')),
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_suspensos_placa ON public.suspensos(placa);
CREATE INDEX idx_suspensos_atendente ON public.suspensos(atendente);
CREATE INDEX idx_suspensos_situacao ON public.suspensos(situacao);
```

### 3.4 Tabela de Logs (Auditoria)

```sql
CREATE TABLE public.logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data TIMESTAMPTZ DEFAULT NOW(),
  usuario TEXT NOT NULL,
  email TEXT NOT NULL,
  perfil TEXT NOT NULL,
  acao TEXT NOT NULL,
  registro_id TEXT DEFAULT '',
  campo TEXT DEFAULT '',
  antes TEXT DEFAULT '',
  depois TEXT DEFAULT ''
);

-- Index por data (mais recentes primeiro)
CREATE INDEX idx_logs_data ON public.logs(data DESC);
CREATE INDEX idx_logs_usuario ON public.logs(usuario);
```

### 3.5 Funcao de Atualizar Timestamp

```sql
-- Funcao trigger para atualizar "atualizado_em" automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar nos cancelamentos
CREATE TRIGGER set_updated_at_cancelamentos
  BEFORE UPDATE ON public.cancelamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Aplicar nos suspensos
CREATE TRIGGER set_updated_at_suspensos
  BEFORE UPDATE ON public.suspensos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 3.6 Inserir Primeiro Admin

```sql
-- Substitua com seus dados reais
INSERT INTO public.usuarios (nome, email, perfil, status, permissoes)
VALUES (
  'Seu Nome',
  'seu.email@empresa.com',
  'Admin',
  'Ativo',
  '{"cancelamentos": true, "suspensos": true, "dashboard": true}'
);
```

---

## 4. Row Level Security (RLS)

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancelamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspensos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Politica: Service Role pode tudo (usado pelas API Routes no backend)
CREATE POLICY "Service role full access" ON public.usuarios
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.cancelamentos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.suspensos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.logs
  FOR ALL USING (auth.role() = 'service_role');

-- Politica: Usuarios autenticados podem ler cancelamentos
CREATE POLICY "Authenticated read cancelamentos" ON public.cancelamentos
  FOR SELECT USING (auth.role() = 'authenticated');

-- Politica: Usuarios autenticados podem ler suspensos
CREATE POLICY "Authenticated read suspensos" ON public.suspensos
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## 5. Configurar Supabase Auth

### 5.1 Habilitar Magic Link (Login por Email sem senha)

1. No Supabase Dashboard, va em **Authentication > Providers**
2. Em **Email**, habilite:
   - [x] Enable Email Provider
   - [x] Enable Magic Link (sem confirmacao de senha)
3. Em **Authentication > URL Configuration**:
   - **Site URL:** `https://seu-app.vercel.app` (ou `http://localhost:3000` para dev)
   - **Redirect URLs:** adicione `https://seu-app.vercel.app/auth/callback`

### 5.2 Alternativa: Login OTP (codigo por email)

Se preferir enviar um codigo de 6 digitos em vez de Magic Link:
1. Em **Authentication > Providers > Email**:
   - Habilite "Enable Email OTP"
   - Defina expiracao (ex: 300 segundos)

### 5.3 Templates de Email (Opcional)

Em **Authentication > Email Templates**, customize:
- **Magic Link:** "Clique para acessar o AVP System"
- **Confirm signup:** "Bem-vindo ao AVP System"

---

## 6. Adaptar o Codigo Next.js

### 6.1 Novas Dependencias

Atualize o `package.json`:

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.3.0",
    "lucide-react": "^0.400.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0",
    "xlsx": "^0.18.5"
  }
}
```

Rode:
```bash
npm install @supabase/supabase-js @supabase/ssr
npm uninstall googleapis jose  # Nao precisa mais
```

### 6.2 Criar Cliente Supabase

**`src/lib/supabase/client.ts`** (para componentes Client):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`src/lib/supabase/server.ts`** (para API Routes / Server Components):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

**`src/lib/supabase/admin.ts`** (service role para operacoes administrativas):
```typescript
import { createClient } from '@supabase/supabase-js'

// NUNCA usar no frontend - apenas em API Routes
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

### 6.3 Middleware de Autenticacao

**`src/middleware.ts`**:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Se nao autenticado e tentando acessar paginas protegidas
  if (!user && !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-|manifest|sw.js).*)'],
}
```

### 6.4 Exemplo: API Route de Cancelamentos com Supabase

**`src/app/api/cancelamentos/route.ts`**:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - Listar cancelamentos
export async function GET(request: NextRequest) {
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '20')
  const status = searchParams.get('status') || ''
  const busca = searchParams.get('busca') || ''
  const mes = searchParams.get('mes') || ''

  let query = supabase
    .from('cancelamentos')
    .select('*', { count: 'exact' })
    .order('data_criacao', { ascending: false })

  // Filtros
  if (status) query = query.eq('status_atual', status)
  if (mes) query = query.eq('mes_referencia', mes)
  if (busca) {
    query = query.or(
      `nome_associado.ilike.%${busca}%,placa.ilike.%${busca}%,consultor.ilike.%${busca}%,atendente.ilike.%${busca}%`
    )
  }

  // Paginacao
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data,
    meta: { total: count || 0, page, pages: Math.ceil((count || 0) / pageSize) }
  })
}

// POST - Criar cancelamento
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('cancelamentos')
    .insert({
      nome_associado: body.nomeDoAssociado,
      placa: body.placa,
      valor_parcela: body.valorDaParcela,
      valor_pago: body.valorPago,
      consultor: body.consultor,
      motivo_cancelamento: body.motivoDoCancelamento,
      status_atual: body.statusAtual,
      observacao: body.observacao,
      atendente: body.atendente,
      mes_referencia: body.mesReferencia || '',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data }, { status: 201 })
}
```

### 6.5 Exemplo: Login com Magic Link

**`src/app/login/page.tsx`**:
```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (!error) setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center">
        <h2>Verifique seu email</h2>
        <p>Enviamos um link de acesso para {email}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="seu.email@empresa.com"
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Enviando...' : 'Entrar'}
      </button>
    </form>
  )
}
```

**`src/app/auth/callback/route.ts`**:
```typescript
import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createServerSupabase()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/`)
}
```

### 6.6 Mapeamento Google Sheets -> Supabase

| Google Sheets (antes) | Supabase (depois) |
|---|---|
| `getRecords(sheetName, page, pageSize)` | `supabase.from('cancelamentos').select().range()` |
| `createRecord(sheetName, data)` | `supabase.from('cancelamentos').insert(data)` |
| `updateRecord(sheetName, rowId, data)` | `supabase.from('cancelamentos').update(data).eq('id', id)` |
| `deleteRecord(sheetName, rowId)` | `supabase.from('cancelamentos').delete().eq('id', id)` |
| `searchRecords(sheetName, query)` | `supabase.from('cancelamentos').select().ilike('nome', '%query%')` |
| `getSuspensos()` | `supabase.from('suspensos').select()` |
| `importSuspensos(data)` | `supabase.from('suspensos').insert(data)` |
| `getLogs()` | `supabase.from('logs').select().order('data', { ascending: false })` |
| `addLog(...)` | `supabase.from('logs').insert({...})` |

---

## 7. Variaveis de Ambiente

### 7.1 Arquivo `.env.local` (desenvolvimento)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...

# App
NEXT_PUBLIC_APP_NAME=AVP System
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 7.2 Na Vercel (producao)

As mesmas variaveis serao adicionadas no painel da Vercel (passo 8.4).

> **IMPORTANTE:** `SUPABASE_SERVICE_ROLE_KEY` NUNCA deve ter prefixo `NEXT_PUBLIC_`.
> Variaveis com `NEXT_PUBLIC_` sao expostas no frontend.

---

## 8. Deploy na Vercel

### 8.1 Pre-requisitos

- Conta na [Vercel](https://vercel.com) (free tier aceita)
- Repositorio no GitHub (ja feito: `alesancod2/AVP-SOLICITACOES-CANCEL`)
- Projeto Supabase configurado (passo 2)

### 8.2 Conectar Repositorio

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Clique em **"Import Git Repository"**
3. Selecione `alesancod2/AVP-SOLICITACOES-CANCEL`
4. Configure:
   - **Framework Preset:** Next.js (auto-detectado)
   - **Root Directory:** `.` (raiz)
   - **Build Command:** `npm run build` (padrao)
   - **Output Directory:** `.next` (padrao)
   - **Install Command:** `npm install` (padrao)

### 8.3 Configurar Build Settings

| Campo | Valor |
|---|---|
| Framework | Next.js |
| Node.js Version | 20.x |
| Build Command | `npm run build` |
| Install Command | `npm install` |

### 8.4 Adicionar Variaveis de Ambiente

Na tela de deploy (ou em **Settings > Environment Variables** depois):

| Key | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbG...` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | `https://seu-app.vercel.app` | Production |

### 8.5 Deploy

1. Clique em **"Deploy"**
2. Aguarde o build (~1-2 minutos)
3. Acesse a URL gerada (ex: `https://avp-system.vercel.app`)

### 8.6 Dominio Customizado (Opcional)

1. Va em **Settings > Domains**
2. Adicione seu dominio (ex: `avp.suaempresa.com`)
3. Configure DNS no seu provedor:
   - **CNAME:** `avp` -> `cname.vercel-dns.com`
   - Ou **A Record:** para o IP fornecido
4. SSL e gerado automaticamente

### 8.7 Deploy Automatico

Apos conectar o repo, todo `git push` na branch `main`:
- Dispara build automatico
- Deploy em ~1 minuto
- Zero downtime (atomic deploys)
- Preview URLs para branches/PRs

---

## 9. Checklist Final

### Supabase
- [ ] Projeto criado no Supabase
- [ ] Todas as 4 tabelas criadas (usuarios, cancelamentos, suspensos, logs)
- [ ] Indices criados
- [ ] Triggers de updated_at aplicados
- [ ] RLS habilitado com policies
- [ ] Auth configurado (Magic Link ou OTP)
- [ ] Redirect URL configurada
- [ ] Primeiro admin inserido na tabela usuarios
- [ ] Testou login pelo Supabase Dashboard (Authentication > Users)

### Codigo
- [ ] Dependencias instaladas (`@supabase/supabase-js`, `@supabase/ssr`)
- [ ] Dependencias removidas (`googleapis`, `jose`)
- [ ] Cliente Supabase criado (client.ts, server.ts, admin.ts)
- [ ] Middleware de auth configurado
- [ ] API Routes migradas (Google Sheets -> Supabase queries)
- [ ] AuthContext atualizado para usar Supabase Auth
- [ ] Build local funciona (`npm run build`)

### Vercel
- [ ] Repositorio conectado
- [ ] Variaveis de ambiente configuradas
- [ ] Build bem-sucedido
- [ ] URL de producao funcionando
- [ ] Supabase Auth redirect URL aponta para URL da Vercel
- [ ] Testou login completo em producao

---

## 10. Troubleshooting

### "Invalid API key"
- Verifique se `NEXT_PUBLIC_SUPABASE_ANON_KEY` esta correta
- Nao confunda `anon key` com `service_role key`

### "relation does not exist"
- Execute os scripts SQL novamente no SQL Editor
- Verifique se esta no schema `public`

### "new row violates row-level security"
- Use `createAdminClient()` (service_role) nas API Routes
- Ou adicione policies adequadas para a operacao

### Build falha na Vercel
- Verifique se todas as env vars estao configuradas
- Rode `npm run build` localmente primeiro
- Cheque se nao ha imports de `googleapis` remanescentes

### Magic Link nao chega no email
- Verifique spam/lixeira
- No Supabase: Authentication > Users, veja se o usuario foi criado
- Verifique se o SMTP esta configurado (Supabase usa sendgrid free por padrao)
- Rate limit: 4 emails por hora no plano free

### Login redireciona para pagina errada
- Verifique **Authentication > URL Configuration > Redirect URLs**
- Deve conter: `https://seu-app.vercel.app/auth/callback`
- E `http://localhost:3000/auth/callback` para dev

### Performance lenta
- Verifique se os indices estao criados
- Use `.select('campo1, campo2')` em vez de `.select('*')` quando possivel
- Implemente cache com ISR do Next.js para dados que mudam pouco

---

## Bonus: Comandos Uteis

```bash
# Desenvolvimento local
npm run dev

# Build de producao
npm run build

# Testar build localmente
npm start

# Ver logs na Vercel (CLI)
npx vercel logs seu-app.vercel.app

# Reset banco Supabase (CUIDADO - apaga tudo)
# No SQL Editor: DROP TABLE IF EXISTS cancelamentos, suspensos, logs, usuarios CASCADE;
```

---

## Estimativa de Custos

| Servico | Plano Free | Inclui |
|---|---|---|
| **Supabase** | Sim | 500MB DB, 50K auth users, 2GB storage |
| **Vercel** | Sim (Hobby) | 100GB bandwidth, serverless functions |

Para a maioria dos usos do AVP System, **ambos os planos free sao suficientes**.

---

## Links Uteis

- [Supabase Docs](https://supabase.com/docs)
- [Supabase + Next.js Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Vercel Deploy Docs](https://vercel.com/docs/deployments/overview)
- [Next.js App Router + Supabase](https://supabase.com/docs/guides/auth/server-side/nextjs)
