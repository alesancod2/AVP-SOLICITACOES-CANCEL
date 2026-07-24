import { NextRequest, NextResponse } from "next/server";
import {
  getRecordById,
  updateRecord,
  deleteRecord,
} from "@/lib/google-sheets";

// =============================================
// GET /api/sheets/[id]?tab=NOME_ABA
// =============================================
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab");

    if (!tab) {
      return NextResponse.json(
        { success: false, error: "Parametro 'tab' e obrigatorio" },
        { status: 400 }
      );
    }

    const record = await getRecordById(tab, params.id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: "Registro nao encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error("API GET [id] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}

// =============================================
// PUT /api/sheets/[id]
// Body: { tab, data }
// =============================================
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { tab, data } = body;

    if (!tab || !data) {
      return NextResponse.json(
        { success: false, error: "Campos 'tab' e 'data' sao obrigatorios" },
        { status: 400 }
      );
    }

    const record = await updateRecord(tab, params.id, data);
    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error("API PUT Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao atualizar" },
      { status: 500 }
    );
  }
}

// =============================================
// DELETE /api/sheets/[id]?tab=NOME_ABA
// =============================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab");

    if (!tab) {
      return NextResponse.json(
        { success: false, error: "Parametro 'tab' e obrigatorio" },
        { status: 400 }
      );
    }

    await deleteRecord(tab, params.id);
    return NextResponse.json({
      success: true,
      data: { message: "Registro removido com sucesso" },
    });
  } catch (error: any) {
    console.error("API DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao deletar" },
      { status: 500 }
    );
  }
}
