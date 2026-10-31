
"use client";

import Link from "next/link";
import Script from "next/script";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useCart } from "@/lib/cart-context";
import {
  INDIAN_STATES,
  INDIAN_STATES_AND_UNION_TERRITORIES,
  INDIAN_UNION_TERRITORIES,
} from "@/lib/india-states";
import { calculateOrderCharges } from "@/lib/order-pricing";
import { isCodAvailableForAmount } from "@/lib/cod-availability";

type CheckoutForm = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingAddress2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  customerNote: string;
};

type OrderResult = {
  orderNumber: string;
  total: string;
  paymentMethod: string;
};

type PaymentMethod = "COD" | "CASHFREE";

type AppliedCoupon = {
  code: string;
  discount: string;
  subtotal: string;
  shippingFee: string;
  tax: string;
  total: string;
};

type CheckoutPricing = {
  shippingFee: string;
  taxRate: string;
  codEnabled: boolean;
  codMinimumAmount: string;
  codMaximumAmount: string;
  codFee: string;
  cashfreeEnabled: boolean;
  cashfreeConfigured: boolean;
  cashfreeMode: "sandbox" | "production";
};

function getAvailablePaymentMethod(
  settings: CheckoutPricing
): PaymentMethod | null {
  if (settings.codEnabled) return "COD";
  if (settings.cashfreeEnabled && settings.cashfreeConfigured) {
    return "CASHFREE";
  }
  return null;
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: "_self";
      }) => Promise<{ error?: { message?: string } } | undefined>;
    };
  }
}

function isAppliedCoupon(value: unknown): value is AppliedCoupon {
  if (!value || typeof value !== "object") return false;
  const coupon = value as Record<string, unknown>;
  return (
    typeof coupon.code === "string" &&
    typeof coupon.discount === "string" &&
    typeof coupon.subtotal === "string" &&
    typeof coupon.shippingFee === "string" &&
    typeof coupon.tax === "string" &&
    typeof coupon.total === "string"
  );
}

function isCheckoutPricing(value: unknown): value is CheckoutPricing {
  if (!value || typeof value !== "object") return false;
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.shippingFee === "string" &&
    typeof settings.taxRate === "string" &&
    typeof settings.codEnabled === "boolean" &&
    typeof settings.codMinimumAmount === "string" &&
    typeof settings.codMaximumAmount === "string" &&
    typeof settings.codFee === "string" &&
    typeof settings.cashfreeEnabled === "boolean" &&
    typeof settings.cashfreeConfigured === "boolean" &&
    (settings.cashfreeMode === "sandbox" ||
      settings.cashfreeMode === "production")
  );
}

type SavedDeliveryInformation = Omit<CheckoutForm, "customerNote">;

const deliveryInformationFields: (keyof SavedDeliveryInformation)[] = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "shippingAddress",
  "shippingAddress2",
  "city",
  "state",
  "postalCode",
  "country",
];

const initialForm: CheckoutForm = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  shippingAddress: "",
  shippingAddress2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  customerNote: "",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "15px",
  boxSizing: "border-box" as const,
  background: "#fff",
  color: "#111827",
};

const labelStyle = {
  display: "block",
  fontWeight: 600,
  fontSize: "14px",
  marginBottom: "7px",
  color: "#374151",
};

