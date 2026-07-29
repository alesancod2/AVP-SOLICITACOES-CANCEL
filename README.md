# AVP System v2.0

Sistema completo de gestao de cancelamentos e pagamentos suspensos, construido com Next.js 14 + Google Sheets como banco de dados.

## Funcionalidades

### Autenticacao
- Login por email (sem senha, validado no backend)
- JWT com expiracao de 8 horas
- Controle de acesso por perfil (Admin/User)
- Permissoes granulares por modulo

### Cancelamentos
- CRUD completo de solicitacoes
- KPI Cards: Total, Ativos, Em Negociacao, Cancelados, Retidos
- Filtros client-side instantaneos: Status, Data inicio/fim, Busca texto
- Paginacao (20 registros por pagina)
- Status: Ativo, Inadimplente, Cancelado, Retido, Pendente, Em negociacao
- Atendente automatico (nome do usuario logado)
- Exclusao apenas para Admin
- Exportacao CSV

### Dashboard (Admin)
- Grafico de Pizza: Retidos vs Cancelados
- Grafico de Linha: Evolucao diaria (Total, Cancelados, Retidos)
- Tabela de Produtividade por Atendente
- KPIs consolidados de todos os meses
- Chart.js para visualizacoes

### Suspensos
- Importacao Excel/CSV (4 colunas: Associado, Placa, Vencimento, Valor Original)
- Fluxo de Atendimento: Iniciar -> Modal com campos -> Salvar
- Trava por operador (outro nao pode pegar)
- Botao "Colocar na Fila" para liberar
- Conferencia: Admin edita (OK/Verificar), User visualiza
- Filtros: Busca, Situacao, Forma Pagamento, Atendente, Conferencia
- KPI Cards: Qtd. Placas, Valores a Receber, Valor Recebido (OK)
- Exportacao CSV

### Usuarios (Admin)
- Cadastrar novo usuario
- Alterar Status (Ativo/Inativo)
- Alterar Perfil (Admin/User)
- Permissoes por modulo com checkboxes

### Auditoria (Admin)
- Log de todas as acoes do sistema
- Filtro por usuario/acao
- Informacoes: Data, Usuario, Email, Acao, Campo, Antes, Depois

### PWA
- Instalavel no celular/desktop
- Service Worker com cache strategy
- Icones SVG

## Stack Tecnica

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide React
- **Graficos**: Chart.js + react-chartjs-2
- **Autenticacao**: jose (JWT)
- **Banco de dados**: Google Sheets API
- **Export**: xlsx, jsPDF + jspdf-autotable
- **Deploy**: Vercel (recomendado)

## Tema

- Dark mode fixo
- Sidebar responsiva com hover-expand e pin toggle
- Mobile: hamburger menu

## Instalacao

1. Clone o repositorio
2. Copie `.env.local.example` para `.env.local` e preencha as credenciais
3. `npm install`
4. `npm run dev`

## Estrutura do Google Sheets

Crie as seguintes abas na planilha:

| Aba | Colunas |
|-----|---------|
| DB_Cancelamentos (ou por mes) | Nome, Placa, Parcela, Pago, Consultor, Motivo, Status, Obs, Atendente, Data Criacao |
| DB_Suspensos | Associado, Dt Recebimento, Dt Vencimento, Placa, Situacao, Forma Pgto, Valor Recebido, Valor Original, Atendente, Observacoes, Conferencia |
| Usuarios | Nome, Email, Perfil, Status, Permissoes (JSON), Data Criacao, Ultimo Acesso |
| Logs | Data, Usuario, Email, Perfil, Acao, ID, Campo, Antes, Depois |

## Permissoes

| Perfil | Cancelamentos | Suspensos | Dashboard | Usuarios | Excluir | Conferencia |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| Admin | Sim | Sim | Sim | Sim | Sim | Edita |
| User | Permissao | Permissao | Permissao | Nao | Nao | Leitura |
