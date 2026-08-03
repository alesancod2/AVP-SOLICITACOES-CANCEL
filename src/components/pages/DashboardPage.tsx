"use client";

import { useState, useEffect } from "react";
import { KPIData, ProdutividadeAtendente, DailyEvolution } from "@/lib/types";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Pie, Line } from "react-chartjs-2";
import { BarChart3, TrendingUp, Users, PieChart } from "lucide-react";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
);

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [produtividade, setProdutividade] = useState<ProdutividadeAtendente[]>([]);
  const [evolucao, setEvolucao] = useState<DailyEvolution[]>([]);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        if (data.success && data.data) {
          setKpi(data.data.kpi);
          setProdutividade(data.data.produtividade);
          setEvolucao(data.data.evolucao);
        }
      } catch (e) {
        console.error("Erro dashboard:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-48 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Pie chart data
  const pieData = {
    labels: ["Retidos", "Cancelados"],
    datasets: [
      {
        data: [kpi?.retidos || 0, kpi?.cancelados || 0],
        backgroundColor: ["rgba(168, 85, 247, 0.7)", "rgba(107, 114, 128, 0.7)"],
        borderColor: ["rgb(168, 85, 247)", "rgb(107, 114, 128)"],
        borderWidth: 2,
      },
    ],
  };

  // Line chart data
  const lineData = {
    labels: evolucao.map((e) => e.data),
    datasets: [
      {
        label: "Total",
        data: evolucao.map((e) => e.total),
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4,
      },
      {
        label: "Cancelados",
        data: evolucao.map((e) => e.cancelados),
        borderColor: "rgb(107, 114, 128)",
        backgroundColor: "rgba(107, 114, 128, 0.1)",
        fill: true,
        tension: 0.4,
      },
      {
        label: "Retidos",
        data: evolucao.map((e) => e.retidos),
        borderColor: "rgb(168, 85, 247)",
        backgroundColor: "rgba(168, 85, 247, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "rgb(156, 163, 175)",
          font: { size: 12 },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "rgb(107, 114, 128)", maxRotation: 45 },
        grid: { color: "rgba(55, 65, 81, 0.5)" },
      },
      y: {
        ticks: { color: "rgb(107, 114, 128)" },
        grid: { color: "rgba(55, 65, 81, 0.5)" },
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "rgb(156, 163, 175)",
          font: { size: 12 },
          padding: 20,
        },
      },
    },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-100">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Visao geral do sistema de cancelamentos</p>
      </div>

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="kpi-card">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-100">{kpi.total}</span>
          </div>
          <div className="kpi-card border-l-2 border-l-green-500">
            <span className="text-xs text-gray-500">Ativos</span>
            <span className="text-xl font-bold text-green-400">{kpi.ativos}</span>
          </div>
          <div className="kpi-card border-l-2 border-l-blue-500">
            <span className="text-xs text-gray-500">Negociacao</span>
            <span className="text-xl font-bold text-blue-400">{kpi.emNegociacao}</span>
          </div>
          <div className="kpi-card border-l-2 border-l-gray-500">
            <span className="text-xs text-gray-500">Cancelados</span>
            <span className="text-xl font-bold text-gray-400">{kpi.cancelados}</span>
          </div>
          <div className="kpi-card border-l-2 border-l-purple-500">
            <span className="text-xs text-gray-500">Retidos</span>
            <span className="text-xl font-bold text-purple-400">{kpi.retidos}</span>
          </div>
          <div className="kpi-card border-l-2 border-l-yellow-500">
            <span className="text-xs text-gray-500">Pendentes</span>
            <span className="text-xl font-bold text-yellow-400">{kpi.pendentes}</span>
          </div>
          <div className="kpi-card border-l-2 border-l-red-500">
            <span className="text-xs text-gray-500">Inadimpl.</span>
            <span className="text-xl font-bold text-red-400">{kpi.inadimplentes}</span>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-200">Retidos vs Cancelados</h3>
          </div>
          <div className="h-64">
            <Pie data={pieData} options={pieOptions} />
          </div>
        </div>

        {/* Line Chart */}
        <div className="card p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-gray-200">Evolucao Diaria</h3>
          </div>
          <div className="h-64">
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Productivity Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-200">Produtividade por Atendente</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-800/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Atendente</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Retidos</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Cancelados</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Taxa Retencao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {produtividade.map((p) => (
                <tr key={p.atendente} className="hover:bg-gray-800/20">
                  <td className="px-4 py-3 text-gray-200 font-medium">{p.atendente}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{p.total}</td>
                  <td className="px-4 py-3 text-center text-purple-400">{p.retidos}</td>
                  <td className="px-4 py-3 text-center text-gray-400">{p.cancelados}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.taxaRetencao >= 70
                        ? "bg-green-900/30 text-green-400"
                        : p.taxaRetencao >= 40
                        ? "bg-yellow-900/30 text-yellow-400"
                        : "bg-red-900/30 text-red-400"
                    }`}>
                      {p.taxaRetencao}%
                    </span>
                  </td>
                </tr>
              ))}
              {produtividade.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Sem dados de produtividade
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
