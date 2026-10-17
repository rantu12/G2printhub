import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import {
  DELETE as deleteAdminTickets,
  GET as getAdminTickets,
} from "../app/api/admin/support/route";
import { PATCH as updateAdminTicket } from "../app/api/admin/support/[id]/route";
import { POST as replyToCustomerTicket } from "../app/api/support/tickets/[id]/replies/route";
import {
  GET as getCustomerTickets,
  POST as createTicket,
} from "../app/api/support/tickets/route";
import { SUPPORT_TICKET_STATUSES, isSupportTicketStatus } from "../lib/support";

test("support ticket statuses contain only the supported workflow values", () => {
  assert.deepEqual(SUPPORT_TICKET_STATUSES, [
    "OPEN",
    "IN_PROGRESS",
    "WAITING_FOR_CUSTOMER",
    "RESOLVED",
    "CLOSED",
  ]);
  for (const status of SUPPORT_TICKET_STATUSES) {
    assert.equal(isSupportTicketStatus(status), true);
  }
  assert.equal(isSupportTicketStatus("PENDING"), false);
  assert.equal(isSupportTicketStatus("closed"), false);
});

test("support ticket submission validates optional fields on the server", async () => {
  const response = await createTicket(
    new Request("http://localhost/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Customer",
        email: "customer@example.com",
        orderId: 123,
        subject: "Order question",
        message: "I need help with an order.",
      }),
    })
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, "Order ID must be text.");
});

test("customer ticket history requires a real authenticated session", async () => {
  const response = await getCustomerTickets();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);

  const replyResponse = await replyToCustomerTicket(
    new Request("http://localhost/api/support/tickets/ticket-id/replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "A test reply." }),
    }),
    { params: Promise.resolve({ id: "ticket-id" }) }
  );
  assert.equal(replyResponse.status, 401);
});

test("admin support APIs reject requests without an admin session", async () => {
  const listResponse = await getAdminTickets(
    new Request("http://localhost/api/admin/support")
  );
  assert.equal(listResponse.status, 401);

  const updateResponse = await updateAdminTicket(
    new Request("http://localhost/api/admin/support/ticket-id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    }),
    { params: Promise.resolve({ id: "ticket-id" }) }
  );
  assert.equal(updateResponse.status, 401);

  const deleteResponse = await deleteAdminTickets(
    new Request("http://localhost/api/admin/support", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation: "DELETE ALL" }),
    })
  );
  assert.equal(deleteResponse.status, 401);
});
