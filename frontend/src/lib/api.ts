const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: unknown;
};

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("catetrek_token");
}

function getBusinessId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("catetrek_business_id");
}

export async function api<T>(
  path: string,
  options: RequestInit & { formData?: FormData; raw?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  const businessId = getBusinessId();

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (businessId) headers.set("X-Business-Id", businessId);

  let body = options.body;
  if (options.formData) {
    body = options.formData;
  } else if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body,
  });

  if (options.raw) {
    if (!res.ok) throw new Error("Request gagal");
    return res as unknown as T;
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Terjadi kesalahan");
  }
  return json.data as T;
}

export { API_URL };
