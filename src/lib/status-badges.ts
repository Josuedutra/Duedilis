// Status badge config utilities — shared (no "use server")
// These are sync lookup functions and cannot live in "use server" files
// when imported by Client Components.

export type BadgeVariant = "default" | "warning" | "success" | "error";

export interface StatusBadgeConfig {
  variant: BadgeVariant;
  label: string;
}

export function getChangeStatusBadgeConfig(status: string): StatusBadgeConfig {
  switch (status) {
    case "DRAFT":
      return { variant: "default", label: "Draft" };
    case "OPEN":
      return { variant: "warning", label: "Open" };
    case "SUBMITTED":
      return { variant: "warning", label: "Submitted" };
    case "UNDER_REVIEW":
      return { variant: "warning", label: "Under Review" };
    case "APPROVED":
      return { variant: "success", label: "Approved" };
    case "REJECTED":
      return { variant: "error", label: "Rejected" };
    case "FORMALIZED":
      return { variant: "success", label: "Formalized" };
    case "CLOSED":
      return { variant: "default", label: "Closed" };
    default:
      return { variant: "default", label: status };
  }
}

export function getTransmittalStatusBadgeConfig(status: string): StatusBadgeConfig {
  switch (status) {
    case "DRAFT":
      return { variant: "default", label: "Draft" };
    case "SENT":
      return { variant: "warning", label: "Sent" };
    case "RECEIVED":
      return { variant: "success", label: "Received" };
    default:
      return { variant: "default", label: status };
  }
}
