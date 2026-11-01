import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "../../login/login-form";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const requestedReturnTo = params.returnTo;
  const returnTo =
    requestedReturnTo === "/admin" ||
    requestedReturnTo?.startsWith("/admin/")
      ? requestedReturnTo
      : "/admin";
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") {
      redirect(returnTo);
    }
    redirect("/account");
  }

  return <LoginForm accountType="admin" returnTo={returnTo} />;
}
