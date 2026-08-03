import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// POST /api/sync-aeasy-cancelados - Dispara workflow sync-aeasy-cancelados.yml
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: usuario } = await admin
      .from("usuarios")
      .select("perfil, nome, email")
      .eq("email", session.user.email)
      .single();

    if (!usuario || usuario.perfil !== "Admin") {
      return NextResponse.json({ success: false, error: "Apenas Admin pode sincronizar" }, { status: 403 });
    }

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
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/sync-aeasy-cancelados.yml/dispatches`,
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
      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Disparar Sync AEasy Cancelados (manual)",
      });

      return NextResponse.json({
        success: true,
        message: "Sincronizacao de cancelados disparada! Aguarde 2-5 minutos para atualizar.",
      });
    } else {
      const err = await response.text();
      return NextResponse.json(
        { success: false, error: `GitHub API erro (${response.status})` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
