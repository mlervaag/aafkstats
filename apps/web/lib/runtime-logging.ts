type LogLevel = "info" | "warn" | "error";

interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

function write(level: LogLevel, fields: LogFields): void {
  const line = JSON.stringify({ level, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** En liten, felles grunnlinje for søkbare Vercel Runtime Logs. */
export function createRequestLogger(request: Request, route: string) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");

  write("info", { msg: "start", route, request_id: requestId });

  return {
    complete<T extends Response>(response: T): T {
      const level: LogLevel = response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info";
      write(level, {
        msg: "done",
        route,
        request_id: requestId,
        status: response.status,
        ms: Date.now() - startedAt,
      });
      return response;
    },
    failed(error: unknown): void {
      write("error", {
        msg: "failed",
        route,
        request_id: requestId,
        status: 500,
        error: error instanceof Error ? error.message : String(error),
        ms: Date.now() - startedAt,
      });
    },
  };
}

/** Detaljer om en kjent, trygg oppstrømsfeil uten responskropp eller hemmeligheter. */
export function logUpstreamFailure(route: string, message: string, status?: number): void {
  write("error", { msg: message, route, upstream_status: status });
}
