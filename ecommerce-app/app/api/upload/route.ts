import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import cloudinary from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/** Cloudinary keeps images and videos on separate delivery paths. */
const RESOURCE_TYPES = ["image", "video"] as const;
type ResourceType = (typeof RESOURCE_TYPES)[number];

/**
 * Returns a signed upload signature so the browser can upload directly to
 * Cloudinary (bypassing our server for the actual file bytes). The API secret
 * never leaves the server — only the signature does, and it's single-use
 * (tied to this exact timestamp + folder combination).
 *
 * The caller says whether it is sending an image or a video; the signature and
 * the returned endpoint are built for that resource type, since a signature
 * generated for one path is rejected on the other.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.PRODUCTS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on the server yet" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const requested = String((body as any).resourceType ?? "image");
  const resourceType: ResourceType = RESOURCE_TYPES.includes(requested as ResourceType)
    ? (requested as ResourceType)
    : "image";

  const timestamp = Math.round(Date.now() / 1000);
  const folder = resourceType === "video" ? "zenblue-video" : "zenblue-media";

  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET
  );

  return NextResponse.json({
    signature,
    timestamp,
    folder,
    resourceType,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
  });
}
