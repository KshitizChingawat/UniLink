const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const configuredApiOrigin = (import.meta.env.VITE_API_ORIGIN || "").trim();

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/$/, "");

const getRuntimeApiBaseUrl = () => {
  if (typeof window === "undefined") return "";
  const globalBase = (window as Window & { __UNILINK_API_BASE_URL__?: string }).__UNILINK_API_BASE_URL__?.trim();
  if (globalBase) return normalizeBaseUrl(globalBase);

  const metaBase = document.querySelector('meta[name="unilink-api-base"]')?.getAttribute("content")?.trim();
  if (metaBase) return normalizeBaseUrl(metaBase);

  return "";
};

const getHeuristicApiBaseUrls = () => {
  const bases = new Set<string>();
  const envBase = normalizeBaseUrl(configuredApiBaseUrl);
  const envOrigin = normalizeBaseUrl(configuredApiOrigin);
  const runtimeBase = getRuntimeApiBaseUrl();

  if (envBase) bases.add(envBase);
  if (envOrigin) bases.add(envOrigin);
  if (runtimeBase) bases.add(runtimeBase);

  if (typeof window !== "undefined") {
    const currentOrigin = normalizeBaseUrl(window.location.origin);
    if (currentOrigin) bases.add(currentOrigin);

    try {
      const parsed = new URL(currentOrigin);
      const host = parsed.hostname;
      const protocol = parsed.protocol;
      const port = parsed.port ? `:${parsed.port}` : "";
      const replacements = [
        host.replace(/frontend/i, "backend"),
        host.replace(/frontend/i, "api"),
        host.replace(/^app-/i, "api-"),
      ];

      for (const replacement of replacements) {
        if (replacement && replacement !== host) {
          bases.add(`${protocol}//${replacement}${port}`);
        }
      }
    } catch {
      // Ignore malformed browser origins and fall back to the direct origin.
    }
  }

  if (import.meta.env.DEV && !bases.size) {
    bases.add("http://localhost:8787");
  }

  return [...bases];
};

let resolvedApiBaseUrl: string | null = configuredApiBaseUrl
  ? normalizeBaseUrl(configuredApiBaseUrl)
  : configuredApiOrigin
    ? normalizeBaseUrl(configuredApiOrigin)
    : null;
let resolvedApiBaseUrlPromise: Promise<string> | null = null;

export const API_BASE_URL = resolvedApiBaseUrl || getHeuristicApiBaseUrls()[0] || "";
export const BASE_URL = API_BASE_URL;
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const getToken = () => localStorage.getItem("auth_token");
const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((part) => part.trim());
  const target = parts.find((part) => part.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
};

const pingApiBaseUrl = async (baseUrl: string) => {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      credentials: "omit",
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const resolveApiBaseUrl = async () => {
  if (resolvedApiBaseUrl) {
    return resolvedApiBaseUrl;
  }

  if (!resolvedApiBaseUrlPromise) {
    resolvedApiBaseUrlPromise = (async () => {
      const candidates = getHeuristicApiBaseUrls();
      for (const candidate of candidates) {
        if (await pingApiBaseUrl(candidate)) {
          resolvedApiBaseUrl = candidate;
          return candidate;
        }
      }

      resolvedApiBaseUrl = candidates[0] || "";
      return resolvedApiBaseUrl;
    })();
  }

  return resolvedApiBaseUrlPromise;
};

export const apiFetch = async <T>(input: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers || {});
  const token = getToken();
  const method = (init.method || "GET").toUpperCase();
  const apiBaseUrl = await resolveApiBaseUrl();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = getCookie("unilink_csrf");
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(`${apiBaseUrl}${input}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as Record<string, unknown>).error)
        : "Request failed";
    throw new ApiError(message, response.status);
  }

  return payload as T;
};

export const getApiUrl = (input: string, baseUrl = API_BASE_URL) => `${baseUrl}${input}`;

export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
