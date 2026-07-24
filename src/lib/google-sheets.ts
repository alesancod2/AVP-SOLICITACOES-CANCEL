import { google, sheets_v4 } from "googleapis";

// =============================================
// CONFIGURACAO E AUTENTICACAO
// =============================================

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
  return auth;
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// =============================================
// TIPOS E INTERFACES
// =============================================

export interface Associado {
  id: string; // row number as ID
  nomeDoAssociado: string;
  placa: string;
  valorDaParcela: string;
  valorPago: string;
  consultor: string;
  motivoDoCancelamento: string;
  statusAtual: string;
  observacao: string;
  atendente: string;
}

export interface SheetTab {
  name: string;
  id: number;
}

// Mapeamento de colunas da planilha
const COLUMN_MAP: Record<keyof Omit<Associado, "id">, number> = {
  nomeDoAssociado: 0,
  placa: 1,
  valorDaParcela: 2,
  valorPago: 3,
  consultor: 4,
  motivoDoCancelamento: 5,
  statusAtual: 6,
  observacao: 7,
  atendente: 8,
};

const HEADERS = [
  "NOME DO ASSOCIADO",
  "PLACA",
  "VALOR DA PARCELA",
  "VALOR PAGO",
  "CONSULTOR",
  "MOTIVO DO CANCELAMENTO",
  "STATUS ATUAL",
  "OBSERVACAO",
  "ATENDENTE",
];

// =============================================
// CACHE SIMPLES EM MEMORIA
// =============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 30000; // 30 segundos

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
// FUNCOES DE LEITURA
// =============================================

/**
 * Lista todas as abas (meses) disponíveis na planilha
 */
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

    const tabs: SheetTab[] =
      response.data.sheets?.map((sheet) => ({
        name: sheet.properties?.title || "",
        id: sheet.properties?.sheetId || 0,
      })) || [];

    setCache(cacheKey, tabs);
    return tabs;
  } catch (error: any) {
    console.error("Erro ao buscar abas:", error.message);
    throw new Error(`Falha ao buscar abas da planilha: ${error.message}`);
  }
}

/**
 * Busca todos os registros de uma aba específica (mês)
 */
export async function getRecords(
  sheetName: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ records: Associado[]; total: number; pages: number }> {
  const cacheKey = `records_${sheetName}_${page}_${pageSize}`;
  const cached = getCached<{ records: Associado[]; total: number; pages: number }>(cacheKey);
  if (cached) return cached;

  try {
    const sheets = getSheetsClient();
    const range = `'${sheetName}'!A2:I`; // Pula o header (linha 1)

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    const rows = response.data.values || [];

    // Filtrar linhas vazias
    const validRows = rows.filter((row) =>
      row.some((cell) => cell && cell.toString().trim() !== "" && cell !== "-")
    );

    const total = validRows.length;
    const pages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedRows = validRows.slice(startIndex, startIndex + pageSize);

    const records: Associado[] = paginatedRows.map((row, index) => ({
      id: String(startIndex + index + 2), // +2 porque linha 1 = header
      nomeDoAssociado: row[0] || "",
      placa: row[1] || "",
      valorDaParcela: row[2] || "",
      valorPago: row[3] || "",
      consultor: row[4] || "",
      motivoDoCancelamento: row[5] || "-",
      statusAtual: row[6] || "-",
      observacao: row[7] || "-",
      atendente: row[8] || "",
    }));

    const result = { records, total, pages };
    setCache(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error("Erro ao buscar registros:", error.message);
    throw new Error(`Falha ao buscar registros: ${error.message}`);
  }
}

/**
 * Busca um registro específico por ID (numero da linha)
 */
export async function getRecordById(
  sheetName: string,
  rowId: string
): Promise<Associado | null> {
  try {
    const sheets = getSheetsClient();
    const range = `'${sheetName}'!A${rowId}:I${rowId}`;

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
    };
  } catch (error: any) {
    console.error("Erro ao buscar registro:", error.message);
    throw new Error(`Falha ao buscar registro: ${error.message}`);
  }
}

