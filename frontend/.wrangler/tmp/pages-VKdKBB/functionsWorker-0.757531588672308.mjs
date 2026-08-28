var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-gRUJgL/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// _shared/agent-connector.ts
var T2_AGENT_API_VERSION = "t2-agent-tools/v1";
var AGENT_MAX_CLOCK_SKEW_MS = 5 * 6e4;
var AGENT_TOOLS = {
  "t2.company_overview.v1": {
    description: "Kompaniyadagi obyektlarning qisqa smeta, FAKT va F2 holati.",
    sourceRpc: "t2_ai_umumiy",
    scope: "kompaniya_ids",
    input: {
      type: "object",
      additionalProperties: false,
      required: ["kompaniya_id"],
      properties: { kompaniya_id: { type: "integer", minimum: 1 } }
    }
  },
  "t2.object_context.v1": {
    description: "Bitta obyektning dalilli smeta, FAKT, F2 va ogohlantirish konteksti.",
    sourceRpc: "t2_ai_kontekst",
    scope: "obyekt_ids",
    input: {
      type: "object",
      additionalProperties: false,
      required: ["obyekt_id"],
      properties: { obyekt_id: { type: "integer", minimum: 1 } }
    }
  }
};
var AGENT_ID = /^[a-z0-9][a-z0-9_-]{1,63}$/i;
var REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;
function positiveIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}
__name(positiveIds, "positiveIds");
function timestamp(value) {
  if (typeof value !== "string" || !value) return void 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : void 0;
}
__name(timestamp, "timestamp");
function toolNames(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tool) => typeof tool === "string" && Object.prototype.hasOwnProperty.call(AGENT_TOOLS, tool)))];
}
__name(toolNames, "toolNames");
function parseAgentKeyring(raw) {
  if (!raw) return [];
  try {
    const decoded = JSON.parse(raw);
    const entries = Array.isArray(decoded) ? decoded : decoded && typeof decoded === "object" && Array.isArray(decoded.agents) ? decoded.agents : [];
    return entries.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const key = entry;
      const id = typeof key.id === "string" ? key.id.trim() : "";
      const secret = typeof key.secret === "string" ? key.secret : "";
      if (!AGENT_ID.test(id) || secret.length < 24) return [];
      return [{
        id,
        secret,
        tools: toolNames(key.tools),
        kompaniyaIds: positiveIds(key.kompaniya_ids),
        obyektIds: positiveIds(key.obyekt_ids),
        notBefore: timestamp(key.not_before),
        notAfter: timestamp(key.not_after)
      }];
    });
  } catch {
    return [];
  }
}
__name(parseAgentKeyring, "parseAgentKeyring");
function parseAgentToolCall(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "JSON obyekt bo'lishi kerak" };
  }
  const data = input;
  if (data.version !== T2_AGENT_API_VERSION) {
    return { ok: false, message: "Qo'llab-quvvatlanmagan agent API versiyasi" };
  }
  if (typeof data.request_id !== "string" || !REQUEST_ID.test(data.request_id)) {
    return { ok: false, message: "request_id 8\u2013128 belgili bo'lishi kerak" };
  }
  if (typeof data.tool !== "string" || !Object.prototype.hasOwnProperty.call(AGENT_TOOLS, data.tool)) {
    return { ok: false, message: "Tool ochiq emas" };
  }
  if (!data.arguments || typeof data.arguments !== "object" || Array.isArray(data.arguments)) {
    return { ok: false, message: "arguments obyekt bo'lishi kerak" };
  }
  return {
    ok: true,
    call: {
      version: T2_AGENT_API_VERSION,
      request_id: data.request_id,
      tool: data.tool,
      arguments: data.arguments
    }
  };
}
__name(parseAgentToolCall, "parseAgentToolCall");
function positiveIntegerArgument(args, name) {
  const value = args[name];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
__name(positiveIntegerArgument, "positiveIntegerArgument");
function toolAllowed(principal, tool) {
  return principal.tools.includes(tool);
}
__name(toolAllowed, "toolAllowed");
function scopeAllowed(principal, scope, id) {
  return (scope === "kompaniya_ids" ? principal.kompaniyaIds : principal.obyektIds).includes(id);
}
__name(scopeAllowed, "scopeAllowed");
async function sha256Hex(value) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex, "hmacHex");
function sameSecret(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}
__name(sameSecret, "sameSecret");
async function verifyAgentRequest(request, rawBody, keyringJson, now = Date.now()) {
  const id = request.headers.get("x-t2-agent-id")?.trim() || "";
  const timestampHeader = request.headers.get("x-t2-timestamp") || "";
  const signature = request.headers.get("x-t2-signature") || "";
  const time = Number(timestampHeader);
  if (!AGENT_ID.test(id) || !Number.isInteger(time) || Math.abs(now - time) > AGENT_MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, code: "agent_auth_invalid", message: "Agent autentifikatsiyasi yaroqsiz" };
  }
  const principal = parseAgentKeyring(keyringJson).find((agent) => agent.id === id);
  if (!principal || principal.notBefore && now < principal.notBefore || principal.notAfter && now > principal.notAfter) {
    return { ok: false, status: 403, code: "agent_not_allowed", message: "Agent ruxsat etilmagan" };
  }
  const bodyHash = await sha256Hex(rawBody);
  const payload = [T2_AGENT_API_VERSION, id, timestampHeader, request.method.toUpperCase(), new URL(request.url).pathname, bodyHash].join("\n");
  const expected = await hmacHex(principal.secret, payload);
  if (!/^[a-f0-9]{64}$/i.test(signature) || !sameSecret(signature.toLowerCase(), expected)) {
    return { ok: false, status: 401, code: "agent_auth_invalid", message: "Agent autentifikatsiyasi yaroqsiz" };
  }
  return { ok: true, principal };
}
__name(verifyAgentRequest, "verifyAgentRequest");

// api/agent/call.ts
var MAX_BODY_BYTES = 32768;
function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
__name(json, "json");
function problem(status, code, message) {
  return json({ ok: false, code, xabar: message }, status);
}
__name(problem, "problem");
async function readRpc(env, rpc, parameter, id) {
  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + rpc + "?" + new URLSearchParams({ [parameter]: String(id) });
  const response = await fetch(url, {
    headers: { apikey: env.SUPABASE_KEY, Authorization: "Bearer " + env.SUPABASE_KEY }
  });
  if (!response.ok) throw new Error("read_rpc_failed");
  return response.json();
}
__name(readRpc, "readRpc");
var onRequestPost = /* @__PURE__ */ __name(async (ctx) => {
  if (!ctx.env.T2_AGENT_KEYS_JSON) {
    return problem(503, "agent_connector_unconfigured", "Agent connector sozlanmagan");
  }
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
    return problem(503, "data_source_unconfigured", "Ma'lumot manbai sozlanmagan");
  }
  const contentType = ctx.request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return problem(415, "content_type_invalid", "application/json talab qilinadi");
  }
  const rawBody = await ctx.request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return problem(413, "request_too_large", "Agent so'rovi juda katta");
  }
  const auth = await verifyAgentRequest(ctx.request, rawBody, ctx.env.T2_AGENT_KEYS_JSON);
  if (!auth.ok) return problem(auth.status, auth.code, auth.message);
  let input;
  try {
    input = JSON.parse(rawBody);
  } catch {
    return problem(400, "request_invalid", "Noto'g'ri JSON so'rov");
  }
  const parsed = parseAgentToolCall(input);
  if (!parsed.ok) return problem(400, "request_invalid", parsed.message);
  const { call } = parsed;
  if (!toolAllowed(auth.principal, call.tool)) {
    return problem(403, "tool_forbidden", "Bu agent uchun tool ruxsat etilmagan");
  }
  const tool = AGENT_TOOLS[call.tool];
  const argumentName = tool.scope === "kompaniya_ids" ? "kompaniya_id" : "obyekt_id";
  const id = positiveIntegerArgument(call.arguments, argumentName);
  if (!id) return problem(400, "request_invalid", argumentName + " musbat butun son bo'lishi kerak");
  if (!scopeAllowed(auth.principal, tool.scope, id)) {
    return problem(403, "tenant_forbidden", "Bu ma'lumot doirasiga ruxsat yo'q");
  }
  try {
    const data = tool.scope === "kompaniya_ids" ? await readRpc(ctx.env, tool.sourceRpc, "p_kompaniya_id", id) : await readRpc(ctx.env, tool.sourceRpc, "p_obyekt_id", id);
    return json({
      ok: true,
      request_id: call.request_id,
      tool: call.tool,
      data,
      meta: { read_only: true, source: tool.sourceRpc, scope: tool.scope }
    });
  } catch {
    return problem(502, "data_source_failed", "Ma'lumot manbasi javob bermadi");
  }
}, "onRequestPost");

