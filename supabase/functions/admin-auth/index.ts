import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const encoder = new TextEncoder();
const allowedOrigins = new Set([
  "https://teemo1069.github.io",
  "https://waterblue-monster-timer.teem0.chatgpt.site",
  "http://terminal.local:4173",
  "http://localhost:4173"
]);

type Account = {
  id: string;
  username: string;
  password_salt: string;
  password_hash: string;
  password_iterations: number;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: string | null;
  disabled: boolean;
};

type Session = {
  id: string;
  account_id: string;
  expires_at: string;
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://teemo1069.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(value: Uint8Array) {
  return bytesToBase64(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let index = 0; index < a.length; index++) different |= a[index] ^ b[index];
  return different === 0;
}

function restHeaders(prefer?: string) {
  return {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { "Prefer": prefer } : {}),
  };
}

async function readAccountByUsername(username: string): Promise<Account | null> {
  const query = new URLSearchParams({
    select: "id,username,password_salt,password_hash,password_iterations,must_change_password,failed_attempts,locked_until,disabled",
    username: `eq.${username}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_accounts?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error("account_lookup_failed");
  const rows = await response.json() as Account[];
  return rows[0] ?? null;
}

async function readAccountById(id: string): Promise<Account | null> {
  const query = new URLSearchParams({
    select: "id,username,password_salt,password_hash,password_iterations,must_change_password,failed_attempts,locked_until,disabled",
    id: `eq.${id}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_accounts?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error("account_lookup_failed");
  const rows = await response.json() as Account[];
  return rows[0] ?? null;
}

async function updateAccount(id: string, values: Record<string, unknown>) {
  const query = new URLSearchParams({ id: `eq.${id}` });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_accounts?${query}`, {
    method: "PATCH",
    headers: restHeaders("return=minimal"),
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error("account_update_failed");
}

async function readSession(tokenHash: string): Promise<Session | null> {
  const query = new URLSearchParams({
    select: "id,account_id,expires_at",
    token_hash: `eq.${tokenHash}`,
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions?${query}`, { headers: restHeaders() });
  if (!response.ok) throw new Error("session_lookup_failed");
  const rows = await response.json() as Session[];
  return rows[0] ?? null;
}

async function verifySession(sessionToken: unknown) {
  if (typeof sessionToken !== "string" || sessionToken.length < 32 || sessionToken.length > 256) return null;
  const tokenHash = await sha256Hex(sessionToken);
  const session = await readSession(tokenHash);
  if (!session) return null;
  const account = await readAccountById(session.account_id);
  if (!account || account.disabled) return null;
  const query = new URLSearchParams({ id: `eq.${session.id}` });
  await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions?${query}`, {
    method: "PATCH",
    headers: restHeaders("return=minimal"),
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  });
  return { account, session, tokenHash };
}

async function createSession(accountId: string) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const sessionToken = bytesToBase64Url(tokenBytes);
  const tokenHash = await sha256Hex(sessionToken);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions`, {
    method: "POST",
    headers: restHeaders("return=representation"),
    body: JSON.stringify({ account_id: accountId, token_hash: tokenHash, expires_at: expiresAt }),
  });
  if (!response.ok) throw new Error("session_create_failed");
  return { sessionToken, expiresAt };
}

async function handleLogin(req: Request, body: Record<string, unknown>) {
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase().slice(0, 64) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password || password.length > 256) return json(req, { error: "帳號或密碼不正確" }, 401);

  const account = await readAccountByUsername(username);
  if (!account || account.disabled) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return json(req, { error: "帳號或密碼不正確" }, 401);
  }

  const now = Date.now();
  const lockedUntil = account.locked_until ? new Date(account.locked_until).getTime() : 0;
  if (lockedUntil > now) return json(req, { error: "登入嘗試過多，請稍後再試" }, 429);

  const actual = await derivePasswordHash(password, base64ToBytes(account.password_salt), account.password_iterations);
  const expected = base64ToBytes(account.password_hash);
  if (!constantTimeEqual(actual, expected)) {
    const attempts = lockedUntil && lockedUntil <= now ? 1 : account.failed_attempts + 1;
    const shouldLock = attempts >= 5;
    await updateAccount(account.id, {
      failed_attempts: shouldLock ? 0 : attempts,
      locked_until: shouldLock ? new Date(now + 15 * 60 * 1000).toISOString() : null,
    });
    return json(req, { error: shouldLock ? "登入嘗試過多，已暫時鎖定 15 分鐘" : "帳號或密碼不正確" }, shouldLock ? 429 : 401);
  }

  await updateAccount(account.id, { failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() });
  const auth = await createSession(account.id);
  return json(req, {
    authenticated: true,
    username: account.username,
    mustChangePassword: account.must_change_password,
    sessionToken: auth.sessionToken,
    expiresAt: auth.expiresAt,
  });
}

async function handleVerify(req: Request, body: Record<string, unknown>) {
  const verified = await verifySession(body.sessionToken);
  if (!verified) return json(req, { authenticated: false }, 401);
  return json(req, {
    authenticated: true,
    username: verified.account.username,
    mustChangePassword: verified.account.must_change_password,
    expiresAt: verified.session.expires_at,
  });
}

async function handleLogout(req: Request, body: Record<string, unknown>) {
  const token = typeof body.sessionToken === "string" ? body.sessionToken : "";
  if (token) {
    const tokenHash = await sha256Hex(token);
    const query = new URLSearchParams({ token_hash: `eq.${tokenHash}` });
    await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions?${query}`, {
      method: "DELETE",
      headers: restHeaders("return=minimal"),
    });
  }
  return json(req, { authenticated: false });
}

function strongPassword(password: string) {
  if (password.length < 12 || password.length > 128) return false;
  const groups = [/[a-z]/.test(password), /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  return groups.filter(Boolean).length >= 3;
}

async function handleChangePassword(req: Request, body: Record<string, unknown>) {
  const verified = await verifySession(body.sessionToken);
  if (!verified) return json(req, { error: "登入已失效，請重新登入" }, 401);
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!strongPassword(newPassword)) {
    return json(req, { error: "新密碼至少 12 字元，並包含英文大小寫、數字、符號中的三類" }, 400);
  }

  const salt = crypto.getRandomValues(new Uint8Array(24));
  const hash = await derivePasswordHash(newPassword, salt, 310000);
  await updateAccount(verified.account.id, {
    password_salt: bytesToBase64(salt),
    password_hash: bytesToBase64(hash),
    password_iterations: 310000,
    must_change_password: false,
    password_changed_at: new Date().toISOString(),
    failed_attempts: 0,
    locked_until: null,
  });

  const query = new URLSearchParams({
    account_id: `eq.${verified.account.id}`,
    id: `neq.${verified.session.id}`,
  });
  await fetch(`${SUPABASE_URL}/rest/v1/admin_sessions?${query}`, {
    method: "DELETE",
    headers: restHeaders("return=minimal"),
  });
  return json(req, { changed: true, mustChangePassword: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed" }, 403);
  if (!SUPABASE_URL || !SERVICE_KEY) return json(req, { error: "服務尚未設定完成" }, 503);

  try {
    const body = await req.json() as Record<string, unknown>;
    switch (body.action) {
      case "login": return await handleLogin(req, body);
      case "verify": return await handleVerify(req, body);
      case "logout": return await handleLogout(req, body);
      case "change_password": return await handleChangePassword(req, body);
      default: return json(req, { error: "未知操作" }, 400);
    }
  } catch (error) {
    console.error(error);
    return json(req, { error: "驗證服務暫時無法使用" }, 500);
  }
});

