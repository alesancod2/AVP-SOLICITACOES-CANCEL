import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Force dynamic rendering - bypass Vercel Data Cache
export const dynamic = "force-dynamic";
export const revalidate = 0;

// =============================================
// CACHE EM MEMORIA (TTL 3s - real-time para operadores)
// =============================================
interface CacheEntry {
  data: any[];
  totalReal: number;
  timestamp: number;
}

let suspensosCache: CacheEntry | null = null;
const CACHE_TTL_MS = 3_000; // 3 segundos

function getCachedData(): CacheEntry | null {
  if (suspensosCache && Date.now() - suspensosCache.timestamp < CACHE_TTL_MS) {
    return suspensosCache;
  }
  suspensosCache = null;
  return null;
}

function setCachedData(data: any[], totalReal: number): void {
  suspensosCache = { data, totalReal, timestamp: Date.now() };
}

// Invalida cache
export function invalidateSuspensosCache(): void {
  suspensosCache = null;
}

// =============================================
// GET /api/suspensos - Busca TODOS os suspensos (sem limite)
// Retorna dataset completo para renderizacao virtualizada no frontend
// Compressao via Content-Encoding habilitada pela Vercel automaticamente
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
      const response = NextResponse.json({
        success: true,
        data: cached.data,
        total: cached.data.length,
        totalReal: cached.totalReal,
        cached: true,
      });
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      response.headers.set("X-Cache", "HIT");
      response.headers.set("Content-Type", "application/json; charset=utf-8");
      return response;
    }

    const admin = createAdminClient();

    // Contagem total absoluta do banco (para KPI)
    const { count: totalCount } = await admin
      .from("suspensos")
      .select("*", { count: "exact", head: true })
      .not("aeasy_venda_id", "is", null);

    // Buscar TODOS os registros - sem limite de paginacao
    let allData: any[] = [];
    let from = 0;
    const pageSize = 10000; // Lote grande para minimizar roundtrips
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from("suspensos")
        .select("*")
        .not("aeasy_venda_id", "is", null)
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

    // Mapear para formato frontend (contrato API verificado contra interface Suspenso)
    const suspensos = allData.map((row) => ({
      id: row.id,
      associado: row.associado ?? "",
      placa: row.placa ?? "",
      dtVencimento: row.dt_vencimento ?? "",
      valorOriginal: row.valor_original ?? "",
      situacaoAeasy: row.situacao_aeasy ?? "Suspenso",
      situacao: row.situacao ?? "",
      dtRecebimento: row.dt_recebimento ?? "",
      formaPagamento: row.forma_pagamento ?? "",
      valorRecebido: row.valor_recebido ?? "",
      atendente: row.atendente ?? "",
      observacoes: row.observacoes ?? "",
      conferencia: row.conferencia ?? "",
      diaVencimento: row.dia_vencimento ?? "",
      diasAtraso: row.dias_atraso ?? 0,
      dataSuspensao: row.data_suspensao ?? "",
      tipoSuspensao: row.tipo_suspensao ?? "",
      consultor: row.consultor ?? "",
      sede: row.sede ?? "",
      plano: row.plano ?? "",
      documento: row.documento ?? "",
      telefone: row.telefone ?? "",
      modelo: row.modelo ?? "",
      aeasyVendaId: row.aeasy_venda_id ?? "",
      sincronizadoEm: row.sincronizado_em ?? "",
    }));

    // Cache
    const totalReal = totalCount ?? suspensos.length;
    setCachedData(suspensos, totalReal);

    const response = NextResponse.json({
      success: true,
      data: suspensos,
      total: suspensos.length,
      totalReal,
      cached: false,
    });
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("X-Cache", "MISS");
    response.headers.set("Content-Type", "application/json; charset=utf-8");
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// =============================================
// PUT /api/suspensos - Atualiza registro (campos do operador)
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

    invalidateSuspensosCache();

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