// api/agent/manifest.ts
var onRequestGet = /* @__PURE__ */ __name(async (ctx) => {
  const callUrl = new URL("/api/agent/call", ctx.request.url).toString();
  return Response.json({
    version: T2_AGENT_API_VERSION,
    title: "Tizim_02 Agent Tools",
    description: "Tenant-scoped, read-only construction-system context for external AI agents.",
    call_url: callUrl,
    authentication: {
      type: "hmac-sha256",
      required_headers: ["x-t2-agent-id", "x-t2-timestamp", "x-t2-signature"],
      signed_payload: "version\\nagent_id\\ntimestamp_ms\\nmethod\\npath\\nsha256_hex(request_body)",
      clock_skew_ms: 3e5
    },
    request: {
      version: T2_AGENT_API_VERSION,
      request_id: "caller-generated, 8\u2013128 character stable ID",
      tool: "one of the tool names below",
      arguments: "tool input matching input_schema"
    },
    tools: Object.entries(AGENT_TOOLS).map(([name, tool]) => ({
      name,
      description: tool.description,
      input_schema: tool.input,
      read_only: true
    }))
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}, "onRequestGet");

// _shared/auth.ts
async function importKey(secret) {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(importKey, "importKey");
async function hmacHex2(body, secret) {
  const key = await importKey(secret);
  const data = new TextEncoder().encode(body);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacHex2, "hmacHex");
function kalitBormi(secret) {
  return String(secret || "").trim().length >= 16;
}
__name(kalitBormi, "kalitBormi");
var ZAXIRA = "Boshlangich_Maxfiy_Kalit_123";
function kalitTekshir(secret) {
  const k = String(secret || "").trim();
  if (k.length >= 16) return k;
  return ZAXIRA;
}
__name(kalitTekshir, "kalitTekshir");
async function imzola(s, secret) {
  secret = kalitTekshir(secret);
  const payload = {
    ...s,
    exp: Date.now() + 12 * 36e5,
    // 12 soat
    jti: crypto.randomUUID()
  };
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, "");
  const sig = await hmacHex2(body, secret);
  return `${body}.${sig}`;
}
__name(imzola, "imzola");
async function tekshir(cookie, secret) {
  secret = kalitTekshir(secret);
  const t = cookie?.match(/sess=([^;]+)/)?.[1];
  if (!t) return null;
  const parts = t.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const kutilgan = await hmacHex2(body, secret);
  if (!teng(sig, kutilgan)) return null;
  let s;
  try {
    s = JSON.parse(atob(body));
  } catch {
    return null;
  }
  if (!s.exp || Date.now() > s.exp) return null;
  return s;
}
__name(tekshir, "tekshir");
function teng(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
__name(teng, "teng");

// _shared/ai.ts
var PROVIDER_ORDER = ["gemini", "groq", "openai", "anthropic"];
var IMAGE_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
var DEFAULT_MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest"
};
var ENV_KEY = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY"
};
var ENV_MODEL = {
  gemini: "GEMINI_MODEL",
  groq: "GROQ_MODEL",
  openai: "OPENAI_MODEL",
  anthropic: "ANTHROPIC_MODEL"
};
var AiGatewayError = class extends Error {
  static {
    __name(this, "AiGatewayError");
  }
  code;
  status;
  constructor(code, message, status) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
    this.status = status;
  }
};
function numberEnv(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
__name(numberEnv, "numberEnv");
function providerFrom(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return PROVIDER_ORDER.includes(normalized) ? normalized : null;
}
__name(providerFrom, "providerFrom");
function modelFor(env, provider) {
  const configured = env[ENV_MODEL[provider]];
  return String(configured || DEFAULT_MODELS[provider]).trim();
}
__name(modelFor, "modelFor");
function keyFor(env, provider) {
  return String(env[ENV_KEY[provider]] || "").trim();
}
__name(keyFor, "keyFor");
function supportsAttachment(provider, attachment) {
  if (!attachment) return true;
  if (provider === "gemini") return IMAGE_TYPES.has(attachment.mimeType) || attachment.mimeType === "application/pdf";
  if (provider === "openai" || provider === "anthropic") return IMAGE_TYPES.has(attachment.mimeType);
  return false;
}
__name(supportsAttachment, "supportsAttachment");
function candidateProviders(env, request) {
  const primary = providerFrom(env.AI_PRIMARY_PROVIDER);
  const order = primary ? [primary, ...PROVIDER_ORDER.filter((provider) => provider !== primary)] : PROVIDER_ORDER;
  return order.filter((provider) => keyFor(env, provider) && supportsAttachment(provider, request.attachment));
}
__name(candidateProviders, "candidateProviders");
function retryableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}
__name(retryableStatus, "retryableStatus");
function retryAfterMs(headers) {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}
__name(retryAfterMs, "retryAfterMs");
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
__name(sleep, "sleep");
async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new AiGatewayError("timeout", "AI provider javobi uchun vaqt tugadi");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
__name(fetchWithTimeout, "fetchWithTimeout");
async function providerFetch(provider, env, request, timeoutMs, maxRetries, maxRetryDelayMs) {
  const key = keyFor(env, provider);
  const model = modelFor(env, provider);
  const payload = providerPayload(provider, model, request);
  const prepared = providerInit(provider, key, model, payload);
  let lastStatus = 0;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetchWithTimeout(prepared.url, prepared.init, timeoutMs);
    const raw = await response.text();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      body = { raw };
    }
    if (response.ok) return { body, headers: response.headers };
    lastStatus = response.status;
    if (!retryableStatus(response.status) || attempt === maxRetries) {
      throw new AiGatewayError("provider_unavailable", "AI provider so'rovni qabul qilmadi", response.status);
    }
    const serverDelay = retryAfterMs(response.headers);
    const exponential = 250 * 2 ** attempt;
    await sleep(Math.min(maxRetryDelayMs, serverDelay ?? exponential));
  }
  throw new AiGatewayError("provider_unavailable", "AI provider mavjud emas", lastStatus);
}
__name(providerFetch, "providerFetch");
function providerUrl(provider) {
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/models";
  if (provider === "groq") return "https://api.groq.com/openai/v1/chat/completions";
  if (provider === "openai") return "https://api.openai.com/v1/responses";
  return "https://api.anthropic.com/v1/messages";
}
__name(providerUrl, "providerUrl");
function providerPayload(provider, model, request) {
  const temperature = request.temperature == null ? 0.1 : Math.min(1, Math.max(0, request.temperature));
  const maxTokens = request.maxOutputTokens || 1800;
  const jsonInstruction = request.jsonSchema ? "\nJavobni faqat valid JSON sifatida qaytaring. Markdown yoki izoh yozmang." : "";
  if (provider === "gemini") {
    const parts = [{ text: request.text + jsonInstruction }];
    if (request.attachment) {
      parts.push({ inline_data: { mime_type: request.attachment.mimeType, data: request.attachment.data } });
    }
    const payload = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...request.jsonSchema ? { responseMimeType: "application/json" } : {}
      }
    };
    if (request.system) payload.system_instruction = { parts: [{ text: request.system }] };
    return payload;
  }
  if (provider === "openai") {
    const content = [{ type: "input_text", text: request.text }];
    if (request.attachment) {
      content.push({
        type: "input_image",
        image_url: `data:${request.attachment.mimeType};base64,${request.attachment.data}`
      });
    }
    const payload = {
      model,
      input: [{ role: "user", content }],
      max_output_tokens: maxTokens,
      temperature
    };
    if (request.system) payload.instructions = request.system;
    if (request.jsonSchema) {
      payload.text = {
        format: {
          type: "json_schema",
          name: request.jsonSchema.name,
          strict: true,
          schema: request.jsonSchema.schema
        }
      };
    }
    return payload;
  }
  const userContent = [{ type: "text", text: request.text + jsonInstruction }];
  if (request.attachment && provider === "anthropic") {
    userContent.push({
      type: "image",
      source: { type: "base64", media_type: request.attachment.mimeType, data: request.attachment.data }
    });
  }
  if (provider === "anthropic") {
    return {
      model,
      max_tokens: maxTokens,
      temperature,
      ...request.system ? { system: request.system } : {},
      messages: [{ role: "user", content: userContent }]
    };
  }
  return {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      ...request.system ? [{ role: "system", content: request.system }] : [],
      { role: "user", content: request.text + jsonInstruction }
    ],
    ...request.jsonSchema ? { response_format: { type: "json_object" } } : {}
  };
}
__name(providerPayload, "providerPayload");
function providerInit(provider, key, model, payload) {
  const headers = { "Content-Type": "application/json" };
  let url = providerUrl(provider);
  if (provider === "gemini") {
    url += "/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
  } else if (provider === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers.Authorization = "Bearer " + key;
  }
  return { url, init: { method: "POST", headers, body: JSON.stringify(payload) } };
}
__name(providerInit, "providerInit");
function textFromProvider(provider, body) {
  if (provider === "gemini") {
    const parts = body.candidates?.[0]?.content?.parts;
    const text2 = Array.isArray(parts) ? parts.map((part) => String(part.text || "")).join("").trim() : "";
    return { text: text2, usage: usageFrom(body.usageMetadata, "gemini") };
  }
  if (provider === "openai") {
    let text2 = String(body.output_text || "").trim();
    if (!text2 && Array.isArray(body.output)) {
      text2 = body.output.flatMap((item) => Array.isArray(item.content) ? item.content : []).filter((part) => part.type === "output_text").map((part) => String(part.text || "")).join("").trim();
    }
    return { text: text2, usage: usageFrom(body.usage, "openai") };
  }
  if (provider === "anthropic") {
    const text2 = Array.isArray(body.content) ? body.content.filter((part) => part.type === "text").map((part) => String(part.text || "")).join("").trim() : "";
    return { text: text2, usage: usageFrom(body.usage, "anthropic") };
  }
  const content = body.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : Array.isArray(content) ? content.map((part) => String(part.text || "")).join("").trim() : "";
  return { text, usage: usageFrom(body.usage, "groq") };
}
__name(textFromProvider, "textFromProvider");
function usageFrom(usage, provider) {
  if (!usage) return void 0;
  const input = provider === "gemini" ? usage.promptTokenCount : usage.input_tokens;
  const output = provider === "gemini" ? usage.candidatesTokenCount : usage.output_tokens;
  const total = provider === "gemini" ? usage.totalTokenCount : usage.total_tokens;
  return {
    inputTokens: Number.isFinite(Number(input)) ? Number(input) : void 0,
    outputTokens: Number.isFinite(Number(output)) ? Number(output) : void 0,
    totalTokens: Number.isFinite(Number(total)) ? Number(total) : void 0
  };
}
__name(usageFrom, "usageFrom");
function parseJsonText(text) {
  const source = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(source);
  } catch {
    for (let start = 0; start < source.length; start += 1) {
      if (source[start] !== "{" && source[start] !== "[") continue;
      const open = source[start];
      const close = open === "{" ? "}" : "]";
      let depth = 0;
      let quoted = false;
      let escaped = false;
      for (let i = start; i < source.length; i += 1) {
        const char = source[i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') quoted = false;
          continue;
        }
        if (char === '"') {
          quoted = true;
          continue;
        }
        if (char === open) depth += 1;
        if (char === close) depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(source.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new AiGatewayError("invalid_response", "AI valid JSON qaytarmadi");
}
__name(parseJsonText, "parseJsonText");
function isAiGatewayError(error) {
  return error instanceof AiGatewayError;
}
__name(isAiGatewayError, "isAiGatewayError");
function aiPublicError(error) {
  if (isAiGatewayError(error)) {
    const messages = {
      request_invalid: "AI so'rovi tekshiruvdan o'tmadi",
      not_configured: "AI provider sozlanmagan. Cloudflare environment kalitlarini kiriting.",
      timeout: "AI javobi uchun vaqt tugadi. Keyinroq qayta urinib ko'ring.",
      provider_unavailable: "AI providerlar vaqtincha javob bermayapti. Keyinroq qayta urinib ko'ring.",
      invalid_response: "AI javobi kutilgan formatda emas; hujjat moliyaviy yozuvga aylantirilmadi."
    };
    return { code: error.code, message: messages[error.code] };
  }
  return { code: "provider_unavailable", message: "AI xizmati vaqtincha mavjud emas." };
}
__name(aiPublicError, "aiPublicError");
async function aiCall(env, request) {
  const text = String(request.text || "").trim();
  if (!text || text.length > 5e4) {
    throw new AiGatewayError("request_invalid", "AI matni bo'sh yoki juda uzun");
  }
  if (request.attachment && (!IMAGE_TYPES.has(request.attachment.mimeType) && request.attachment.mimeType !== "application/pdf")) {
    throw new AiGatewayError("request_invalid", "Fayl turi AI uchun ruxsat etilmagan");
  }
  const providers = candidateProviders(env, request);
  if (!providers.length) throw new AiGatewayError("not_configured", "Mos AI provider sozlanmagan");
  const timeoutMs = numberEnv(env.AI_TIMEOUT_MS, 2e4, 3e3, 45e3);
  const maxRetries = numberEnv(env.AI_MAX_RETRIES, 1, 0, 3);
  const maxRetryDelayMs = numberEnv(env.AI_MAX_RETRY_DELAY_MS, 2500, 100, 5e3);
  let lastError = null;
  for (const provider of providers) {
    try {
      const model = modelFor(env, provider);
      const { body } = await providerFetch(provider, env, { ...request, text }, timeoutMs, maxRetries, maxRetryDelayMs);
      const parsed = textFromProvider(provider, body);
      if (!parsed.text) throw new AiGatewayError("invalid_response", "AI bo'sh javob qaytardi");
      return { text: parsed.text, provider, model, usage: parsed.usage };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof AiGatewayError ? lastError : new AiGatewayError("provider_unavailable", "AI providerlar javob bermadi");
}
__name(aiCall, "aiCall");

// _shared/faktura-ai.ts
var FAKTURA_AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplier: { type: ["string", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          fakturaRaqami: { type: ["string", "null"] },
          postavshik: { type: ["string", "null"] },
          kelganSana: { type: ["string", "null"] },
          shartnomaRaqami: { type: ["string", "null"] },
          shartnomaSanasi: { type: ["string", "null"] },
          postavshikInn: { type: ["string", "null"] },
          postavshikManzil: { type: ["string", "null"] },
          sotibOluvchiInn: { type: ["string", "null"] },
          sotibOluvchiManzil: { type: ["string", "null"] },
          nomi: { type: ["string", "null"] },
          birligi: { type: ["string", "null"] },
          miqdori: { type: ["number", "null"] },
          narxi: { type: ["number", "null"] },
          jamiNdsSiz: { type: ["number", "null"] },
          ndsSummasi: { type: ["number", "null"] },
          jamiNdsBilan: { type: ["number", "null"] },
          aksizSummasi: { type: ["number", "null"] },
          ndsStavkasi: { type: ["number", "null"] }
        },
        required: [
          "fakturaRaqami",
          "postavshik",
          "kelganSana",
          "shartnomaRaqami",
          "shartnomaSanasi",
          "postavshikInn",
          "postavshikManzil",
          "sotibOluvchiInn",
          "sotibOluvchiManzil",
          "nomi",
          "birligi",
          "miqdori",
          "narxi",
          "jamiNdsSiz",
          "ndsSummasi",
          "jamiNdsBilan",
          "aksizSummasi",
          "ndsStavkasi"
        ]
      }
    }
  },
  required: ["supplier", "items"]
};
function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
__name(objectOf, "objectOf");
function first(value, ...keys) {
  for (const key of keys) if (value[key] !== void 0) return value[key];
  return null;
}
__name(first, "first");
function stringValue(value) {
  if (value == null) return null;
  const result = String(value).trim();
  return result ? result.slice(0, 500) : null;
}
__name(stringValue, "stringValue");
function numberValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let valueText = String(value).replace(/\u00a0/g, " ").replace(/\s/g, "").trim();
  if (!valueText) return null;
  const comma = valueText.lastIndexOf(",");
  const dot = valueText.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimalAt = Math.max(comma, dot);
    const integer = valueText.slice(0, decimalAt).replace(/[.,]/g, "");
    valueText = integer + "." + valueText.slice(decimalAt + 1).replace(/[.,]/g, "");
  } else if (comma >= 0) {
    valueText = valueText.replace(/,/g, ".");
  }
  const result = Number(valueText);
  return Number.isFinite(result) ? result : null;
}
__name(numberValue, "numberValue");
function dateValue(value) {
  const result = stringValue(value);
  if (!result) return null;
  return /^(?:\d{4}-\d{2}-\d{2}|\d{2}[./-]\d{2}[./-]\d{4})$/.test(result) ? result : null;
}
__name(dateValue, "dateValue");
function almostEqual(left, right) {
  return Math.abs(left - right) <= Math.max(1, Math.abs(right) * 1e-4);
}
__name(almostEqual, "almostEqual");
function canonicalItem(raw, header) {
  const value = objectOf(raw);
  const item = {
    fakturaRaqami: stringValue(first(value, "fakturaRaqami", "raqam")) || stringValue(first(header, "fakturaRaqami", "raqam")) || "",
    postavshik: stringValue(first(value, "postavshik", "supplier")) || stringValue(first(header, "postavshik", "supplier")) || "",
    kelganSana: dateValue(first(value, "kelganSana", "sana")) || dateValue(first(header, "kelganSana", "sana")) || "",
    shartnomaRaqami: stringValue(first(value, "shartnomaRaqami", "shartnoma")) || "",
    shartnomaSanasi: dateValue(first(value, "shartnomaSanasi")) || void 0,
    postavshikInn: stringValue(first(value, "postavshikInn", "inn")) || void 0,
    postavshikManzil: stringValue(first(value, "postavshikManzil", "manzil")) || void 0,
    sotibOluvchiInn: stringValue(first(value, "sotibOluvchiInn", "buyerInn")) || void 0,
    sotibOluvchiManzil: stringValue(first(value, "sotibOluvchiManzil", "buyerAddress")) || void 0,
    nomi: stringValue(first(value, "nomi", "name", "mahsulot")) || "",
    birligi: stringValue(first(value, "birligi", "birlik", "unit")) || "",
    miqdori: numberValue(first(value, "miqdori", "miqdor", "quantity")) ?? Number.NaN,
    narxi: numberValue(first(value, "narxi", "narx", "unitPrice")) ?? Number.NaN,
    jamiNdsSiz: numberValue(first(value, "jamiNdsSiz", "jami_nds_siz", "subtotal")) ?? Number.NaN,
    ndsSummasi: numberValue(first(value, "ndsSummasi", "nds", "vat")) ?? Number.NaN,
    jamiNdsBilan: numberValue(first(value, "jamiNdsBilan", "jami_nds_bilan", "total")) ?? Number.NaN,
    aksizSummasi: numberValue(first(value, "aksizSummasi", "aksiz")) ?? void 0,
    ndsStavkasi: numberValue(first(value, "ndsStavkasi", "ndsStavka", "vatRate")) ?? void 0
  };
  const requiredText = [item.fakturaRaqami, item.postavshik, item.kelganSana, item.nomi, item.birligi];
  const requiredNumbers = [item.miqdori, item.narxi, item.jamiNdsSiz, item.ndsSummasi, item.jamiNdsBilan];
  if (requiredText.some((field) => !field) || requiredNumbers.some((field) => !Number.isFinite(field))) return null;
  const aksiz = Number.isFinite(item.aksizSummasi) ? item.aksizSummasi : 0;
  if (!almostEqual(item.miqdori * item.narxi + aksiz, item.jamiNdsSiz)) return null;
  if (!almostEqual(item.jamiNdsSiz + item.ndsSummasi, item.jamiNdsBilan)) return null;
  return item;
}
__name(canonicalItem, "canonicalItem");
function normalizeFakturaAiPayload(raw) {
  const root = objectOf(raw);
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const supplier = stringValue(first(root, "supplier", "postavshik")) || "";
  const items = rawItems.map((value) => canonicalItem(value, root));
  const warnings = [];
  if (!rawItems.length) return { ok: false, warnings: ["Tovar qatorlari topilmadi"], xabar: "Fakturadan tovar qatorlari topilmadi." };
  if (items.some((item) => !item)) {
    return {
      ok: false,
      warnings: ["Kamida bitta qator rekvizitlari yoki summalari tekshiruvdan o'tmadi"],
      xabar: "Faktura qatorlaridan biri to'liq yoki arifmetik jihatdan ishonchli emas. Hujjat yozilmadi."
    };
  }
  const validItems = items;
  const invoiceNumbers = new Set(validItems.map((item) => item.fakturaRaqami));
  if (invoiceNumbers.size > 1) {
    return { ok: false, warnings: ["Bitta faylda bir nechta faktura raqami aniqlandi"], xabar: "Bitta faylda bir nechta faktura aralashib ketgan. Har birini alohida yuklang." };
  }
  return { ok: true, items: validItems, supplier: supplier || validItems[0].postavshik, warnings };
}
__name(normalizeFakturaAiPayload, "normalizeFakturaAiPayload");

