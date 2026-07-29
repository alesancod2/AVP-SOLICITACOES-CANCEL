import { NextRequest, NextResponse } from "next/server";
import { getSuspensos, updateSuspenso, addLog } from "@/lib/google-sheets";
import { verifyToken } from "@/lib/auth";

async function getUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return await verifyToken(authHeader.substring(7));
}

// GET /api/suspensos
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const suspensos = await getSuspensos();
    return NextResponse.json({ success: true, data: suspensos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT /api/suspensos - Update a suspenso record (conferencia, etc)
export async function PUT(request: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
  }

  try {
    const { id, ...data } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, error: "ID obrigatorio" }, { status: 400 });
    }

    const updated = await updateSuspenso(id, data);

    await addLog(user.nome, user.email, user.perfil, "Atualizar Suspenso", id, "", "", "");

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
