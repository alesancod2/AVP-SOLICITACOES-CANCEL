import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createToken } from "@/lib/auth";
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

// POST /api/auth - Login
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email e obrigatorio" },
        { status: 400 }
      );
    }

    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Usuarios'!A2:G",
    });

    const rows = response.data.values || [];
    const userRow = rows.find(
      (row) => row[1]?.toLowerCase().trim() === email.toLowerCase().trim()
    );

    if (!userRow) {
      return NextResponse.json(
        { success: false, error: "Email nao cadastrado no sistema" },
        { status: 401 }
      );
    }

    const status = userRow[3] || "Ativo";
    if (status === "Inativo") {
      return NextResponse.json(
        { success: false, error: "Usuario inativo. Contate o administrador." },
        { status: 403 }
      );
    }

    // Parse permissions from column E (JSON or comma-separated)
    let permissoes: UserPermissions = { cancelamentos: true, suspensos: true, dashboard: true };
    const permStr = userRow[4] || "";
    if (permStr) {
      try {
        permissoes = JSON.parse(permStr);
      } catch {
        // Fallback: parse comma-separated
        permissoes = {
          cancelamentos: permStr.includes("cancelamentos"),
          suspensos: permStr.includes("suspensos"),
          dashboard: permStr.includes("dashboard"),
        };
      }
    }

    const user: User = {
      id: String(rows.indexOf(userRow) + 2),
      nome: userRow[0] || "",
      email: userRow[1] || "",
      perfil: (userRow[2] as any) || "User",
      status: status as any,
      permissoes,
      dataCriacao: userRow[5] || "",
      ultimoAcesso: new Date().toLocaleDateString("pt-BR"),
    };

    // Update last access
    const rowIndex = rows.indexOf(userRow) + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Usuarios'!G${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[new Date().toLocaleDateString("pt-BR")]] },
    });

    const token = await createToken(user);

    return NextResponse.json({
      success: true,
      data: { user, token },
    });
  } catch (error: any) {
    console.error("Auth Error:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno de autenticacao" },
      { status: 500 }
    );
  }
}