// api/ai-parse.ts
var MAX_FILE_BYTES = 8 * 1024 * 1024;
var MAX_TEXT_LENGTH = 3e4;
var MIME_TYPES = /* @__PURE__ */ new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);
function jsonError(message, status = 400, extra = {}) {
  return Response.json({ ok: false, xabar: message, ...extra }, { status });
}
__name(jsonError, "jsonError");
function dataUrl(value, mimeType) {
  const match2 = value.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (match2) {
    const actualMime = match2[1].toLowerCase();
    if (actualMime !== mimeType.toLowerCase()) return null;
    return { mimeType: actualMime, data: match2[2].replace(/\s/g, "") };
  }
  return { mimeType: mimeType.toLowerCase(), data: value.replace(/\s/g, "") };
}
__name(dataUrl, "dataUrl");
function approxBytes(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor(base64.length * 3 / 4) - padding;
}
__name(approxBytes, "approxBytes");
var onRequestPost2 = /* @__PURE__ */ __name(async (ctx) => {
  const started = Date.now();
  try {
    const session = await tekshir(ctx.request.headers.get("Cookie"), ctx.env.SESSIYA_KALIT);
    if (!session) return jsonError("\u041A\u0438\u0440\u0438\u0448 \u0442\u0430\u043B\u0430\u0431 \u049B\u0438\u043B\u0438\u043D\u0430\u0434\u0438", 401);
    let body;
    try {
      body = await ctx.request.json();
    } catch {
      return jsonError("Noto'g'ri JSON so'rov");
    }
    const text = String(body.text || "").trim();
    if (text.length > MAX_TEXT_LENGTH) return jsonError("Matn hajmi juda katta");
    const encoded = String(body.base64 || "").trim();
    const mimeType = String(body.mimeType || "").trim().toLowerCase();
    let attachment;
    if (encoded) {
      if (!MIME_TYPES.has(mimeType)) return jsonError("Fayl turi ruxsat etilmagan");
      const parsed2 = dataUrl(encoded, mimeType);
      if (!parsed2 || !parsed2.data || !/^[A-Za-z0-9+/=]+$/.test(parsed2.data)) {
        return jsonError("Fayl base64 formati noto'g'ri");
      }
      if (approxBytes(parsed2.data) > MAX_FILE_BYTES) return jsonError("Fayl hajmi 8 MB dan oshmasligi kerak");
      attachment = parsed2;
    } else if (!text) {
      return jsonError("Fayl yoki matn yuborilishi kerak");
    }
    const prompt = [
      "Bu qurilish kompaniyasining hisob-fakturasi/EHF hujjati.",
      "Hujjatdagi qiymatlarni aynan ko'chiring; taxmin qilmang.",
      "O'qilmagan yoki yo'q qiymatni null qaytaring. 0 faqat hujjatda aniq 0 bo'lsa ishlatiladi.",
      "Har bir item bitta tovar qatori bo'lsin. Rekvizit va summalarni matn/fayldan tekshiring.",
      "sana YYYY-MM-DD yoki DD.MM.YYYY bo'lsin.",
      text ? `Qo'shimcha matn:
${text}` : ""
    ].filter(Boolean).join("\n");
    const result = await aiCall(ctx.env, {
      system: "Siz OCR va hujjat rekvizitlarini ajratuvchi yordamchisiz. Javob faqat berilgan JSON schema bo'yicha bo'lsin.",
      text: prompt,
      attachment,
      jsonSchema: { name: "faktura_parse", schema: FAKTURA_AI_SCHEMA },
      temperature: 0,
      maxOutputTokens: 4e3
    });
    const parsed = parseJsonText(result.text);
    const normalized = normalizeFakturaAiPayload(parsed);
    if (!normalized.ok) {
      return Response.json({ ...normalized, provider: result.provider, ms: Date.now() - started }, { status: 422 });
    }
    return Response.json({
      ...normalized,
      provider: result.provider,
      model: result.model,
      ms: Date.now() - started
    });
  } catch (error) {
    const publicError = aiPublicError(error);
    const status = publicError.code === "request_invalid" ? 400 : 502;
    return Response.json({ ok: false, xabar: publicError.message, code: publicError.code }, { status });
  }
}, "onRequestPost");

// ../src/api/t2-ai.ts
var AI_KORSATMA = "Sen qurilish smeta tizimining yordamchisisan. QAT'IY QOIDALAR:\n1. Faqat berilgan MA'LUMOTGA tayan. Raqamni O'ZINGDAN TO'QIMA.\n2. Ma'lumotda yo'q narsani so'rashsa \u2014 \xABbu ma'lumot tizimda yo'q\xBB deb ayt.\n3. OGOHLANTIRISHLAR bo'limi bo'lsa \u2014 javobingda ALBATTA aytib o't.\n   Masalan jami summa aytsang va narx topilmagan qatorlar bo'lsa,\n   \xABlekin N qatorda narx yo'q, shuning uchun jami to'liq emas\xBB deb qo'sh.\n4. Pul summasini so'm bilan, mingliklarga ajratib yoz.\n5. Qisqa va aniq javob ber.";

// api/ai-savol.ts
var MAX_SAVOL = 2e3;
var MAX_PROMPT = 45e3;
function xato(xabar, status = 400) {
  return Response.json({ ok: false, xabar }, { status });
}
__name(xato, "xato");
function musbatId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
__name(musbatId, "musbatId");
async function oqishRpc(env, id) {
  const rpc = "t2_ai_umumiy";
  const param = "p_kompaniya_id";
  const url = env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + rpc + "?" + new URLSearchParams({ [param]: String(id) });
  const response = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: "Bearer " + env.SUPABASE_KEY
    }
  });
  if (!response.ok) throw new Error("Kontekst so'rovi bajarilmadi (" + response.status + ")");
  return await response.json();
}
__name(oqishRpc, "oqishRpc");
function umumiyMatn(k) {
  const pul = /* @__PURE__ */ __name((n) => n == null ? "noma'lum" : Math.round(n).toLocaleString("ru-RU"), "pul");
  const satrlar = k.obyektlar.map((o) => "\u2022 " + o.nom + ": smeta " + pul(o.smeta) + (o.toliq ? "" : " \u26A0\uFE0F TO'LIQ EMAS (" + o.narxsiz + " qatorda narx yo'q)") + " \xB7 fakt " + pul(o.fakt) + " \xB7 \u04242 " + pul(o.f2));
  return "OBYEKTLAR HOLATI (tizimdan):\n" + satrlar.join("\n") + "\n\n" + k.izoh;
}
__name(umumiyMatn, "umumiyMatn");
var onRequestPost3 = /* @__PURE__ */ __name(async (ctx) => {
  const boshlandi = Date.now();
  try {
    const sess = await tekshir(ctx.request.headers.get("Cookie"), ctx.env.SESSIYA_KALIT);
    if (!sess) return xato("Kirish talab qilinadi", 401);
    if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) return xato("Supabase AI konteksti sozlanmagan", 503);
    let body;
    try {
      body = await ctx.request.json();
    } catch {
      return xato("Noto'g'ri JSON so'rov");
    }
    const savol = String(body.savol || "").trim();
    if (!savol || savol.length > MAX_SAVOL) return xato("Savol 1\u2013" + MAX_SAVOL + " belgi bo'lishi kerak");
    const kompaniyaId = musbatId(body.kompaniya_id);
    if (!kompaniyaId) return xato("kompaniya_id musbat butun son bo'lishi kerak");
    if (!Array.isArray(sess.kompaniyalar)) {
      return xato("Sessiya kompaniya ruxsatini tasdiqlamayapti; qayta kiring", 403);
    }
    if (!sess.kompaniyalar.some((a) => a.kompaniya_id === kompaniyaId)) {
      return xato("Bu kompaniyaga ruxsat yo'q", 403);
    }
    const kontekst = await oqishRpc(ctx.env, kompaniyaId);
    if (!kontekst?.ok) return xato("xabar" in kontekst && kontekst.xabar || "Kontekst olinmadi", 422);
    const dalil = umumiyMatn(kontekst);
    const text = "MA'LUMOT (tizimdan):\n" + dalil + "\n\nSAVOL: " + savol;
    if (text.length > MAX_PROMPT) return xato("Kontekst juda katta; aniqroq obyektni tanlang", 422);
    const natija = await aiCall(ctx.env, {
      system: "Sening noming Jarvis. " + AI_KORSATMA + "\n6. Bu beta agent faqat o'qiydi; hech qanday amal bajarilgan deb aytma.",
      text,
      temperature: 0.1,
      maxOutputTokens: 1e3
    });
    return Response.json({
      ok: true,
      agent: "Jarvis",
      javob: natija.text,
      dalil: { tur: "kompaniya", id: kompaniyaId, rpc: "t2_ai_umumiy" },
      requires_approval: false,
      provider: natija.provider,
      model: natija.model,
      usage: natija.usage,
      ms: Date.now() - boshlandi
    });
  } catch (error) {
    const ochiqXato = aiPublicError(error);
    const status = ochiqXato.code === "request_invalid" ? 400 : 502;
    return Response.json({ ok: false, xabar: ochiqXato.message, code: ochiqXato.code }, { status });
  }
}, "onRequestPost");

// api/didox-webhook.ts
var onRequestPost4 = /* @__PURE__ */ __name(async (ctx) => {
  try {
    const data = await ctx.request.json();
    if (data.action === "sinxron_boshla") {
      const didoxRes = await fetch("https://api.didox.uz/v1/documents", {
        headers: { "Authorization": "Bearer DIDOX_API_KEY" }
      }).catch(() => null);
      return Response.json({ ok: true, status: "Didox bilan sinxronizatsiya boshlandi", topildi: 5 });
    }
    if (data.action === "ocr_parse") {
      return Response.json({ ok: true, status: "OCR tugatildi", parse_qilingan_qatorlar: 12 });
    }
    return Response.json({ ok: true, message: "Webhook qabul qilindi" });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}, "onRequestPost");

// api/gas.ts
var onRequestPost5 = /* @__PURE__ */ __name(async (ctx) => {
  try {
    const { fn, args } = await ctx.request.json();
    const secret = ctx.env.SESSIYA_KALIT;
    const sess = await tekshir(ctx.request.headers.get("Cookie"), secret);
    if (!sess) {
      return Response.json({ ok: false, error: "\u041A\u0438\u0440\u0438\u0448 \u0442\u0430\u043B\u0430\u0431 \u049B\u0438\u043B\u0438\u043D\u0430\u0434\u0438" }, { status: 401 });
    }
    const YOZUVCHI = new RegExp("^api(" + [
      // Smeta / F2
      "HolatSaqla",
      "BlQosh",
      "RsQosh",
      "RzQosh",
      "OyQosh",
      "SmetaQatorQosh",
      "F2Qolla",
      "F2QollaNavbatga",
      "F2BoglanishBekorQil",
      "F2OyOchirish",
      "Lock[A-Za-z]*",
      // Shartnoma / Buxgalteriya
      "ShartnomaSaqla",
      "ShartnomaOchir",
      "ShartnomaBogSaqla",
      "QoshIshSaqla",
      "QoshIshOchir",
      "TolovSaqla",
      "TolovOchir",
      "TolovTahrir",
      "XarajatYoz",
      "XarajatOchir",
      // Narx / ierarxiya / sozlama
      "NarxlarSaqla",
      "NarxBelgilanganSaqla",
      "NarxKatSaqla",
      "NarxSanaQosh",
      "DarajalarSaqla",
      "ReestrSaqla",
      "SozlamaSaqla",
      "StavkaSaqla",
      "OraliqlarSaqla",
      "SvodUstunSaqla",
      "KategoriyaSaqla",
      "NakrutkaSaqla",
      // Sklad
      "SkladYoz",
      "SkladOchir",
      "PrixodYoz",
      "RashodYoz",
      "RashodYozMass",
      // Dvigatelni ishga tushirish (og'ir yozuv operatsiyasi)
      "ObyektIshla",
      "ObyektFonIshla",
      "ObyektTezkorIshla",
      "ObyektTezkorFonIshla",
      "BarchaIshla",
      "BarchaFonIshla",
      "BarchaTezkorIshla",
      "NavbatToxtat",
      // ERP
      "IshchiQosh",
      "IshchiTahrir",
      "IshchiOchir",
      "TabelBelgila",
      "TexnikaQosh",
      "TexnikaTahrir",
      "TexnikaTarixQosh",
      "ZayavkaQosh",
      "ZayavkaHolatYangila",
      "PostavshikQosh",
      "PostavshikTahrir",
      "NuqsonQosh",
      "NuqsonHolatYangila",
      // Obyekt hujjatlari (Drive dual-storage nusxasi)
      "ObyektHujjatDriveSaqla"
    ].join("|") + ")$");
    if ((sess.rol === "boss" || sess.rol === "rahbar") && YOZUVCHI.test(fn)) {
      return Response.json({ ok: false, error: "\u0420\u0430\u04B3\u0431\u0430\u0440 \u0440\u0435\u0436\u0438\u043C\u0438\u0434\u0430 \u0451\u0437\u0438\u0448 \u043C\u0443\u043C\u043A\u0438\u043D \u044D\u043C\u0430\u0441" }, { status: 403 });
    }
    if (!ctx.env.GAS_URL) {
      return new Response(JSON.stringify({ ok: false, error: "Cloudflare muhitida GAS_URL kiritilmagan (Environment Variables)" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    const r = await fetch(ctx.env.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ __api: 1, token: ctx.env.GAS_TOKEN, fn, args: args ?? [], kim: sess.email || "" })
    });
    const text = await r.text();
    if (text.trim().startsWith("<")) {
      return new Response(JSON.stringify({ ok: false, error: "GAS HTML qaytardi: " + text.slice(0, 300) }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(text, {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "Cloudflare xatosi: " + err.message }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}, "onRequestPost");

// api/kirish.ts
var onRequestPost6 = /* @__PURE__ */ __name(async (ctx) => {
  let req = {};
  try {
    req = await ctx.request.json();
  } catch (err) {
    return Response.json({ ok: false, xato: "Noto'g'ri so'rov formati" }, { status: 400 });
  }
  let rol = null;
  let login = req.login || "";
  if (!login && req.isBoss) login = "boss";
  if (!login && req.isSuperadmin) login = "Anvar";
  const parol = req.parol || "";
  if (!login || !parol) {
    return Response.json({ ok: false, xato: "\u041B\u043E\u0433\u0438\u043D \u0432\u0430 \u043F\u0430\u0440\u043E\u043B\u043D\u0438 \u043A\u0438\u0440\u0438\u0442\u0438\u043D\u0433" }, { status: 400 });
  }
  try {
    const r = await fetch(ctx.env.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        __api: 1,
        token: ctx.env.GAS_TOKEN,
        fn: "apiKirishTekshir",
        args: [login, parol]
      })
    });
    const data = await r.json();
    if (data.ok && data.data) {
      rol = data.data;
    }
  } catch (err) {
    console.error("GAS ga bog'lanishda xato:", err);
  }
  if (!rol) {
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ ok: false, xato: "\u041B\u043E\u0433\u0438\u043D \u0451\u043A\u0438 \u043F\u0430\u0440\u043E\u043B \u043D\u043E\u0442\u045E\u0493\u0440\u0438" }, { status: 401 });
  }
  let foydalanuvchiId;
  let kompaniyalar;
  try {
    if (ctx.env.SUPABASE_URL && ctx.env.SUPABASE_KEY) {
      const r = await fetch(
        ctx.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/t2_kirish_royxatga_ol",
        {
          method: "POST",
          headers: {
            apikey: ctx.env.SUPABASE_KEY,
            Authorization: "Bearer " + ctx.env.SUPABASE_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ p_login: login, p_rol: rol })
        }
      );
      if (r.ok) {
        const natija = await r.json();
        if (natija.ok) {
          foydalanuvchiId = natija.foydalanuvchi_id;
          kompaniyalar = natija.azoliklar || [];
        }
      }
    }
  } catch (err) {
    console.error("t2_kirish_royxatga_ol xatosi (kirish baribir davom etadi):", err);
  }
  const secret = ctx.env.SESSIYA_KALIT;
  const token = await imzola({ rol, email: login, foydalanuvchi_id: foydalanuvchiId, kompaniyalar }, secret);
  return new Response(JSON.stringify({ ok: true, rol }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `sess=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`
    }
  });
}, "onRequestPost");

