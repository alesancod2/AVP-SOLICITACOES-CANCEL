import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/suspensos
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("suspensos")
      .select("*")
      .order("data_criacao", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Map to frontend format
    const suspensos = (data || []).map((row) => ({
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
    }));

    return NextResponse.json({ success: true, data: suspensos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/suspensos - Update a suspenso record
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
    if (data.associado !== undefined) updateData.associado = data.associado;
    if (data.dtRecebimento !== undefined) updateData.dt_recebimento = data.dtRecebimento;
    if (data.dtVencimento !== undefined) updateData.dt_vencimento = data.dtVencimento;
    if (data.placa !== undefined) updateData.placa = data.placa;
    if (data.situacao !== undefined) updateData.situacao = data.situacao;
    if (data.formaPagamento !== undefined) updateData.forma_pagamento = data.formaPagamento;
    if (data.valorRecebido !== undefined) updateData.valor_recebido = data.valorRecebido;
    if (data.valorOriginal !== undefined) updateData.valor_original = data.valorOriginal;
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

    if (error) {
      throw new Error(error.message);
    }

    // Get user info for logging
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

    const updated = {
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
    };

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
