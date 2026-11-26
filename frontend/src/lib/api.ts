const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("The VELLARA API base URL has not been configured.");
    this.name = "ApiNotConfiguredError";
  }
}

/**
 * Intentionally refuses to guess routes or payload contracts.
 * Add typed feature methods here only after the backend owner approves them.
 */
export async function apiRequest<T>(_path: string, _init?: RequestInit): Promise<T> {
  if (!baseUrl) throw new ApiNotConfiguredError();
  throw new Error("No approved VELLARA API routes have been registered yet.");
}
