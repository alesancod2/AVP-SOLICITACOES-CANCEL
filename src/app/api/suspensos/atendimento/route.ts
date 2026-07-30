import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Force dynamic rendering - bypass Vercel edge cache
export const dynamic = "force-dynamic";

// POST /api/suspensos/atendimento - Iniciar/Salvar/Liberar atendimento
// Includes 409 Conflict detection for race conditions between operators
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
      // =============================================
      // CONFLICT DETECTION (409)
      // Verifica se outro operador ja iniciou atendimento
      // antes de permitir a operacao
      // =============================================
      const { data: current } = await admin
        .from("suspensos")
        .select("atendente")
        .eq("id", id)
        .single();

      if (current && current.atendente && current.atendente !== usuario.nome) {
        // Outro operador ja pegou este registro - retorna 409 Conflict
        return NextResponse.json(
          {
            success: false,
            error: `Registro ja em atendimento por: ${current.atendente}`,
            conflict: true,
            atendente: current.atendente,
          },
          { status: 409 }
        );
      }

      const { data: row, error } = await admin
        .from("suspensos")
        .update({
          atendente: usuario.nome,
          dt_recebimento: new Date().toLocaleDateString("pt-BR"),
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("atendente", current?.atendente ?? "") // Atomic: so atualiza se atendente nao mudou
        .select()
        .single();

      if (error) {
        // Se falhou o update condicional, outro operador ganhou a corrida
        return NextResponse.json(
          {
            success: false,
            error: "Registro foi pego por outro operador. Atualize a lista.",
            conflict: true,
          },
          { status: 409 }
        );
      }

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

      // Verificar se o operador atual ainda eh o atendente (prevenir conflito)
      const { data: current } = await admin
        .from("suspensos")
        .select("atendente")
        .eq("id", id)
        .single();

      if (current && current.atendente !== usuario.nome) {
        return NextResponse.json(
          {
            success: false,
            error: `Voce nao eh mais o atendente deste registro. Atendente atual: ${current.atendente || "nenhum"}`,
            conflict: true,
          },
          { status: 409 }
        );
      }

      const updateData: Record<string, any> = {
        atualizado_em: new Date().toISOString(),
      };

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
        campo: "atendimento",
        depois: `Pgto: ${dados.formaPagamento ?? "-"}, Valor: ${dados.valorRecebido ?? "-"}`,
      });

      return NextResponse.json({ success: true, data: mapSuspenso(row) });
    }

    if (action === "liberar") {
      const { data: row, error } = await admin
        .from("suspensos")
        .update({
          atendente: "",
          dt_recebimento: "",
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
    associado: row.associado ?? "",
    dtRecebimento: row.dt_recebimento ?? "",
    dtVencimento: row.dt_vencimento ?? "",
    placa: row.placa ?? "",
    situacaoAeasy: row.situacao_aeasy ?? "Suspenso",
    situacao: row.situacao ?? "",
    formaPagamento: row.forma_pagamento ?? "",
    valorRecebido: row.valor_recebido ?? "",
    valorOriginal: row.valor_original ?? "",
    atendente: row.atendente ?? "",
    observacoes: row.observacoes ?? "",
    conferencia: row.conferencia ?? "",
    diaVencimento: row.dia_vencimento ?? "",
  };
}
