// =============================================
// TIPOS GLOBAIS DA APLICACAO
// =============================================

export interface Associado {
  id: string;
  nomeDoAssociado: string;
  placa: string;
  valorDaParcela: string;
  valorPago: string;
  consultor: string;
  motivoDoCancelamento: string;
  statusAtual: string;
  observacao: string;
  atendente: string;
}

export interface SheetTab {
  name: string;
  id: number;
}

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

export interface FormField {
  key: keyof Omit<Associado, "id">;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

// Configuração dos campos do formulário baseada na planilha
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
    placeholder: "Descreva o motivo (se aplicável)",
  },
  {
    key: "statusAtual",
    label: "Status Atual",
    type: "select",
    required: true,
    options: ["Ativo", "Inadimplente", "Cancelado", "Pendente", "Em negociacao", "-"],
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

// Status possíveis para badge de cores
export const STATUS_COLORS: Record<string, string> = {
  Ativo: "bg-green-100 text-green-800",
  Inadimplente: "bg-red-100 text-red-800",
  Cancelado: "bg-gray-100 text-gray-800",
  Pendente: "bg-yellow-100 text-yellow-800",
  "Em negociacao": "bg-blue-100 text-blue-800",
  "-": "bg-gray-50 text-gray-400",
};