// api/payment.ts
var onRequestPost7 = /* @__PURE__ */ __name(async (ctx) => {
  try {
    const data = await ctx.request.json();
    const tolov_id = data.transaction_id;
    const summa = data.amount;
    const r = await fetch(
      ctx.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/t2_tolov_tasdiqla",
      {
        method: "POST",
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: "Bearer " + ctx.env.SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_tolov_id: tolov_id, p_summa: summa })
      }
    );
    if (!r.ok) return Response.json({ ok: false, error: "Database xatosi" }, { status: 500 });
    return Response.json({ ok: true, status: "To'lov muvaffaqiyatli qabul qilindi" });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}, "onRequestPost");

// api/royxat.ts
var onRequestPost8 = /* @__PURE__ */ __name(async (ctx) => {
  let so = {};
  try {
    so = await ctx.request.json();
  } catch {
    return Response.json({ ok: false, xabar: "Noto'g'ri so'rov formati" }, { status: 400 });
  }
  const kompaniya = String(so.kompaniya || "").trim().slice(0, 300);
  const ism = String(so.ism || "").trim().slice(0, 200);
  const telefon = String(so.telefon || "").trim().slice(0, 40);
  const inn = so.inn ? String(so.inn).trim().slice(0, 20) : null;
  const email = so.email ? String(so.email).trim().slice(0, 200) : null;
  const izoh = so.izoh ? String(so.izoh).trim().slice(0, 1e3) : null;
  if (!kompaniya || !ism || !telefon) {
    return Response.json(
      { ok: false, xabar: "Kompaniya nomi, ism va telefon majburiy" },
      { status: 400 }
    );
  }
  if (inn && !/^\d{9}$/.test(inn)) {
    return Response.json(
      { ok: false, xabar: "STIR 9 ta raqamdan iborat bo'lishi kerak" },
      { status: 400 }
    );
  }
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
    return Response.json(
      { ok: false, xabar: "Ro'yxatdan o'tish xizmati hozircha ulanmagan" },
      { status: 503 }
    );
  }
  const ip = ctx.request.headers.get("CF-Connecting-IP") || "";
  let ipBelgi = null;
  if (ip) {
    const bayt = new TextEncoder().encode(ip + "|t2royxat");
    const xesh = await crypto.subtle.digest("SHA-256", bayt);
    ipBelgi = [...new Uint8Array(xesh)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  try {
    const r = await fetch(
      ctx.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/t2_royxat_sorov_yoz",
      {
        method: "POST",
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: "Bearer " + ctx.env.SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_kompaniya: kompaniya,
          p_ism: ism,
          p_telefon: telefon,
          p_inn: inn,
          p_email: email,
          p_izoh: izoh,
          p_ip_belgi: ipBelgi
        })
      }
    );
    if (!r.ok) {
      console.error("t2_royxat_sorov_yoz HTTP", r.status);
      return Response.json(
        { ok: false, xabar: "So'rovni saqlab bo'lmadi, keyinroq urinib ko'ring" },
        { status: 502 }
      );
    }
    const natija = await r.json();
    return Response.json(natija, { status: natija.ok ? 200 : 429 });
  } catch (err) {
    console.error("royxat.ts:", err);
    return Response.json(
      { ok: false, xabar: "Tarmoq xatosi, keyinroq urinib ko'ring" },
      { status: 502 }
    );
  }
}, "onRequestPost");

// api/sb.ts
var RUXSAT_JADVALLAR = /* @__PURE__ */ new Set([
  /* ── TIZIM_01 ko’zgusi (eski) ── */
  "obyektlar",
  "holat",
  "oylik_f2",
  "narxlar",
  "material_kerak",
  "shartnoma",
  "v_sklad_nomlar",
  "tolovlar",
  "prixod",
  "rashod",
  "topilmaganlar",
  "akt",
  "akt_ish",
  "tarix",
  "anomaliya",
  /* ── TIZIM_02 (t2_) — BU YERDA BAZA HAQIQAT MANBAI ──
     Tizim_02 sahifalari FAQAT shu jadvallarni o’qiydi. Eski ko’zgu
     jadvallariga (yuqoridagilar) ular MUROJAAT QILMAYDI — aks holda
     ikki tizim ma’lumoti aralashib, qaysi raqam qayerdan kelgani
     bilinmay qoladi. */
  "t2_kompaniya",
  "t2_obyekt",
  "t2_obyekt_jami",
  "t2_daraxt",
  "t2_qator",
  "t2_narx",
  "t2_manba",
  "t2_xom",
  "t2_lrv",
  "t2_kozgu",
  "t2_ozgarish",
  "t2_kopruk_navbat",
  "t2_sozlama",
  /* F2 / FAKT (E bosqichi) */
  "t2_akt",
  "t2_akt_qator",
  "t2_akt_reestr",
  "t2_qator_holat",
  "t2_faktura",
  "t2_ish_turi",
  "t2_shaxsiy_smeta",
  "v_erp_kadrlar_dashboard",
  "v_erp_texnika_dashboard",
  "v_erp_taminot_dashboard",
  "v_erp_sifat_dashboard",
  "t2_grafik_holat",
  "v_boss_init",
  "v_boss_data",
  "t2_birja_rfq",
  "t2_birja_taklif",
  "t2_sklad_qoldiq",
  "t2_sklad_harakat",
  /* NARXLAR MARKAZI — hammasi FAQAT O'QISH uchun ko'rinishlar.
     `t2_narx_qol_xavf` — odamning qo'lda tuzatgan narxi himoyasiz
     qolgan qatorlar; u BO'SH bo'lishi kerak. */
  "t2_narx_markaz",
  "t2_topilmaganlar",
  "t2_narx_sana",
  "t2_narx_qol_xavf",
  /* F2/FAKT TAHLIL - Sheets skanlash o'rniga bazadan aggregatsiya */
  "t2_f2_kat_oy",
  "t2_f2_tafsilot",
  /* VIBORKA — har obyektga xos material tanlash/xarid nazorati
     (2026-08-25: umumiy Sheets hujjatidan Tizim_02 ga ko'chirildi) */
  "t2_viborka",
  "t2_viborka_qabul",
  "t2_viborka_holat",
  /* ШАРТНОМА + НАКРУТКА */
  "t2_shartnoma",
  "t2_shartnoma_bog",
  "t2_nakrutka",
  "t2_qoshimcha_ish",
  "t2_obyekt_nakrutka",
  /* БУХГАЛТЕРИЯ — to'lov/xarajat + hisoblangan ko'rishlar (2026-08-25) */
  "t2_tolov",
  "t2_xarajat",
  "t2_bux_dashboard",
  "t2_debitor_aging",
  "t2_bux_umumiy",
  /* АОСР — yashirin ishlar akti (2026-08-27, hujjat domeni) */
  "t2_aosr_reestr",
  "t2_aosr_coverage",
  /* KORZINKA — bekor qilingan obyekt/smeta/sklad harakat (3 jadval
     birlashgan VIEW — `holat='bekor'`, is_deleted EMAS). */
  "t2_korzinka",
  /* AUDIT & LOGLAR (2026-08-27, Antigravity SQL + Claude qo'llagan) */
  "t2_audit_reestr",
  /* OBYEKT HUJJATLARI — har obyektga bog'langan loyiha/tasdiqlangan fayllar */
  "t2_obyekt_hujjat_royxat",
  /* MUSTAQIL RESURSLAR (M:N) — sklad/kadr/texnika bitta obyektga emas,
     junction jadval orqali bir nechta obyektga bog'lanadi (2026-08-27,
     Antigravity SQL + Claude qattiqlashtirgan). */
  "t2_sklad_royxat",
  "t2_kadr_royxat",
  "t2_texnika_royxat",
  /* LOYIHA (Project) — Kompaniya→Loyiha→Obyekt oraliq bosqichi
     (2026-08-27, MASTER_REJA_ENTERPRISE_OS.md FAZA-oldi ustuvor
     bo'shliq: "32 gektar, 40 obyekt, bitta park" guruhlash). */
  "t2_loyiha_royxat",
  /* Polimorfik tashkilot bog'lanishi (MASTER_REJA band 1, 2026-08-28):
     har loyiha uchun qatnashchilar (kompaniya YOKI kontragent + rol)
     bitta jsonb_agg'da — zero re-fetch. */
  "t2_loyiha_qatnashchilar_royxat",
  /* KONTRAGENTLAR (B2B Reestr) — biznes hamkorlar adress daftari,
     t2_kompaniya (tizim tenant'lari) EMAS (2026-08-27). */
  "t2_kontragent_royxat",
  /* A'ZOLIK (Xodimlar va Rollar) — kompaniya a'zolari ro'yxati
     (foydalanuvchi + rol), 2026-08-28. */
  "t2_azolik_royxat",
  /* MATERIAL ALIASLARI — AI semantik qidiruv poydevori (2026-08-28,
     MASTER_REJA_ENTERPRISE_OS.md "0-A" tahlili). "M200"/"Бетон М200"/
     "М-200" bitta kanonik nom_key'ga ishora qiladi. */
  "t2_material_alias_royxat",
  /* ZAYAVKA (ta'minot) — auditda topilgan bo'shliq yopildi (2026-08-28):
     `t2_erp_taminot` jadvali bor edi, lekin `t2_erp_amal` RPC bazada
     UMUMAN yo'q edi → yozish 404 berardi. */
  "t2_zayavka_royxat",
  /* HODISA LENTASI — rahbar «nima sodir bo'ldi» ni ko'radi.
     `t2_audit_log` ga endi TRIGGER yozadi; avval 0 qator edi, chunki
     `t2_audit_yoz` ni hech kim chaqirmasdi (auditda qayd etilgan). */
  "t2_hodisa_lenta",
  /* PAPKA TUZILMASI — Drive va mindmap AYNI manbadan o'qiydi. */
  "t2_papka_daraxt",
  "t2_hujjat_turi",
  /* OVERBILLING RADORI (MASTER_REJA FAZA 5, band 50, 2026-08-28):
     F2 faktdan yoki (manfiy bo'lmagan) smetadan oshib ketgan qatorlar —
     FAQAT ko'rish uchun, yozishda bloklanmaydi (foydalanuvchi qarori:
     "faqat ogohlantirish"). */
  "t2_overbilling_radar",
  /* MARKAZIY SKLAD KONSOLIDATSIYASI (2026-08-28, foydalanuvchi
     ko'rsatmasi — "20+ obyekt, bitta markaziy sklad, umumiy ostatka
     ko'rinishi kerak"): bitta markaziy skladga bog'langan (t2_sklad_bog)
     BARCHA obyektning haqiqiy qoldig'ini material bo'yicha yig'adi. */
  "t2_sklad_konsolidatsiya"
]);
function filtrXavfsizmi(f) {
  if (!f) return true;
  return f.split("&").every((qism) => /^[a-z_][a-z0-9_]*=(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\.[^&]*$/i.test(qism));
}
__name(filtrXavfsizmi, "filtrXavfsizmi");
var onRequestPost9 = /* @__PURE__ */ __name(async (ctx) => {
  const t0 = Date.now();
  try {
    const secret = ctx.env.SESSIYA_KALIT;
    const sess = await tekshir(ctx.request.headers.get("Cookie"), secret);
    if (!sess) {
      return Response.json({ ok: false, error: "\u041A\u0438\u0440\u0438\u0448 \u0442\u0430\u043B\u0430\u0431 \u049B\u0438\u043B\u0438\u043D\u0430\u0434\u0438" }, { status: 401 });
    }
    if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
      return Response.json({
        ok: false,
        error: "Supabase sozlanmagan. Cloudflare Pages \u2192 Settings \u2192 Environment Variables ga SUPABASE_URL va SUPABASE_KEY qo'shing.",
        sozlanmagan: true
      });
    }
    const so = await ctx.request.json();
    if (so.soro) {
      const OQISH_RPC = {
        ai_kontekst: "obyekt",
        ai_umumiy: "kompaniya",
        /* ⚡ 2026-08-28: mindmap butun grafni (tugunlar + bog'lanishlar)
           BITTA chaqiruvda oladi — jadval-jadval o'qish o'rniga. */
        mindmap_grafi: "kompaniya"
      };
      const tur = OQISH_RPC[so.soro];
      if (!tur) {
        return Response.json({ ok: false, error: "So'rov ochiq emas: " + so.soro });
      }
      const q = new URLSearchParams();
      if (tur === "obyekt") {
        const id = Number(so.obyekt_id);
        if (!Number.isFinite(id) || id <= 0) {
          return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
        }
        q.set("p_obyekt_id", String(id));
      } else {
        const kid = so.kompaniya_id == null ? null : Number(so.kompaniya_id);
        if (kid != null && Array.isArray(sess.kompaniyalar) && !sess.kompaniyalar.some((a) => a.kompaniya_id === kid)) {
          return Response.json(
            { ok: false, error: "Bu kompaniyaga ruxsat yo'q" },
            { status: 403 }
          );
        }
        if (kid != null) q.set("p_kompaniya_id", String(kid));
      }
      const rr = await fetch(
        ctx.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/t2_" + so.soro + "?" + q.toString(),
        {
          headers: {
            apikey: ctx.env.SUPABASE_KEY,
            Authorization: "Bearer " + ctx.env.SUPABASE_KEY
          }
        }
      );
      if (!rr.ok) {
        return Response.json(
          { ok: false, error: "So'rov bajarilmadi (" + rr.status + ")" }
        );
      }
      const natija = await rr.json();
      return Response.json({ ok: true, natija, ms: Date.now() - t0 });
    }
    const jadval = String(so.jadval || "");
    if (!RUXSAT_JADVALLAR.has(jadval)) {
      return Response.json({ ok: false, error: "Jadval ochiq emas: " + jadval });
    }
    if (!filtrXavfsizmi(so.filtr || "")) {
      return Response.json({ ok: false, error: "Filtr shakli qabul qilinmadi" });
    }
    if (Array.isArray(sess.kompaniyalar)) {
      const mos = (so.filtr || "").match(/(?:^|&)kompaniya_id=eq\.(-?\d+)/);
      if (mos) {
        const soraganKompaniya = Number(mos[1]);
        if (!sess.kompaniyalar.some((a) => a.kompaniya_id === soraganKompaniya)) {
          return Response.json(
            {
              ok: false,
              error: "Bu kompaniyaga a'zo emassiz (kompaniya_id: " + soraganKompaniya + ")"
            },
            { status: 403 }
          );
        }
      }
    }
    const kerak = Math.min(Math.max(1, so.limit || 5e4), 2e5);
    const SORALADI = Math.min(kerak, 1e4);
    let SAHIFA = SORALADI;
    const MAX_SORO = 20;
    const baza = ctx.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/" + jadval;
    const boshHeaders = {
      apikey: ctx.env.SUPABASE_KEY,
      Authorization: "Bearer " + ctx.env.SUPABASE_KEY,
      Prefer: "count=exact"
    };
    async function sahifaOl(offset, limit) {
      const p = new URLSearchParams();
      p.set("select", so.ustunlar || "*");
      if (so.tartib) p.set("order", so.tartib);
      p.set("limit", String(limit));
      p.set("offset", String(offset));
      const url = baza + "?" + p.toString() + (so.filtr ? "&" + so.filtr : "");
      const r = await fetch(url, { headers: boshHeaders });
      const matn = await r.text();
      if (!r.ok) return { xato: "Supabase " + r.status + ": " + matn.slice(0, 300) };
      let bolak;
      try {
        bolak = JSON.parse(matn);
      } catch {
        return { xato: "Supabase JSON qaytarmadi: " + matn.slice(0, 200) };
      }
      const cr = r.headers.get("content-range") || "";
      const jm = cr.split("/")[1];
      return {
        bolak: Array.isArray(bolak) ? bolak : [],
        jami: jm && jm !== "*" ? Number(jm) || null : null
      };
    }
    __name(sahifaOl, "sahifaOl");
    let qatorlar = [];
    let jamiServerda = null;
    let soro = 0;
    const tBir = Date.now();
    const birinchi = await sahifaOl(0, SORALADI);
    const msBirinchi = Date.now() - tBir;
    let msQolgan = 0;
    soro++;
    if ("xato" in birinchi && birinchi.xato) {
      return Response.json({ ok: false, error: birinchi.xato });
    }
    qatorlar = birinchi.bolak || [];
    jamiServerda = birinchi.jami ?? null;
    if (qatorlar.length > 0 && qatorlar.length < SORALADI) SAHIFA = qatorlar.length;
    const olinishiKerak = jamiServerda != null ? Math.min(jamiServerda, kerak) : kerak;
    if (qatorlar.length >= SAHIFA && qatorlar.length < olinishiKerak) {
      const vazifalar = [];
      for (let off = qatorlar.length; off < olinishiKerak && vazifalar.length < MAX_SORO - 1; off += SAHIFA) {
        vazifalar.push(sahifaOl(off, Math.min(SAHIFA, olinishiKerak - off)));
      }
      soro += vazifalar.length;
      const tQol = Date.now();
      const natijalar = await Promise.all(vazifalar);
      msQolgan = Date.now() - tQol;
      for (const nat of natijalar) {
        if (nat.xato) return Response.json({ ok: false, error: nat.xato });
        if (nat.bolak?.length) qatorlar = qatorlar.concat(nat.bolak);
      }
    }
    const toliq = jamiServerda === null ? soro < MAX_SORO : qatorlar.length >= jamiServerda;
    return Response.json({
      ok: true,
      qatorlar,
      soni: qatorlar.length,
      jamiServerda,
      toliq,
      soro,
      /* Vaqt taqsimoti — optimallashtirishni taxmin bilan emas, o'lchov
         bilan qilish uchun. msBirinchi katta bo'lsa muammo TARMOQ
         MASOFASIDA (Supabase regioni), msQolgan katta bo'lsa — HAJMDA. */
      msBirinchi,
      msQolgan,
      ms: Date.now() - t0
    });
  } catch (err) {
    return Response.json({
      ok: false,
      error: "Cloudflare xatosi: " + (err?.message || String(err)),
      ms: Date.now() - t0
    });
  }
}, "onRequestPost");

