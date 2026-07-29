import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { User, UserPermissions } from "@/lib/types";

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

// POST /api/auth - Send magic link (OTP)
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email e obrigatorio" },
        { status: 400 }
      );
    }

    // Check if user exists in our system first
    const admin = createAdminClient();
    const { data: usuario, error: dbError } = await admin
      .from("usuarios")
      .select("id, status")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (dbError || !usuario) {
      return NextResponse.json(
        { success: false, error: "Email nao cadastrado no sistema" },
        { status: 401 }
      );
    }

    if (usuario.status === "Inativo") {
      return NextResponse.json(
        { success: false, error: "Usuario inativo. Contate o administrador." },
        { status: 403 }
      );
    }

    // Send OTP via Supabase Auth
    const { error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.toLowerCase().trim(),
    });

    if (error) {
      console.error("OTP Error:", error);
      return NextResponse.json(
        { success: false, error: "Erro ao enviar link de acesso" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Link de acesso enviado para o email" },
    });
  } catch (error: any) {
    console.error("Auth POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno de autenticacao" },
      { status: 500 }
    );
  }
}
