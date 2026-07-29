import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { User } from "@/lib/types";

// GET /api/auth - Get current user profile from usuarios table
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Nao autenticado" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();
    const { data: usuario, error } = await admin
      .from("usuarios")
      .select("*")
      .eq("email", session.user.email)
      .single();

    if (error || !usuario) {
      return NextResponse.json(
        { success: false, error: "Usuario nao cadastrado no sistema" },
        { status: 403 }
      );
    }

    if (usuario.status === "Inativo") {
      return NextResponse.json(
        { success: false, error: "Usuario inativo. Contate o administrador." },
        { status: 403 }
      );
    }

    // Update ultimo_acesso
    await admin
      .from("usuarios")
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq("id", usuario.id);

    // Link auth_user_id if not set
    if (!usuario.auth_user_id) {
      await admin
        .from("usuarios")
        .update({ auth_user_id: session.user.id })
        .eq("id", usuario.id);
    }

    const userProfile: User = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      status: usuario.status,
      permissoes: usuario.permissoes || { cancelamentos: true, suspensos: true, dashboard: true },
      dataCriacao: usuario.data_criacao,
      ultimoAcesso: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: userProfile });
  } catch (error: any) {
    console.error("Auth GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno de autenticacao" },
      { status: 500 }
    );
  }
}
