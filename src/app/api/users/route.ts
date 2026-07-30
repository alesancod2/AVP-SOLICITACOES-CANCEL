import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { User, UserPermissions } from "@/lib/types";

export const dynamic = "force-dynamic";

async function validateAdmin(request: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("*")
    .eq("email", session.user.email)
    .single();

  if (!usuario || usuario.perfil !== "Admin") return null;
  return usuario;
}

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin(request);
  if (!adminUser) {
    return NextResponse.json(
      { success: false, error: "Acesso negado" },
      { status: 403 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("usuarios")
      .select("*")
      .order("data_criacao", { ascending: false });

    if (error) throw new Error(error.message);

    const users: User[] = (data || []).map((row) => ({
      id: row.id,
      nome: row.nome || "",
      email: row.email || "",
      perfil: row.perfil || "User",
      status: row.status || "Ativo",
      permissoes: row.permissoes || { cancelamentos: true, suspensos: true, dashboard: true },
      dataCriacao: row.data_criacao
        ? new Date(row.data_criacao).toLocaleDateString("pt-BR")
        : "",
      ultimoAcesso: row.ultimo_acesso
        ? new Date(row.ultimo_acesso).toLocaleDateString("pt-BR")
        : "",
    }));

    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/users - Create user (Supabase Auth + tabela usuarios)
export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin(request);
  if (!adminUser) {
    return NextResponse.json(
      { success: false, error: "Acesso negado" },
      { status: 403 }
    );
  }

  try {
    const { nome, email, senha, perfil, permissoes } = await request.json();

    if (!nome || !email) {
      return NextResponse.json(
        { success: false, error: "Nome e email sao obrigatorios" },
        { status: 400 }
      );
    }

    if (!senha || senha.length < 6) {
      return NextResponse.json(
        { success: false, error: "Senha obrigatoria (minimo 6 caracteres)" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check if email already exists in usuarios table
    const { data: existing } = await admin
      .from("usuarios")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Email ja cadastrado" },
        { status: 400 }
      );
    }

    // 1. Criar usuario no Supabase Auth
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: senha,
      email_confirm: true, // Auto-confirma o email
    });

    if (authError) {
      // Se o usuario ja existe no Auth mas nao na tabela
      if (authError.message.includes("already been registered")) {
        // Continuar para criar na tabela usuarios
      } else {
        return NextResponse.json(
          { success: false, error: `Erro Auth: ${authError.message}` },
          { status: 400 }
        );
      }
    }

    // 2. Criar na tabela usuarios
    const perms: UserPermissions = permissoes || { cancelamentos: true, suspensos: true, dashboard: true };

    const { error } = await admin.from("usuarios").insert({
      nome,
      email: email.toLowerCase().trim(),
      perfil: perfil || "User",
      status: "Ativo",
      permissoes: perms,
      auth_user_id: authData?.user?.id || null,
    });

    if (error) throw new Error(error.message);

    // Log action
    await admin.from("logs").insert({
      usuario: adminUser.nome,
      email: adminUser.email,
      perfil: adminUser.perfil,
      acao: "Criar Usuario",
      campo: "email",
      depois: email,
    });

    return NextResponse.json(
      { success: true, data: { message: "Usuario criado com sucesso (Auth + Sistema)" } },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update user
export async function PUT(request: NextRequest) {
  const adminUser = await validateAdmin(request);
  if (!adminUser) {
    return NextResponse.json(
      { success: false, error: "Acesso negado" },
      { status: 403 }
    );
  }

  try {
    const { id, status, perfil, permissoes } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do usuario e obrigatorio" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Get current user data
    const { data: current, error: fetchError } = await admin
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !current) {
      return NextResponse.json(
        { success: false, error: "Usuario nao encontrado" },
        { status: 404 }
      );
    }

    const updateData: Record<string, any> = {};
    const changes: string[] = [];

    if (status && status !== current.status) {
      updateData.status = status;
      changes.push(`Status: ${current.status} -> ${status}`);
    }
    if (perfil && perfil !== current.perfil) {
      updateData.perfil = perfil;
      changes.push(`Perfil: ${current.perfil} -> ${perfil}`);
    }
    if (permissoes) {
      updateData.permissoes = permissoes;
      changes.push("Permissoes atualizadas");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true, data: { message: "Nenhuma alteracao" } });
    }

    const { error } = await admin
      .from("usuarios")
      .update(updateData)
      .eq("id", id);

    if (error) throw new Error(error.message);

    // Log changes
    if (changes.length > 0) {
      await admin.from("logs").insert({
        usuario: adminUser.nome,
        email: adminUser.email,
        perfil: adminUser.perfil,
        acao: "Alterar Usuario",
        registro_id: id,
        campo: changes.join("; "),
      });
    }

    return NextResponse.json({ success: true, data: { message: "Usuario atualizado" } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
