import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/cancelamentos
// Query params: page, pageSize, search, status, mes_referencia
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const mesReferencia = searchParams.get("mes_referencia") || "";

    const admin = createAdminClient();
    let query = admin.from("cancelamentos").select("*", { count: "exact" });

    // Filters
    if (status) {
      query = query.eq("status_atual", status);
    }

    if (mesReferencia) {
      query = query.eq("mes_referencia", mesReferencia);
    }

    if (search) {
      query = query.or(
        `nome_associado.ilike.%${search}%,placa.ilike.%${search}%,consultor.ilike.%${search}%,atendente.ilike.%${search}%`
      );
    }

    // Ordering
    query = query.order("data_criacao", { ascending: false });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const total = count || 0;
    const pages = Math.ceil(total / pageSize);

    // Map to frontend format
    const records = (data || []).map((row) => ({
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
      mesReferencia: row.mes_referencia || "",
      dataCriacao: row.data_criacao
        ? new Date(row.data_criacao).toLocaleDateString("pt-BR")
        : "",
    }));

    return NextResponse.json({
      success: true,
      data: records,
      meta: { total, page, pages },
    });
  } catch (error: any) {
    console.error("API GET cancelamentos Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// POST /api/cancelamentos
export async function POST(request: NextRequest) {
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

    if (!data.nomeDoAssociado || !data.placa) {
      return NextResponse.json(
        { success: false, error: "Nome do Associado e Placa sao obrigatorios" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const insertData = {
      nome_associado: data.nomeDoAssociado,
      placa: data.placa,
      valor_parcela: data.valorDaParcela || "",
      valor_pago: data.valorPago || "",
      consultor: data.consultor || "",
      motivo_cancelamento: data.motivoDoCancelamento || "",
      status_atual: data.statusAtual || "Ativo",
      observacao: data.observacao || "",
      atendente: data.atendente || "",
      mes_referencia: data.mesReferencia || "",
    };

    const { data: record, error } = await admin
      .from("cancelamentos")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id: record.id,
          nomeDoAssociado: record.nome_associado,
          placa: record.placa,
          valorDaParcela: record.valor_parcela,
          valorPago: record.valor_pago,
          consultor: record.consultor,
          motivoDoCancelamento: record.motivo_cancelamento,
          statusAtual: record.status_atual,
          observacao: record.observacao,
          atendente: record.atendente,
          dataCriacao: new Date(record.data_criacao).toLocaleDateString("pt-BR"),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API POST cancelamentos Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao criar registro" },
      { status: 500 }
    );
  }
}
