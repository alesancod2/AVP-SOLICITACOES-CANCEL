import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

// GET /api/logs - Admin only
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest({ requireAdmin: true });
    if (authError) return authError;

    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "200", 10);

    const { data, error } = await admin
      .from("logs")
      .select("*")
      .order("data", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const logs = (data || []).map((row) => ({
      id: row.id,
      data: row.data
        ? new Date(row.data).toLocaleString("pt-BR")
        : "",
      usuario: row.usuario || "",
      email: row.email || "",
      perfil: row.perfil || "",
      acao: row.acao || "",
      registroId: row.registro_id || "",
      campo: row.campo || "",
      antes: row.antes || "",
      depois: row.depois || "",
    }));

    return NextResponse.json({ success: true, data: logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