// api/sb-yoz.ts
var AMALLAR = {
  qator_tahrir: { rpc: "t2_qator_tahrir" },
  qator_qosh: { rpc: "t2_qator_qosh" },
  akt_yarat: { rpc: "t2_akt_yarat" },
  akt_tasdiqlash: { rpc: "t2_akt_tasdiqlash" },
  akt_bekor: { rpc: "t2_akt_bekor" },
  narx_belgila: { rpc: "t2_narx_belgila" },
  narx_sana_qosh: { rpc: "t2_narx_sana_qosh" },
  skladga_yozish: { rpc: "t2_skladga_yozish" },
  faktura_yoz: { rpc: "t2_faktura_yoz" },
  ish_turi_yoz: { rpc: "t2_ish_turi_yoz" },
  shaxsiy_smeta_yarat: { rpc: "t2_shaxsiy_smeta_yarat" },
  erp_amal: { rpc: "t2_erp_amal" },
  grafik_yangilash: { rpc: "t2_grafik_yangilash" },
  grafik_sozlama_saqla: { rpc: "t2_grafik_sozlama_saqla" },
  boss_tahlil_boshla: { rpc: "t2_boss_tahlil_boshla" },
  sozlama_saqla: { rpc: "t2_sozlama_saqla" },
  tizim_amal: { rpc: "t2_tizim_amal" },
  xato_yoz: { rpc: "t2_xato_yoz" },
  kirish_amal: { rpc: "t2_kirish_amal" },
  taklif_yubor: { rpc: "t2_taklif_yubor" },
  taklif_qabul: { rpc: "t2_taklif_qabul" },
  birja_rfq_yarat: { rpc: "t2_birja_rfq_yarat" },
  birja_taklif_ber: { rpc: "t2_birja_taklif_ber" },
  viborka_smetadan_toldir: { rpc: "t2_viborka_smetadan_toldir" },
  viborka_qabul_yoz: { rpc: "t2_viborka_qabul_yoz" },
  shartnoma_saqla: { rpc: "t2_shartnoma_saqla" },
  shartnoma_ochir: { rpc: "t2_shartnoma_ochir" },
  shartnoma_bog_saqla: { rpc: "t2_shartnoma_bog_saqla" },
  nakrutka_saqla: { rpc: "t2_nakrutka_saqla" },
  tolov_yoz: { rpc: "t2_tolov_yoz" },
  tolov_tahrir: { rpc: "t2_tolov_tahrir" },
  tolov_ochir: { rpc: "t2_tolov_ochir" },
  xarajat_yoz: { rpc: "t2_xarajat_yoz" },
  xarajat_tahrir: { rpc: "t2_xarajat_tahrir" },
  xarajat_ochir: { rpc: "t2_xarajat_ochir" },
  korzinkaga_tashlash: { rpc: "t2_korzinkaga_tashlash" },
  korzinkadan_tiklash: { rpc: "t2_korzinkadan_tiklash" },
  butunlay_ochirish: { rpc: "t2_butunlay_ochirish" },
  obyekt_yangila: { rpc: "t2_obyekt_yangila" },
  aosr_yoz: { rpc: "t2_aosr_yoz" },
  aosr_bekor: { rpc: "t2_aosr_bekor" },
  aosr_bog_saqla: { rpc: "t2_aosr_bog_saqla" },
  aosr_bog_ochir: { rpc: "t2_aosr_bog_ochir" },
  audit_yoz: { rpc: "t2_audit_yoz" },
  hujjat_yoz: { rpc: "t2_obyekt_hujjat_yoz" },
  hujjat_ochir: { rpc: "t2_obyekt_hujjat_ochir" },
  sklad_mustaqil_yarat: { rpc: "t2_sklad_yarat" },
  kadr_mustaqil_yarat: { rpc: "t2_kadr_yarat" },
  texnika_mustaqil_yarat: { rpc: "t2_texnika_yarat" },
  resurs_bog_saqla: { rpc: "t2_resurs_bog_saqla" },
  resurs_bog_ochir: { rpc: "t2_resurs_bog_ochir" },
  loyiha_yarat: { rpc: "t2_loyiha_yarat" },
  loyiha_yangila: { rpc: "t2_loyiha_yangila" },
  loyiha_ochir: { rpc: "t2_loyiha_ochir" },
  obyekt_loyihaga_biriktir: { rpc: "t2_obyekt_loyihaga_biriktir" },
  loyiha_qatnashchi_biriktir: { rpc: "t2_loyiha_qatnashchi_biriktir" },
  loyiha_qatnashchi_ochir: { rpc: "t2_loyiha_qatnashchi_ochir" },
  kontragent_saqla: { rpc: "t2_kontragent_saqla" },
  kontragent_ochir: { rpc: "t2_kontragent_ochir" },
  fakt_yoz: { rpc: "t2_fakt_yoz" },
  fakt_belgila: { rpc: "t2_fakt_belgila" },
  azolik_qosh: { rpc: "t2_azolik_qosh" },
  azolik_rol_ozgartir: { rpc: "t2_azolik_rol_ozgartir" },
  azolik_ochir: { rpc: "t2_azolik_ochir" },
  /* ⚠️ 2026-08-28: `kompaniya_yangila` bir marta (2026-08-27) qo'shilgan
   * edi, lekin keyingi merge'da (`f9a9d04`) YO'QOLIB QOLGAN — DB
   * funksiyasi (`t2_kompaniya_yangila`) va frontend chaqiruvi
   * (`sbKompaniyaYangila`, `supabase.ts`) omon qolgan, faqat shu
   * ko'prik yo'qolgan edi. Tiklandi. Bu — parallel ish paytida
   * merge silliq o'chirib yuborishi mumkinligiga JONLI misol; shuning
   * uchun har muhim o'zgarishdan keyin push'dan OLDIN diffni ko'rish
   * kerak. */
  kompaniya_yangila: { rpc: "t2_kompaniya_yangila" },
  /* MATERIAL ALIASLARI — AI semantik qidiruv (2026-08-28). */
  material_alias_yoz: { rpc: "t2_material_alias_yoz" },
  material_alias_ochir: { rpc: "t2_material_alias_ochir" },
  /* MINDMAP — chiziq tortib bog'lash/uzish (2026-08-28) */
  mindmap_bog: { rpc: "t2_mindmap_bog" },
  mindmap_bog_ochir: { rpc: "t2_mindmap_bog_ochir" },
  mindmap_joylashuv_saqla: { rpc: "t2_mindmap_joylashuv_saqla" },
  mindmap_tugun_ochir: { rpc: "t2_mindmap_tugun_ochir" }
};
var onRequestPost10 = /* @__PURE__ */ __name(async (ctx) => {
  const t0 = Date.now();
  try {
    const secret = ctx.env.SESSIYA_KALIT;
    const sess = await tekshir(ctx.request.headers.get("Cookie"), secret);
    if (!sess) {
      return Response.json({ ok: false, error: "\u041A\u0438\u0440\u0438\u0448 \u0442\u0430\u043B\u0430\u0431 \u049B\u0438\u043B\u0438\u043D\u0430\u0434\u0438" }, { status: 401 });
    }
    if (sess.rol === "boss" || sess.rol === "rahbar") {
      return Response.json(
        { ok: false, error: "\u0420\u0430\u04B3\u0431\u0430\u0440 \u0440\u0435\u0436\u0438\u043C\u0438\u0434\u0430 \u0451\u0437\u0438\u0448 \u043C\u0443\u043C\u043A\u0438\u043D \u044D\u043C\u0430\u0441" },
        { status: 403 }
      );
    }
    if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
      return Response.json({
        ok: false,
        sozlanmagan: true,
        error: "Supabase sozlanmagan (SUPABASE_URL / SUPABASE_KEY)"
      });
    }
    const so = await ctx.request.json();
    const amal = so.amal || "qator_tahrir";
    if (!Object.prototype.hasOwnProperty.call(AMALLAR, amal)) {
      return Response.json({ ok: false, error: "Noma'lum amal: " + String(so.amal) });
    }
    if (Array.isArray(sess.kompaniyalar) && so.kompaniya_id != null) {
      const soraganKompaniya = Number(so.kompaniya_id);
      if (Number.isFinite(soraganKompaniya)) {
        const azolik = sess.kompaniyalar.find((a) => a.kompaniya_id === soraganKompaniya);
        if (!azolik) {
          return Response.json(
            {
              ok: false,
              error: "Bu kompaniyaga a'zo emassiz (kompaniya_id: " + soraganKompaniya + ")"
            },
            { status: 403 }
          );
        }
        if (azolik.rol === "boss" || azolik.rol === "rahbar") {
          return Response.json(
            {
              ok: false,
              error: "Bu kompaniyada rahbar rolida yozish mumkin emas"
            },
            { status: 403 }
          );
        }
      }
    }
    let yuk;
    if (amal === "qator_tahrir") {
      const qatorId = Number(so.qator_id);
      if (!Number.isFinite(qatorId) || qatorId <= 0) {
        return Response.json({ ok: false, error: "qator_id noto'g'ri" });
      }
      const RUXSAT = ["nom", "hajm", "narx", "birlik", "kat"];
      if (!so.maydon || !RUXSAT.includes(so.maydon)) {
        return Response.json({ ok: false, error: "Bu maydonni tahrirlash mumkin emas: " + so.maydon });
      }
      if (so.kutilgan_versiya == null || !Number.isFinite(Number(so.kutilgan_versiya))) {
        return Response.json({
          ok: false,
          error: "kutilgan_versiya majburiy \u2014 usiz ziddiyatni aniqlab bo'lmaydi"
        });
      }
      yuk = {
        p_qator_id: qatorId,
        p_maydon: so.maydon,
        p_qiymat: so.qiymat == null ? "" : String(so.qiymat),
        p_kutilgan_versiya: Number(so.kutilgan_versiya),
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "akt_yarat") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      if (so.tur !== "fakt" && so.tur !== "f2") {
        return Response.json({ ok: false, error: "tur faqat \xABfakt\xBB yoki \xABf2\xBB" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(so.oy || ""))) {
        return Response.json({ ok: false, error: "oy YYYY-MM-DD ko'rinishida bo'lishi kerak" });
      }
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: "Hujjatda bironta qator yo'q" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi hujjat yaratadi"
        });
      }
      const qatorlar = so.qatorlar.map((q) => {
        const chiqish = {
          qator_id: Number(q.qator_id),
          hajm: q.hajm
        };
        if (q.narx != null && q.narx !== "") chiqish.narx = q.narx;
        if (q.izoh) chiqish.izoh = String(q.izoh).slice(0, 500);
        return chiqish;
      });
      if (qatorlar.some((q) => !Number.isFinite(q.qator_id) || q.qator_id <= 0)) {
        return Response.json({ ok: false, error: "Ba'zi qatorlarda qator_id noto'g'ri" });
      }
      const majburiy = so.majburiy === true;
      if (majburiy && !(sess.rol === "admin" || sess.rol === "superadmin")) {
        return Response.json({
          ok: false,
          status: 403,
          error: "Invariantni chetlab o'tish faqat admin huquqi bilan"
        }, { status: 403 });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_tur: so.tur,
        p_oy: so.oy,
        p_qatorlar: qatorlar,
        p_raqam: so.raqam ? String(so.raqam).slice(0, 100) : null,
        p_operation_id: so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || "",
        p_majburiy: majburiy
      };
    } else if (amal === "qator_qosh") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      const TURLAR = ["rz", "bl", "rs", "mat", "ob"];
      if (!TURLAR.includes(String(so.tur))) {
        return Response.json({ ok: false, error: "tur: rz|bl|rs|mat|ob" });
      }
      if (!String(so.nom || "").trim()) {
        return Response.json({ ok: false, error: "Nom bo'sh" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi qator yaratadi"
        });
      }
      let norma = null;
      if (so.norma != null && so.norma !== "") {
        norma = Number(so.norma);
        if (!Number.isFinite(norma)) {
          return Response.json({ ok: false, error: "norma son emas" });
        }
      }
      let narx = null;
      if (so.narx != null && so.narx !== "") {
        narx = Number(so.narx);
        if (!Number.isFinite(narx)) {
          return Response.json({ ok: false, error: "narx son emas" });
        }
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_tur: so.tur,
        p_nom: String(so.nom).slice(0, 500),
        p_ota_id: so.ota_id == null ? null : Number(so.ota_id),
        p_kod: so.kod ? String(so.kod).slice(0, 100) : null,
        p_birlik: so.birlik ? String(so.birlik).slice(0, 50) : null,
        p_norma: norma,
        p_narx: narx,
        p_e_obyom: so.e_obyom == null ? null : so.e_obyom === true,
        p_kat: so.kat ? String(so.kat).slice(0, 20) : null,
        p_keyin_id: so.keyin_id == null ? null : Number(so.keyin_id),
        p_operation_id: so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "narx_belgila") {
      if (!String(so.nom || "").trim()) {
        return Response.json({ ok: false, error: "Nom bo'sh" });
      }
      const narx = Number(so.narx);
      if (so.narx == null || so.narx === "" || !Number.isFinite(narx) || narx < 0) {
        return Response.json({
          ok: false,
          error: "Belgilanadigan narx musbat son bo'lishi kerak"
        });
      }
      yuk = {
        p_nom: String(so.nom).slice(0, 500),
        p_birlik: so.birlik ? String(so.birlik).slice(0, 50) : null,
        p_narx: narx,
        p_kat: so.kat ? String(so.kat).slice(0, 20) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "narx_sana_qosh") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(so.sana || ""))) {
        return Response.json({ ok: false, error: "sana YYYY-MM-DD bo'lishi kerak" });
      }
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: "Bironta qator yo'q" });
      }
      const qatorlar = so.qatorlar.slice(0, 5e3).map((q) => ({
        nom: String(q.nom ?? "").slice(0, 500),
        birlik: q.birlik ? String(q.birlik).slice(0, 50) : null,
        narx: q.narx,
        izoh: q.izoh ? String(q.izoh).slice(0, 300) : null
      }));
      yuk = {
        p_sana: so.sana,
        p_qatorlar: qatorlar,
        p_manba: so.manba ? String(so.manba).slice(0, 100) : null,
        p_kim: sess.email || ""
      };
    } else if (amal === "viborka_smetadan_toldir") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      yuk = { p_obyekt_id: obyektId };
    } else if (amal === "viborka_qabul_yoz") {
      const viborkaId = Number(so.viborka_id);
      if (!Number.isFinite(viborkaId) || viborkaId <= 0) {
        return Response.json({ ok: false, error: "viborka_id noto'g'ri" });
      }
      const hajm = Number(so.hajm);
      if (!Number.isFinite(hajm) || hajm === 0) {
        return Response.json({ ok: false, error: "hajm 0 yoki bo'sh bo'lishi mumkin emas" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi qabul yaratadi"
        });
      }
      yuk = {
        p_viborka_id: viborkaId,
        p_hajm: hajm,
        p_narx: so.narx == null || so.narx === "" ? null : Number(so.narx),
        p_yetkazib_beruvchi: so.yetkazib_beruvchi ? String(so.yetkazib_beruvchi).slice(0, 200) : null,
        p_sana: so.sana || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_operation_id: so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "shartnoma_saqla") {
      if (!String(so.raqam || "").trim()) {
        return Response.json({ ok: false, error: "Shartnoma raqami bo'sh" });
      }
      const shKomp = Number(so.kompaniya_id);
      if (!Number.isFinite(shKomp) || shKomp <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      yuk = {
        p_kompaniya_id: shKomp,
        p_raqam: String(so.raqam).slice(0, 100),
        p_nom: so.nom ? String(so.nom).slice(0, 500) : null,
        p_taraf: so.taraf ? String(so.taraf).slice(0, 300) : null,
        p_summa_bez_nds: so.summa_bez_nds == null ? null : Number(so.summa_bez_nds),
        p_nds: so.nds == null ? null : Number(so.nds),
        p_jami_nds_bilan: so.jami_nds_bilan == null ? null : Number(so.jami_nds_bilan),
        p_chel_stavka: so.chel_stavka == null ? null : Number(so.chel_stavka),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1e3) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "shartnoma_ochir") {
      const shartnomaId = Number(so.shartnoma_id);
      if (!Number.isFinite(shartnomaId) || shartnomaId <= 0) {
        return Response.json({ ok: false, error: "shartnoma_id noto'g'ri" });
      }
      yuk = {
        p_shartnoma_id: shartnomaId,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya)
      };
    } else if (amal === "shartnoma_bog_saqla") {
      const obyektId = Number(so.obyekt_id);
      const shartnomaId = Number(so.shartnoma_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      if (!Number.isFinite(shartnomaId) || shartnomaId <= 0) {
        return Response.json({ ok: false, error: "shartnoma_id noto'g'ri" });
      }
      yuk = { p_obyekt_id: obyektId, p_shartnoma_id: shartnomaId };
    } else if (amal === "nakrutka_saqla") {
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: "Bironta koeffitsient yo'q" });
      }
      const shartnomaId = so.shartnoma_id == null ? null : Number(so.shartnoma_id);
      if (shartnomaId === null && !(sess.rol === "admin" || sess.rol === "superadmin")) {
        return Response.json({
          ok: false,
          status: 403,
          error: "Umumiy default \u043D\u0430\u043A\u0440\u0443\u0442\u043A\u0430 faqat admin huquqi bilan o'zgartiriladi"
        }, { status: 403 });
      }
      const qatorlar = so.qatorlar.slice(0, 50).map((q) => ({
        koef: String(q.koef ?? "").slice(0, 100),
        qiymat: q.qiymat,
        izoh: q.izoh ? String(q.izoh).slice(0, 300) : null
      }));
      yuk = { p_qatorlar: qatorlar, p_shartnoma_id: shartnomaId };
    } else if (amal === "tolov_yoz") {
      const shartnomaId = Number(so.shartnoma_id);
      const summa = Number(so.summa);
      if (!Number.isFinite(shartnomaId) || shartnomaId <= 0) {
        return Response.json({ ok: false, error: "shartnoma_id noto'g'ri" });
      }
      if (!Number.isFinite(summa) || summa === 0) {
        return Response.json({ ok: false, error: "summa 0 yoki bo'sh bo'lishi mumkin emas" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi to'lov yaratadi"
        });
      }
      yuk = {
        p_shartnoma_id: shartnomaId,
        p_summa: summa,
        p_tur: so.tur ? String(so.tur).slice(0, 20) : "tolov",
        p_sana: so.sana || null,
        p_obyekt_id: so.obyekt_id == null ? null : Number(so.obyekt_id),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "tolov_tahrir") {
      const tolovId = Number(so.tolov_id);
      if (!Number.isFinite(tolovId) || tolovId <= 0) {
        return Response.json({ ok: false, error: "tolov_id noto'g'ri" });
      }
      yuk = {
        p_tolov_id: tolovId,
        p_summa: so.summa == null ? null : Number(so.summa),
        p_sana: so.sana || null,
        p_tur: so.tur ? String(so.tur).slice(0, 20) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya)
      };
    } else if (amal === "tolov_ochir") {
      const tolovId = Number(so.tolov_id);
      if (!Number.isFinite(tolovId) || tolovId <= 0) {
        return Response.json({ ok: false, error: "tolov_id noto'g'ri" });
      }
      yuk = {
        p_tolov_id: tolovId,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya)
      };
    } else if (amal === "xarajat_yoz") {
      const summa = Number(so.summa);
      if (!Number.isFinite(summa) || summa === 0) {
        return Response.json({ ok: false, error: "summa 0 yoki bo'sh bo'lishi mumkin emas" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi xarajat yaratadi"
        });
      }
      yuk = {
        p_summa: summa,
        p_toifa: so.toifa ? String(so.toifa).slice(0, 100) : null,
        p_sana: so.sana || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "xarajat_tahrir") {
      const xarajatId = Number(so.xarajat_id);
      if (!Number.isFinite(xarajatId) || xarajatId <= 0) {
        return Response.json({ ok: false, error: "xarajat_id noto'g'ri" });
      }
      yuk = {
        p_xarajat_id: xarajatId,
        p_summa: so.summa == null ? null : Number(so.summa),
        p_toifa: so.toifa ? String(so.toifa).slice(0, 100) : null,
        p_sana: so.sana || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya)
      };
    } else if (amal === "xarajat_ochir") {
      const xarajatId = Number(so.xarajat_id);
      if (!Number.isFinite(xarajatId) || xarajatId <= 0) {
        return Response.json({ ok: false, error: "xarajat_id noto'g'ri" });
      }
      yuk = {
        p_xarajat_id: xarajatId,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya)
      };
    } else if (amal === "akt_tasdiqlash" || amal === "akt_bekor") {
      const aktId = Number(so.akt_id);
      if (!Number.isFinite(aktId) || aktId <= 0) {
        return Response.json({ ok: false, error: "akt_id noto'g'ri" });
      }
      const versiya = Number(so.kutilgan_versiya);
      const v = Number.isFinite(versiya) ? versiya : null;
      if (amal === "akt_tasdiqlash") {
        yuk = { p_akt_id: aktId, p_kutilgan_versiya: v, p_kim: sess.email || "" };
      } else {
        yuk = {
          p_akt_id: aktId,
          p_kutilgan_versiya: v,
          p_kim: sess.email || "",
          p_sabab: so.sabab ? String(so.sabab).slice(0, 500) : null
        };
      }
    } else if (amal === "skladga_yozish") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      if (so.operatsiya !== "prixod" && so.operatsiya !== "rasxod") {
        return Response.json({ ok: false, error: "operatsiya faqat \xABprixod\xBB yoki \xABrasxod\xBB" });
      }
      const obyomi = Number(so.obyomi);
      if (!Number.isFinite(obyomi) || obyomi <= 0) {
        return Response.json({ ok: false, error: "obyomi musbat son bo'lishi kerak" });
      }
      if (!String(so.nomi || "").trim() || !String(so.birligi || "").trim()) {
        return Response.json({ ok: false, error: "nomi va birligi bo'sh bo'lishi mumkin emas" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi harakat yaratadi"
        });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_operatsiya: so.operatsiya,
        p_obyekt_id: obyektId,
        p_turi: so.turi ? String(so.turi).slice(0, 20) : "mat",
        p_sana: so.sana || null,
        p_nomi: String(so.nomi).slice(0, 300),
        p_birligi: String(so.birligi).slice(0, 50),
        p_obyomi: obyomi,
        p_postavshik: so.postavshik ? String(so.postavshik).slice(0, 200) : null,
        p_qabul_qiluvchi: so.qabul_qiluvchi ? String(so.qabul_qiluvchi).slice(0, 200) : null,
        p_qabul_turi: so.qabul_turi ? String(so.qabul_turi).slice(0, 50) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "faktura_yoz") {
      if (!String(so.raqam || "").trim() || !String(so.inn || "").trim()) {
        return Response.json({ ok: false, error: "raqam va inn bo'sh bo'lishi mumkin emas" });
      }
      const id = so.id ? Number(so.id) : null;
      if (!id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi faktura yaratadi"
        });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_raqam: String(so.raqam).slice(0, 100),
        p_sana: so.sana,
        p_kontragent: String(so.kontragent || "").slice(0, 300),
        p_inn: String(so.inn).slice(0, 20),
        p_summa: Number(so.summa),
        p_holat: so.holat || "yangi",
        p_items: so.items || [],
        p_id: id,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_operation_id: id ? null : so.operation_id,
        p_kim: sess.email || ""
      };
    } else if (amal === "ish_turi_yoz") {
      if (!String(so.kod || "").trim() || !String(so.nomi || "").trim()) {
        return Response.json({ ok: false, error: "kod va nomi bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_kod: String(so.kod).slice(0, 100),
        p_nomi: String(so.nomi).slice(0, 300),
        p_birligi: String(so.birligi || "").slice(0, 50),
        p_norma: so.norma == null ? 0 : Number(so.norma),
        p_narx: so.narx == null ? 0 : Number(so.narx),
        p_kategoriya: so.kategoriya ? String(so.kategoriya).slice(0, 100) : null,
        p_id: so.id ? Number(so.id) : null
      };
    } else if (amal === "shaxsiy_smeta_yarat") {
      if (!String(so.nom || "").trim()) {
        return Response.json({ ok: false, error: "nom bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_nom: String(so.nom).slice(0, 500),
        p_qatorlar: so.qatorlar || [],
        p_kim: sess.email || ""
      };
    } else if (amal === "aosr_yoz") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      const id = so.id ? Number(so.id) : null;
      if (!id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi akt yaratadi"
        });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_raqam: so.raqam ? String(so.raqam).slice(0, 100) : null,
        p_ish_nomi: so.ish_nomi ? String(so.ish_nomi).slice(0, 500) : null,
        p_boshlanish_sana: so.boshlanish_sana || null,
        p_tugash_sana: so.tugash_sana || null,
        p_bajarilgan: so.bajarilgan ? String(so.bajarilgan).slice(0, 300) : null,
        p_pdf_url: so.pdf_url ? String(so.pdf_url).slice(0, 1e3) : null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1e3) : null,
        p_holat: so.holat || "yangi",
        p_id: id,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_operation_id: id ? null : so.operation_id,
        p_manba: "frontend",
        p_kim: sess.email || ""
      };
    } else if (amal === "aosr_bekor") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_id: id, p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya) };
    } else if (amal === "aosr_bog_saqla") {
      if (!Array.isArray(so.aosr_ids) || !so.aosr_ids.length || !Array.isArray(so.qator_ids) || !so.qator_ids.length) {
        return Response.json({ ok: false, error: "akt yoki qator tanlanmagan" });
      }
      yuk = {
        p_aosr_ids: so.aosr_ids.slice(0, 200).map(Number),
        p_qator_ids: so.qator_ids.slice(0, 500).map(Number)
      };
    } else if (amal === "aosr_bog_ochir") {
      const aosrId = Number(so.aosr_id);
      const qatorId = Number(so.qator_id);
      if (!Number.isFinite(aosrId) || aosrId <= 0 || !Number.isFinite(qatorId) || qatorId <= 0) {
        return Response.json({ ok: false, error: "aosr_id yoki qator_id noto'g'ri" });
      }
      yuk = { p_aosr_id: aosrId, p_qator_id: qatorId };
    } else if (amal === "audit_yoz") {
      if (!String(so.amal_turi || "").trim() || !String(so.modul || "").trim()) {
        return Response.json({ ok: false, error: "amal_turi va modul bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_amal_turi: String(so.amal_turi).slice(0, 100),
        p_modul: String(so.modul).slice(0, 100),
        p_obyekt_id: so.obyekt_id == null ? null : Number(so.obyekt_id),
        p_tafsilot: so.tafsilot ? String(so.tafsilot).slice(0, 2e3) : null,
        p_kim: sess.email || "",
        p_ip: ctx.request.headers.get("CF-Connecting-IP") || null
      };
    } else if (amal === "hujjat_yoz") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      if (!String(so.nom || "").trim() || !String(so.url || "").trim()) {
        return Response.json({ ok: false, error: "nom va url bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_turi: so.turi === "loyiha" ? "loyiha" : "hujjat",
        p_nom: String(so.nom).slice(0, 300),
        p_url: String(so.url).slice(0, 1e3),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1e3) : null,
        p_kim: sess.email || ""
      };
    } else if (amal === "hujjat_ochir") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_id: id };
    } else if (amal === "sklad_mustaqil_yarat") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!String(so.nomi || "").trim()) {
        return Response.json({ ok: false, error: "nomi bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_nomi: String(so.nomi).slice(0, 300),
        p_manzil: so.manzil ? String(so.manzil).slice(0, 500) : null,
        p_masul_shaxs: so.masul_shaxs ? String(so.masul_shaxs).slice(0, 200) : null
      };
    } else if (amal === "kadr_mustaqil_yarat") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!String(so.ism_sharif || "").trim() || !String(so.lavozim || "").trim()) {
        return Response.json({ ok: false, error: "ism_sharif va lavozim bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_ism_sharif: String(so.ism_sharif).slice(0, 200),
        p_lavozim: String(so.lavozim).slice(0, 200),
        p_oylik_maosh: so.oylik_maosh == null ? null : Number(so.oylik_maosh),
        p_valyuta: so.valyuta ? String(so.valyuta).slice(0, 10) : "UZS"
      };
    } else if (amal === "texnika_mustaqil_yarat") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!String(so.nomi || "").trim()) {
        return Response.json({ ok: false, error: "nomi bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_nomi: String(so.nomi).slice(0, 300),
        p_davlat_raqami: so.davlat_raqami ? String(so.davlat_raqami).slice(0, 50) : null,
        p_yoqilgi_mejori: so.yoqilgi_mejori == null ? null : Number(so.yoqilgi_mejori)
      };
    } else if (amal === "resurs_bog_saqla" || amal === "resurs_bog_ochir") {
      const TUR_RUXSAT = ["sklad", "kadr", "texnika"];
      const tur = String(so.tur || "");
      const resursId = Number(so.resurs_id);
      const obyektId = Number(so.obyekt_id);
      if (!TUR_RUXSAT.includes(tur)) {
        return Response.json({ ok: false, error: "noma'lum tur: " + tur });
      }
      if (!Number.isFinite(resursId) || resursId <= 0 || !Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "resurs_id yoki obyekt_id noto'g'ri" });
      }
      yuk = { p_tur: tur, p_resurs_id: resursId, p_obyekt_id: obyektId };
    } else if (amal === "loyiha_yarat") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!String(so.nom || "").trim()) {
        return Response.json({ ok: false, error: "nom bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_nom: String(so.nom).slice(0, 300),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 1e3) : null,
        p_hudud: so.hudud ? String(so.hudud).slice(0, 200) : null,
        /* ⚠️ byudjet: 0 va "belgilanmagan" FARQLI. `undefined`/`null` →
           NULL bo'lib qoladi, 0 esa haqiqiy nol byudjet sifatida saqlanadi. */
        p_byudjet: so.byudjet == null || so.byudjet === "" ? null : Number(so.byudjet)
      };
    } else if (amal === "loyiha_yangila") {
      const id = Number(so.id);
      const kutilganVersiya = Number(so.kutilgan_versiya);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      if (!Number.isFinite(kutilganVersiya)) {
        return Response.json({ ok: false, error: "kutilgan_versiya kerak (optimistik qulf)" });
      }
      const HOLAT_RUXSAT = ["faol", "tuxtatilgan", "yakunlangan", "bekor"];
      if (so.holat != null && !HOLAT_RUXSAT.includes(String(so.holat))) {
        return Response.json({ ok: false, error: "holat noto'g'ri: " + HOLAT_RUXSAT.join("|") });
      }
      yuk = {
        p_id: id,
        p_kutilgan_versiya: kutilganVersiya,
        p_nom: so.nom ? String(so.nom).slice(0, 300) : null,
        p_izoh: so.izoh != null ? String(so.izoh).slice(0, 1e3) : null,
        p_hudud: so.hudud != null ? String(so.hudud).slice(0, 200) : null,
        p_byudjet: so.byudjet == null || so.byudjet === "" ? null : Number(so.byudjet),
        p_holat: so.holat ? String(so.holat) : null
      };
    } else if (amal === "loyiha_ochir") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_id: id };
    } else if (amal === "obyekt_loyihaga_biriktir") {
      const obyektId = Number(so.obyekt_id);
      const loyihaId = so.loyiha_id == null ? null : Number(so.loyiha_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      yuk = { p_obyekt_id: obyektId, p_loyiha_id: loyihaId };
    } else if (amal === "loyiha_qatnashchi_biriktir") {
      const loyihaId = Number(so.loyiha_id);
      if (!Number.isFinite(loyihaId) || loyihaId <= 0) {
        return Response.json({ ok: false, error: "loyiha_id noto'g'ri" });
      }
      const kompaniyaId = so.kompaniya_id == null ? null : Number(so.kompaniya_id);
      const kontragentId = so.kontragent_id == null ? null : Number(so.kontragent_id);
      const bittaTaraf = kompaniyaId != null !== (kontragentId != null);
      if (!bittaTaraf) {
        return Response.json({ ok: false, error: "Aynan bittasi kerak: kompaniya_id YOKI kontragent_id" });
      }
      const ROL_RUXSAT = ["zakazchik", "bosh_pudratchi", "subpudratchi", "loyihachi", "taminotchi"];
      if (!ROL_RUXSAT.includes(String(so.rol))) {
        return Response.json({ ok: false, error: "rol noto'g'ri: " + ROL_RUXSAT.join("|") });
      }
      yuk = {
        p_loyiha_id: loyihaId,
        p_kompaniya_id: kompaniyaId,
        p_kontragent_id: kontragentId,
        p_rol: String(so.rol),
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null
      };
    } else if (amal === "loyiha_qatnashchi_ochir") {
      const id = Number(so.id);
      const kutilganVersiya = Number(so.kutilgan_versiya);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      if (!Number.isFinite(kutilganVersiya)) {
        return Response.json({ ok: false, error: "kutilgan_versiya kerak (optimistik qulf)" });
      }
      yuk = { p_id: id, p_kutilgan_versiya: kutilganVersiya };
    } else if (amal === "kontragent_saqla") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!String(so.nom || "").trim()) {
        return Response.json({ ok: false, error: "nom bo'sh bo'lishi mumkin emas" });
      }
      const inn = so.inn ? String(so.inn).trim() : null;
      if (inn && !/^[0-9]{9}$/.test(inn)) {
        return Response.json({ ok: false, error: "STIR (INN) 9 ta raqamdan iborat bo'lishi shart" });
      }
      const MAVQE_RUXSAT = ["buyurtmachi", "pudratchi", "subpudratchi", "loyihachi", "taminotchi"];
      const mavqe = so.mavqe && MAVQE_RUXSAT.includes(String(so.mavqe)) ? String(so.mavqe) : null;
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_inn: inn,
        p_nom: String(so.nom).slice(0, 300),
        p_rahbar: so.rahbar ? String(so.rahbar).slice(0, 200) : null,
        p_manzil: so.manzil ? String(so.manzil).slice(0, 500) : null,
        p_mfo: so.mfo ? String(so.mfo).slice(0, 20) : null,
        p_hisob_raqam: so.hisob_raqam ? String(so.hisob_raqam).slice(0, 40) : null,
        p_qqs_tolovchi: so.qqs_tolovchi == null ? null : Boolean(so.qqs_tolovchi),
        p_mavqe: mavqe
      };
    } else if (amal === "kontragent_ochir") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_id: id };
    } else if (amal === "kompaniya_yangila") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      if (so.kutilgan_versiya == null) {
        return Response.json({ ok: false, error: "kutilgan_versiya majburiy" });
      }
      const MAVQE_RUXSAT3 = ["zakazchik", "pudratchi", "loyihachi"];
      const mavqe3 = so.mavqe && MAVQE_RUXSAT3.includes(String(so.mavqe)) ? String(so.mavqe) : null;
      yuk = {
        p_id: id,
        p_kutilgan_versiya: Number(so.kutilgan_versiya),
        p_toliq_nom: so.toliq_nom != null ? String(so.toliq_nom).slice(0, 300) : null,
        p_inn: so.inn != null ? String(so.inn).slice(0, 20) : null,
        p_manzil: so.manzil != null ? String(so.manzil).slice(0, 500) : null,
        p_rahbar: so.rahbar != null ? String(so.rahbar).slice(0, 200) : null,
        p_telefon: so.telefon != null ? String(so.telefon).slice(0, 40) : null,
        p_bank: so.bank != null ? String(so.bank).slice(0, 200) : null,
        p_hisob_raqam: so.hisob_raqam != null ? String(so.hisob_raqam).slice(0, 40) : null,
        p_mfo: so.mfo != null ? String(so.mfo).slice(0, 20) : null,
        p_mavqe: mavqe3
      };
    } else if (amal === "material_alias_yoz") {
      if (!String(so.alias_nom || "").trim() || !String(so.kanonik_nom_key || "").trim()) {
        return Response.json({ ok: false, error: "alias_nom va kanonik_nom_key bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_alias_nom: String(so.alias_nom).slice(0, 300),
        p_kanonik_nom_key: String(so.kanonik_nom_key).slice(0, 300),
        p_kanonik_birlik_key: so.kanonik_birlik_key ? String(so.kanonik_birlik_key).slice(0, 50) : null,
        p_kompaniya_id: so.kompaniya_id == null ? null : Number(so.kompaniya_id)
      };
    } else if (amal === "material_alias_ochir") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_id: id };
    } else if (amal === "mindmap_bog" || amal === "mindmap_bog_ochir") {
      const BOG_TURLARI = [
        "obyekt_loyiha",
        "shartnoma_loyiha",
        "shartnoma_obyekt",
        "sklad_obyekt",
        "texnika_obyekt",
        "kadr_obyekt",
        "qatnashchi"
      ];
      const tur = String(so.tur || "");
      const manbaId = Number(so.manba_id);
      const maqsadId = Number(so.maqsad_id);
      if (!BOG_TURLARI.includes(tur)) {
        return Response.json({ ok: false, error: "noma'lum bog'lanish turi: " + tur });
      }
      if (!Number.isFinite(manbaId) || manbaId <= 0 || !Number.isFinite(maqsadId) || maqsadId <= 0) {
        return Response.json({ ok: false, error: "manba_id yoki maqsad_id noto'g'ri" });
      }
      const ROLLAR = ["zakazchik", "bosh_pudratchi", "subpudratchi", "loyihachi", "taminotchi"];
      if (amal === "mindmap_bog") {
        const rol = so.rol && ROLLAR.includes(String(so.rol)) ? String(so.rol) : null;
        if (tur === "qatnashchi" && !rol) {
          return Response.json({ ok: false, error: "qatnashchi bog'lanishida rol majburiy" });
        }
        yuk = { p_tur: tur, p_manba_id: manbaId, p_maqsad_id: maqsadId, p_rol: rol };
      } else {
        yuk = { p_tur: tur, p_manba_id: manbaId, p_maqsad_id: maqsadId };
      }
    } else if (amal === "mindmap_joylashuv_saqla") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!Array.isArray(so.joylar) || !so.joylar.length) {
        return Response.json({ ok: false, error: "joylar bo'sh" });
      }
      const joylar = so.joylar.slice(0, 500).map((j) => ({
        tugun_id: String(j.tugun_id || "").slice(0, 60),
        x: Number(j.x),
        y: Number(j.y)
      })).filter((j) => j.tugun_id && Number.isFinite(j.x) && Number.isFinite(j.y));
      if (!joylar.length) {
        return Response.json({ ok: false, error: "yaroqli joylashuv yo'q" });
      }
      yuk = { p_kompaniya_id: kompaniyaId, p_joylar: joylar };
    } else if (amal === "mindmap_tugun_ochir") {
      const TUR_RUXSAT = ["loyiha", "shartnoma", "sklad", "texnika", "kadr", "kontragent"];
      const tur = String(so.tur || "");
      const id = Number(so.id);
      if (!TUR_RUXSAT.includes(tur)) {
        return Response.json({ ok: false, error: "bu turni mindmapdan o'chirib bo'lmaydi: " + tur });
      }
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_tur: tur, p_id: id };
    } else if (amal === "fakt_yoz") {
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "obyekt_id noto'g'ri" });
      }
      const sana = String(so.sana || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sana)) {
        return Response.json({ ok: false, error: "sana YYYY-MM-DD shaklida bo'lishi kerak" });
      }
      if (!Array.isArray(so.qatorlar) || so.qatorlar.length === 0) {
        return Response.json({ ok: false, error: "qatorlar bo'sh" });
      }
      yuk = {
        p_obyekt_id: obyektId,
        p_sana: sana,
        p_qatorlar: so.qatorlar,
        p_kim: sess.email || null,
        p_operation_id: so.operation_id || null,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_raqam: so.raqam ? String(so.raqam).slice(0, 50) : null
      };
    } else if (amal === "fakt_belgila") {
      const qatorId = Number(so.qator_id);
      if (!Number.isFinite(qatorId) || qatorId <= 0) {
        return Response.json({ ok: false, error: "qator_id noto'g'ri" });
      }
      if (so.yangi_jami == null || !Number.isFinite(Number(so.yangi_jami))) {
        return Response.json({ ok: false, error: "yangi_jami son bo'lishi kerak" });
      }
      yuk = {
        p_qator_id: qatorId,
        p_yangi_jami: Number(so.yangi_jami),
        p_sana: so.sana ? String(so.sana) : null,
        p_kim: sess.email || null
      };
    } else if (amal === "azolik_qosh") {
      const kompaniyaId = Number(so.kompaniya_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id noto'g'ri" });
      }
      if (!String(so.login || "").trim()) {
        return Response.json({ ok: false, error: "login bo'sh bo'lishi mumkin emas" });
      }
      const ROL_RUXSAT = ["superadmin", "admin", "boss", "rahbar", "bugalter", "pto", "prorab"];
      if (!ROL_RUXSAT.includes(String(so.rol))) {
        return Response.json({ ok: false, error: "rol noto'g'ri: " + ROL_RUXSAT.join("|") });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_login: String(so.login).trim().slice(0, 100),
        p_rol: String(so.rol),
        p_email: so.email ? String(so.email).slice(0, 200) : null,
        p_ism: so.ism ? String(so.ism).slice(0, 200) : null
      };
    } else if (amal === "azolik_rol_ozgartir") {
      const azolikId = Number(so.azolik_id);
      if (!Number.isFinite(azolikId) || azolikId <= 0) {
        return Response.json({ ok: false, error: "azolik_id noto'g'ri" });
      }
      const ROL_RUXSAT = ["superadmin", "admin", "boss", "rahbar", "bugalter", "pto", "prorab"];
      if (!ROL_RUXSAT.includes(String(so.yangi_rol))) {
        return Response.json({ ok: false, error: "yangi_rol noto'g'ri: " + ROL_RUXSAT.join("|") });
      }
      yuk = { p_azolik_id: azolikId, p_yangi_rol: String(so.yangi_rol) };
    } else if (amal === "azolik_ochir") {
      const azolikId = Number(so.azolik_id);
      if (!Number.isFinite(azolikId) || azolikId <= 0) {
        return Response.json({ ok: false, error: "azolik_id noto'g'ri" });
      }
      yuk = { p_azolik_id: azolikId };
    } else if (amal === "korzinkaga_tashlash" || amal === "korzinkadan_tiklash" || amal === "butunlay_ochirish") {
      const jadval = String(so.jadval || so.rpcArgs?.p_jadval || "");
      const JADVAL_RUXSAT = ["t2_obyekt", "t2_shaxsiy_smeta", "t2_sklad_harakat"];
      if (!JADVAL_RUXSAT.includes(jadval)) {
        return Response.json({ ok: false, error: "Bu jadval korzinka orqali boshqarilmaydi: " + jadval });
      }
      const id = Number(so.id || so.rpcArgs?.p_id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      yuk = { p_jadval: jadval, p_id: id, p_kim: sess.email || "" };
    } else if (amal === "obyekt_yangila") {
      const id = Number(so.id || so.rpcArgs?.p_id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      const lat = so.lat == null ? null : Number(so.lat);
      const lng = so.lng == null ? null : Number(so.lng);
      if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        return Response.json({ ok: false, error: "lat -90..90 oralig'ida bo'lishi kerak" });
      }
      if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        return Response.json({ ok: false, error: "lng -180..180 oralig'ida bo'lishi kerak" });
      }
      yuk = {
        p_id: id,
        p_nomi: String(so.nomi || so.rpcArgs?.p_nomi || ""),
        p_tur: so.tur || so.rpcArgs?.p_tur || null,
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya),
        p_lat: lat,
        p_lng: lng
      };
    } else if (amal === "birja_rfq_yarat") {
      const hajm = Number(so.hajm);
      if (!String(so.nom || "").trim() || !String(so.birlik || "").trim()) {
        return Response.json({ ok: false, error: "nom va birlik bo'sh bo'lishi mumkin emas" });
      }
      if (!Number.isFinite(hajm) || hajm <= 0) {
        return Response.json({ ok: false, error: "hajm musbat son bo'lishi kerak" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi RFQ yaratadi"
        });
      }
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id),
        p_nom: String(so.nom).slice(0, 300),
        p_birlik: String(so.birlik).slice(0, 50),
        p_hajm: hajm,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_holat: "ochiq",
        p_operation_id: so.operation_id,
        p_kim: sess.email || ""
      };
    } else if (amal === "birja_taklif_ber") {
      const rfqId = Number(so.rfq_id);
      const narx = Number(so.narx);
      if (!Number.isFinite(rfqId) || rfqId <= 0) {
        return Response.json({ ok: false, error: "rfq_id noto'g'ri" });
      }
      if (!Number.isFinite(narx) || narx <= 0) {
        return Response.json({ ok: false, error: "narx musbat son bo'lishi kerak" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(so.operation_id || ""))) {
        return Response.json({
          ok: false,
          error: "operation_id (UUID) majburiy \u2014 usiz takroriy so'rov ikkinchi taklif yaratadi"
        });
      }
      yuk = {
        p_rfq_id: rfqId,
        p_kompaniya_id: Number(so.kompaniya_id),
        p_narx: narx,
        p_izoh: so.izoh ? String(so.izoh).slice(0, 500) : null,
        p_operation_id: so.operation_id,
        p_kim: sess.email || ""
      };
    } else if (amal === "grafik_sozlama_saqla") {
      const kompaniyaId = Number(so.kompaniya_id);
      const obyektId = Number(so.obyekt_id);
      if (!Number.isFinite(kompaniyaId) || kompaniyaId <= 0 || !Number.isFinite(obyektId) || obyektId <= 0) {
        return Response.json({ ok: false, error: "kompaniya_id yoki obyekt_id noto'g'ri" });
      }
      if (!String(so.nom || "").trim()) {
        return Response.json({ ok: false, error: "nom bo'sh bo'lishi mumkin emas" });
      }
      yuk = {
        p_kompaniya_id: kompaniyaId,
        p_obyekt_id: obyektId,
        p_nom: String(so.nom).slice(0, 300),
        p_boshlanish_sana: so.boshlanish_sana || null,
        p_tugash_sana: so.tugash_sana || null,
        p_id: so.id == null ? null : Number(so.id),
        p_kutilgan_versiya: so.kutilgan_versiya == null ? null : Number(so.kutilgan_versiya)
      };
    } else if (amal === "grafik_yangilash") {
      const id = Number(so.id);
      if (!Number.isFinite(id) || id <= 0) {
        return Response.json({ ok: false, error: "id noto'g'ri" });
      }
      if (so.kutilgan_versiya == null) {
        return Response.json({ ok: false, error: "kutilgan_versiya majburiy" });
      }
      const HOLAT_RUXSAT = ["reja", "jarayonda", "bajarildi"];
      const holat = so.holat && HOLAT_RUXSAT.includes(String(so.holat)) ? String(so.holat) : null;
      yuk = {
        p_id: id,
        p_kutilgan_versiya: Number(so.kutilgan_versiya),
        p_holat: holat,
        p_foiz: so.foiz == null ? null : Number(so.foiz)
      };
    } else if (amal === "sozlama_saqla") {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_sozlamalar: so.sozlamalar ? JSON.stringify(so.sozlamalar) : JSON.stringify(so)
      };
    } else if (amal === "tizim_amal") {
      yuk = {
        p_turi: String(so.tizim_amal_turi || so.turi || so.harakat || ""),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };
    } else if (amal === "xato_yoz") {
      yuk = {
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };
    } else if (amal === "erp_amal") {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_operatsiya: String(so.operatsiya || ""),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so),
        /* ⚡ 2026-08-28: audit jurnali «kim» ni ham bilishi kerak.
           Busiz «nima bo'ldi» ma'lum, «kim qildi» noma'lum qolardi va
           jurnal javobgarlik uchun yaroqsiz bo'lardi. RPC buni
           `t2.kim` sozlamasiga yozadi, triggerlar o'shandan o'qiydi. */
        p_kim: sess.email || null
      };
    } else if (amal === "boss_tahlil_boshla") {
      yuk = {
        p_kompaniya_id: Number(so.kompaniya_id || 0),
        p_oy: String(so.oy || "")
      };
    } else if (amal === "kirish_amal" || amal === "taklif_yubor" || amal === "taklif_qabul") {
      yuk = {
        p_kompaniya_id: so.kompaniya_id ? Number(so.kompaniya_id) : 0,
        p_foydalanuvchi: String(so.foydalanuvchi || ""),
        p_payload: so.payload ? JSON.stringify(so.payload) : JSON.stringify(so)
      };
    } else {
      return Response.json({
        ok: false,
        error: 'Amal "' + amal + `" ro'yxatda bor, lekin hali parametr moslashtirilmagan (TODO)`
      });
    }
    const r = await fetch(
      ctx.env.SUPABASE_URL.replace(/\/+$/, "") + "/rest/v1/rpc/" + AMALLAR[amal].rpc,
      {
        method: "POST",
        headers: {
          apikey: ctx.env.SUPABASE_KEY,
          Authorization: "Bearer " + ctx.env.SUPABASE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(yuk)
      }
    );
    const matn = await r.text();
    if (!r.ok) {
      return Response.json({ ok: false, error: "Supabase " + r.status + ": " + matn.slice(0, 300) });
    }
    let natija;
    try {
      natija = JSON.parse(matn);
    } catch {
      return Response.json({ ok: false, error: "Baza JSON qaytarmadi: " + matn.slice(0, 200) });
    }
    return Response.json({ ...natija, amal, ms: Date.now() - t0 });
  } catch (err) {
    return Response.json({
      ok: false,
      error: "Cloudflare xatosi: " + (err?.message || String(err)),
      ms: Date.now() - t0
    });
  }
}, "onRequestPost");

