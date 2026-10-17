import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SupportHistory from "./support-history";

export default async function CustomerSupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorName: true,
          authorRole: true,
          message: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="customer-support-page">
      <div className="customer-support-shell">
        <header className="customer-support-header">
          <span className="help-center-eyebrow">MY ACCOUNT</span>
          <h1>Support history</h1>
          <p>Review your support requests and continue the conversation.</p>
        </header>
        <SupportHistory
          initialTickets={tickets.map((ticket) => ({
            ...ticket,
            createdAt: ticket.createdAt.toISOString(),
            updatedAt: ticket.updatedAt.toISOString(),
            replies: ticket.replies.map((reply) => ({
              ...reply,
              createdAt: reply.createdAt.toISOString(),
            })),
          }))}
        />
      </div>
    </main>
  );
}
