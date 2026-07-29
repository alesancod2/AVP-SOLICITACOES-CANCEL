import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KPIData, ProdutividadeAtendente, DailyEvolution } from "@/lib/types";

// GET /api/dashboard
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const mesReferencia = searchParams.get("mes_referencia") || "";

    let query = admin.from("cancelamentos").select("*");

    if (mesReferencia) {
      query = query.eq("mes_referencia", mesReferencia);
    }

    const { data: allRecords, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const records = allRecords || [];

    // KPIs
    const kpi: KPIData = {
      total: records.length,
      ativos: records.filter((r) => r.status_atual === "Ativo").length,
      emNegociacao: records.filter((r) => r.status_atual === "Em negociacao").length,
      cancelados: records.filter((r) => r.status_atual === "Cancelado").length,
      retidos: records.filter((r) => r.status_atual === "Retido").length,
      pendentes: records.filter((r) => r.status_atual === "Pendente").length,
      inadimplentes: records.filter((r) => r.status_atual === "Inadimplente").length,
    };

    // Productivity per Atendente
    const atendenteMap = new Map<string, { total: number; retidos: number; cancelados: number }>();
    records.forEach((r) => {
      const name = r.atendente || "Sem atendente";
      if (!atendenteMap.has(name)) {
        atendenteMap.set(name, { total: 0, retidos: 0, cancelados: 0 });
      }
      const entry = atendenteMap.get(name)!;
      entry.total++;
      if (r.status_atual === "Retido") entry.retidos++;
      if (r.status_atual === "Cancelado") entry.cancelados++;
    });

    const produtividade: ProdutividadeAtendente[] = Array.from(atendenteMap.entries())
      .map(([atendente, data]) => ({
        atendente,
        total: data.total,
        retidos: data.retidos,
        cancelados: data.cancelados,
        taxaRetencao: data.total > 0 ? Math.round((data.retidos / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Daily evolution (by data_criacao)
    const dailyMap = new Map<string, { total: number; cancelados: number; retidos: number }>();
    records.forEach((r) => {
      if (!r.data_criacao) return;
      const date = new Date(r.data_criacao).toLocaleDateString("pt-BR");
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { total: 0, cancelados: 0, retidos: 0 });
      }
      const entry = dailyMap.get(date)!;
      entry.total++;
      if (r.status_atual === "Cancelado") entry.cancelados++;
      if (r.status_atual === "Retido") entry.retidos++;
    });

    const evolucao: DailyEvolution[] = Array.from(dailyMap.entries())
      .map(([data, values]) => ({ data, ...values }))
      .sort((a, b) => {
        const [da, ma, ya] = a.data.split("/").map(Number);
        const [db, mb, yb] = b.data.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      })
      .slice(-30); // Last 30 days

    return NextResponse.json({
      success: true,
      data: { kpi, produtividade, evolucao },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
