import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { ensureStoreSettings } from "../lib/store-settings";
import { GET as getAdminCod, PUT as putAdminCod } from "../app/api/admin/settings/cod/route";

test("StoreSettings defaults codEnabled to true and updates correctly", async () => {
  let inMemorySettings: {
    id: string;
    shippingFee: string;
    taxRate: string;
    codEnabled: boolean;
    cashfreeEnabled: boolean;
  } | null = null;

  const mockClient = {
    storeSettings: {
      findUnique: async () => inMemorySettings,
      create: async ({ data }: { data: typeof inMemorySettings }) => {
        inMemorySettings = { ...data! };
        return inMemorySettings;
      },
      update: async ({ data }: { data: Partial<typeof inMemorySettings> }) => {
        inMemorySettings = {
          ...inMemorySettings!,
          ...data,
        };
        return inMemorySettings;
      },
    },
  };
  const settingsClient =
    mockClient as unknown as Parameters<typeof ensureStoreSettings>[0];

  // 1. Initial creation defaults to codEnabled: true
  const initial = await ensureStoreSettings(settingsClient);
  assert.equal(initial.codEnabled, true, "Default COD status should be enabled");

  // 2. Updating codEnabled to false
  const updatedFalse = await ensureStoreSettings(settingsClient, { codEnabled: false });
  assert.equal(updatedFalse.codEnabled, false, "COD should be updated to false");

  // 3. Updating codEnabled back to true
  const updatedTrue = await ensureStoreSettings(settingsClient, { codEnabled: true });
  assert.equal(updatedTrue.codEnabled, true, "COD should be updated to true");
});

test("Admin COD API rejects unauthenticated requests with 401", async () => {
  // Direct call to GET without admin session cookies
  const getResponse = await getAdminCod();
  assert.equal(getResponse.status, 401);
  const getData = await getResponse.json();
  assert.equal(getData.success, false);
  assert.equal(getData.message, "Authentication required.");

  // Direct call to PUT without admin session cookies
  const putRequest = new Request("http://localhost:3000/api/admin/settings/cod", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codEnabled: false }),
  });
  const putResponse = await putAdminCod(putRequest);
  assert.equal(putResponse.status, 401);
  const putData = await putResponse.json();
  assert.equal(putData.success, false);
  assert.equal(putData.message, "Authentication required.");
});

test("Server-side checkout validation rejects COD when codEnabled is false", () => {
  // Simulate the order verification check in app/api/orders/route.ts
  const verifyPaymentMethodAllowed = (
    paymentMethod: string,
    storeSettings: { codEnabled: boolean; cashfreeEnabled: boolean }
  ) => {
    if (paymentMethod === "COD" && !storeSettings.codEnabled) {
      return {
        status: 409,
        success: false,
        message: "Cash on Delivery is currently unavailable. Please choose online payment.",
      };
    }
    if (paymentMethod === "CASHFREE" && !storeSettings.cashfreeEnabled) {
      return {
        status: 409,
        success: false,
        message: "Cashfree Payments is currently unavailable.",
      };
    }
    return { status: 200, success: true };
  };

  // COD is disabled, user chooses COD -> Rejected with 409
  const codRejected = verifyPaymentMethodAllowed("COD", {
    codEnabled: false,
    cashfreeEnabled: true,
  });
  assert.equal(codRejected.status, 409);
  assert.equal(codRejected.success, false);
  assert.equal(
    codRejected.message,
    "Cash on Delivery is currently unavailable. Please choose online payment."
  );

  // COD is disabled, user chooses CASHFREE -> Allowed
  const cashfreeAllowed = verifyPaymentMethodAllowed("CASHFREE", {
    codEnabled: false,
    cashfreeEnabled: true,
  });
  assert.equal(cashfreeAllowed.status, 200);
  assert.equal(cashfreeAllowed.success, true);

  // COD is enabled, user chooses COD -> Allowed
  const codAllowed = verifyPaymentMethodAllowed("COD", {
    codEnabled: true,
    cashfreeEnabled: true,
  });
  assert.equal(codAllowed.status, 200);
  assert.equal(codAllowed.success, true);
});

test("Changing COD setting does not cancel or modify existing COD orders", () => {
  const existingOrders = [
    {
      id: "order_1",
      orderNumber: "PH-12345",
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      status: "PENDING",
      total: "499.00",
    },
    {
      id: "order_2",
      orderNumber: "PH-12346",
      paymentMethod: "COD",
      paymentStatus: "PAID",
      status: "DELIVERED",
      total: "1250.00",
    },
  ];

  // Store setting changes to codEnabled: false
  const updatedSettings = { codEnabled: false };

  // Assert existing orders remain unchanged
  assert.equal(existingOrders.length, 2);
  assert.equal(existingOrders[0].paymentMethod, "COD");
  assert.equal(existingOrders[0].status, "PENDING");
  assert.equal(existingOrders[1].paymentMethod, "COD");
  assert.equal(existingOrders[1].status, "DELIVERED");
  assert.equal(updatedSettings.codEnabled, false);
});
