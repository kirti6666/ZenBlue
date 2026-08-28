import { NextRequest, NextResponse } from "next/server";
import { getErpMappingData, replaceErpSkuMappings } from "@/lib/erp/client";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SETTINGS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const result = await getErpMappingData();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 502 });
  return NextResponse.json(result.data);
}

export async function PUT(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.SETTINGS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const mappings = Array.isArray(body?.mappings) ? body.mappings : [];
  try {
    const saved = await replaceErpSkuMappings(mappings);
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save mappings" },
      { status: 400 }
    );
  }
}
