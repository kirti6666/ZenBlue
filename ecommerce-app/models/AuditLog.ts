import mongoose, { Schema, models, model } from "mongoose";

export type AuditAction =
  | "LOGIN"
  | "PRODUCT_CREATE"
  | "PRODUCT_UPDATE"
  | "PRODUCT_DELETE"
  | "CATEGORY_CREATE"
  | "CATEGORY_UPDATE"
  | "CATEGORY_DELETE"
  | "ORDER_STATUS_UPDATE"
  | "COUPON_CREATE"
  | "COUPON_UPDATE"
  | "COUPON_DELETE"
  | "REVIEW_MODERATE"
  | "SETTINGS_UPDATE"
  // ZenBlue additions
  | "ORDER_CANCEL"
  | "ORDER_NOTE"
  | "RETURN_UPDATE"
  | "STOCK_ADJUST"
  | "SHIPMENT_CREATE"
  | "SHIPMENT_UPDATE"
  | "CREDIT_NOTE_ISSUE"
  | "WALLET_ADJUST"
  | "CONTENT_UPDATE"
  | "FAQ_UPDATE"
  | "STAFF_CREATE"
  | "STAFF_UPDATE"
  | "STAFF_DELETE"
  | "CUSTOMER_UPDATE"
  | "PRODUCT_IMPORT"
  | "MARKETING_ACTION";

export type AuditTargetType =
  | "Product"
  | "Order"
  | "Category"
  | "Coupon"
  | "Review"
  | "User"
  | "Settings"
  | "ReturnRequest"
  | "Shipment"
  | "CreditNote"
  | "ContentPage"
  | "Faq"
  | "BlogPost"
  | "Wallet";

export interface IAuditLog {
  _id: string;
  admin: mongoose.Types.ObjectId;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: mongoose.Types.ObjectId;
  changes?: Record<string, unknown>; // e.g. { before: {...}, after: {...} }
  ipAddress?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    admin: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetType: { type: String },
    targetId: { type: Schema.Types.ObjectId },
    changes: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Descending index so the activity feed loads newest-first quickly
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ admin: 1 });

export default models.AuditLog || model<IAuditLog>("AuditLog", AuditLogSchema);
