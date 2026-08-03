import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KPIData, ProdutividadeAtendente, DailyEvolution } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/dashboard
// Uses aggregated queries instead of SELECT * + JS filtering (10-100x faster)
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

    // =============================================
    // KPIs via COUNT aggregation (no SELECT * needed)
    // =============================================
    let countQuery = admin.from("cancelamentos").select("status_atual", { count: "exact", head: true });
    if (mesReferencia) countQuery = countQuery.eq("mes_referencia", mesReferencia);
    const { count: totalCount } = await countQuery;

    const statusCounts = async (status: string) => {
      let q = admin.from("cancelamentos").select("*", { count: "exact", head: true }).eq("status_atual", status);
      if (mesReferencia) q = q.eq("mes_referencia", mesReferencia);
      const { count } = await q;
      return count || 0;
    };

    const [ativos, emNegociacao, cancelados, retidos, pendentes, inadimplentes] = await Promise.all([
      statusCounts("Ativo"),
      statusCounts("Em negociacao"),
      statusCounts("Cancelado"),
      statusCounts("Retido"),
      statusCounts("Pendente"),
      statusCounts("Inadimplente"),
    ]);

    const kpi: KPIData = {
      total: totalCount || 0,
      ativos,
      emNegociacao,
      cancelados,
      retidos,
      pendentes,
      inadimplentes,
    };

    // =============================================
    // Productivity per Atendente — only needs atendente + status_atual columns
    // =============================================
    let prodQuery = admin.from("cancelamentos").select("atendente, status_atual");
    if (mesReferencia) prodQuery = prodQuery.eq("mes_referencia", mesReferencia);
    const { data: prodRows, error: prodError } = await prodQuery;

    if (prodError) throw new Error(prodError.message);

    const atendenteMap = new Map<string, { total: number; retidos: number; cancelados: number }>();
    (prodRows || []).forEach((r) => {
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

    // =============================================
    // Daily evolution — only needs data_criacao + status_atual columns
    // Uses atualizado_em for Cancelado/Retido (when status actually changed)
    // Limited to last 30 days via date filter (reduces data transfer)
    // =============================================
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let evolQuery = admin
      .from("cancelamentos")
      .select("data_criacao, status_atual, atualizado_em")
      .gte("data_criacao", thirtyDaysAgo.toISOString());
    if (mesReferencia) evolQuery = evolQuery.eq("mes_referencia", mesReferencia);
    const { data: evolRows, error: evolError } = await evolQuery;

    if (evolError) throw new Error(evolError.message);

    const dailyMap = new Map<string, { total: number; cancelados: number; retidos: number }>();
    (evolRows || []).forEach((r) => {
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
      });

    return NextResponse.json({
      success: true,
      data: { kpi, produtividade, evolucao },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
