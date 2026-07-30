import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/suspensos/import - Import Excel/CSV data
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

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

    const admin = createAdminClient();

    // Map to database format
    const insertData = validData.map((row: any) => ({
      associado: row.associado,
      placa: row.placa,
      dt_vencimento: row.dtVencimento,
      valor_original: row.valorOriginal,
      dt_recebimento: "",
      situacao: "",
      forma_pagamento: "",
      valor_recebido: "",
      atendente: "",
      observacoes: "",
      conferencia: "",
    }));

    const { error } = await admin.from("suspensos").insert(insertData);

    if (error) {
      throw new Error(error.message);
    }

    // Log the import
    const { data: usuario } = await admin
      .from("usuarios")
      .select("nome, email, perfil")
      .eq("email", session.user.email)
      .single();

    if (usuario) {
      await admin.from("logs").insert({
        usuario: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
        acao: "Importar Suspensos",
        campo: "quantidade",
        depois: String(validData.length),
      });
    }

    return NextResponse.json({
      success: true,
      data: { imported: validData.length, total: data.length, invalid: data.length - validData.length },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
