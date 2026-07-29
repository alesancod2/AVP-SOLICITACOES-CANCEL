import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/sync-aeasy - Dispara GitHub Actions workflow manualmente
export async function POST(request: NextRequest) {
  try {
    // Validar sessao
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    // Validar admin
    const admin = createAdminClient();
    const { data: usuario } = await admin
      .from("usuarios")
      .select("perfil, nome, email")
      .eq("email", session.user.email)
      .single();

    if (!usuario || usuario.perfil !== "Admin") {
      return NextResponse.json({ success: false, error: "Apenas Admin pode sincronizar" }, { status: 403 });
    }

    // Disparar GitHub Actions workflow_dispatch
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "alesancod2";
    const REPO_NAME = process.env.GITHUB_REPO_NAME || "AVP-SOLICITACOES-CANCEL";

    if (!GITHUB_TOKEN) {
      return NextResponse.json(
        { success: false, error: "GITHUB_TOKEN nao configurado na Vercel" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/sync-aeasy.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (response.status === 204 || response.ok) {
      // Log
      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Disparar Sync AEasy (manual)",
      });

      return NextResponse.json({
        success: true,
        message: "Sincronizacao disparada com sucesso! Os dados serao atualizados em 1-2 minutos.",
      });
    } else {
      const err = await response.text();
      console.error("GitHub Actions dispatch error:", response.status, err);
      return NextResponse.json(
        { success: false, error: `GitHub API erro (${response.status}): ${err.substring(0, 100)}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Sync dispatch error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
