// =============================================
// SUPABASE EDGE FUNCTION: sync-aeasy
// Sincroniza dados de associados suspensos da API AEasy
// para a tabela "suspensos" no Supabase.
//
// Regra de negocio: valor_contribuicao = valor_original
// (o campo de contribuicao recebe exatamente o VendasValor da AEasy)
// =============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

// ---- Tipos ----

interface AeasyLoginResponse {
  mensagem: string;
  redirect: string;
  aviso: string | null;
}

interface AeasyVenda {
  VendasId: string;
  ClientesIndividuosNome: string;
  ClientesIndividuosDocumento: string;
  ClientesIndividuosContatosDdd: string;
  ClientesIndividuosContatosTelefone: string;
  VendasCarrosPlaca: string;
  VendasCarrosModelosNome: string;
  VendasCarrosMarcasNome: string;
  VendasValor: string; // "R$ 70,90" - VALOR ORIGINAL (contribuicao)
  VendasCarrosValorTotal: string; // "70.90" - valor numerico
  VendasVencimento: string; // dia do vencimento "10"
  VendasSituacao: string; // "Suspenso"
  VendasDataSuspensao: string; // "25/07/2026"
  VendasDiasAtraso: string; // "9"
  VendasQuantidadeFaturasPagas: string;
  VendasQuantidadeFaturasAtraso: string;
  VendasTipoSuspensao: string; // "Debito"
  ConsultoresNome: string;
  ConsultoresCentroCustoNome: string;
  VendasCarrosCategoriasPlanosNome: string;
  VendasFormaPagamentoEnum: string; // "1"=Boleto, "2"=Cartao
  VendasDataCadastro: string;
  VendasDataAtivacao: string;
  VendasCarrosValorFipe: string;
}

interface AeasyDataTablesResponse {
  draw: string;
  recordsTotal: string;
  recordsFiltered: string;
  data: AeasyVenda[];
}

interface SuspensoRecord {
  aeasy_venda_id: string;
  associado: string;
  documento: string;
  telefone: string;
  placa: string;
  modelo: string;
  marca: string;
  valor_original: string; // VendasValor (formatado R$)
  valor_contribuicao: string; // = valor_original (REGRA DE NEGOCIO)
  dia_vencimento: string;
  data_suspensao: string;
  dias_atraso: number;
  faturas_pagas: number;
  faturas_atraso: number;
  tipo_suspensao: string;
  consultor: string;
  sede: string;
  plano: string;
  forma_pagamento: string;
  situacao: string;
  dt_vencimento: string;
  atendente: string;
  observacoes: string;
  conferencia: string;
  sincronizado_em: string;
}

// ---- CORS Headers ----

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- Helpers ----

