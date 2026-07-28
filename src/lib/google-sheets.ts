import { google, sheets_v4 } from "googleapis";
import { Cancelamento, Suspenso, LogEntry } from "./types";

// =============================================
// CONFIGURACAO E AUTENTICACAO
// =============================================

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// =============================================
// CACHE EM MEMORIA
// =============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// =============================================
// CANCELAMENTOS - LEITURA
// =============================================

export interface SheetTab {
  name: string;
  id: number;
}

export async function getSheetTabs(): Promise<SheetTab[]> {
  const cacheKey = "tabs";
  const cached = getCached<SheetTab[]>(cacheKey);
  if (cached) return cached;

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets.properties",
    });

    const tabs: SheetTab[] = (response.data.sheets || [])
      .map((sheet) => ({
        name: sheet.properties?.title || "",
        id: sheet.properties?.sheetId || 0,
      }))
      .filter(
        (tab) =>
          !["Usuarios", "Logs", "DB_Suspensos"].includes(tab.name)
      );

    setCache(cacheKey, tabs);
    return tabs;
  } catch (error: any) {
    console.error("Erro ao buscar abas:", error.message);
    throw new Error(`Falha ao buscar abas: ${error.message}`);
  }
}

export async function getRecords(
  sheetName: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ records: Cancelamento[]; total: number; pages: number }> {
  const cacheKey = `records_${sheetName}_${page}_${pageSize}`;
  const cached = getCached<{ records: Cancelamento[]; total: number; pages: number }>(cacheKey);
  if (cached) return cached;

  try {
    const sheets = getSheetsClient();
    const range = `'${sheetName}'!A2:J`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const rows = response.data.values || [];
    const validRows = rows.filter((row) =>
      row.some((cell) => cell && cell.toString().trim() !== "" && cell !== "-")
    );

    const total = validRows.length;
    const pages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = validRows.slice(startIndex, startIndex + pageSize);

    const records: Cancelamento[] = paginatedRows.map((row, index) => ({
      id: String(startIndex + index + 2),
      nomeDoAssociado: row[0] || "",
      placa: row[1] || "",
      valorDaParcela: row[2] || "",
      valorPago: row[3] || "",
      consultor: row[4] || "",
      motivoDoCancelamento: row[5] || "-",
      statusAtual: row[6] || "-",
      observacao: row[7] || "-",
      atendente: row[8] || "",
      dataCriacao: row[9] || "",
    }));

    const result = { records, total, pages };
    setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    throw new Error(`Falha ao buscar registros: ${error.message}`);
  }
}

export async function getAllRecords(sheetName: string): Promise<Cancelamento[]> {
  const { records } = await getRecords(sheetName, 1, 10000);
  return records;
}

export async function getRecordById(
  sheetName: string,
  rowId: string
): Promise<Cancelamento | null> {
  try {
    const sheets = getSheetsClient();
    const range = `'${sheetName}'!A${rowId}:J${rowId}`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const row = response.data.values?.[0];
    if (!row) return null;

    return {
      id: rowId,
      nomeDoAssociado: row[0] || "",
      placa: row[1] || "",
      valorDaParcela: row[2] || "",
      valorPago: row[3] || "",
      consultor: row[4] || "",
      motivoDoCancelamento: row[5] || "-",
      statusAtual: row[6] || "-",
      observacao: row[7] || "-",
      atendente: row[8] || "",
      dataCriacao: row[9] || "",
    };
  } catch (error: any) {
    throw new Error(`Falha ao buscar registro: ${error.message}`);
  }
}

// =============================================
// CANCELAMENTOS - ESCRITA
// =============================================

export async function createRecord(
  sheetName: string,
  data: Omit<Cancelamento, "id">
): Promise<Cancelamento> {
  try {
    const sheets = getSheetsClient();
    const dataCriacao = data.dataCriacao || new Date().toLocaleDateString("pt-BR");

    const values = [[
      data.nomeDoAssociado,
      data.placa,
      data.valorDaParcela,
      data.valorPago,
      data.consultor,
      data.motivoDoCancelamento || "-",
      data.statusAtual || "-",
      data.observacao || "-",
      data.atendente,
      dataCriacao,
    ]];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:J`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    const updatedRange = response.data.updates?.updatedRange || "";
    const rowMatch = updatedRange.match(/(\d+)$/);
    const newRowId = rowMatch ? rowMatch[1] : "0";

    invalidateCache(sheetName);

    return { id: newRowId, ...data, dataCriacao };
  } catch (error: any) {
    throw new Error(`Falha ao criar registro: ${error.message}`);
  }
}

export async function updateRecord(
  sheetName: string,
  rowId: string,
  data: Partial<Omit<Cancelamento, "id">>
): Promise<Cancelamento> {
  try {
    const sheets = getSheetsClient();
    const currentRecord = await getRecordById(sheetName, rowId);
    if (!currentRecord) {
      throw new Error(`Registro na linha ${rowId} nao encontrado`);
    }

    const updatedData = { ...currentRecord, ...data };
    const range = `'${sheetName}'!A${rowId}:J${rowId}`;
    const values = [[
      updatedData.nomeDoAssociado,
      updatedData.placa,
      updatedData.valorDaParcela,
      updatedData.valorPago,
      updatedData.consultor,
      updatedData.motivoDoCancelamento || "-",
      updatedData.statusAtual || "-",
      updatedData.observacao || "-",
      updatedData.atendente,
      updatedData.dataCriacao || "",
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    invalidateCache(sheetName);
    return { id: rowId, ...updatedData };
  } catch (error: any) {
    throw new Error(`Falha ao atualizar registro: ${error.message}`);
  }
}

export async function deleteRecord(sheetName: string, rowId: string): Promise<boolean> {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A${rowId}:J${rowId}`,
    });
    invalidateCache(sheetName);
    return true;
  } catch (error: any) {
    throw new Error(`Falha ao deletar registro: ${error.message}`);
  }
}

