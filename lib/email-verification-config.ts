export function isEmailVerificationConfiguredWithValues(
  apiKey: string | undefined,
  from: string | undefined,
  appUrl: string | undefined
): boolean {
  return Boolean(
    apiKey &&
      apiKey.trim() !== "" &&
      apiKey !== "your-resend-api-key" &&
      from &&
      from.trim() !== "" &&
      appUrl &&
      appUrl.trim() !== ""
  );
}
