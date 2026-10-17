import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store-settings";
import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") {
      redirect("/admin");
    }
    redirect("/account");
  }

  const params = await searchParams;
  const settings = await getStoreSettings();
  const initialError =
    params.error === "google"
      ? "Google sign-in could not be completed. Please try again."
      : "";

  return (
    <LoginForm
      accountType="customer"
      initialError={initialError}
      passwordLoginEnabled={settings.passwordLoginEnabled}
      googleSignInEnabled={settings.googleSignInEnabled}
      registrationEnabled={settings.registrationEnabled}
    />
  );
}
