import mongoose, { Schema, models, model } from "mongoose";

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  title: string;
  price: number;
  quantity: number;
  image?: string;
  variant?: Map<string, string>; // e.g. { Size: "M", Color: "Red" }, empty if no variants
  /** Frozen at order time so the invoice never re-derives tax from live settings. */
  hsnCode?: string;
  gstRate?: number;
  sku?: string;
  /** Quantity already returned against this line — blocks over-returning. */
  returnedQuantity?: number;
}

export interface IShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface IOrder {
  _id: string;
  /** Null for guest checkout — `guestEmail`/`guestPhone` identify the buyer. */
  user?: mongoose.Types.ObjectId;
  isGuest: boolean;
  guestEmail?: string;
  guestPhone?: string;
  /** Short human-quotable reference, e.g. ZB-8F3K2A. */
  orderNumber: string;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  billingAddress?: IShippingAddress;
  subtotal: number;
  discount: number;
  couponCode?: string;
  /** Store credit redeemed against this order. */
  walletUsed: number;
  shippingFee: number;
  /** Total GST on the order — the per-line breakup lives on the invoice. */
  taxAmount: number;
  total: number;
  paymentMethod: "razorpay" | "cod";
  paymentStatus: "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  refundedAmount: number;
  orderStatus:
    | "placed"
    | "confirmed"
    | "processing"
    | "shipped"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "returned";
  /** Latest forward shipment, denormalized for listing and emails. */
  awb?: string;
  courierName?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  /** Staff-only, never shown to the customer. */
  internalNotes?: string;
  /** Accounting-side references and status from HisabKitab. */
  erpTransactionId?: string;
  erpInvoiceNumber?: string;
  erpDispatchId?: string;
  erpDispatchStatus?: string;
  erpSyncedAt?: Date;
  erpSyncError?: string;
  statusHistory: { status: string; note?: string; at: Date }[];
  /** Set when this order was created as a replacement for a return. */
  isReplacementFor?: mongoose.Types.ObjectId;
  /** The abandoned-cart row this order converted, for recovery attribution. */
  recoveredFromCart?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    image: { type: String },
    variant: { type: Map, of: String },
    /** Frozen at order time so the invoice never re-derives tax from live settings. */
    hsnCode: { type: String, default: "" },
    gstRate: { type: Number, default: null },
    sku: { type: String, default: "" },
    /** Quantity already returned against this line — blocks over-returning. */
    returnedQuantity: { type: Number, default: 0 },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    // Not required: guest checkout is supported per the quotation.
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    isGuest: { type: Boolean, default: false },
    guestEmail: { type: String, default: "", index: true },
    guestPhone: { type: String, default: "" },
    orderNumber: { type: String, unique: true },

    items: [OrderItemSchema],
    shippingAddress: { type: ShippingAddressSchema, required: true },
    // Defaults to the shipping address at checkout; kept separate because the
    // GST place-of-supply is determined by the ship-to state, while the
    // invoice's "billed to" block may legitimately differ.
    billingAddress: { type: ShippingAddressSchema },

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String },
    walletUsed: { type: Number, default: 0 },
    shippingFee: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    paymentMethod: { type: String, enum: ["razorpay", "cod"], required: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending",
      index: true,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    refundedAmount: { type: Number, default: 0 },

    orderStatus: {
      type: String,
      enum: [
        "placed",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
      ],
      default: "placed",
      index: true,
    },

    // Latest forward shipment, denormalized. The full record (and any earlier
    // attempts) lives in the Shipment collection.
    awb: { type: String, default: "" },
    courierName: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, default: "" },

    internalNotes: { type: String, default: "" },
    erpTransactionId: { type: String, default: "", index: true, sparse: true },
    erpInvoiceNumber: { type: String, default: "", index: true, sparse: true },
    erpDispatchId: { type: String, default: "" },
    erpDispatchStatus: { type: String, default: "" },
    erpSyncedAt: { type: Date },
    erpSyncError: { type: String, default: "" },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, required: true },
            note: { type: String, default: "" },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    isReplacementFor: { type: Schema.Types.ObjectId, ref: "ReturnRequest" },
    recoveredFromCart: { type: Schema.Types.ObjectId, ref: "AbandonedCart" },
  },
  { timestamps: true }
);

/**
 * Order numbers are generated here rather than at the call site so every
 * creation path (checkout, exchange replacement, admin manual order) gets one.
 * Format: ZB-<6 chars of the ObjectId, uppercased> — short enough to read over
 * the phone, and unique because the ObjectId already is.
 */
OrderSchema.pre("validate", function (next) {
  if (!this.orderNumber) {
    this.orderNumber = `ZB-${this._id.toString().slice(-6).toUpperCase()}`;
  }
  next();
});

OrderSchema.index({ createdAt: -1 });

export default models.Order || model<IOrder>("Order", OrderSchema);
