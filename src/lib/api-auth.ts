import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// =============================================
// Helper centralizado de autenticacao e autorizacao para API Routes
// Elimina duplicacao do padrao auth em todas as routes
// =============================================

export interface AuthenticatedUser {
  id: string;
  nome: string;
  email: string;
  perfil: "Admin" | "User";
  permissoes: {
    cancelamentos: boolean;
    suspensos: boolean;
    dashboard: boolean;
  };
}

export type ModulePermission = "cancelamentos" | "suspensos" | "dashboard";

interface AuthResult {
  user: AuthenticatedUser | null;
  error: NextResponse | null;
}

/**
 * Valida sessao e retorna perfil do usuario.
 * Se `requiredPermission` fornecido, verifica se user tem acesso ao modulo.
 * Se `requireAdmin`, verifica se user eh Admin.
 *
 * Retorna { user, error } — se error != null, retorne-o diretamente na route.
 */
export async function authenticateRequest(options?: {
  requiredPermission?: ModulePermission;
  requireAdmin?: boolean;
}): Promise<AuthResult> {
  const supabase = createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Nao autorizado" },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("id, nome, email, perfil, permissoes, status")
    .eq("email", session.user.email)
    .single();

  if (!usuario || usuario.status === "Inativo") {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Usuario inativo ou nao cadastrado" },
        { status: 403 }
      ),
    };
  }

  // Verificar Admin se necessario
  if (options?.requireAdmin && usuario.perfil !== "Admin") {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Acesso restrito a administradores" },
        { status: 403 }
      ),
    };
  }

  // Verificar permissao do modulo (Admin tem acesso total)
  if (options?.requiredPermission && usuario.perfil !== "Admin") {
    const perms = usuario.permissoes || {};
    if (!perms[options.requiredPermission]) {
      return {
        user: null,
        error: NextResponse.json(
          { success: false, error: `Sem permissao para o modulo: ${options.requiredPermission}` },
          { status: 403 }
        ),
      };
    }
  }

  return {
    user: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      permissoes: usuario.permissoes || { cancelamentos: true, suspensos: true, dashboard: true },
    },
    error: null,
  };
}

// =============================================
// Sanitizacao de input para queries PostgREST/ilike
// Escapa caracteres especiais que podem manipular filtros
// =============================================

/**
 * Escapa caracteres especiais do PostgREST ilike filter.
 * Previne manipulacao de pattern matching via input do usuario.
 */
export function sanitizeSearchInput(input: string): string {
  // Escapar caracteres especiais do LIKE/ILIKE do PostgreSQL
  return input
    .replace(/\\/g, "\\\\") // backslash primeiro
    .replace(/%/g, "\\%")    // percent (wildcard)
    .replace(/_/g, "\\_")    // underscore (single char wildcard)
    .trim();
}

// =============================================
// Validacao e cap de parametros numericos
// =============================================

const MAX_PAGE_SIZE = 1000;
const MIN_PAGE = 1;

/**
 * Valida e limita pageSize (max 1000) e page (min 1).
 */
export function validatePagination(params: { page?: string | null; pageSize?: string | null }) {
  let page = parseInt(params.page || "1", 10);
  let pageSize = parseInt(params.pageSize || "50", 10);

  if (isNaN(page) || page < MIN_PAGE) page = MIN_PAGE;
  if (isNaN(pageSize) || pageSize < 1) pageSize = 50;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize };
}
