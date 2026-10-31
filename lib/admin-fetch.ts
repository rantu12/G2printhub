export async function fetchAdmin(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401 && typeof window !== "undefined") {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(
      `/admin/login?returnTo=${encodeURIComponent(returnTo)}`
    );
  }

  return response;
}
