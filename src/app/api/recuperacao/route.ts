import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// =============================================
// REGRA DE VISIBILIDADE (Fila Ativa):
// Um cliente so permanece visivel se:
//   - NAO tem status "Ativo" (veio da API como reativado)
//   - OU (tem status "Interessado" E tem atendente vinculado)
// Clientes com outros status (Recusa, Nao Localizado, Contato Realizado)
// ficam visiveis para acompanhamento ate serem removidos pelo sync
// =============================================

interface CacheEntry {
  data: any[];
  totalReal: number;
  timestamp: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5_000;

function getCached(): CacheEntry | null {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) return cache;
  cache = null;
  return null;
}

// GET /api/recuperacao
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const cached = getCached();
    if (cached) {
      return NextResponse.json({
        success: true, data: cached.data, total: cached.data.length, totalReal: cached.totalReal, cached: true,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const admin = createAdminClient();

    const { count: totalCount } = await admin
      .from("recuperacao")
      .select("*", { count: "exact", head: true });

    // Buscar todos os registros
    let allData: any[] = [];
    let from = 0;
    const pageSize = 5000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from("recuperacao")
        .select("*")
        .order("dias_cancelado", { ascending: false })
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

    // REGRA DE VISIBILIDADE:
    // Cliente com status "Ativo" so fica visivel se tem "Interessado" + atendente
    const visibleRecords = allData.filter((row) => {
      const status = row.status_recuperacao || "";
      // Se marcado como "Ativo" (reativado): so mostra se tem interesse + atendente
      if (status === "Ativo") {
        return false; // Reativados saem da fila (sucesso!)
      }
      // "Recuperado" tambem sai da fila (missao cumprida)
      if (status === "Recuperado") {
        return false;
      }
      // Todos os demais ficam visiveis na fila de trabalho
      return true;
    });

    const records = visibleRecords.map((row) => ({
      id: row.id,
      associado: row.associado ?? "",
      documento: row.documento ?? "",
      telefone: row.telefone ?? "",
      placa: row.placa ?? "",
      modelo: row.modelo ?? "",
      valorOriginal: row.valor_original ?? "",
      consultor: row.consultor ?? "",
      sede: row.sede ?? "",
      plano: row.plano ?? "",
      diasCancelado: row.dias_cancelado ?? 0,
      dataCancelamento: row.data_cancelamento ?? "",
      diaVencimento: row.dia_vencimento ?? "",
      atendente: row.atendente ?? "",
      observacoes: row.observacoes ?? "",
      statusRecuperacao: row.status_recuperacao ?? "",
      aeasyVendaId: row.aeasy_venda_id ?? "",
      sincronizadoEm: row.sincronizado_em ?? "",
    }));

    const totalReal = totalCount ?? allData.length;
    cache = { data: records, totalReal, timestamp: Date.now() };

    return NextResponse.json({
      success: true, data: records, total: records.length, totalReal, cached: false,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/recuperacao - Atualiza atendimento + registra historico
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

    // Buscar estado atual ANTES da alteracao (para historico)
    const { data: currentRecord } = await admin
      .from("recuperacao")
      .select("aeasy_venda_id, associado, placa, telefone, plano, status_recuperacao, atendente")
      .eq("id", id)
      .single();

    // Atualizar o registro
    const updateData: Record<string, any> = {};
    if (data.atendente !== undefined) updateData.atendente = data.atendente;
    if (data.observacoes !== undefined) updateData.observacoes = data.observacoes;
    if (data.statusRecuperacao !== undefined) updateData.status_recuperacao = data.statusRecuperacao;
    updateData.atualizado_em = new Date().toISOString();

    const { error } = await admin
      .from("recuperacao")
      .update(updateData)
      .eq("id", id);

    if (error) throw new Error(error.message);

    cache = null;

    // Buscar usuario logado
    const { data: usuario } = await admin
      .from("usuarios")
      .select("nome, email, perfil")
      .eq("email", session.user.email)
      .single();

    const nomeAtendente = data.atendente || usuario?.nome || "";

    // =============================================
    // REGISTRAR HISTORICO DE TENTATIVA
    // Grava sempre que houver alteracao de status ou inicio de atendimento
    // =============================================
    if (data.statusRecuperacao !== undefined || data.atendente) {
      await admin.from("recuperacao_historico").insert({
        recuperacao_id: id,
        aeasy_venda_id: currentRecord?.aeasy_venda_id || "",
        associado: currentRecord?.associado || "",
        placa: currentRecord?.placa || "",
        telefone: currentRecord?.telefone || "",
        plano: currentRecord?.plano || "",
        atendente: nomeAtendente,
        status_anterior: currentRecord?.status_recuperacao || "",
        status_novo: data.statusRecuperacao || currentRecord?.status_recuperacao || "",
        observacoes: data.observacoes || "",
      });
    }

    // Log de auditoria (tabela logs existente)
    if (usuario) {
      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Atendimento Recuperacao",
        registro_id: id,
        campo: "status_recuperacao",
        antes: currentRecord?.status_recuperacao || "",
        depois: data.statusRecuperacao || "",
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
