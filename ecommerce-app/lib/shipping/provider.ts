import type { SiteSettingsData } from "@/lib/site-settings";

/**
 * Courier aggregator abstraction.
 *
 * The quotation names Shiprocket or Delhivery "or client preference", and the
 * account is registered in the client's name during handover — so the concrete
 * provider is not known at build time. Everything above this file talks to the
 * `ShippingProvider` interface, which means switching aggregator is one new
 * implementation and a settings change, not a rewrite of the order screens.
 *
 * The `manual` provider is the default and is fully functional: staff paste an
 * AWB from the courier's own dashboard. That keeps the store shippable from day
 * one, before API onboarding is complete.
 */

export interface RateRequest {
  fromPincode: string;
  toPincode: string;
  weightKg: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
  cod: boolean;
  declaredValue: number;
}

export interface RateOption {
  courierId: string;
  courierName: string;
  rate: number;
  estimatedDays: number;
  codAvailable: boolean;
  rating?: number;
}

export interface CreateShipmentRequest {
  orderNumber: string;
  /** Reverse shipments book a pickup from the customer instead of a delivery. */
  direction: "forward" | "reverse";
  courierId?: string;
  pickupLocation: string;
  consignee: {
    name: string;
    phone: string;
    email?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: { name: string; sku: string; quantity: number; unitPrice: number; hsn?: string }[];
  weightKg: number;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  declaredValue: number;
  codAmount: number;
}

export interface CreateShipmentResult {
  ok: boolean;
  error?: string;
  providerShipmentId?: string;
  awb?: string;
  courierName?: string;
  trackingUrl?: string;
  labelUrl?: string;
  raw?: unknown;
}

export interface TrackingResult {
  ok: boolean;
  error?: string;
  status?: string;
  events?: { status: string; description: string; location: string; occurredAt: Date }[];
  deliveredAt?: Date;
  expectedDeliveryAt?: Date;
}

export interface ShippingProvider {
  readonly name: string;
  /** True when the credentials needed for live API calls are present. */
  isConfigured(): boolean;
  getRates(req: RateRequest): Promise<RateOption[]>;
  createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult>;
  track(awb: string): Promise<TrackingResult>;
  cancelShipment(awb: string): Promise<{ ok: boolean; error?: string }>;
}

/**
 * Manual provider — no API, staff enter AWBs themselves.
 *
 * Deliberately not a stub that throws: this is the supported operating mode for
 * a store that ships through a courier's web dashboard, and every screen must
 * work identically under it. Rate lookup returns the flat rate from settings so
 * the checkout still quotes a number.
 */
class ManualProvider implements ShippingProvider {
  readonly name = "manual";
  constructor(private settings: SiteSettingsData) {}

  isConfigured() {
    return true;
  }

  async getRates(req: RateRequest): Promise<RateOption[]> {
    const { commerce, shipping } = this.settings;
    const free = req.declaredValue >= commerce.freeShippingThreshold;
    return [
      {
        courierId: "manual",
        courierName: "Standard delivery",
        rate: free ? 0 : commerce.shippingFee + (req.cod ? shipping.codExtraFee : 0),
        estimatedDays: 5,
        codAvailable: shipping.codEnabled,
      },
    ];
  }

  async createShipment(): Promise<CreateShipmentResult> {
    // Nothing to call — the admin fills in the AWB after booking with the
    // courier directly. The Shipment row is still created by the route.
    return { ok: true, courierName: "" };
  }

  async track(): Promise<TrackingResult> {
    return { ok: false, error: "Live tracking requires a courier API integration" };
  }

  async cancelShipment(): Promise<{ ok: boolean; error?: string }> {
    return { ok: true };
  }
}

/**
 * Shiprocket implementation.
 *
 * Shiprocket issues a bearer token from an email/password login that expires
 * after ~10 days, so the token is cached in memory with an expiry rather than
 * re-authenticating on every call (their login endpoint is rate-limited).
 */
class ShiprocketProvider implements ShippingProvider {
  readonly name = "shiprocket";
  private token: string | null = null;
  private tokenExpiresAt = 0;

  private static BASE = "https://apiv2.shiprocket.in/v1/external";

  constructor(private settings: SiteSettingsData) {}

  isConfigured() {
    return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
  }

  private async auth(): Promise<string | null> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    if (!this.isConfigured()) return null;

