import { Schema, models, model } from "mongoose";

/**
 * Shipment — a forward consignment booked with a courier aggregator
 * (Shiprocket / Delhivery / client preference).
 *
 * Kept separate from Order because the relationship is genuinely one-to-many:
 * a split shipment, or a re-booking after a failed pickup, creates another
 * shipment against the same order. The order keeps the *latest* AWB
 * denormalized for display; this collection is the full record.
 *
 * `trackingEvents` is the raw scan history pulled from the courier, newest
 * last, so the customer-facing tracker and the admin view read the same data.
 */

export const SHIPMENT_STATUSES = [
  "created",
  "awb_assigned",
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "rto_initiated",
  "rto_delivered",
  "cancelled",
  "failed",
] as const;

const TrackingEventSchema = new Schema(
  {
    status: { type: String, default: "" },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ShipmentSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    /** Set instead of `order` semantics when this is a reverse pickup leg. */
    returnRequest: { type: Schema.Types.ObjectId, ref: "ReturnRequest", index: true },
    direction: { type: String, enum: ["forward", "reverse"], default: "forward" },

    provider: { type: String, default: "manual" }, // shiprocket | delhivery | manual
    courierName: { type: String, default: "" },
    /** The aggregator's own shipment id, needed for later API calls. */
    providerShipmentId: { type: String, default: "" },
    awb: { type: String, default: "", index: true },
    trackingUrl: { type: String, default: "" },
    labelUrl: { type: String, default: "" },
    manifestUrl: { type: String, default: "" },

    status: { type: String, enum: SHIPMENT_STATUSES, default: "created", index: true },
    trackingEvents: { type: [TrackingEventSchema], default: [] },

    /** Package details — these drive the courier's rate calculation. */
    weightKg: { type: Number, default: 0.5 },
    lengthCm: { type: Number, default: 0 },
    breadthCm: { type: Number, default: 0 },
    heightCm: { type: Number, default: 0 },

    shippingCharge: { type: Number, default: 0 },
    codAmount: { type: Number, default: 0 },

    pickupScheduledFor: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    expectedDeliveryAt: { type: Date },

    /** Last raw payload from the provider, kept for debugging integrations. */
    providerResponse: { type: Schema.Types.Mixed },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ShipmentSchema.index({ createdAt: -1 });

export default models.Shipment || model("Shipment", ShipmentSchema);
