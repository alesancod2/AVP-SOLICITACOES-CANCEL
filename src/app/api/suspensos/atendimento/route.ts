import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST /api/suspensos/atendimento - Iniciar/Salvar/Liberar atendimento
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Get current user profile
    const { data: usuario } = await admin
      .from("usuarios")
      .select("nome, email, perfil")
      .eq("email", session.user.email)
      .single();

    if (!usuario) {
      return NextResponse.json({ success: false, error: "Usuario nao encontrado" }, { status: 403 });
    }

    const { id, action, dados } = await request.json();

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "ID e action sao obrigatorios" },
        { status: 400 }
      );
    }

    if (action === "iniciar") {
      const { data: row, error } = await admin
        .from("suspensos")
        .update({
          atendente: usuario.nome,
          dt_recebimento: new Date().toLocaleDateString("pt-BR"),
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Iniciar Atendimento Suspenso",
        registro_id: id,
        depois: usuario.nome,
      });

      return NextResponse.json({ success: true, data: mapSuspenso(row) });
    }

    if (action === "salvar") {
      if (!dados) {
        return NextResponse.json(
          { success: false, error: "Dados do atendimento obrigatorios" },
          { status: 400 }
        );
      }

      const updateData: Record<string, any> = {
        atualizado_em: new Date().toISOString(),
      };
      if (dados.situacao !== undefined) updateData.situacao = dados.situacao;
      if (dados.formaPagamento !== undefined) updateData.forma_pagamento = dados.formaPagamento;
      if (dados.valorRecebido !== undefined) updateData.valor_recebido = dados.valorRecebido;
      if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;
      if (dados.dtRecebimento !== undefined) {
        updateData.dt_recebimento = dados.dtRecebimento;
      } else {
        updateData.dt_recebimento = new Date().toLocaleDateString("pt-BR");
      }

      const { data: row, error } = await admin
        .from("suspensos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Salvar Atendimento Suspenso",
        registro_id: id,
        campo: "situacao",
        depois: dados.situacao || "",
      });

      return NextResponse.json({ success: true, data: mapSuspenso(row) });
    }

    if (action === "liberar") {
      const { data: row, error } = await admin
        .from("suspensos")
        .update({
          atendente: "",
          dt_recebimento: "",
          situacao: "",
          forma_pagamento: "",
          valor_recebido: "",
          observacoes: "",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Liberar Suspenso (Fila)",
        registro_id: id,
        antes: usuario.nome,
      });

      return NextResponse.json({ success: true, data: mapSuspenso(row) });
    }

    return NextResponse.json(
      { success: false, error: "Action invalida. Use: iniciar, salvar, liberar" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function mapSuspenso(row: any) {
  return {
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
}
