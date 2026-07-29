import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/suspensos - Busca TODOS os suspensos (sem limite)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Buscar TODOS os registros (Supabase limita a 1000 por query, paginar)
    let allData: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await admin
        .from("suspensos")
        .select("*")
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

    // Map to frontend format
    const suspensos = allData.map((row) => ({
      id: row.id,
      associado: row.associado || "",
      dtRecebimento: row.dt_recebimento || "",
      dtVencimento: row.dt_vencimento || "",
      placa: row.placa || "",
      situacao: row.situacao || "",
      formaPagamento: row.forma_pagamento || "",
      valorRecebido: row.valor_recebido || "",
      valorOriginal: row.valor_original || "",
      atendente: row.atendente || "",
      observacoes: row.observacoes || "",
      conferencia: row.conferencia || "",
      // Campos extras da AEasy
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

    // Cache header: 60 segundos
    const response = NextResponse.json({ success: true, data: suspensos, total: suspensos.length });
    response.headers.set("Cache-Control", "private, max-age=60, stale-while-revalidate=120");
    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/suspensos - Update a suspenso record (campos manuais do operador)
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
      .select()
      .single();

    if (error) throw new Error(error.message);

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