export default function CheckoutPage() {
 const { items, ready, subtotal, clearCart } = useCart();

  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [savingDeliveryInformation, setSavingDeliveryInformation] =
    useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryMessageIsError, setDeliveryMessageIsError] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [checkoutPricing, setCheckoutPricing] = useState<CheckoutPricing>({
    shippingFee: "0.00",
    taxRate: "0.00",
    codEnabled: true,
    codMinimumAmount: "0.00",
    codMaximumAmount: "",
    codFee: "0.00",
    cashfreeEnabled: false,
    cashfreeConfigured: false,
    cashfreeMode: "sandbox",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    "COD"
  );
  const [pendingCashfreeSession, setPendingCashfreeSession] = useState("");
  const [cashfreeScriptLoaded, setCashfreeScriptLoaded] = useState(false);
  const [cashfreeScriptError, setCashfreeScriptError] = useState("");
  const [pricingProductKey, setPricingProductKey] = useState<string | null>(
    null
  );
  const [pricingError, setPricingError] = useState("");

  const checkoutProductIds = useMemo(
    () => [...new Set(items.map(({ product }) => product.id))],
    [items]
  );
  const checkoutProductKey = checkoutProductIds.join(",");
  const pricingLoaded = pricingProductKey === checkoutProductKey;

  const subtotalCents = Math.round(Number(subtotal) * 100);
  const discountCents = appliedCoupon
    ? Math.round(Number(appliedCoupon.discount) * 100)
    : 0;
  const basePricingTotals = pricingLoaded
    ? calculateOrderCharges(
        subtotalCents,
        discountCents,
        checkoutPricing.shippingFee,
        checkoutPricing.taxRate
      )
    : null;
  const codPricingTotals = pricingLoaded
    ? calculateOrderCharges(
        subtotalCents,
        discountCents,
        checkoutPricing.shippingFee,
        checkoutPricing.taxRate,
        checkoutPricing.codFee
      )
    : null;
  const codAmountAvailable =
    checkoutPricing.codEnabled &&
    codPricingTotals !== null &&
    isCodAvailableForAmount(
      codPricingTotals.totalCents,
      Math.round(Number(checkoutPricing.codMinimumAmount) * 100),
      checkoutPricing.codMaximumAmount
        ? Math.round(Number(checkoutPricing.codMaximumAmount) * 100)
        : null
    );
  const pricingTotals =
    paymentMethod === "COD" ? codPricingTotals : basePricingTotals;

  useEffect(() => {
    if (!ready) return;

    let active = true;
    const params = new URLSearchParams();
    for (const productId of checkoutProductIds) {
      params.append("productId", productId);
    }
    fetch(`/api/checkout/pricing?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !isCheckoutPricing(data.settings)) {
          throw new Error(data.message || "Unable to load shipping and tax.");
        }
        if (active) {
          setCheckoutPricing(data.settings);
          setPaymentMethod(getAvailablePaymentMethod(data.settings));
          setPricingProductKey(checkoutProductKey);
          setPricingError("");
        }
      })
      .catch((loadError: unknown) => {
        console.error("Load checkout pricing error:", loadError);
        if (active) {
          setPricingProductKey(null);
          setPricingError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load shipping and tax."
          );
        }
      });
    return () => {
      active = false;
    };
  }, [checkoutProductIds, checkoutProductKey, ready]);

  const cashfreeAvailable =
    checkoutPricing.cashfreeEnabled && checkoutPricing.cashfreeConfigured;
  const availablePaymentMethods: PaymentMethod[] = [
    ...(codAmountAvailable ? ["COD" as const] : []),
    ...(cashfreeAvailable ? ["CASHFREE" as const] : []),
  ];
  const selectedPaymentAvailable =
    paymentMethod !== null && availablePaymentMethods.includes(paymentMethod);
  const cashfreeCheckoutReady =
    paymentMethod !== "CASHFREE" || cashfreeScriptLoaded;

  async function launchCashfreePayment(paymentSessionId: string) {
    if (!window.Cashfree) {
      throw new Error(
        "Cashfree checkout could not load. Refresh the page and try again."
      );
    }
    const cashfree = window.Cashfree({
      mode: checkoutPricing.cashfreeMode,
    });
    const checkoutResult = await cashfree.checkout({
      paymentSessionId,
      redirectTarget: "_self",
    });
    if (checkoutResult?.error) {
      throw new Error(
        checkoutResult.error.message || "Cashfree checkout could not be opened."
      );
    }
  }

  useEffect(() => {
    async function loadSavedDeliveryInformation() {
      try {
        const response = await fetch("/api/account/delivery-information", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          if (response.status !== 401) {
            setAccountError(
              data.message || "Unable to check your account for saved delivery information."
            );
            console.error(
              "Load saved delivery information error:",
              data.message
            );
          }
          return;
        }

        setSignedIn(true);
        if (data.deliveryInformation) {
          const saved = data.deliveryInformation as SavedDeliveryInformation;
          setForm((current) => ({
            ...current,
            ...Object.fromEntries(
              deliveryInformationFields.map((field) => [
                field,
                field === "country"
                  ? saved[field] || current[field] || "India"
                  : current[field] || saved[field] || "",
              ])
            ),
          }));
        }
      } catch (loadError) {
        console.error("Load saved delivery information error:", loadError);
        setAccountError(
          "Unable to check your account for saved delivery information."
        );
      } finally {
        setCheckingAccount(false);
      }
    }

    loadSavedDeliveryInformation();
  }, []);

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setDeliveryMessage("");
  }

  async function handleSaveDeliveryInformation() {
    setSavingDeliveryInformation(true);
    setDeliveryMessage("");

    try {
      const response = await fetch("/api/account/delivery-information", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          Object.fromEntries(
            deliveryInformationFields.map((field) => [field, form[field]])
          )
        ),
      });
      const data = await response.json();

      if (response.status === 401) {
        setSignedIn(false);
        throw new Error("Log in to save delivery information to your account.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save delivery information.");
      }

      setDeliveryMessage(data.message);
      setDeliveryMessageIsError(false);
    } catch (saveError) {
      setDeliveryMessage(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save delivery information."
      );
      setDeliveryMessageIsError(true);
    } finally {
      setSavingDeliveryInformation(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (
      appliedCoupon &&
      Math.round(Number(appliedCoupon.subtotal) * 100) !==
        Math.round(Number(subtotal) * 100)
    ) {
      setCouponError(
        "Your cart changed. Apply the coupon again before placing the order."
      );
      setAppliedCoupon(null);
      return;
    }

    if (!ready) {
      return;
    }

    if (!pricingLoaded) {
      setError(pricingError || "Checkout pricing is still loading. Please try again.");
      return;
    }

    if (!paymentMethod || !availablePaymentMethods.includes(paymentMethod)) {
      setError(
        paymentMethod === "COD"
          ? "Cash on Delivery is currently unavailable. Please choose online payment."
          : paymentMethod === "CASHFREE"
            ? "Cashfree Payments is unavailable. Please choose an available payment method."
            : "No payment methods are currently available. Please contact support."
      );
      return;
    }
    if (paymentMethod === "CASHFREE" && !cashfreeScriptLoaded) {
      setError(
        cashfreeScriptError ||
          "Cashfree checkout is still loading. Please try again in a moment."
      );
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty. Add a product before checking out.");
      return;
    }

    if (paymentMethod === "CASHFREE" && pendingCashfreeSession) {
      setSubmitting(true);
      try {
        await launchCashfreePayment(pendingCashfreeSession);
      } catch (paymentError) {
        setError(
          paymentError instanceof Error
            ? paymentError.message
            : "Unable to open Cashfree checkout."
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          paymentMethod,
          ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
          items: items.map(({ product, quantity, artwork }) => ({
            productId: product.id,
            quantity,
            ...(product.selectedColor
              ? { selectedColor: product.selectedColor }
              : {}),
            ...(product.selectedSize
              ? { selectedSize: product.selectedSize }
              : {}),
            ...(artwork ? { artworkId: artwork.id } : {}),
          })),
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        setError("Please log in before placing your order.");
        return;
      }

      if (!response.ok || !data.success) {
        setError(data.message || "Unable to place your order. Please try again.");
        if (response.status === 409 || data.message?.includes("Cash on Delivery")) {
          const params = new URLSearchParams();
          for (const productId of checkoutProductIds) {
            params.append("productId", productId);
          }
          fetch(`/api/checkout/pricing?${params.toString()}`, { cache: "no-store" })
            .then(async (res) => {
              const pricingData = await res.json();
              if (res.ok && pricingData.success && isCheckoutPricing(pricingData.settings)) {
                setCheckoutPricing(pricingData.settings);
                setPaymentMethod(getAvailablePaymentMethod(pricingData.settings));
              }
            })
            .catch(() => {});
        }
        return;
      }

      if (paymentMethod === "CASHFREE") {
        const paymentSessionId = data.order?.paymentSessionId;
        if (typeof paymentSessionId !== "string" || !paymentSessionId) {
          throw new Error("The server did not return a Cashfree payment session.");
        }
        setPendingCashfreeSession(paymentSessionId);
        await launchCashfreePayment(paymentSessionId);
        return;
      }

      setOrder({
        orderNumber: data.order.orderNumber,
        total: data.order.total,
        paymentMethod: data.order.paymentMethod,
      });

      clearCart();
    } catch (submitError) {
      console.error("Checkout submission error:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to connect to the server. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError("Enter a coupon code.");
      setAppliedCoupon(null);
      return;
    }
    setApplyingCoupon(true);
    setCouponError("");
    setAppliedCoupon(null);
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          items: items.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to apply coupon.");
      }
      if (!isAppliedCoupon(data.coupon)) {
        throw new Error("The server returned an invalid coupon response.");
      }
      setAppliedCoupon(data.coupon);
      setCouponCode(data.coupon.code);
    } catch (applyError) {
      setCouponError(
        applyError instanceof Error
          ? applyError.message
          : "Unable to apply coupon."
      );
    } finally {
      setApplyingCoupon(false);
    }
  }

  if (!ready) {
    return (
      <main style={pageStyle}>
        <section style={successStyle}>
          <p style={{ color: "#6b7280", lineHeight: 1.7 }}>
            Loading your cart...
          </p>
        </section>
      </main>
    );
  }

  if (order) {
    return (
      <main style={pageStyle}>
        <section style={successStyle}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>✓</div>
          <h1 style={{ fontSize: "30px", margin: "0 0 12px" }}>
            Order placed successfully!
          </h1>
          <p style={{ color: "#4b5563", lineHeight: 1.7 }}>
            Your order has been submitted to PrintHub.
          </p>

          <div style={orderBoxStyle}>
            <p style={{ margin: "0 0 8px", color: "#6b7280" }}>
              Order Number
            </p>
            <strong style={{ fontSize: "20px" }}>{order.orderNumber}</strong>
            <p style={{ margin: "16px 0 0" }}>
              Total: <strong>₹{Number(order.total).toFixed(2)}</strong>
            </p>
            <p style={{ marginBottom: 0, color: "#92400e" }}>
              Payment:{" "}
              {order.paymentMethod === "COD"
                ? "Cash on Delivery (COD)"
                : "Cashfree Payments"}
            </p>
          </div>

          <Link href="/" style={primaryLinkStyle}>
            Browse more products
          </Link>
        </section>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main style={pageStyle}>
        <section style={successStyle}>
          <h1 style={{ fontSize: "28px" }}>Your cart is empty</h1>
          <p style={{ color: "#6b7280" }}>
            Add a product to your cart before checking out.
          </p>
          <Link href="/" style={primaryLinkStyle}>
            Browse products
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      {cashfreeAvailable && (
        <Script
          src="https://sdk.cashfree.com/js/v3/cashfree.js"
          strategy="afterInteractive"
          onReady={() => setCashfreeScriptLoaded(true)}
          onError={() => {
            setCashfreeScriptError(
              "Cashfree checkout could not load. Check your connection and try again."
            );
          }}
        />
      )}
      <div style={containerStyle}>
        <header style={{ marginBottom: "28px" }}>
          <Link href="/cart" style={{ color: "#4f46e5" }}>
            ← Back to cart
          </Link>
          <h1 style={{ fontSize: "34px", margin: "14px 0 8px" }}>
            Checkout
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Enter your contact information and delivery address.
          </p>
        </header>

        <div className="checkout-layout">
          <form onSubmit={handleSubmit} style={formCardStyle}>
            <h2 style={sectionTitleStyle}>Delivery information</h2>

            <div style={fieldStyle}>
              <label htmlFor="customerName" style={labelStyle}>
                Full name *
              </label>
              <input
                id="customerName"
                name="customerName"
                autoComplete="name"
                value={form.customerName}
                onChange={handleChange}
                required
                maxLength={120}
                style={inputStyle}
                placeholder="Your name"
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="customerEmail" style={labelStyle}>
                Email *
              </label>
              <input
                id="customerEmail"
                name="customerEmail"
                type="email"
                autoComplete="email"
                value={form.customerEmail}
                onChange={handleChange}
                required
                maxLength={254}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="customerPhone" style={labelStyle}>
                Phone number *
              </label>
              <input
                id="customerPhone"
                name="customerPhone"
                type="tel"
                autoComplete="tel"
                value={form.customerPhone}
                onChange={handleChange}
                required
                maxLength={30}
                style={inputStyle}
                placeholder="Your phone number"
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="shippingAddress" style={labelStyle}>
                Address *
              </label>
              <textarea
                id="shippingAddress"
                name="shippingAddress"
                autoComplete="street-address"
                value={form.shippingAddress}
                onChange={handleChange}
                required
                maxLength={500}
                rows={3}
                style={inputStyle}
                placeholder="House number, street, area"
              />
            </div>

            <div style={fieldStyle}>
              <label htmlFor="shippingAddress2" style={labelStyle}>
                Address line 2
              </label>
              <input
                id="shippingAddress2"
                name="shippingAddress2"
                value={form.shippingAddress2}
                onChange={handleChange}
                maxLength={250}
                style={inputStyle}
                placeholder="Apartment, landmark (optional)"
              />
            </div>

            <div style={twoColumnStyle}>
              <div style={fieldStyle}>
                <label htmlFor="city" style={labelStyle}>
                  City *
                </label>
                <input
                  id="city"
                  name="city"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={handleChange}
                  required
                  maxLength={100}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="state" style={labelStyle}>
                  State / UT
                </label>
                <select
                  id="state"
                  name="state"
                  autoComplete="address-level1"
                  value={form.state}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option value="">Select state or UT</option>
                  {form.state &&
                    !INDIAN_STATES_AND_UNION_TERRITORIES.includes(
                      form.state
                    ) && <option value={form.state}>{form.state}</option>}
                  <optgroup label="States">
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Union territories">
                    {INDIAN_UNION_TERRITORIES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div style={twoColumnStyle}>
              <div style={fieldStyle}>
                <label htmlFor="postalCode" style={labelStyle}>
                  Postal / ZIP Code *
                </label>
                <input
                  id="postalCode"
                  name="postalCode"
                  autoComplete="postal-code"
                  value={form.postalCode}
                  onChange={handleChange}
                  required
                  maxLength={20}
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="country" style={labelStyle}>
                  Country *
                </label>
                <input
                  id="country"
                  name="country"
                  autoComplete="country-name"
                  value={form.country}
                  onChange={handleChange}
                  required
                  maxLength={100}
                  style={inputStyle}
                  placeholder="India"
                />
              </div>
            </div>

            <div style={fieldStyle}>
              <label htmlFor="customerNote" style={labelStyle}>
                Order notes
              </label>
              <textarea
                id="customerNote"
                name="customerNote"
                value={form.customerNote}
                onChange={handleChange}
                maxLength={1000}
                rows={3}
                style={inputStyle}
                placeholder="Special instructions (optional)"
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <button
                type="button"
                onClick={handleSaveDeliveryInformation}
                disabled={checkingAccount || !signedIn || savingDeliveryInformation}
                style={{
                  ...secondaryButtonStyle,
                  opacity:
                    checkingAccount || !signedIn || savingDeliveryInformation
                      ? 0.65
                      : 1,
                  cursor:
                    checkingAccount || !signedIn || savingDeliveryInformation
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {savingDeliveryInformation
                  ? "Saving delivery information..."
                  : "Save delivery information"}
              </button>
              {!checkingAccount && !signedIn && !accountError && (
                <p style={{ fontSize: "12px", color: "#6b7280", margin: "8px 0 0" }}>
                  <Link href="/login?redirect=/checkout" style={{ color: "#4f46e5" }}>
                    Log in
                  </Link>{" "}
                  to save delivery information to your account.
                </p>
              )}
              {accountError && (
                <p
                  role="alert"
                  style={{ fontSize: "13px", color: "#b91c1c", margin: "8px 0 0" }}
                >
                  {accountError}
                </p>
              )}
              {deliveryMessage && (
                <p
                  role={deliveryMessageIsError ? "alert" : "status"}
                  style={{
                    fontSize: "13px",
                    color: deliveryMessageIsError ? "#b91c1c" : "#047857",
                    margin: "8px 0 0",
                  }}
                >
                  {deliveryMessage}
                </p>
              )}
            </div>

            <fieldset
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "16px",
                margin: "0 0 20px",
              }}
              disabled={
                submitting || !pricingLoaded || Boolean(pendingCashfreeSession)
              }
            >
              <legend style={{ padding: "0 6px", fontWeight: 700 }}>
                Payment method
              </legend>
              {codAmountAvailable ? (
                <label
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    padding: "10px 0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === "COD"}
                    onChange={() => setPaymentMethod("COD")}
                  />
                  <span>
                    Cash on Delivery
                    {Number(checkoutPricing.codFee) > 0
                      ? ` (₹${Number(checkoutPricing.codFee).toFixed(2)} fee)`
                      : ""}
                  </span>
                </label>
              ) : pricingLoaded && checkoutPricing.codEnabled ? (
                <div
                  role="status"
                  style={{
                    margin: "6px 0 12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  <strong>Notice: </strong>
                  This total is outside the Cash on Delivery amount limits.
                  Please choose online payment.
                </div>
              ) : !checkoutPricing.codEnabled ? (
                <div
                  role="status"
                  style={{
                    margin: "6px 0 12px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    fontSize: "14px",
                    lineHeight: "1.4",
                  }}
                >
                  <strong>Notice: </strong>
                  Cash on Delivery is disabled for the store or one or more
                  products in your cart. Please choose online payment.
                </div>
              ) : (
                <p role="status">Checking Cash on Delivery availability…</p>
              )}
              {cashfreeAvailable && (
                <label
                  style={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                    padding: "10px 0",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASHFREE"
                    checked={paymentMethod === "CASHFREE"}
                    onChange={() => setPaymentMethod("CASHFREE")}
                  />
                  <span>Pay online with Cashfree</span>
                </label>
              )}
              {!codAmountAvailable && pricingLoaded && !cashfreeAvailable && (
                <p role="alert" style={{ color: "#b91c1c", margin: "8px 0 0" }}>
                  No payment methods are currently available. Please contact
                  support.
                </p>
              )}
              {checkoutPricing.cashfreeEnabled &&
                !checkoutPricing.cashfreeConfigured && (
                  <p
                    role="status"
                    style={{ color: "#92400e", margin: "8px 0 0" }}
                  >
                    Cashfree is enabled by the store but is not configured yet.
                  </p>
                )}
              {cashfreeAvailable &&
              paymentMethod === "CASHFREE" &&
              cashfreeScriptError ? (
                <p role="alert" style={{ color: "#b91c1c", margin: "8px 0 0" }}>
                  {cashfreeScriptError}
                </p>
              ) : (
                cashfreeAvailable &&
                paymentMethod === "CASHFREE" &&
                !cashfreeScriptLoaded && (
                  <p style={{ color: "#6b7280", margin: "8px 0 0" }}>
                    Loading secure Cashfree checkout…
                  </p>
                )
              )}
            </fieldset>

            {error && (
              <div
                role="alert"
                style={{
                  padding: "13px",
                  marginBottom: "16px",
                  borderRadius: "8px",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  lineHeight: 1.6,
                }}
              >
                {error}
                {error.includes("log in") && (
                  <>
                    {" "}
                    <Link
                      href="/login?redirect=/checkout"
                      style={{ fontWeight: 700, textDecoration: "underline" }}
                    >
                      Log in
                    </Link>
                  </>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                !pricingLoaded ||
                !selectedPaymentAvailable ||
                !cashfreeCheckoutReady
              }
              style={{
                ...primaryButtonStyle,
                opacity:
                  submitting ||
                  !pricingLoaded ||
                  !selectedPaymentAvailable ||
                  !cashfreeCheckoutReady
                    ? 0.65
                    : 1,
                cursor:
                  submitting ||
                  !pricingLoaded ||
                  !selectedPaymentAvailable ||
                  !cashfreeCheckoutReady
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {submitting
                ? paymentMethod === "CASHFREE"
                  ? "Opening Cashfree checkout..."
                  : "Placing order..."
                : !pricingLoaded
                  ? "Loading checkout charges..."
                  : !selectedPaymentAvailable
                    ? "No payment method available"
                    : !cashfreeCheckoutReady
                      ? "Loading Cashfree checkout..."
                      : paymentMethod === "CASHFREE"
                        ? "Continue to Cashfree"
                        : "Place order"}
            </button>

            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                lineHeight: 1.6,
                marginTop: "12px",
              }}
            >
              You must be logged in to place an order. Available payment
              methods are controlled by the store.
            </p>
          </form>

          <aside style={summaryCardStyle}>
            <h2 style={sectionTitleStyle}>Your order</h2>

            <div className="checkout-coupon">
              <label htmlFor="checkout-coupon-code">Discount code</label>
              <div>
                <input
                  id="checkout-coupon-code"
                  value={couponCode}
                  onChange={(event) => {
                    setCouponCode(event.target.value.toUpperCase());
                    setAppliedCoupon(null);
                    setCouponError("");
                  }}
                  placeholder="Enter code"
                  maxLength={32}
                  disabled={applyingCoupon || submitting}
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={applyingCoupon || submitting || items.length === 0}
                >
                  {applyingCoupon
                    ? "Checking..."
                    : appliedCoupon
                      ? "Applied"
                      : "Apply"}
                </button>
              </div>
              {couponError && (
                <p className="checkout-coupon-error" role="alert">
                  {couponError}
                </p>
              )}
              {appliedCoupon && (
                <p className="checkout-coupon-success" role="status">
                  {appliedCoupon.code} applied — you save ₹
                  {Number(appliedCoupon.discount).toFixed(2)}.
                </p>
              )}
            </div>

            {items.map(({ product, quantity }) => {
              const unitPrice = Number(
                product.discountPrice ?? product.price
              );

              return (
                <div key={product.id} style={summaryItemStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 5px", fontWeight: 600 }}>
                      {product.name}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#6b7280",
                      }}
                    >
                      Quantity: {quantity}
                    </p>
                  </div>
                  <strong style={{ whiteSpace: "nowrap" }}>
                    ₹{(unitPrice * quantity).toFixed(2)}
                  </strong>
                </div>
              );
            })}

            <div style={totalRowStyle}>
              <span>Subtotal</span>
              <strong>₹{Number(subtotal).toFixed(2)}</strong>
            </div>

            {appliedCoupon && (
              <div style={totalRowStyle} className="checkout-coupon-total">
                <span>Discount ({appliedCoupon.code})</span>
                <strong>−₹{Number(appliedCoupon.discount).toFixed(2)}</strong>
              </div>
            )}

            <div style={totalRowStyle}>
              <span>Shipping</span>
              <span>
                {pricingTotals
                  ? `₹${(pricingTotals.shippingFeeCents / 100).toFixed(2)}`
                  : "Loading..."}
              </span>
            </div>

            {paymentMethod === "COD" && Number(checkoutPricing.codFee) > 0 && (
              <div style={totalRowStyle}>
                <span>Cash on Delivery fee</span>
                <span>₹{Number(checkoutPricing.codFee).toFixed(2)}</span>
              </div>
            )}

            <div style={totalRowStyle}>
              <span>Tax ({Number(checkoutPricing.taxRate).toFixed(2)}%)</span>
              <span>
                {pricingTotals
                  ? `₹${(pricingTotals.taxCents / 100).toFixed(2)}`
                  : "Loading..."}
              </span>
            </div>

            {pricingError && (
              <p className="checkout-pricing-error" role="alert">
                {pricingError}
              </p>
            )}

            <div style={grandTotalStyle}>
              <span>Total</span>
              <strong>
                {pricingTotals
                  ? `₹${(pricingTotals.totalCents / 100).toFixed(2)}`
                  : "Loading..."}
              </strong>
            </div>

            <p style={{ color: "#6b7280", fontSize: "12px", lineHeight: 1.6 }}>
              Prices will be verified on the server. The final order total may
              differ from the cart if product prices have changed.
            </p>

            <Link
              href="/cart"
              style={{
                color: "#4f46e5",
                display: "inline-block",
                marginTop: "8px",
              }}
            >
              Edit cart
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f9fafb",
  padding: "36px 20px",
  color: "#111827",
};

const containerStyle = {
  maxWidth: "1120px",
  margin: "0 auto",
};

const formCardStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "24px",
  minWidth: 0,
};

const summaryCardStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "14px",
  padding: "24px",
  minWidth: 0,
};

const successStyle = {
  maxWidth: "560px",
  margin: "40px auto",
  padding: "32px 24px",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  textAlign: "center" as const,
};

const orderBoxStyle = {
  margin: "24px 0",
  padding: "20px",
  borderRadius: "12px",
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  lineHeight: 1.7,
};

const sectionTitleStyle = {
  fontSize: "21px",
  margin: "0 0 22px",
};

const fieldStyle = {
  marginBottom: "18px",
  minWidth: 0,
};

const twoColumnStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
};

const summaryItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  padding: "14px 0",
  borderBottom: "1px solid #e5e7eb",
  fontSize: "14px",
};

const totalRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 0",
  fontSize: "14px",
};

const grandTotalStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "18px 0 8px",
  marginTop: "8px",
  borderTop: "1px solid #d1d5db",
  fontSize: "18px",
};

const primaryButtonStyle = {
  width: "100%",
  padding: "14px 18px",
  background: "#4f46e5",
  color: "#fff",
  border: "none",
  borderRadius: "9px",
  fontSize: "16px",
  fontWeight: 700,
};

const secondaryButtonStyle = {
  padding: "11px 15px",
  border: "1px solid #c7d2fe",
  borderRadius: "8px",
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: "14px",
  fontWeight: 700,
};

const primaryLinkStyle = {
  display: "inline-block",
  padding: "12px 20px",
  background: "#4f46e5",
  color: "#fff",
  borderRadius: "9px",
  textDecoration: "none",
  fontWeight: 600,
};