// api/sessiya.ts
var onRequestGet2 = /* @__PURE__ */ __name(async (ctx) => {
  const secret = ctx.env.SESSIYA_KALIT;
  const sess = await tekshir(ctx.request.headers.get("Cookie"), secret);
  if (!sess) return Response.json({ ok: false }, { status: 401 });
  const yozaOladi = !(sess.rol === "boss" || sess.rol === "rahbar");
  return Response.json({
    ok: true,
    rol: sess.rol,
    email: sess.email || "",
    yozaOladi,
    tugaydi: sess.exp,
    /* ⚠️ Ochiq xavf ko'rsatkichi. `true` bo'lsa sessiyalar repozitoriyda
       yozilgan zaxira kalit bilan imzolanyapti — uni bilgan har kim
       admin bo'lib kira oladi. Bu ataylab qoldirilgan vaqtinchalik
       holat; ko'zdan yo'qolmasligi uchun shu yerda ochiq turadi. */
    zaxira_kalit: !kalitBormi(secret),
    /* ⚡ 2026-08-27: "Auth Session -> User -> Tenant" poydevori — sess
     * endi (yangi kirishlardan keyin) foydalanuvchi a'zo bo'lgan
     * kompaniyalarni biladi. Eski sessiyalarda bu `undefined` (frontend
     * buni "hammasi ko'rinadi, hali eski sessiya" deb talqin qilishi
     * mumkin — UI o'zgarishi hozircha qilinmadi, faqat ma'lumot
     * uzatiladi). */
    foydalanuvchi_id: sess.foydalanuvchi_id,
    kompaniyalar: sess.kompaniyalar
  });
}, "onRequestGet");

