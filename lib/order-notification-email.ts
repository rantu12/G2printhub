import { Resend } from "resend";
import { getIntegrationValue } from "@/lib/integration-secrets";
import { getConfiguredSiteUrl, getStoreSettings } from "@/lib/store-settings";

type NewOrder = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: { toString(): string };
  items: { productName: string; quantity: number }[];
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export async function sendNewOrderNotificationEmail(
  recipients: string[],
  order: NewOrder,
): Promise<void> {
  const [apiKey, from, settings] = await Promise.all([
    getIntegrationValue("RESEND_API_KEY"),
    getIntegrationValue("EMAIL_FROM"),
    getStoreSettings(),
  ]);
  const appUrl = await getConfiguredSiteUrl(settings);

  if (!apiKey || !from || !appUrl) {
    throw new Error("Order notification email is not configured.");
  }
  if (recipients.length === 0) {
    throw new Error("No active admin email addresses are configured.");
  }

  let orderUrl: URL;
  try {
    orderUrl = new URL("/admin/orders", appUrl);
  } catch {
    throw new Error("APP_URL must be a valid absolute URL.");
  }
  if (
    !["http:", "https:"].includes(orderUrl.protocol) ||
    (process.env.NODE_ENV === "production" && orderUrl.protocol !== "https:")
  ) {
    throw new Error("APP_URL must use HTTP or HTTPS and HTTPS in production.");
  }
  orderUrl.searchParams.set("search", order.orderNumber);

  const safeOrderNumber = escapeHtml(order.orderNumber);
  const safeCustomerName = escapeHtml(order.customerName);
  const safeCustomerEmail = escapeHtml(order.customerEmail);
  const itemLines = order.items
    .map(
      (item) =>
        `<li>${escapeHtml(item.productName)} &times; ${item.quantity}</li>`,
    )
    .join("");
  const textItems = order.items
    .map((item) => `- ${item.productName} x ${item.quantity}`)
    .join("\n");
  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: recipients,
    subject: `New PrintHub order ${order.orderNumber}`,
    html: `<p>A new order has been received.</p><p><strong>Order:</strong> ${safeOrderNumber}<br><strong>Customer:</strong> ${safeCustomerName} (${safeCustomerEmail})<br><strong>Total:</strong> ₹${escapeHtml(order.total.toString())}</p><ul>${itemLines}</ul><p><a href="${escapeHtml(orderUrl.toString())}">View order in admin</a></p>`,
    text: `A new order has been received.\nOrder: ${order.orderNumber}\nCustomer: ${order.customerName} (${order.customerEmail})\nTotal: INR ${order.total.toString()}\n${textItems}\nView order in admin: ${orderUrl.toString()}`,
  });

  if (error) {
    throw new Error(`Resend could not deliver the order notification: ${error.message}`);
  }
}
