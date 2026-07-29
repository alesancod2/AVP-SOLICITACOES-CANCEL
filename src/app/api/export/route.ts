import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/export?type=cancelamentos|suspensos&format=csv|json
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "cancelamentos";
    const format = searchParams.get("format") || "csv";

    const admin = createAdminClient();
    let data: any[] = [];

    if (type === "suspensos") {
      const { data: rows, error } = await admin
        .from("suspensos")
        .select("*")
        .order("data_criacao", { ascending: false });

      if (error) throw new Error(error.message);

      data = (rows || []).map((row) => ({
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
    } else {
      const { data: rows, error } = await admin
        .from("cancelamentos")
        .select("*")
        .order("data_criacao", { ascending: false });

      if (error) throw new Error(error.message);

      data = (rows || []).map((row) => ({
        nomeDoAssociado: row.nome_associado || "",
        placa: row.placa || "",
        valorDaParcela: row.valor_parcela || "",
        valorPago: row.valor_pago || "",
        consultor: row.consultor || "",
        motivoDoCancelamento: row.motivo_cancelamento || "",
        statusAtual: row.status_atual || "",
        observacao: row.observacao || "",
        atendente: row.atendente || "",
        dataCriacao: row.data_criacao
          ? new Date(row.data_criacao).toLocaleDateString("pt-BR")
          : "",
      }));
    }

    if (format === "json") {
      return NextResponse.json({ success: true, data });
    }

    // CSV format
    if (data.length === 0) {
      return new NextResponse("Sem dados para exportar", { status: 200 });
    }

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(";"),
      ...data.map((row) =>
        headers.map((h) => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(";")
      ),
    ];

    const csv = csvRows.join("\n");
    const filename = `${type}_export_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