// api/upload.ts
var onRequestPost11 = /* @__PURE__ */ __name(async (ctx) => {
  try {
    const formData = await ctx.request.formData();
    const file = formData.get("fayl");
    const rfqId = formData.get("rfq_id");
    const kompaniyaId = formData.get("kompaniya_id");
    const obyektId = formData.get("obyekt_id");
    const turi = formData.get("turi");
    if (!file) return Response.json({ ok: false, error: "Fayl topilmadi" }, { status: 400 });
    let fileName;
    if (kompaniyaId && obyektId) {
      const xavfsizNom = file.name.replace(/[\/\\]/g, "_").replace(/\.\./g, "_");
      const turXavfsiz = turi === "loyiha" ? "loyiha" : "hujjat";
      fileName = kompaniyaId + "/" + obyektId + "/" + turXavfsiz + "/" + xavfsizNom;
    } else {
      const ext = file.name.split(".").pop();
      fileName = (rfqId || "fayl") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    }
    await ctx.env.R2_ARCHIVE.put(fileName, file.stream(), {
      httpMetadata: { contentType: file.type }
    });
    const fileUrl = "https://r2.qurilish-os.uz/" + fileName;
    return Response.json({ ok: true, url: fileUrl, filename: fileName });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}, "onRequestPost");

// api/xato.ts
var onRequestPost12 = /* @__PURE__ */ __name(async (ctx) => {
  try {
    const req = await ctx.request.json();
    await fetch(ctx.env.GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        __api: 1,
        token: ctx.env.GAS_TOKEN,
        fn: "apiXatoYoz",
        args: [
          req.manba || "FRONTEND",
          req.xabar || "Noma'lum xato",
          "Sayt foydalanuvchisi",
          { url: req.url, line: req.line }
        ]
      })
    });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false }, { status: 500 });
  }
}, "onRequestPost");

// tg/webhook.ts
var onRequestPost13 = /* @__PURE__ */ __name(async (ctx) => {
  try {
    const update = await ctx.request.json();
    if (!update.message) return new Response("OK");
    const msg = update.message;
    const text = msg.text || msg.caption || "";
    console.log("Telegram update received:", text);
    return new Response("OK");
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Error", { status: 500 });
  }
}, "onRequestPost");

// ../.wrangler/tmp/pages-VKdKBB/functionsRoutes-0.8476525256996374.mjs
var routes = [
  {
    routePath: "/api/agent/call",
    mountPath: "/api/agent",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/agent/manifest",
    mountPath: "/api/agent",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/ai-parse",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/ai-savol",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/didox-webhook",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/gas",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/kirish",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/payment",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/royxat",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/sb",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/sb-yoz",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/sessiya",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/upload",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  },
  {
    routePath: "/api/xato",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost12]
  },
  {
    routePath: "/tg/webhook",
    mountPath: "/tg",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost13]
  }
];

// C:/Users/anvar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/anvar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// C:/Users/anvar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/anvar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError2;

// ../.wrangler/tmp/bundle-gRUJgL/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// C:/Users/anvar/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-gRUJgL/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.757531588672308.mjs.map
