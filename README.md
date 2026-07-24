# Sistema de Gestao de Associados

Aplicacao web full-stack que utiliza **Google Sheets como banco de dados** para gerenciamento de associados, parcelas e pagamentos. Interface moderna com dashboard, filtros, busca e CRUD completo.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                     │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Dashboard   │  │  Filtros │  │  Formulário CRUD  │  │
│  │  (Tabela)    │  │  Busca   │  │  (Create/Edit)    │  │
│  └──────┬───────┘  └────┬─────┘  └────────┬──────────┘  │
│         │                │                  │             │
│         └────────────────┼──────────────────┘             │
│                          │                                │
│              ┌───────────▼───────────┐                    │
│              │   API Routes (Next)   │                    │
│              │   /api/sheets         │                    │
│              │   /api/sheets/[id]    │                    │
│              └───────────┬───────────┘                    │
└──────────────────────────┼────────────────────────────────┘
                           │
                ┌──────────▼──────────┐
                │   Google Sheets API  │
                │   (googleapis SDK)   │
                └──────────┬──────────┘
                           │
                ┌──────────▼──────────┐
                │   Google Sheets      │
                │   (Banco de Dados)   │
                │                      │
                │  ┌─────────────────┐ │
                │  │ Aba: AGOSTO     │ │
                │  │ Aba: SETEMBRO   │ │
                │  │ Aba: OUTUBRO    │ │
                │  │ Aba: NOVEMBRO   │ │
                │  │ Aba: DEZEMBRO   │ │
                │  └─────────────────┘ │
                └──────────────────────┘
```

---

## Stack Tecnologica

| Camada       | Tecnologia            | Motivo                                    |
| ------------ | --------------------- | ----------------------------------------- |
| Frontend     | Next.js 14 (App Router) | SSR, API routes integradas, performance |
| Estilizacao  | Tailwind CSS 3.4      | Rapido de estilizar, design responsivo    |
| Linguagem    | TypeScript            | Tipagem forte, menos bugs                 |
| Backend/API  | Next.js API Routes    | Zero config adicional, serverless-ready   |
| Banco de Dados| Google Sheets        | Custo zero, familiar, compartilhavel      |
| SDK          | googleapis            | Biblioteca oficial do Google              |
| Deploy       | Vercel / Railway      | Deploy em 1 clique, gratuito              |

---

## Estrutura de Arquivos

```
sheets-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── sheets/
│   │   │       ├── route.ts          # GET (listar/buscar) + POST (criar)
│   │   │       └── [id]/
│   │   │           └── route.ts      # GET (por ID) + PUT (editar) + DELETE
│   │   ├── globals.css               # Estilos globais + Tailwind
│   │   ├── layout.tsx                # Layout raiz (header/footer)
│   │   └── page.tsx                  # Pagina principal (Dashboard)
│   ├── components/
│   │   ├── DataTable.tsx             # Tabela de dados com acoes
│   │   ├── DeleteConfirmModal.tsx    # Modal de confirmacao de exclusao
│   │   ├── LoadingSkeleton.tsx       # Loading states (skeleton)
│   │   ├── Pagination.tsx            # Paginacao
│   │   ├── RecordForm.tsx            # Formulario dinamico (criar/editar)
│   │   ├── SearchBar.tsx             # Barra de busca com debounce
│   │   ├── StatusBadge.tsx           # Badge colorido de status
│   │   ├── TabSelector.tsx           # Seletor de abas (meses)
│   │   └── Toast.tsx                 # Notificacoes toast
│   └── lib/
│       ├── google-sheets.ts          # Integracao Google Sheets (CRUD)
│       └── types.ts                  # Tipos TypeScript + config campos
├── .env.local.example                # Template de variaveis de ambiente
├── next.config.js                    # Config Next.js
├── package.json                      # Dependencias
├── postcss.config.js                 # Config PostCSS
├── tailwind.config.ts                # Config Tailwind
└── tsconfig.json                     # Config TypeScript
```

---

## Configuracao da Planilha (Banco de Dados)

### Estrutura Esperada

Cada **aba** da planilha representa um **mes** (AGOSTO, SETEMBRO, etc.).

A **linha 1** de cada aba deve conter os headers:

| Coluna A | Coluna B | Coluna C | Coluna D | Coluna E | Coluna F | Coluna G | Coluna H | Coluna I |
|----------|----------|----------|----------|----------|----------|----------|----------|----------|
| NOME DO ASSOCIADO | PLACA | VALOR DA PARCELA | VALOR PAGO | CONSULTOR | MOTIVO DO CANCELAMENTO | STATUS ATUAL | OBSERVACAO | ATENDENTE |

### Regras da Planilha

- **Linha 1**: Sempre reservada para headers (nao sera lida como dados)
- **ID do registro**: Corresponde ao numero da linha na planilha
- **Campos vazios**: Use "-" como valor padrao
- **Status**: Valores recomendados: `Ativo`, `Inadimplente`, `Cancelado`, `Pendente`, `Em negociacao`

---

## Configuracao da Google Sheets API

### Passo 1: Criar Projeto no Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Clique em **"Criar Projeto"** → Nomeie como "Gestao Associados"
3. Aguarde a criacao e selecione o projeto

### Passo 2: Ativar a API

1. No menu lateral, va em **"APIs e Servicos"** → **"Biblioteca"**
2. Busque por **"Google Sheets API"**
3. Clique em **"Ativar"**

### Passo 3: Criar Service Account

1. Va em **"APIs e Servicos"** → **"Credenciais"**
2. Clique em **"Criar Credenciais"** → **"Conta de Servico"**
3. Preencha:
   - Nome: `sheets-app-service`
   - Descricao: `Servico para app de gestao`
4. Clique em **"Criar e Continuar"** → Pule as permissoes → **"Concluir"**

### Passo 4: Gerar Chave JSON

1. Na lista de contas de servico, clique na conta criada
2. Va na aba **"Chaves"**
3. Clique **"Adicionar Chave"** → **"Criar nova chave"** → **JSON**
4. O arquivo JSON sera baixado automaticamente

### Passo 5: Compartilhar a Planilha

1. Abra sua planilha no Google Sheets
2. Copie o **e-mail da Service Account** (formato: `nome@projeto.iam.gserviceaccount.com`)
3. Clique em **"Compartilhar"** na planilha
4. Cole o e-mail da Service Account
5. Defina permissao como **"Editor"**
6. Desmarque "Notificar pessoas" e clique **"Compartilhar"**

### Passo 6: Configurar Variaveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```env
GOOGLE_SPREADSHEET_ID=16DjjPOMnWu-9P88fKkLCxSGFHOSFtv8N7_kt1yWkiOE
GOOGLE_SERVICE_ACCOUNT_EMAIL=sheets-app-service@seu-projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nSUA_CHAVE_AQUI\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_APP_NAME=Sistema de Gestao de Associados
```

> **IMPORTANTE**: O `GOOGLE_PRIVATE_KEY` deve estar entre aspas duplas e as quebras de linha como `\n`.

Para extrair do JSON baixado:
```bash
# No terminal, extraia a private_key do arquivo JSON:
cat sua-chave.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['private_key'])"
```

---

## Instalacao e Execucao Local

### Pre-requisitos

- Node.js 18+ instalado
- npm ou yarn
- Conta Google Cloud configurada (passos acima)

### Passo a Passo

```bash
# 1. Entrar na pasta do projeto
cd sheets-app

