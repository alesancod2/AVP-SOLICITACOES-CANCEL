import { NextRequest, NextResponse } from "next/server";
import { updateSuspenso, addLog } from "@/lib/google-sheets";
import { verifyToken } from "@/lib/auth";

// POST /api/suspensos/atendimento - Iniciar atendimento (lock operator)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.substring(7));
  if (!user) {
    return NextResponse.json({ success: false, error: "Token invalido" }, { status: 401 });
  }

  try {
    const { id, action, dados } = await request.json();

    if (!id || !action) {
      return NextResponse.json(
        { success: false, error: "ID e action sao obrigatorios" },
        { status: 400 }
      );
    }

    if (action === "iniciar") {
      // Lock: assign operator
      const updated = await updateSuspenso(id, {
        atendente: user.nome,
        dtRecebimento: new Date().toLocaleDateString("pt-BR"),
      });

      await addLog(user.nome, user.email, user.perfil, "Iniciar Atendimento Suspenso", id, "", "", user.nome);

      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "salvar") {
      // Save attendance data
      if (!dados) {
        return NextResponse.json(
          { success: false, error: "Dados do atendimento obrigatorios" },
          { status: 400 }
        );
      }

      const updated = await updateSuspenso(id, {
        situacao: dados.situacao,
        formaPagamento: dados.formaPagamento,
        valorRecebido: dados.valorRecebido,
        observacoes: dados.observacoes,
        dtRecebimento: dados.dtRecebimento || new Date().toLocaleDateString("pt-BR"),
      });

      await addLog(user.nome, user.email, user.perfil, "Salvar Atendimento Suspenso", id, "situacao", "", dados.situacao);

      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "liberar") {
      // Release: remove operator lock
      const updated = await updateSuspenso(id, {
        atendente: "",
        dtRecebimento: "",
        situacao: "" as any,
        formaPagamento: "" as any,
        valorRecebido: "",
        observacoes: "",
      });

      await addLog(user.nome, user.email, user.perfil, "Liberar Suspenso (Fila)", id, "", user.nome, "");

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json(
      { success: false, error: "Action invalida. Use: iniciar, salvar, liberar" },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
