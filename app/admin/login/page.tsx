import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "../../login/login-form";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") {
      redirect("/admin");
    }
    redirect("/account");
  }

  return <LoginForm accountType="admin" />;
}
