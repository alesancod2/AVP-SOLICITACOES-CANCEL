import { NextRequest, NextResponse } from "next/server";
import { getAllRecords, getSuspensos } from "@/lib/google-sheets";
import { verifyToken } from "@/lib/auth";

// GET /api/export?type=cancelamentos|suspensos&tab=TAB_NAME&format=csv|json
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
    const type = searchParams.get("type") || "cancelamentos";
    const tab = searchParams.get("tab") || "DB_Cancelamentos";
    const format = searchParams.get("format") || "csv";

    let data: any[] = [];

    if (type === "suspensos") {
      data = await getSuspensos();
    } else {
      data = await getAllRecords(tab);
    }

    if (format === "json") {
      return NextResponse.json({ success: true, data });
    }

    // CSV format
    if (data.length === 0) {
      return new NextResponse("Sem dados para exportar", { status: 200 });
    }

    const headers = Object.keys(data[0]).filter((k) => k !== "id");
    const csvRows = [
      headers.join(";"),
      ...data.map((row) =>
        headers.map((h) => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(";")
      ),
    ];

    const csv = csvRows.join("\n");
    const filename = `${type}_export_${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
