"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCartStore } from "@/store/useCartStore";
import { AddressForm } from "@/components/storefront/AddressForm";
import { AvailableCoupons } from "@/components/storefront/AvailableCoupons";

interface Address {
  _id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-checkout-js")) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [mounted, setMounted] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressLoading, setAddressLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("cod");

  // Commerce config from Site Settings (shipping, currency, which payment
  // methods are enabled). Falls back to sensible defaults until it loads.
  const [storeName, setStoreName] = useState("ZenBlue");
  const [commerce, setCommerce] = useState({
    currencySymbol: "₹",
    shippingFee: 49,
    freeShippingThreshold: 999,
    codEnabled: true,
    razorpayEnabled: true,
  });

  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState("");

  // Guest checkout. `isGuest` is only settled after /api/addresses answers —
  // rendering either branch before then would flash the wrong form.
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestAddress, setGuestAddress] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  // Store credit. Guests have no wallet, so this stays at zero for them.
  const [walletBalance, setWalletBalance] = useState(0);
  const [useWallet, setUseWallet] = useState(true);

  useEffect(() => setMounted(true), []);

  async function loadAddresses() {
    setAddressLoading(true);
    const res = await fetch("/api/addresses");

    // A 401 here means "not signed in", which is a supported way to check out —
    // it switches the page into guest mode rather than bouncing to /login.
    if (res.status === 401) {
      setIsGuest(true);
      setShowAddressForm(true);
      setAddressLoading(false);
      return;
    }

    setIsGuest(false);
    const data = await res.json();
    const list: Address[] = data.addresses ?? [];
    setAddresses(list);
    const defaultAddr = list.find((a) => a.isDefault) ?? list[0];
    if (defaultAddr) setSelectedAddressId(defaultAddr._id);
    setShowAddressForm(list.length === 0);
    setAddressLoading(false);

    // Only signed-in shoppers have a wallet to read.
    fetch("/api/wallet")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setWalletBalance(d.balance ?? 0))
      .catch(() => {});
  }

  useEffect(() => {
    loadAddresses();
    // Load commerce settings so shipping, currency, and payment options match admin config.
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.brand?.storeName) setStoreName(d.settings.brand.storeName);
        if (d.settings?.commerce) {
          const c = d.settings.commerce;
          setCommerce(c);
          // If COD is disabled, default the selection to Razorpay (and vice-versa).
          if (!c.codEnabled && c.razorpayEnabled) setPaymentMethod("razorpay");
          if (c.codEnabled && !c.razorpayEnabled) setPaymentMethod("cod");
        }
      })
      .catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const cur = commerce.currencySymbol;
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingFee =
    subtotal - discount >= commerce.freeShippingThreshold ? 0 : commerce.shippingFee;
  const payableBeforeCredit = Math.max(0, subtotal - discount + shippingFee);

  // Paying online needs at least ₹1 left on the gateway — a zero-rupee Razorpay
  // order is rejected — so credit can only clear a prepaid order down to ₹1.
  const creditCap =
    paymentMethod === "razorpay"
      ? Math.max(0, payableBeforeCredit - 1)
      : payableBeforeCredit;
  const walletApplied = useWallet ? Math.min(walletBalance, creditCap) : 0;
  const total = Math.max(0, payableBeforeCredit - walletApplied);

  async function handleApplyCoupon(codeArg?: string) {
    setCouponError("");
    const code = (codeArg ?? couponInput).trim();
    if (!code) return;
    setCouponInput(code); // reflect one-tap selections in the input
    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponError(data.error || "Invalid coupon");
        setDiscount(0);
        setCouponCode(null);
        return;
      }
      setDiscount(data.discount);
      setCouponCode(data.code);
    } catch {
      setCouponError("Something went wrong");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponCode(null);
    setDiscount(0);
    setCouponInput("");
    setCouponError("");
  }

  async function handlePlaceOrder() {
    setOrderError("");

    if (isGuest) {
      if (!guestEmail.trim()) {
        setOrderError("Enter an email address so we can send your order confirmation");
        return;
      }
      const required: (keyof typeof guestAddress)[] = [
        "fullName",
        "phone",
        "line1",
        "city",
        "state",
        "pincode",
      ];
      if (required.some((field) => !guestAddress[field].trim())) {
        setOrderError("Please complete every required address field");
        return;
      }
    } else if (!selectedAddressId) {
      setOrderError("Please select a shipping address");
      return;
    }

    const checkoutItems = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      variant: i.variant,
    }));

    // Lets the server close out the abandoned-cart row and attribute recovery.
    let cartToken: string | undefined;
    try {
      cartToken = localStorage.getItem("zb-cart-token") ?? undefined;
    } catch {
      cartToken = undefined;
    }

    const identityPayload = isGuest
      ? { address: guestAddress, guestEmail: guestEmail.trim() }
      : { addressId: selectedAddressId, walletAmount: walletApplied };

    if (paymentMethod === "cod") {
      setPlacing(true);
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: checkoutItems,
            ...identityPayload,
            paymentMethod: "cod",
            couponCode: couponCode ?? undefined,
            cartToken,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          setOrderError(data.error || "Failed to place order");
          setPlacing(false);
          return;
        }

        clearCart();
        router.push(`/order-success/${data.order._id}`);
      } catch {
        setOrderError("Something went wrong. Please try again.");
        setPlacing(false);
      }
      return;
    }

    // Razorpay flow
    setPlacing(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setOrderError("Failed to load the payment gateway. Please check your connection.");
        setPlacing(false);
        return;
      }

      const createRes = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: checkoutItems,
          ...identityPayload,
          cartToken,
          couponCode: couponCode ?? undefined,
        }),
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        setOrderError(createData.error || "Failed to start payment");
        setPlacing(false);
        return;
      }

      const options = {
        key: createData.keyId,
        amount: createData.amount,
        currency: createData.currency,
        name: storeName,
        description: "Order payment",
        order_id: createData.razorpayOrderId,
        prefill: createData.prefill,
        theme: { color: "#111827" },
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: createData.orderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              setOrderError(
                verifyData.error ||
                "Payment verification failed. If money was deducted, please contact support."
              );
              setPlacing(false);
              return;
            }

            clearCart();
            router.push(`/order-success/${createData.orderId}`);
          } catch {
            setOrderError(
              "Payment verification failed. If money was deducted, please contact support."
            );
            setPlacing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setPlacing(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function () {
        setOrderError("Payment failed. Please try again.");
        setPlacing(false);
      });
      rzp.open();
    } catch {
      setOrderError("Something went wrong. Please try again.");
      setPlacing(false);
    }
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-14 text-center sm:px-6 sm:py-16">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <Link href="/shop" className="text-primary underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 text-left sm:px-6 sm:py-8 md:grid-cols-5 md:gap-7">
      <div className="order-2 space-y-5 md:order-1 md:col-span-3">
        {/* Guest contact + address. Shown only when nobody is signed in. */}
        {isGuest && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
              <h2 className="font-display text-lg font-semibold text-heading">Your details</h2>
              <Link
                href="/login?callbackUrl=/checkout"
                className="text-sm text-link underline underline-offset-4"
              >
                Have an account? Sign in
              </Link>
            </div>

            <div className="space-y-2.5 rounded-xl border border-line bg-surface p-3 sm:p-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Your order confirmation, invoice and tracking link go here.
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Full name</span>
                  <input
                    required
                    value={guestAddress.fullName}
                    onChange={(e) =>
                      setGuestAddress({ ...guestAddress, fullName: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Phone</span>
                  <input
                    required
                    type="tel"
                    value={guestAddress.phone}
                    onChange={(e) => setGuestAddress({ ...guestAddress, phone: e.target.value })}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Address</span>
                <input
                  required
                  value={guestAddress.line1}
                  onChange={(e) => setGuestAddress({ ...guestAddress, line1: e.target.value })}
                  placeholder="House / flat, street"
                  className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <input
                value={guestAddress.line2}
                onChange={(e) => setGuestAddress({ ...guestAddress, line2: e.target.value })}
                placeholder="Landmark, area (optional)"
                aria-label="Address line 2"
                className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
              />

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">City</span>
                  <input
                    required
                    value={guestAddress.city}
                    onChange={(e) => setGuestAddress({ ...guestAddress, city: e.target.value })}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">State</span>
                  <input
                    required
                    value={guestAddress.state}
                    onChange={(e) => setGuestAddress({ ...guestAddress, state: e.target.value })}
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                  <span className="mt-1 block text-xs text-gray-500">
                    Sets the GST place of supply.
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Pincode</span>
                  <input
                    required
                    inputMode="numeric"
                    value={guestAddress.pincode}
                    onChange={(e) =>
                      setGuestAddress({ ...guestAddress, pincode: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {!isGuest && (
        <section>
          <h2 className="mb-3 border-b border-line pb-2 font-display text-lg font-semibold text-heading">Shipping Address</h2>

          {addressLoading ? (
            <p className="text-gray-400 text-sm">Loading addresses...</p>
          ) : (
            <div className="space-y-2">
              {addresses.map((addr) => (
                <label
                  key={addr._id}
                  className={`block cursor-pointer rounded-xl border p-3 text-sm ${selectedAddressId === addr._id ? "border-primary" : "border-line"
                    }`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={selectedAddressId === addr._id}
                    onChange={() => setSelectedAddressId(addr._id)}
                    className="mr-2"
                  />
                  <span className="font-medium">{addr.fullName}</span> — {addr.phone}
                  <br />
                  <span className="text-gray-500">
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} -{" "}
                    {addr.pincode}
                  </span>
                </label>
              ))}

              {!showAddressForm && (
                <button
                  onClick={() => setShowAddressForm(true)}
                  className="text-sm text-primary underline"
                >
                  + Add a new address
                </button>
              )}

              {showAddressForm && (
                <AddressForm
                  onSaved={() => {
                    setShowAddressForm(false);
                    loadAddresses();
                  }}
                  onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                />
              )}
            </div>
          )}
        </section>
        )}

        <section>
          <h2 className="mb-3 border-b border-line pb-2 font-display text-lg font-semibold text-heading">Payment Method</h2>
          <div className="space-y-2 text-sm">
            {commerce.codEnabled && (
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-line bg-surface"
                  }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                />
                Cash on Delivery
              </label>
            )}
            {commerce.razorpayEnabled && (
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-line bg-surface"
                  }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === "razorpay"}
                  onChange={() => setPaymentMethod("razorpay")}
                />
                Pay Online (Card / UPI / Netbanking via Razorpay)
              </label>
            )}
            {!commerce.codEnabled && !commerce.razorpayEnabled && (
              <p className="text-gray-400">No payment methods are currently available.</p>
            )}
          </div>
        </section>
      </div>

      <div className="space-y-3 md:col-span-2">
        <div className="flex items-center justify-between border-b border-line pb-2">
          <h2 className="font-display text-lg font-semibold text-heading">Order Summary</h2>
          <Link href="/cart" className="text-[11px] font-medium text-link hover:underline">Edit bag</Link>
        </div>

        <div className="space-y-2 rounded-xl border border-line bg-surface p-3 text-sm">
          {items.map((item) => (
            <div
              key={item.productId + JSON.stringify(item.variant ?? {})}
              className="flex items-start justify-between gap-3"
            >
              <span className="line-clamp-1 font-display text-[13px] text-heading">
                <span className="font-bold">{item.title}</span>{" "}
                <span className="font-normal">× {item.quantity}</span>
              </span>
              <span className="shrink-0 font-sans text-xs font-medium text-heading">{cur}{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div>
          {couponCode ? (
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-2 text-xs">
              <span>
                Coupon <strong>{couponCode}</strong> applied
              </span>
              <button onClick={removeCoupon} className="text-red-500 text-xs underline">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                placeholder="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-primary"
              />
            <button
                onClick={() => handleApplyCoupon()}
                disabled={couponLoading}
                className="h-10 rounded-lg border border-line bg-surface px-4 text-xs font-medium text-heading transition-colors hover:border-primary disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          )}
          {couponError && <p className="text-xs text-red-600 mt-1">{couponError}</p>}

          <AvailableCoupons
            subtotal={subtotal}
            appliedCode={couponCode}
            onApply={(c) => handleApplyCoupon(c)}
          />
        </div>

        <div className="space-y-1.5 rounded-xl border border-line bg-surface p-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{cur}{subtotal}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>−{cur}{discount}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{shippingFee === 0 ? "Free" : `${cur}${shippingFee}`}</span>
          </div>
          {walletApplied > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Store credit</span>
              <span>−{cur}{walletApplied.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-line pt-2 font-display text-base font-semibold text-heading">
            <span>Total</span>
            <span className="font-sans">{cur}{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Store credit — signed-in shoppers with a balance only. */}
        {walletBalance > 0 && (
          <label className="flex items-start gap-2.5 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={useWallet}
              onChange={(e) => setUseWallet(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-medium">
                Use store credit ({cur}
                {walletBalance.toFixed(2)} available)
              </span>
              <span className="block text-xs text-gray-500">
                {useWallet
                  ? `${cur}${walletApplied.toFixed(2)} applied to this order.`
                  : "Your balance will be kept for later."}
                {paymentMethod === "razorpay" &&
                  useWallet &&
                  walletBalance > walletApplied &&
                  " Paying online leaves a minimum of ₹1 on the gateway."}
              </span>
            </span>
          </label>
        )}

        {orderError && <p className="text-sm text-red-600">{orderError}</p>}

        <button
          onClick={handlePlaceOrder}
          disabled={placing || addressLoading}
          className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {placing
            ? paymentMethod === "razorpay"
              ? "Opening payment..."
              : "Placing order..."
            : paymentMethod === "razorpay"
              ? "Proceed to Pay"
              : "Place Order"}
        </button>
      </div>
    </main>
  );
}
