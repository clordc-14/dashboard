export class HttpError extends Error {
  constructor(status, message, details, expose = false) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
    this.expose = expose;
  }
}

export function json(body, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    ...init,
    headers
  });
}

export function jsonError(error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const body = {
    error: {
      message: status === 500 && !error?.expose ? "Internal server error" : error.message,
      status
    }
  };

  if (error?.details) {
    body.error.details = error.details;
  }

  return json(body, { status });
}

export function methodNotAllowed(allowedMethods) {
  return json(
    {
      error: {
        message: "Method not allowed",
        status: 405
      }
    },
    {
      status: 405,
      headers: {
        allow: allowedMethods.join(", ")
      }
    }
  );
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
}
