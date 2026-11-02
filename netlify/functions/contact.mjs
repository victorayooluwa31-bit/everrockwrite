import { getStore } from "@netlify/blobs";

export const handler = async (event) => {
  const reply = (statusCode, data) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(data) });
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed." });
  let input;
  try { input = JSON.parse(event.body || "{}"); } catch { return reply(400, { error: "Invalid request." }); }
  if (String(input.website || "").trim()) return reply(200, { ok: true });
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const message = String(input.message || "").trim();
  if (!name || name.length > 100) return reply(400, { error: "Please enter your name." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: "Please enter a valid email address." });
  if (!message || message.length > 5000) return reply(400, { error: "Please enter a message (up to 5,000 characters)." });
  try {
    const store = getStore("everrock-contact-inbox");
    const messages = await store.get("messages", { type: "json" }) || [];
    messages.push({ id: crypto.randomUUID(), name, email, message, receivedAt: new Date().toISOString() });
    await store.setJSON("messages", messages.slice(-1000));
    return reply(200, { ok: true });
  } catch (error) {
    console.error("Contact submission failed:", error);
    return reply(500, { error: "Your message could not be sent right now. Please try again later." });
  }
};
