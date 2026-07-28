import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { verifyToken, isAdmin } from "@/lib/auth";
import { User, UserPermissions } from "@/lib/types";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

async function validateAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const payload = await verifyToken(token);
  if (!payload || !isAdmin(payload.perfil)) {
    return null;
  }
  return payload;
}

// GET /api/users - List all users
export async function GET(request: NextRequest) {
  const admin = await validateAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Acesso negado" },
      { status: 403 }
    );
  }

  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Usuarios'!A2:G",
    });

    const rows = response.data.values || [];
    const users: User[] = rows.map((row, index) => {
      let permissoes: UserPermissions = { cancelamentos: true, suspensos: true, dashboard: true };
      if (row[4]) {
        try {
          permissoes = JSON.parse(row[4]);
        } catch {
          permissoes = {
            cancelamentos: (row[4] || "").includes("cancelamentos"),
            suspensos: (row[4] || "").includes("suspensos"),
            dashboard: (row[4] || "").includes("dashboard"),
          };
        }
      }
      return {
        id: String(index + 2),
        nome: row[0] || "",
        email: row[1] || "",
        perfil: (row[2] as any) || "User",
        status: (row[3] as any) || "Ativo",
        permissoes,
        dataCriacao: row[5] || "",
        ultimoAcesso: row[6] || "",
      };
    });

    return NextResponse.json({ success: true, data: users });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST /api/users - Create user
export async function POST(request: NextRequest) {
  const admin = await validateAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Acesso negado" },
      { status: 403 }
    );
  }

  try {
    const { nome, email, perfil, permissoes } = await request.json();

    if (!nome || !email) {
      return NextResponse.json(
        { success: false, error: "Nome e email sao obrigatorios" },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();

    // Check if email already exists
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Usuarios'!B2:B",
    });
    const emails = (existing.data.values || []).flat();
    if (emails.some((e) => e.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "Email ja cadastrado" },
        { status: 400 }
      );
    }

    const perms = permissoes || { cancelamentos: true, suspensos: true, dashboard: true };
    const dataCriacao = new Date().toLocaleDateString("pt-BR");

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Usuarios'!A:G",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[nome, email, perfil || "User", "Ativo", JSON.stringify(perms), dataCriacao, ""]],
      },
    });

    // Log action
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Logs'!A:I",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          new Date().toLocaleString("pt-BR"),
          admin.nome,
          admin.email,
          admin.perfil,
          "Criar Usuario",
          "",
          "email",
          "",
          email,
        ]],
      },
    });

    return NextResponse.json({ success: true, data: { message: "Usuario criado com sucesso" } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update user
export async function PUT(request: NextRequest) {
  const admin = await validateAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { success: false, error: "Acesso negado" },
      { status: 403 }
    );
  }

  try {
    const { id, status, perfil, permissoes } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID do usuario e obrigatorio" },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();
    const rowId = parseInt(id);

    // Get current data
    const current = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Usuarios'!A${rowId}:G${rowId}`,
    });
    const currentRow = current.data.values?.[0];
    if (!currentRow) {
      return NextResponse.json(
        { success: false, error: "Usuario nao encontrado" },
        { status: 404 }
      );
    }

    const updatedRow = [
      currentRow[0],
      currentRow[1],
      perfil || currentRow[2],
      status || currentRow[3],
      permissoes ? JSON.stringify(permissoes) : currentRow[4],
      currentRow[5],
      currentRow[6],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Usuarios'!A${rowId}:G${rowId}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [updatedRow] },
    });

    // Log
    const changes: string[] = [];
    if (status && status !== currentRow[3]) changes.push(`Status: ${currentRow[3]} -> ${status}`);
    if (perfil && perfil !== currentRow[2]) changes.push(`Perfil: ${currentRow[2]} -> ${perfil}`);
    if (permissoes) changes.push(`Permissoes atualizadas`);

    if (changes.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "'Logs'!A:I",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[
            new Date().toLocaleString("pt-BR"),
            admin.nome,
            admin.email,
            admin.perfil,
            "Alterar Usuario",
            currentRow[1],
            changes.join("; "),
            "",
            "",
          ]],
        },
      });
    }

    return NextResponse.json({ success: true, data: { message: "Usuario atualizado" } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
