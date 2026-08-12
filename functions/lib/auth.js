import { ensureUser, normalizeEmail, requireDb } from "./db.js";
import { HttpError } from "./http.js";

const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";
const ACCESS_JWT_COOKIE = "CF_Authorization";
const DEFAULT_DEV_NAME = "Local Developer";
const DEFAULT_DEV_ROLE = "admin";

export async function authenticateRequest(context) {
  const environment = getEnvironment(context.env, context.request);
  const identity =
    environment === "development"
      ? await getDevelopmentIdentity(context)
      : await getAccessIdentity(context);

  if (context.env.DB) {
    const defaultRole = getDefaultRole(context.env, identity.email, environment);

    return ensureUser(context.env.DB, identity, defaultRole);
  }

  if (environment !== "development") {
    requireDb(context.env);
  }

  return {
    id: "usr_local_development",
    email: normalizeEmail(identity.email),
    name: identity.name || DEFAULT_DEV_NAME,
    role: context.env.DEV_USER_ROLE || DEFAULT_DEV_ROLE
  };
}

export function getEnvironment(env, request) {
  const configured = String(env.ENVIRONMENT || "").trim().toLowerCase();

  if (["development", "preview", "production"].includes(configured)) {
    return configured;
  }

  const hostname = new URL(request.url).hostname;
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  return isLocalHost ? "development" : "production";
}

async function getDevelopmentIdentity(context) {
  const headerEmail = context.request.headers.get("x-dev-user-email");
  const headerName = context.request.headers.get("x-dev-user-name");

  return {
    email: headerEmail || context.env.DEV_USER_EMAIL || createLocalDevelopmentEmail(context.request),
    name: headerName || context.env.DEV_USER_NAME || DEFAULT_DEV_NAME
  };
}

function getDefaultRole(env, email, environment) {
  if (environment === "development") {
    return env.DEV_USER_ROLE || DEFAULT_DEV_ROLE;
  }

  return getInitialAdminEmails(env.INITIAL_ADMIN_EMAILS).has(normalizeEmail(email))
    ? "admin"
    : "viewer";
}

function getInitialAdminEmails(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function createLocalDevelopmentEmail(request) {
  const host = new URL(request.url).hostname.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `local-developer-${host || "pages"}@local.invalid`;
}

async function getAccessIdentity(context) {
  const token = getAccessToken(context.request);

  if (!token) {
    throw new HttpError(401, "Missing Cloudflare Access JWT");
  }

  const payload = await verifyAccessJwt(token, context.env);
  const email = payload.email || payload.common_name;

  if (!email) {
    throw new HttpError(401, "Cloudflare Access JWT does not include email");
  }

  return {
    email,
    name: payload.name || payload.email || payload.common_name
  };
}

function getAccessToken(request) {
  const headerToken = request.headers.get(ACCESS_JWT_HEADER);

  if (headerToken) {
    return headerToken;
  }

  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${ACCESS_JWT_COOKIE}=([^;]+)`));

  return match ? decodeURIComponent(match[1]) : null;
}

async function verifyAccessJwt(token, env) {
  const teamDomain = trimTrailingSlash(env.ACCESS_TEAM_DOMAIN || "");
  const expectedAudience = env.ACCESS_AUD;

  if (!teamDomain || !expectedAudience) {
    throw new HttpError(500, "Missing Cloudflare Access configuration");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new HttpError(401, "Invalid Cloudflare Access JWT");
  }

  const header = parseBase64UrlJson(encodedHeader);
  const payload = parseBase64UrlJson(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new HttpError(401, "Unsupported Cloudflare Access JWT header");
  }

  validateJwtPayload(payload, expectedAudience, teamDomain);

  const key = await getJwkForKid(teamDomain, header.kid);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["verify"]
  );

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  if (!verified) {
    throw new HttpError(401, "Invalid Cloudflare Access JWT signature");
  }

  return payload;
}

function validateJwtPayload(payload, expectedAudience, teamDomain) {
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp <= now) {
    throw new HttpError(401, "Cloudflare Access JWT has expired");
  }

  if (payload.nbf && payload.nbf > now) {
    throw new HttpError(401, "Cloudflare Access JWT is not active yet");
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (!audience.includes(expectedAudience)) {
    throw new HttpError(403, "Cloudflare Access audience does not match");
  }

  if (payload.iss && trimTrailingSlash(payload.iss) !== teamDomain) {
    throw new HttpError(403, "Cloudflare Access issuer does not match");
  }
}

async function getJwkForKid(teamDomain, kid) {
  const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);

  if (!response.ok) {
    throw new HttpError(500, "Unable to fetch Cloudflare Access public keys");
  }

  const certs = await response.json();
  const key = certs.keys?.find((item) => item.kid === kid);

  if (!key) {
    throw new HttpError(401, "Cloudflare Access signing key was not found");
  }

  return key;
}

function parseBase64UrlJson(value) {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
  } catch {
    throw new HttpError(401, "Invalid Cloudflare Access JWT payload");
  }
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}
