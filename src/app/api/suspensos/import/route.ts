import { NextRequest, NextResponse } from "next/server";
import { importSuspensos, addLog } from "@/lib/google-sheets";
import { verifyToken } from "@/lib/auth";

// POST /api/suspensos/import - Import Excel/CSV data
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
    const { data } = await request.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: "Dados invalidos para importacao" },
        { status: 400 }
      );
    }

    // Validate each row has required fields
    const validData = data.filter(
      (row: any) => row.associado && row.placa && row.dtVencimento && row.valorOriginal
    );

    if (validData.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nenhum registro valido. Campos obrigatorios: Associado, Placa, Vencimento, Valor Original" },
        { status: 400 }
      );
    }

    const count = await importSuspensos(validData);

    await addLog(
      user.nome,
      user.email,
      user.perfil,
      "Importar Suspensos",
      "",
      "quantidade",
      "",
      String(count)
    );

    return NextResponse.json({
      success: true,
      data: { imported: count, total: data.length, invalid: data.length - validData.length },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
