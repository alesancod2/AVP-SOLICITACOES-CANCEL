import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/cancelamentos/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("cancelamentos")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !row) {
      return NextResponse.json(
        { success: false, error: "Registro nao encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        nomeDoAssociado: row.nome_associado || "",
        placa: row.placa || "",
        valorDaParcela: row.valor_parcela || "",
        valorPago: row.valor_pago || "",
        consultor: row.consultor || "",
        motivoDoCancelamento: row.motivo_cancelamento || "-",
        statusAtual: row.status_atual || "-",
        observacao: row.observacao || "-",
        atendente: row.atendente || "",
        dataCriacao: row.data_criacao
          ? new Date(row.data_criacao).toLocaleDateString("pt-BR")
          : "",
      },
    });
  } catch (error: any) {
    console.error("API GET cancelamento Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

// PUT /api/cancelamentos/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Campo 'data' e obrigatorio" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const updateData: Record<string, any> = {};
    if (data.nomeDoAssociado !== undefined) updateData.nome_associado = data.nomeDoAssociado;
    if (data.placa !== undefined) updateData.placa = data.placa;
    if (data.valorDaParcela !== undefined) updateData.valor_parcela = data.valorDaParcela;
    if (data.valorPago !== undefined) updateData.valor_pago = data.valorPago;
    if (data.consultor !== undefined) updateData.consultor = data.consultor;
    if (data.motivoDoCancelamento !== undefined) updateData.motivo_cancelamento = data.motivoDoCancelamento;
    if (data.statusAtual !== undefined) updateData.status_atual = data.statusAtual;
    if (data.observacao !== undefined) updateData.observacao = data.observacao;
    if (data.atendente !== undefined) updateData.atendente = data.atendente;
    if (data.mesReferencia !== undefined) updateData.mes_referencia = data.mesReferencia;

    updateData.atualizado_em = new Date().toISOString();

    const { data: row, error } = await admin
      .from("cancelamentos")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        nomeDoAssociado: row.nome_associado || "",
        placa: row.placa || "",
        valorDaParcela: row.valor_parcela || "",
        valorPago: row.valor_pago || "",
        consultor: row.consultor || "",
        motivoDoCancelamento: row.motivo_cancelamento || "-",
        statusAtual: row.status_atual || "-",
        observacao: row.observacao || "-",
        atendente: row.atendente || "",
        dataCriacao: row.data_criacao
          ? new Date(row.data_criacao).toLocaleDateString("pt-BR")
          : "",
      },
    });
  } catch (error: any) {
    console.error("API PUT cancelamento Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar" },
      { status: 500 }
    );
  }
}

// DELETE /api/cancelamentos/[id] - Admin only
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verificar se usuario eh Admin antes de permitir exclusao
    const { data: usuario } = await admin
      .from("usuarios")
      .select("perfil")
      .eq("email", session.user.email)
      .single();

    if (!usuario || usuario.perfil !== "Admin") {
      return NextResponse.json(
        { success: false, error: "Apenas administradores podem excluir registros" },
        { status: 403 }
      );
    }

    const { error } = await admin
      .from("cancelamentos")
      .delete()
      .eq("id", params.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      data: { message: "Registro removido com sucesso" },
    });
  } catch (error: any) {
    console.error("API DELETE cancelamento Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao deletar" },
      { status: 500 }
    );
  }
}