    try {
      const res = await fetch(`${ShiprocketProvider.BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.SHIPROCKET_EMAIL,
          password: process.env.SHIPROCKET_PASSWORD,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.token) return null;

      this.token = data.token as string;
      // Refresh a day early rather than racing the real expiry.
      this.tokenExpiresAt = Date.now() + 9 * 864e5;
      return this.token;
    } catch (err) {
      console.error("[shiprocket] auth failed:", err);
      return null;
    }
  }

  private async call(path: string, init?: RequestInit) {
    const token = await this.auth();
    if (!token) throw new Error("Shiprocket is not configured or authentication failed");

    const res = await fetch(`${ShiprocketProvider.BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? `Shiprocket returned HTTP ${res.status}`);
    return data;
  }

  async getRates(req: RateRequest): Promise<RateOption[]> {
    try {
      const params = new URLSearchParams({
        pickup_postcode: req.fromPincode,
        delivery_postcode: req.toPincode,
        weight: String(req.weightKg),
        cod: req.cod ? "1" : "0",
        declared_value: String(req.declaredValue),
      });
      const data = await this.call(`/courier/serviceability/?${params}`);
      const couriers = data?.data?.available_courier_companies ?? [];

      return couriers.map((c: any) => ({
        courierId: String(c.courier_company_id),
        courierName: c.courier_name,
        rate: Number(c.rate ?? 0),
        estimatedDays: Number(c.estimated_delivery_days ?? 0),
        codAvailable: Number(c.cod) === 1,
        rating: Number(c.rating ?? 0),
      }));
    } catch (err) {
      console.error("[shiprocket] rate lookup failed:", err);
      return [];
    }
  }

  async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
    try {
      const endpoint =
        req.direction === "reverse" ? "/orders/create/return" : "/orders/create/adhoc";

      const created = await this.call(endpoint, {
        method: "POST",
        body: JSON.stringify({
          order_id: req.orderNumber,
          order_date: new Date().toISOString().slice(0, 10),
          pickup_location: req.pickupLocation,
          billing_customer_name: req.consignee.name,
          billing_last_name: "",
          billing_address: req.consignee.line1,
          billing_address_2: req.consignee.line2 ?? "",
          billing_city: req.consignee.city,
          billing_pincode: req.consignee.pincode,
          billing_state: req.consignee.state,
          billing_country: "India",
          billing_email: req.consignee.email ?? "",
          billing_phone: req.consignee.phone,
          shipping_is_billing: true,
          order_items: req.items.map((i) => ({
            name: i.name,
            sku: i.sku || i.name.slice(0, 40),
            units: i.quantity,
            selling_price: i.unitPrice,
            hsn: i.hsn ?? "",
          })),
          payment_method: req.codAmount > 0 ? "COD" : "Prepaid",
          sub_total: req.declaredValue,
          length: req.lengthCm,
          breadth: req.breadthCm,
          height: req.heightCm,
          weight: req.weightKg,
        }),
      });

      const shipmentId = created?.shipment_id;
      if (!shipmentId) {
        return { ok: false, error: "Shiprocket did not return a shipment id", raw: created };
      }

      // Assigning the AWB is a separate call; without it the shipment exists
      // but cannot be picked up or tracked.
      const assigned = await this.call("/courier/assign/awb", {
        method: "POST",
        body: JSON.stringify({
          shipment_id: shipmentId,
          ...(req.courierId ? { courier_id: Number(req.courierId) } : {}),
        }),
      });

      const awbData = assigned?.response?.data ?? {};
      const awb = awbData.awb_code ?? "";

      return {
        ok: Boolean(awb),
        error: awb ? undefined : "Shiprocket could not assign an AWB",
        providerShipmentId: String(shipmentId),
        awb,
        courierName: awbData.courier_name ?? "",
        trackingUrl: awb ? `https://shiprocket.co/tracking/${awb}` : "",
        raw: { created, assigned },
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async track(awb: string): Promise<TrackingResult> {
    try {
      const data = await this.call(`/courier/track/awb/${awb}`);
      const tracking = data?.tracking_data ?? {};
      const activities = tracking?.shipment_track_activities ?? [];

      return {
        ok: true,
        status: tracking?.shipment_track?.[0]?.current_status ?? "",
        events: activities.map((a: any) => ({
          status: a.status ?? "",
          description: a.activity ?? "",
          location: a.location ?? "",
          occurredAt: new Date(a.date),
        })),
        deliveredAt: tracking?.shipment_track?.[0]?.delivered_date
          ? new Date(tracking.shipment_track[0].delivered_date)
          : undefined,
        expectedDeliveryAt: tracking?.etd ? new Date(tracking.etd) : undefined,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async cancelShipment(awb: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.call("/orders/cancel/shipment/awbs", {
        method: "POST",
        body: JSON.stringify({ awbs: [awb] }),
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * Delhivery — placeholder that intentionally reports itself unconfigured.
 *
 * Delhivery issues per-client API tokens and a client-specific warehouse setup
 * during onboarding, so the request shapes cannot be finalised until the
 * client's account exists. Selecting it falls back to manual AWB entry, which
 * keeps every screen working, rather than failing shipments silently.
 */
class DelhiveryProvider implements ShippingProvider {
  readonly name = "delhivery";
  constructor(private settings: SiteSettingsData) {}

  isConfigured() {
    return Boolean(process.env.DELHIVERY_API_TOKEN);
  }
  async getRates(): Promise<RateOption[]> {
    return [];
  }
  async createShipment(): Promise<CreateShipmentResult> {
    return {
      ok: false,
      error: "Delhivery API onboarding is not complete — enter the AWB manually for now",
    };
  }
  async track(): Promise<TrackingResult> {
    return { ok: false, error: "Delhivery API onboarding is not complete" };
  }
  async cancelShipment() {
    return { ok: false, error: "Delhivery API onboarding is not complete" };
  }
}

/** Resolves the provider the admin has selected in Site Settings → Shipping. */
export function getShippingProvider(settings: SiteSettingsData): ShippingProvider {
  switch (settings.shipping.provider) {
    case "shiprocket":
      return new ShiprocketProvider(settings);
    case "delhivery":
      return new DelhiveryProvider(settings);
    default:
      return new ManualProvider(settings);
  }
}
