// =============================================
// TIPOS GLOBAIS DA APLICACAO - AVP System
// =============================================

// ---- AUTENTICACAO E USUARIOS ----

export type UserProfile = "Admin" | "User";
export type UserStatus = "Ativo" | "Inativo";

export interface UserPermissions {
  cancelamentos: boolean;
  suspensos: boolean;
  recuperacao: boolean;
  dashboard: boolean;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: UserProfile;
  status: UserStatus;
  permissoes: UserPermissions;
  dataCriacao: string;
  ultimoAcesso: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}

// ---- CANCELAMENTOS ----

export type CancelamentoStatus =
  | "Ativo"
  | "Inadimplente"
  | "Cancelado"
  | "Retido"
  | "Pendente"
  | "Em negociacao";

export interface Cancelamento {
  id: string;
  nomeDoAssociado: string;
  placa: string;
  valorDaParcela: string;
  valorPago: string;
  consultor: string;
  motivoDoCancelamento: string;
  statusAtual: CancelamentoStatus | string;
  observacao: string;
  atendente: string;
  dataCriacao?: string;
}

// Legacy alias
export type Associado = Cancelamento;

// ---- SUSPENSOS ----

export type SituacaoAeasy =
  | "Suspenso"
  | "Ativo"
  | "Cancelado"
  | "Inadimplente"
  | "";

export type FormaPagamento =
  | "PIX"
  | "Boleto"
  | "Cartao"
  | "Transferencia"
  | "Dinheiro"
  | "";

export type ConferenciaStatus = "OK" | "Verificar" | "";

export interface Suspenso {
  id: string;
  associado: string;
  dtRecebimento: string;
  dtVencimento: string;
  diaVencimento: string;
  placa: string;
  // Situacao vinda da AEasy (read-only, nao editavel)
  situacaoAeasy: SituacaoAeasy;
  // Situacao legada (campo antigo, nao mais utilizado no frontend)
  situacao: string;
  formaPagamento: FormaPagamento;
  valorRecebido: string;
  valorOriginal: string;
  atendente: string;
  observacoes: string;
  conferencia: ConferenciaStatus;
  telefone: string;
  diasAtraso: number;
}

// ---- AUDITORIA ----

// ---- RECUPERACAO (Cancelados AEasy) ----

export interface Recuperacao {
  id: string;
  associado: string;
  documento: string;
  telefone: string;
  placa: string;
  modelo: string;
  valorOriginal: string;
  consultor: string;
  sede: string;
  plano: string;
  diasCancelado: number;
  dataCancelamento: string;
  diaVencimento: string;
  atendente: string;
  observacoes: string;
  statusRecuperacao: RecuperacaoStatus;
  aeasyVendaId: string;
  sincronizadoEm: string;
}

export type RecuperacaoStatus =
  | ""
  | "Contato Realizado"
  | "Interessado"
  | "Recusa"
  | "Nao Localizado"
  | "Recuperado";

export interface RecuperacaoFilters {
  busca: string;
  statusRecuperacao: string;
  atendente: string;
  sede: string;
}

// ---- AUDITORIA ----

export interface LogEntry {
  id: string;
  data: string;
  usuario: string;
  email: string;
  perfil: string;
  acao: string;
  registroId: string;
  campo: string;
  antes: string;
  depois: string;
}

// ---- API ----

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    pages: number;
  };
}

// ---- FORMULARIO CANCELAMENTOS ----

