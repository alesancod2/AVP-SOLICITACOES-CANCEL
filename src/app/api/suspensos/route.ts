import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// =============================================
// CACHE EM MEMORIA (TTL 60s)
// Evita queries repetidas ao Supabase em alta frequencia
// =============================================
interface CacheEntry {
  data: any[];
  timestamp: number;
}

let suspensosCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60_000; // 60 segundos

function getCachedData(): any[] | null {
  if (suspensosCache && Date.now() - suspensosCache.timestamp < CACHE_TTL_MS) {
    return suspensosCache.data;
  }
  suspensosCache = null;
  return null;
}

function setCachedData(data: any[]): void {
  suspensosCache = { data, timestamp: Date.now() };
}

// Invalida cache (chamado em PUT/atendimento)
export function invalidateSuspensosCache(): void {
  suspensosCache = null;
}

// =============================================
// GET /api/suspensos - Busca TODOS os suspensos
// Usa cache em memoria (60s TTL) + paginacao interna Supabase
// =============================================
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    // Tentar cache primeiro
    const cached = getCachedData();
    if (cached) {
      const response = NextResponse.json({ success: true, data: cached, total: cached.length, cached: true });
      response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
      response.headers.set("X-Cache", "HIT");
      return response;
    }

    // Cache miss: buscar do Supabase (paginado, sem limite de 1000)
    const admin = createAdminClient();
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from("suspensos")
        .select("*")
        .order("dia_vencimento", { ascending: true })
        .order("associado", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw new Error(error.message);

      if (data && data.length > 0) {
        allData.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Mapear para formato frontend
    // Campos: associado, placa, dtVencimento, valorOriginal, situacao
    // seguem exatamente o mesmo padrao de mapeamento
    const suspensos = allData.map((row) => ({
      id: row.id,
      associado: row.associado || "",
      placa: row.placa || "",
      dtVencimento: row.dt_vencimento || "",
      valorOriginal: row.valor_original || "",
      situacao: row.situacao || "",
      // Campos operador
      dtRecebimento: row.dt_recebimento || "",
      formaPagamento: row.forma_pagamento || "",
      valorRecebido: row.valor_recebido || "",
      atendente: row.atendente || "",
      observacoes: row.observacoes || "",
      conferencia: row.conferencia || "",
      // Campos extras AEasy
      diaVencimento: row.dia_vencimento || "",
      diasAtraso: row.dias_atraso || 0,
      dataSuspensao: row.data_suspensao || "",
      tipoSuspensao: row.tipo_suspensao || "",
      consultor: row.consultor || "",
      sede: row.sede || "",
      plano: row.plano || "",
      documento: row.documento || "",
      telefone: row.telefone || "",
      modelo: row.modelo || "",
    }));

    // Salvar no cache
    setCachedData(suspensos);

    const response = NextResponse.json({ success: true, data: suspensos, total: suspensos.length, cached: false });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    response.headers.set("X-Cache", "MISS");
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =============================================
// PUT /api/suspensos - Atualiza registro (campos do operador)
// Invalida cache apos update
// =============================================
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID obrigatorio" }, { status: 400 });
    }

    const admin = createAdminClient();
    const updateData: Record<string, any> = {};
    if (data.dtRecebimento !== undefined) updateData.dt_recebimento = data.dtRecebimento;
    if (data.situacao !== undefined) updateData.situacao = data.situacao;
    if (data.formaPagamento !== undefined) updateData.forma_pagamento = data.formaPagamento;
    if (data.valorRecebido !== undefined) updateData.valor_recebido = data.valorRecebido;
    if (data.atendente !== undefined) updateData.atendente = data.atendente;
    if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;
    if (data.conferencia !== undefined) updateData.conferencia = data.conferencia;
    updateData.atualizado_em = new Date().toISOString();

    const { data: row, error } = await admin
      .from("suspensos")
      .update(updateData)
      .eq("id", id)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    // Invalidar cache
    invalidateSuspensosCache();

    // Log
    const { data: usuario } = await admin
      .from("usuarios")
      .select("nome, email, perfil")
      .eq("email", session.user.email)
      .single();

    if (usuario) {
      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Atualizar Suspenso",
        registro_id: id,
      });
    }

    return NextResponse.json({ success: true, data: { id: row.id } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
