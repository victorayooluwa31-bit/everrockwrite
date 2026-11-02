import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "er_inbox_session";
const reply = (statusCode, data, headers = {}) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers }, body: JSON.stringify(data) });
const secret = () => process.env.INBOX_SESSION_SECRET || "";
const sign = value => createHmac("sha256", secret()).update(value).digest("base64url");
const makeToken = () => {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  return payload + "." + sign(payload);
};
const cookie = (value, age) => `${COOKIE}=${value}; Path=/api/inbox; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const authenticated = event => {
  const header = event.headers.cookie || event.headers.Cookie || "";
  const entry = header.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE + "="));
  if (!entry || !secret()) return false;
  const [payload, signature] = decodeURIComponent(entry.slice(COOKIE.length + 1)).split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload), a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
};

export const handler = async event => {
  const path = event.path || "";
  if (event.httpMethod === "POST" && path.endsWith("/login")) {
    let input;
    try { input = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Invalid request." }); }
    const password = Buffer.from(process.env.INBOX_ADMIN_PASSWORD || "");
    const supplied = Buffer.from(String(input.password || ""));
    if (!password.length || !secret()) return reply(503, { error: "Inbox access has not been configured in Netlify yet." });
    if (password.length !== supplied.length || !timingSafeEqual(password, supplied)) return reply(401, { error: "Incorrect password." });
    return reply(200, { ok: true }, { "Set-Cookie": cookie(makeToken(), 28800) });
  }
  if (event.httpMethod === "POST" && path.endsWith("/logout")) return reply(200, { ok: true }, { "Set-Cookie": cookie("", 0) });
  if (!authenticated(event)) return reply(401, { error: "Please sign in to view messages." });
  try {
    const store = getStore("everrock-contact-inbox");
    const messages = await store.get("messages", { type: "json" }) || [];
    if (event.httpMethod === "GET") return reply(200, { messages: messages.sort((a,b) => b.receivedAt.localeCompare(a.receivedAt)) });
    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters?.id;
      const remaining = messages.filter(item => item.id !== id);
      if (!id || remaining.length === messages.length) return reply(404, { error: "Message not found." });
      await store.setJSON("messages", remaining);
      return reply(200, { ok: true });
    }
    return reply(405, { error: "Method not allowed." });
  } catch (error) {
    console.error("Inbox error:", error);
    return reply(500, { error: "The inbox could not be loaded." });
  }
};