// =============================================
// FUNCOES DE ESCRITA
// =============================================

/**
 * Cria um novo registro na próxima linha disponível
 */
export async function createRecord(
  sheetName: string,
  data: Omit<Associado, "id">
): Promise<Associado> {
  try {
    const sheets = getSheetsClient();
    const range = `'${sheetName}'!A:I`;

    const values = [
      [
        data.nomeDoAssociado,
        data.placa,
        data.valorDaParcela,
        data.valorPago,
        data.consultor,
        data.motivoDoCancelamento || "-",
        data.statusAtual || "-",
        data.observacao || "-",
        data.atendente,
      ],
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    // Extrair o número da linha do range atualizado
    const updatedRange = response.data.updates?.updatedRange || "";
    const rowMatch = updatedRange.match(/(\d+)$/);
    const newRowId = rowMatch ? rowMatch[1] : "0";

    // Invalidar cache
    invalidateCache(sheetName);

    return {
      id: newRowId,
      ...data,
    };
  } catch (error: any) {
    console.error("Erro ao criar registro:", error.message);
    throw new Error(`Falha ao criar registro: ${error.message}`);
  }
}

/**
 * Atualiza um registro existente pela linha
 */
export async function updateRecord(
  sheetName: string,
  rowId: string,
  data: Partial<Omit<Associado, "id">>
): Promise<Associado> {
  try {
    const sheets = getSheetsClient();

    // Primeiro, buscar o registro atual
    const currentRecord = await getRecordById(sheetName, rowId);
    if (!currentRecord) {
      throw new Error(`Registro na linha ${rowId} nao encontrado`);
    }

    // Mesclar dados atuais com os novos
    const updatedData = { ...currentRecord, ...data };

    const range = `'${sheetName}'!A${rowId}:I${rowId}`;
    const values = [
      [
        updatedData.nomeDoAssociado,
        updatedData.placa,
        updatedData.valorDaParcela,
        updatedData.valorPago,
        updatedData.consultor,
        updatedData.motivoDoCancelamento || "-",
        updatedData.statusAtual || "-",
        updatedData.observacao || "-",
        updatedData.atendente,
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    // Invalidar cache
    invalidateCache(sheetName);

    return { id: rowId, ...updatedData };
  } catch (error: any) {
    console.error("Erro ao atualizar registro:", error.message);
    throw new Error(`Falha ao atualizar registro: ${error.message}`);
  }
}

/**
 * Deleta um registro (limpa os dados da linha)
 */
export async function deleteRecord(
  sheetName: string,
  rowId: string
): Promise<boolean> {
  try {
    const sheets = getSheetsClient();
    const range = `'${sheetName}'!A${rowId}:I${rowId}`;

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range,
    });

    // Invalidar cache
    invalidateCache(sheetName);

    return true;
  } catch (error: any) {
    console.error("Erro ao deletar registro:", error.message);
    throw new Error(`Falha ao deletar registro: ${error.message}`);
  }
}

/**
 * Busca registros com filtro de texto
 */
export async function searchRecords(
  sheetName: string,
  query: string
): Promise<Associado[]> {
  try {
    const { records } = await getRecords(sheetName, 1, 1000);

    if (!query.trim()) return records;

    const lowerQuery = query.toLowerCase();
    return records.filter(
      (record) =>
        record.nomeDoAssociado.toLowerCase().includes(lowerQuery) ||
        record.placa.toLowerCase().includes(lowerQuery) ||
        record.consultor.toLowerCase().includes(lowerQuery) ||
        record.atendente.toLowerCase().includes(lowerQuery) ||
        record.statusAtual.toLowerCase().includes(lowerQuery)
    );
  } catch (error: any) {
    console.error("Erro na busca:", error.message);
    throw new Error(`Falha na busca: ${error.message}`);
  }
}