export async function searchRecords(sheetName: string, query: string): Promise<Cancelamento[]> {
  const { records } = await getRecords(sheetName, 1, 10000);
  if (!query.trim()) return records;
  const lowerQuery = query.toLowerCase();
  return records.filter(
    (r) =>
      r.nomeDoAssociado.toLowerCase().includes(lowerQuery) ||
      r.placa.toLowerCase().includes(lowerQuery) ||
      r.consultor.toLowerCase().includes(lowerQuery) ||
      r.atendente.toLowerCase().includes(lowerQuery) ||
      r.statusAtual.toLowerCase().includes(lowerQuery)
  );
}

// =============================================
// SUSPENSOS
// =============================================

export async function getSuspensos(): Promise<Suspenso[]> {
  const cacheKey = "suspensos_all";
  const cached = getCached<Suspenso[]>(cacheKey);
  if (cached) return cached;

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'DB_Suspensos'!A2:L",
    });

    const rows = response.data.values || [];
    const suspensos: Suspenso[] = rows
      .filter((row) => row.some((cell) => cell && cell.toString().trim() !== ""))
      .map((row, index) => ({
        id: String(index + 2),
        associado: row[0] || "",
        dtRecebimento: row[1] || "",
        dtVencimento: row[2] || "",
        placa: row[3] || "",
        situacao: (row[4] as any) || "",
        formaPagamento: (row[5] as any) || "",
        valorRecebido: row[6] || "",
        valorOriginal: row[7] || "",
        atendente: row[8] || "",
        observacoes: row[9] || "",
        conferencia: (row[10] as any) || "",
      }));

    setCache(cacheKey, suspensos);
    return suspensos;
  } catch (error: any) {
    throw new Error(`Falha ao buscar suspensos: ${error.message}`);
  }
}

export async function importSuspensos(
  data: Array<{ associado: string; placa: string; dtVencimento: string; valorOriginal: string }>
): Promise<number> {
  try {
    const sheets = getSheetsClient();
    const values = data.map((item) => [
      item.associado,
      "", // dtRecebimento
      item.dtVencimento,
      item.placa,
      "", // situacao
      "", // formaPagamento
      "", // valorRecebido
      item.valorOriginal,
      "", // atendente
      "", // observacoes
      "", // conferencia
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'DB_Suspensos'!A:K",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    invalidateCache("suspensos");
    return values.length;
  } catch (error: any) {
    throw new Error(`Falha ao importar: ${error.message}`);
  }
}

export async function updateSuspenso(
  rowId: string,
  data: Partial<Suspenso>
): Promise<Suspenso> {
  try {
    const sheets = getSheetsClient();

    // Get current
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'DB_Suspensos'!A${rowId}:K${rowId}`,
    });

    const row = response.data.values?.[0];
    if (!row) throw new Error("Registro nao encontrado");

    const current: Suspenso = {
      id: rowId,
      associado: row[0] || "",
      dtRecebimento: row[1] || "",
      dtVencimento: row[2] || "",
      placa: row[3] || "",
      situacao: (row[4] as any) || "",
      formaPagamento: (row[5] as any) || "",
      valorRecebido: row[6] || "",
      valorOriginal: row[7] || "",
      atendente: row[8] || "",
      observacoes: row[9] || "",
      conferencia: (row[10] as any) || "",
    };

    const updated = { ...current, ...data };
    const values = [[
      updated.associado,
      updated.dtRecebimento,
      updated.dtVencimento,
      updated.placa,
      updated.situacao,
      updated.formaPagamento,
      updated.valorRecebido,
      updated.valorOriginal,
      updated.atendente,
      updated.observacoes,
      updated.conferencia,
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'DB_Suspensos'!A${rowId}:K${rowId}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    invalidateCache("suspensos");
    return updated;
  } catch (error: any) {
    throw new Error(`Falha ao atualizar suspenso: ${error.message}`);
  }
}

// =============================================
// LOGS / AUDITORIA
// =============================================

export async function getLogs(limit: number = 200): Promise<LogEntry[]> {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Logs'!A2:I",
    });

    const rows = response.data.values || [];
    const logs: LogEntry[] = rows
      .map((row, index) => ({
        id: String(index + 2),
        data: row[0] || "",
        usuario: row[1] || "",
        email: row[2] || "",
        perfil: row[3] || "",
        acao: row[4] || "",
        registroId: row[5] || "",
        campo: row[6] || "",
        antes: row[7] || "",
        depois: row[8] || "",
      }))
      .reverse()
      .slice(0, limit);

    return logs;
  } catch (error: any) {
    throw new Error(`Falha ao buscar logs: ${error.message}`);
  }
}

export async function addLog(
  usuario: string,
  email: string,
  perfil: string,
  acao: string,
  registroId: string = "",
  campo: string = "",
  antes: string = "",
  depois: string = ""
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Logs'!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          new Date().toLocaleString("pt-BR"),
          usuario,
          email,
          perfil,
          acao,
          registroId,
          campo,
          antes,
          depois,
        ]],
      },
    });
  } catch (error: any) {
    console.error("Erro ao registrar log:", error.message);
  }
}
