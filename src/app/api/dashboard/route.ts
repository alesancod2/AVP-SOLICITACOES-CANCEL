import { NextRequest, NextResponse } from "next/server";
import { getAllRecords, getSheetTabs } from "@/lib/google-sheets";
import { verifyToken, isAdmin } from "@/lib/auth";
import { KPIData, ProdutividadeAtendente, DailyEvolution } from "@/lib/types";

// GET /api/dashboard
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Nao autorizado" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.substring(7));
  if (!user) {
    return NextResponse.json({ success: false, error: "Token invalido" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") || "";

    // Get all available tabs and merge data if no specific tab
    let allRecords: any[] = [];

    if (tab) {
      allRecords = await getAllRecords(tab);
    } else {
      const tabs = await getSheetTabs();
      for (const t of tabs) {
        const records = await getAllRecords(t.name);
        allRecords.push(...records);
      }
    }

    // KPIs
    const kpi: KPIData = {
      total: allRecords.length,
      ativos: allRecords.filter((r) => r.statusAtual === "Ativo").length,
      emNegociacao: allRecords.filter((r) => r.statusAtual === "Em negociacao").length,
      cancelados: allRecords.filter((r) => r.statusAtual === "Cancelado").length,
      retidos: allRecords.filter((r) => r.statusAtual === "Retido").length,
      pendentes: allRecords.filter((r) => r.statusAtual === "Pendente").length,
      inadimplentes: allRecords.filter((r) => r.statusAtual === "Inadimplente").length,
    };

    // Productivity per Atendente
    const atendenteMap = new Map<string, { total: number; retidos: number; cancelados: number }>();
    allRecords.forEach((r) => {
      const name = r.atendente || "Sem atendente";
      if (!atendenteMap.has(name)) {
        atendenteMap.set(name, { total: 0, retidos: 0, cancelados: 0 });
      }
      const entry = atendenteMap.get(name)!;
      entry.total++;
      if (r.statusAtual === "Retido") entry.retidos++;
      if (r.statusAtual === "Cancelado") entry.cancelados++;
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

    // Daily evolution (by dataCriacao)
    const dailyMap = new Map<string, { total: number; cancelados: number; retidos: number }>();
    allRecords.forEach((r) => {
      const date = r.dataCriacao || "Sem data";
      if (date === "Sem data") return;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { total: 0, cancelados: 0, retidos: 0 });
      }
      const entry = dailyMap.get(date)!;
      entry.total++;
      if (r.statusAtual === "Cancelado") entry.cancelados++;
      if (r.statusAtual === "Retido") entry.retidos++;
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
