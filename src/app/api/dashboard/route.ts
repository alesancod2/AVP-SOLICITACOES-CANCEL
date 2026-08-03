import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/api-auth";
import { KPIData, ProdutividadeAtendente, DailyEvolution } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/dashboard
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest({ requiredPermission: "dashboard" });
    if (authError) return authError;

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

    // Daily evolution - usa atualizado_em para refletir quando o status MUDOU
    // Se atualizado_em nao existe, fallback para data_criacao
    const dailyMap = new Map<string, { total: number; cancelados: number; retidos: number }>();
    records.forEach((r) => {
      // Para status finais (Cancelado/Retido), usar data da ultima atualizacao
      // Para outros, usar data de criacao (entrada no sistema)
      let dateRef: string | null = null;
      if ((r.status_atual === "Cancelado" || r.status_atual === "Retido") && r.atualizado_em) {
        try {
          dateRef = new Date(r.atualizado_em).toLocaleDateString("pt-BR");
        } catch {
          dateRef = null;
        }
      }
      if (!dateRef && r.data_criacao) {
        try {
          dateRef = new Date(r.data_criacao).toLocaleDateString("pt-BR");
        } catch {
          dateRef = null;
        }
      }
      if (!dateRef) return;

      if (!dailyMap.has(dateRef)) {
        dailyMap.set(dateRef, { total: 0, cancelados: 0, retidos: 0 });
      }
      const entry = dailyMap.get(dateRef)!;
      entry.total++;
      if (r.status_atual === "Cancelado") entry.cancelados++;
      if (r.status_atual === "Retido") entry.retidos++;
    });

    const evolucao: DailyEvolution[] = Array.from(dailyMap.entries())
      .map(([data, values]) => ({ data, ...values }))
      .sort((a, b) => {
        const partsA = a.data.split("/").map(Number);
        const partsB = b.data.split("/").map(Number);
        // Parsing defensivo: verifica se o split gerou 3 partes validas
        if (partsA.length !== 3 || partsB.length !== 3) return 0;
        const [da, ma, ya] = partsA;
        const [db, mb, yb] = partsB;
        if (isNaN(da) || isNaN(ma) || isNaN(ya) || isNaN(db) || isNaN(mb) || isNaN(yb)) return 0;
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
