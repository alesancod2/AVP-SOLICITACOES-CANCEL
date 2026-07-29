import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/logs
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Verify admin
    const { data: usuario } = await admin
      .from("usuarios")
      .select("perfil")
      .eq("email", session.user.email)
      .single();

    if (!usuario || usuario.perfil !== "Admin") {
      return NextResponse.json({ success: false, error: "Acesso negado" }, { status: 403 });
    }

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