export interface FormField {
  key: keyof Omit<Cancelamento, "id" | "dataCriacao">;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export const CANCELAMENTO_STATUS_OPTIONS: CancelamentoStatus[] = [
  "Ativo",
  "Inadimplente",
  "Cancelado",
  "Retido",
  "Pendente",
  "Em negociacao",
];

export const FORM_FIELDS: FormField[] = [
  {
    key: "nomeDoAssociado",
    label: "Nome do Associado",
    type: "text",
    required: true,
    placeholder: "Digite o nome completo",
  },
  {
    key: "placa",
    label: "Placa",
    type: "text",
    required: true,
    placeholder: "Ex: ABC-1234",
  },
  {
    key: "valorDaParcela",
    label: "Valor da Parcela",
    type: "text",
    required: true,
    placeholder: "Ex: R$ 150,00",
  },
  {
    key: "valorPago",
    label: "Valor Pago",
    type: "text",
    required: false,
    placeholder: "Ex: R$ 150,00",
  },
  {
    key: "consultor",
    label: "Consultor",
    type: "text",
    required: false,
    placeholder: "Nome do consultor",
  },
  {
    key: "motivoDoCancelamento",
    label: "Motivo do Cancelamento",
    type: "textarea",
    required: false,
    placeholder: "Descreva o motivo (se aplicavel)",
  },
  {
    key: "statusAtual",
    label: "Status Atual",
    type: "select",
    required: true,
    options: [...CANCELAMENTO_STATUS_OPTIONS],
  },
  {
    key: "observacao",
    label: "Observacao",
    type: "textarea",
    required: false,
    placeholder: "Observacoes adicionais",
  },
  {
    key: "atendente",
    label: "Atendente",
    type: "text",
    required: false,
    placeholder: "Nome do atendente",
  },
];

// Status cores para badges
export const STATUS_COLORS: Record<string, string> = {
  Ativo: "bg-green-900/30 text-green-400 border border-green-700/50",
  Suspenso: "bg-orange-900/30 text-orange-400 border border-orange-700/50",
  Inadimplente: "bg-red-900/30 text-red-400 border border-red-700/50",
  Cancelado: "bg-gray-700/30 text-gray-400 border border-gray-600/50",
  Retido: "bg-purple-900/30 text-purple-400 border border-purple-700/50",
  Pendente: "bg-yellow-900/30 text-yellow-400 border border-yellow-700/50",
  "Em negociacao": "bg-blue-900/30 text-blue-400 border border-blue-700/50",
  OK: "bg-green-900/30 text-green-400 border border-green-700/50",
  Verificar: "bg-orange-900/30 text-orange-400 border border-orange-700/50",
  Pago: "bg-green-900/30 text-green-400 border border-green-700/50",
  Parcial: "bg-yellow-900/30 text-yellow-400 border border-yellow-700/50",
  "Nao localizado": "bg-gray-700/30 text-gray-400 border border-gray-600/50",
  Recusa: "bg-red-900/30 text-red-400 border border-red-700/50",
};

// ---- FILTROS ----

export interface CancelamentoFilters {
  mes: string;
  ano: string;
  status: string;
  dataInicio: string;
  dataFim: string;
  busca: string;
}

export interface SuspensoFilters {
  busca: string;
  vencimentoDe: string;
  vencimentoAte: string;
  situacao: string;
  formaPagamento: string;
  atendente: string;
  conferencia: string;
  valorSegmento: string;
}

// ---- DASHBOARD ----

export interface KPIData {
  total: number;
  ativos: number;
  emNegociacao: number;
  cancelados: number;
  retidos: number;
  pendentes: number;
  inadimplentes: number;
}

export interface ProdutividadeAtendente {
  atendente: string;
  total: number;
  retidos: number;
  cancelados: number;
  taxaRetencao: number;
}

export interface DailyEvolution {
  data: string;
  total: number;
  cancelados: number;
  retidos: number;
}

// ---- NAVIGATION ----

export type PageName = "cancelamentos" | "recuperacao" | "suspensos" | "dashboard" | "usuarios" | "logs";

export interface NavItem {
  name: PageName;
  label: string;
  icon: string;
  adminOnly?: boolean;
  permissionKey?: keyof UserPermissions;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "cancelamentos", label: "Cancelamentos", icon: "file-x", permissionKey: "cancelamentos" },
  { name: "recuperacao", label: "Recuperacao", icon: "user-x", permissionKey: "recuperacao" },
  { name: "suspensos", label: "Suspensos", icon: "pause-circle", permissionKey: "suspensos" },
  { name: "dashboard", label: "Dashboard", icon: "bar-chart-3", permissionKey: "dashboard" },
  { name: "usuarios", label: "Usuarios", icon: "users", adminOnly: true },
  { name: "logs", label: "Auditoria", icon: "scroll-text", adminOnly: true },
];
