/**
 * The backend wraps every error as
 *   { success: false, error: { code, message, details, codes, retry_after } }
 * (`codes` = {field: [code]} for validation errors). Helpers here turn that
 * into something a screen can show.
 */

export interface ApiErrorInfo {
  status: number | null;
  code: string | null;
  message: string | null;
  codes: Record<string, string[]>;
  retryAfter: number | null;
  network: boolean;
}

export function parseApiError(err: unknown): ApiErrorInfo {
  const out: ApiErrorInfo = {
    status: null,
    code: null,
    message: null,
    codes: {},
    retryAfter: null,
    network: false,
  };
  const axiosErr = err as {
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: string;
          message?: string;
          codes?: Record<string, string[]>;
          retry_after?: number;
        };
        detail?: string;
      };
    };
    message?: string;
  };
  if (!axiosErr?.response) {
    out.network = true;
    return out;
  }
  out.status = axiosErr.response.status ?? null;
  const data = axiosErr.response.data;
  const env = data?.error;
  if (env) {
    out.code = env.code ?? null;
    out.message = env.message ?? null;
    out.codes = env.codes ?? {};
    out.retryAfter =
      typeof env.retry_after === "number" ? env.retry_after : null;
  } else if (typeof data?.detail === "string") {
    out.message = data.detail;
  }
  return out;
}

export function loginErrorMessage(
  err: unknown,
  copy: {
    invalidCredentials: string;
    accountLocked: string;
    tooManyAttempts: string;
    networkError: string;
  },
): string {
  const e = parseApiError(err);
  if (e.network) return copy.networkError;
  if (e.status === 429 || e.code === "throttled") {
    return copy.tooManyAttempts.replace(
      "{seconds}",
      String(e.retryAfter ?? 60),
    );
  }
  if ((e.codes.detail ?? []).includes("account_locked"))
    return copy.accountLocked;
  if (e.status === 401) return copy.invalidCredentials;
  return e.message ?? copy.invalidCredentials;
}
