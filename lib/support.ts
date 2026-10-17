export const SUPPORT_TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export function isSupportTicketStatus(
  value: unknown
): value is SupportTicketStatus {
  return (
    typeof value === "string" &&
    SUPPORT_TICKET_STATUSES.some((status) => status === value)
  );
}

export function supportAuthError(error: unknown, message: string) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return { status: 401, message };
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return { status: 403, message: "Admin access required." };
  }
  return null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasPrismaCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