function parseValorBRL(valor: string): number {
  // "R$ 70,90" -> 70.90
  if (!valor) return 0;
  const clean = valor.replace(/[R$\s.]/g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function formatFormData(params: Record<string, string | string[]>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.join("&");
}

function buildDataTablesParams(start: number, length: number): string {
  // Parametros minimos obrigatorios do DataTables + filtro de suspensos
  const params: Record<string, string> = {
    "draw": "1",
    "start": String(start),
    "length": String(length),
    "columns[0][data]": "ClientesIndividuosNome",
    "columns[0][name]": "ClientesIndividuosNome",
    "columns[0][searchable]": "false",
    "columns[0][orderable]": "true",
    "columns[0][search][value]": "",
    "columns[0][search][regex]": "false",
    "order[0][column]": "0",
    "order[0][dir]": "asc",
    // Filtros: Suspensos por Debito no mes atual
    "formPesquisa[VendasSituacao][]": "2", // Suspenso
    "formPesquisa[TipoData]": "VendasDataSuspensao",
    "formPesquisa[submitFilter]": "true",
    "formPesquisa[DepartNivel]": "1",
  };

  // Adicionar datas: mes atual
  const now = new Date();
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  params["formPesquisa[DataInicial]"] = firstDay;
  params["formPesquisa[DataFinal]"] = lastDay;

  return formatFormData(params);
}

// ---- Classe principal: AEasy Client ----

class AeasyClient {
  private baseUrl: string;
  private sessionCookie: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async login(cpf: string, senha: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/conta/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        UsuariosLogin: cpf,
        UsuariosSenha: senha,
      }),
      redirect: "manual",
    });

    // Extrair PHPSESSID do Set-Cookie
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const cookie of setCookies) {
      const match = cookie.match(/PHPSESSID=([^;]+)/);
      if (match) {
        this.sessionCookie = match[1];
      }
    }

    // Fallback: tentar header raw
    if (!this.sessionCookie) {
      const rawCookie = response.headers.get("set-cookie") || "";
      const match = rawCookie.match(/PHPSESSID=([^;]+)/);
      if (match) {
        this.sessionCookie = match[1];
      }
    }

    if (!this.sessionCookie) {
      console.error("Falha ao obter PHPSESSID no login");
      return false;
    }

    const body: AeasyLoginResponse = await response.json();
    return body.mensagem?.includes("sucesso") || response.status === 200;
  }

  async fetchSuspensos(start = 0, length = 100): Promise<AeasyDataTablesResponse> {
    if (!this.sessionCookie) {
      throw new Error("Sessao nao inicializada. Faca login primeiro.");
    }

    const body = buildDataTablesParams(start, length);

    const response = await fetch(`${this.baseUrl}/vendas/listagem/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": `PHPSESSID=${this.sessionCookie}`,
        "Accept": "application/json, text/javascript, */*; q=0.01",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`AEasy retornou status ${response.status}`);
    }

    return await response.json();
  }

  async fetchAllSuspensos(): Promise<AeasyVenda[]> {
    const allRecords: AeasyVenda[] = [];
    const pageSize = 100;
    let start = 0;
    let total = 0;

    // Primeira requisicao para saber o total
    const first = await this.fetchSuspensos(0, pageSize);
    total = parseInt(first.recordsFiltered || "0", 10);
    allRecords.push(...first.data);

    console.log(`[AEasy] Total de suspensos encontrados: ${total}`);

    // Paginar o restante
    start = pageSize;
    while (start < total) {
      const page = await this.fetchSuspensos(start, pageSize);
      allRecords.push(...page.data);
      start += pageSize;

      // Rate limiting: esperar 500ms entre paginas
      await new Promise((r) => setTimeout(r, 500));
    }

    return allRecords;
  }
}

// ---- Mapeamento AEasy -> Supabase ----

function mapVendaToSuspenso(venda: AeasyVenda): SuspensoRecord {
  const valorOriginal = venda.VendasValor || "";
  const formaPgto =
    venda.VendasFormaPagamentoEnum === "1" ? "Boleto" :
    venda.VendasFormaPagamentoEnum === "2" ? "Cartao" : "";

  // Calcular proximo vencimento baseado no dia
  const diaVenc = venda.VendasVencimento || "10";
  const now = new Date();
  const proxVencimento = `${String(diaVenc).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  return {
    aeasy_venda_id: venda.VendasId,
    associado: venda.ClientesIndividuosNome || "",
    documento: venda.ClientesIndividuosDocumento || "",
    telefone: `(${venda.ClientesIndividuosContatosDdd || ""}) ${venda.ClientesIndividuosContatosTelefone || ""}`,
    placa: venda.VendasCarrosPlaca || "",
    modelo: `${venda.VendasCarrosMarcasNome || ""} ${venda.VendasCarrosModelosNome || ""}`.trim(),
    marca: venda.VendasCarrosMarcasNome || "",

    // *** REGRA DE NEGOCIO: valor_contribuicao = valor_original ***
    valor_original: valorOriginal,
    valor_contribuicao: valorOriginal, // MESMA COISA - regra explicita

    dia_vencimento: diaVenc,
    data_suspensao: venda.VendasDataSuspensao || "-",
    dias_atraso: parseInt(venda.VendasDiasAtraso || "0", 10),
    faturas_pagas: parseInt(venda.VendasQuantidadeFaturasPagas || "0", 10),
    faturas_atraso: parseInt(venda.VendasQuantidadeFaturasAtraso || "0", 10),
    tipo_suspensao: venda.VendasTipoSuspensao || "",
    consultor: venda.ConsultoresNome || "",
    sede: venda.ConsultoresCentroCustoNome || "",
    plano: venda.VendasCarrosCategoriasPlanosNome || "",
    forma_pagamento: formaPgto,
    situacao: "", // Sera preenchido pelo operador no AVP System
    dt_vencimento: proxVencimento,
    atendente: "",
    observacoes: "",
    conferencia: "",
    sincronizado_em: new Date().toISOString(),
  };
}

// ---- Handler principal ----

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validar metodo
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Metodo nao permitido. Use POST." }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Variaveis de ambiente
    const AEASY_BASE_URL = Deno.env.get("AEASY_BASE_URL") || "https://aeasy.autovaleprevencoes.org";
    const AEASY_LOGIN = Deno.env.get("AEASY_LOGIN"); // CPF
    const AEASY_PASSWORD = Deno.env.get("AEASY_PASSWORD");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!AEASY_LOGIN || !AEASY_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Credenciais AEasy nao configuradas (AEASY_LOGIN, AEASY_PASSWORD)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Credenciais Supabase nao configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-aeasy] Iniciando sincronizacao...");

    // 1. Login na AEasy
    const aeasy = new AeasyClient(AEASY_BASE_URL);
    const loginOk = await aeasy.login(AEASY_LOGIN, AEASY_PASSWORD);

    if (!loginOk) {
      return new Response(
        JSON.stringify({ error: "Falha no login AEasy. Verifique credenciais." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[sync-aeasy] Login AEasy OK");

    // 2. Buscar todos os suspensos
    const vendas = await aeasy.fetchAllSuspensos();
    console.log(`[sync-aeasy] ${vendas.length} registros obtidos da AEasy`);

    if (vendas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum suspenso encontrado no periodo", synced: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Mapear dados (aplicando regra: valor_contribuicao = valor_original)
    const records = vendas.map(mapVendaToSuspenso);

    // 4. Persistir no Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Upsert baseado no aeasy_venda_id (evita duplicatas)
    const { data, error } = await supabase
      .from("suspensos")
      .upsert(records, {
        onConflict: "aeasy_venda_id",
        ignoreDuplicates: false,
      });

    if (error) {
      console.error("[sync-aeasy] Erro Supabase:", error.message);
      return new Response(
        JSON.stringify({ error: `Erro ao gravar no Supabase: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync-aeasy] ${records.length} registros sincronizados com sucesso`);

    // 5. Registrar log
    await supabase.from("logs").insert({
      usuario: "Edge Function",
      email: "system@avp-system.com",
      perfil: "System",
      acao: "Sync AEasy Suspensos",
      campo: "quantidade",
      depois: String(records.length),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronizacao concluida`,
        synced: records.length,
        total_aeasy: vendas.length,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[sync-aeasy] Erro fatal:", err);
    return new Response(
      JSON.stringify({ error: `Erro interno: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
