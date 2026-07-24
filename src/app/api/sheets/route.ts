import { NextRequest, NextResponse } from "next/server";
import {
  getRecords,
  createRecord,
  getSheetTabs,
  searchRecords,
} from "@/lib/google-sheets";

// =============================================
// GET /api/sheets
// Query params: tab, page, pageSize, search
// =============================================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const search = searchParams.get("search") || "";

    // Se nenhuma aba especificada, retornar lista de abas
    if (!tab) {
      const tabs = await getSheetTabs();
      return NextResponse.json({
        success: true,
        data: tabs,
      });
    }

    // Se há busca, usar searchRecords
    if (search) {
      const records = await searchRecords(tab, search);
      return NextResponse.json({
        success: true,
        data: records,
        meta: {
          total: records.length,
          page: 1,
          pages: 1,
        },
      });
    }

    // Busca paginada normal
    const result = await getRecords(tab, page, pageSize);
    return NextResponse.json({
      success: true,
      data: result.records,
      meta: {
        total: result.total,
        page,
        pages: result.pages,
      },
    });
  } catch (error: any) {
    console.error("API GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}

// =============================================
// POST /api/sheets
// Body: { tab, data }
// =============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tab, data } = body;

    if (!tab || !data) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos 'tab' e 'data' sao obrigatorios",
        },
        { status: 400 }
      );
    }

    // Validar campos obrigatórios
    if (!data.nomeDoAssociado || !data.placa) {
      return NextResponse.json(
        {
          success: false,
          error: "Nome do Associado e Placa sao obrigatorios",
        },
        { status: 400 }
      );
    }

    const record = await createRecord(tab, data);
    return NextResponse.json(
      {
        success: true,
        data: record,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erro ao criar registro",
      },
      { status: 500 }
    );
  }
}
