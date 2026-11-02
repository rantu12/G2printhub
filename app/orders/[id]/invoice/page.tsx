import { notFound, redirect } from "next/navigation";
import OrderInvoice from "@/app/components/order-invoice";
import { getCurrentUser } from "@/lib/auth";
import { isInvoiceDownloadAvailable } from "@/lib/invoice-eligibility";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings";

type CustomerInvoicePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerOrderInvoicePage({
  params,
}: CustomerInvoicePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      shippingAddress: true,
      shippingAddress2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      subtotal: true,
      couponCode: true,
      discount: true,
      shippingFee: true,
      codFee: true,
      tax: true,
      total: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          sku: true,
          selectedColor: true,
          selectedSize: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });

  if (
    !order ||
    !isInvoiceDownloadAvailable(order.paymentStatus, order.status)
  ) {
    notFound();
  }

  const storeSettings = await getStoreSettings();
  return (
    <OrderInvoice
      backHref="/orders"
      backLabel="← Back to my orders"
      download
      order={{
        ...order,
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        shippingFee: Number(order.shippingFee),
        codFee: Number(order.codFee),
        tax: Number(order.tax),
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      }}
      settings={{
        siteName: storeSettings.siteName,
        siteLogo: storeSettings.siteLogo,
        timeZone: storeSettings.timeZone,
        invoiceTitle: storeSettings.invoiceTitle,
        invoiceTagline: storeSettings.invoiceTagline,
        invoiceSellerName: storeSettings.invoiceSellerName,
        invoiceGstin: storeSettings.invoiceGstin,
        invoicePan: storeSettings.invoicePan,
        invoiceAddress: storeSettings.invoiceAddress,
        invoiceContact: storeSettings.invoiceContact,
        invoiceReturnPolicy: storeSettings.invoiceReturnPolicy,
      }}
    />
  );
}
