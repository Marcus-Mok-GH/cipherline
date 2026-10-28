const API = "https://gen.pollinations.ai";
const ENTER = "https://enter.pollinations.ai";
const KEY_STORE = "cipherline-key";

export function getKey() {
  return sessionStorage.getItem(KEY_STORE) || "";
}

export function setKey(key) {
  if (key) sessionStorage.setItem(KEY_STORE, key);
  else sessionStorage.removeItem(KEY_STORE);
}

export async function listModels() {
  const res = await fetch(`${API}/v1/models`);
  if (!res.ok) throw new Error(`Could not load models (${res.status})`);
  const data = await res.json();
  const models = data.data || data || [];
  return models.filter(
    (m) =>
      Array.isArray(m.input_modalities) &&
      m.input_modalities.includes("text") &&
      m.input_modalities.includes("image") &&
      Array.isArray(m.output_modalities) &&
      m.output_modalities.includes("text") &&
      (m.supported_endpoints || []).includes("/v1/chat/completions"),
  );
}

export async function chat({
  key = getKey(),
  model,
  messages,
  maxTokens = 8000,
  temperature = 0.7,
} = {}) {
  if (!key) throw new Error("Connect with your own Pollen key first.");
  const res = await fetch(`${API}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${res.status}: ${text.slice(0, 240)}`);
  }
  if (!res.ok) {
    throw new Error(
      data.error?.message || data.message || `${res.status}: ${text.slice(0, 240)}`,
    );
  }
  let content = data?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) content = content.map((p) => p.text || "").join("");
  return {
    content: String(content || "").trim(),
    usage: data.usage || null,
    model: data.model || model,
  };
}

export default chat;

export function authorizeWithPollen() {
  const redirect = `${location.origin}${location.pathname}`;
  const params = new URLSearchParams({
    redirect_uri: redirect,
    scope: "usage",
    budget: "5",
    expiry: "7",
    models: "text",
  });
  location.href = `${ENTER}/authorize?${params}`;
}

export function captureFragmentKey() {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const key = params.get("api_key") || params.get("access_token");
  const error = params.get("error");
  history.replaceState({}, "", location.pathname + location.search);
  if (error) throw new Error(`Authorization failed: ${error}`);
  if (key) {
    setKey(key);
    return key;
  }
  return null;
}
