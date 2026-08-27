import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { requireAuth } from "@/lib/middleware/requireAuth";

export const dynamic = "force-dynamic";

/**
 * The profile form's editable fields.
 *
 * Deliberately NOT here: email, role, permissions and wallet balance. Email is
 * the sign-in identifier and changing it has to re-verify, role and permissions
 * are back-office concerns, and the balance is derived from a ledger. Accepting
 * any of them on a customer-writable endpoint would be a privilege-escalation
 * or accounting bug waiting to happen — so the schema is strict() and a payload
 * carrying them is rejected outright rather than silently ignored.
 */
const profileSchema = z
  .object({
    firstName: z.string().trim().max(60).default(""),
    lastName: z.string().trim().max(60).default(""),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?\d[\d\s-]{7,17})?$/, "Enter a valid mobile number")
      .default(""),
    // Sent as YYYY-MM-DD by <input type="date">; "" clears it.
    dob: z
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Enter a valid date of birth")
      .default(""),
    gender: z.enum(["male", "female", "other", ""]).default(""),
    marketingOptIn: z.boolean().default(false),
  })
  .strict();

function serialize(user: any) {
  return {
    name: user.name ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    phoneVerified: !!user.phoneVerified,
    dob: user.dob ? new Date(user.dob).toISOString().slice(0, 10) : "",
    gender: user.gender ?? "",
    marketingOptIn: !!user.marketingOptIn,
  };
}

export async function GET(req: NextRequest) {
  const current = await requireAuth(req);
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const user = await User.findById(current.id).lean();
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ profile: serialize(user) });
  } catch (err) {
    console.error("Profile read error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const current = await requireAuth(req);
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const data = parsed.data;

    await connectDB();
    const user = await User.findById(current.id);
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const phone = data.phone.replace(/[\s-]/g, "");

    // A phone number is a sign-in identifier (see /api/auth/otp/verify), so it
    // has to stay unique — two accounts sharing one number would make the OTP
    // login ambiguous. Checked before writing rather than relying on the index,
    // so the customer gets a readable message instead of a 500.
    if (phone && phone !== user.phone) {
      const taken = await User.exists({ _id: { $ne: user._id }, phone });
      if (taken) {
        return NextResponse.json(
          { error: "That mobile number is already linked to another account" },
          { status: 409 }
        );
      }
      // Changing the number invalidates the previous verification.
      user.phone = phone;
      user.phoneVerified = false;
    } else if (!phone) {
      user.phone = undefined;
      user.phoneVerified = false;
    }

    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.gender = data.gender;
    user.marketingOptIn = data.marketingOptIn;
    user.dob = data.dob ? new Date(`${data.dob}T00:00:00.000Z`) : undefined;

    // `name` remains the canonical display name used across orders and emails;
    // keep it in step with the split fields, but never blank it if the customer
    // has left both of them empty.
    const combined = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
    if (combined) user.name = combined;

    await user.save();

    return NextResponse.json({ profile: serialize(user) });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