# 2. Instalar dependencias
npm install

# 3. Configurar variaveis de ambiente
cp .env.local.example .env.local
# Edite o .env.local com suas credenciais reais

# 4. Executar em modo desenvolvimento
npm run dev

# 5. Acessar no navegador
# http://localhost:3000
```

---

## Deploy em Producao

### Opcao 1: Vercel (Recomendado - Gratuito)

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Fazer deploy
vercel

# 3. Configurar variaveis de ambiente no dashboard da Vercel
# Settings → Environment Variables → Adicionar:
# - GOOGLE_SPREADSHEET_ID
# - GOOGLE_SERVICE_ACCOUNT_EMAIL
# - GOOGLE_PRIVATE_KEY
```

Ou pelo dashboard:
1. Acesse [vercel.com](https://vercel.com)
2. Importe o repositorio do GitHub
3. Configure as variaveis de ambiente
4. Clique em Deploy

### Opcao 2: Railway

1. Acesse [railway.app](https://railway.app)
2. Conecte seu repositorio GitHub
3. Adicione as variaveis de ambiente
4. Deploy automatico a cada push

### Opcao 3: Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

---

## API Endpoints

### `GET /api/sheets`
Lista abas da planilha (sem parametro `tab`) ou registros de uma aba.

**Query Params:**
| Param    | Tipo   | Descricao                    |
|----------|--------|------------------------------|
| tab      | string | Nome da aba (obrigatorio para listar registros) |
| page     | number | Pagina atual (default: 1)    |
| pageSize | number | Itens por pagina (default: 50) |
| search   | string | Texto para busca             |

**Exemplo:**
```
GET /api/sheets?tab=AGOSTO&page=1&pageSize=20&search=João
```

---

### `POST /api/sheets`
Cria novo registro.

**Body:**
```json
{
  "tab": "AGOSTO",
  "data": {
    "nomeDoAssociado": "João Silva",
    "placa": "ABC-1234",
    "valorDaParcela": "R$ 150,00",
    "valorPago": "R$ 150,00",
    "consultor": "Maria",
    "motivoDoCancelamento": "-",
    "statusAtual": "Ativo",
    "observacao": "-",
    "atendente": "Carlos"
  }
}
```

---

### `PUT /api/sheets/:id`
Atualiza registro existente.

**Body:**
```json
{
  "tab": "AGOSTO",
  "data": {
    "statusAtual": "Inadimplente",
    "observacao": "Parcela em atraso"
  }
}
```

---

### `DELETE /api/sheets/:id?tab=AGOSTO`
Remove (limpa) um registro.

---

## Limites e Consideracoes

### Rate Limits do Google Sheets API
- **Leitura**: 300 requisicoes/minuto por projeto
- **Escrita**: 300 requisicoes/minuto por projeto
- **Cache**: Implementado com TTL de 30 segundos para reduzir chamadas

### Limitacoes
- Maximo recomendado: ~5.000 linhas por aba
- Concorrencia: Nao ha controle de concorrencia nativo (use para times pequenos)
- Sem autenticacao de usuarios (adicione NextAuth.js se necessario)

### Melhorias Futuras Sugeridas
- [ ] Adicionar autenticacao (NextAuth.js com Google OAuth)
- [ ] Exportar relatorios em PDF
- [ ] Dashboard com graficos (Chart.js)
- [ ] Notificacoes por email para inadimplentes
- [ ] Modo offline com sync posterior
- [ ] Logs de auditoria (quem alterou o que)

---

## Licenca

Este projeto e de uso interno. Adapte conforme necessario.
