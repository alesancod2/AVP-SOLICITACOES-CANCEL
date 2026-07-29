import { NextRequest, NextResponse } from "next/server";
import { getLogs } from "@/lib/google-sheets";
import { verifyToken, isAdmin } from "@/lib/auth";

// GET /api/logs
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.substring(7));
  if (!user || !isAdmin(user.perfil)) {
    return NextResponse.json({ success: false, error: "Acesso negado" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "200", 10);
    const logs = await getLogs(limit);
    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
