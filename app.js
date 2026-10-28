import { buildSkylineSvg, decodeSkylineSvg } from "./demo.js";
import chat, {
  authorizeWithPollen,
  captureFragmentKey,
  setKey,
  getKey,
} from "./pollen.js";
import {
  PAPER,
  PRESETS,
  encodePrompt,
  DECODE_PROMPT,
  schemePrompt,
  extractSvg,
  parseFinalAnswer,
  parseScheme,
  judge,
  svgToBitmap,
  SCHEME_FAMILIES,
  sampleSecrets,
} from "./stego.js";

const el = (id) => document.getElementById(id);

const $secret = el("secret");
const $presets = el("presets");
const $jpegLoss = el("jpegLoss");
const $imgFrame = el("imgFrame");
const $seekerLog = el("seekerLog");
const $encodeStatus = el("encodeStatus");
const $metrics = el("metrics");
const $schemePill = el("schemePill");
const $apiKey = el("apiKey");
const $keyHint = el("keyHint");
const $tabs = el("tabs");
const $skyline = el("skyline");

let currentSvg = null;
let currentSecret = null;
let key = getKey();

function setStatus(node, text, kind = "") {
  node.className = kind ? `status ${kind}` : "status";
  node.textContent = text;
}

function setTab(name) {
  $tabs.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name),
  );
  document
    .querySelectorAll("section.panel")
    .forEach((s) => s.classList.toggle("hidden", s.id !== `tab-${name}`));
}

function updateKeyHint() {
  if (document.activeElement !== $apiKey) $apiKey.value = key || "";
  $keyHint.textContent = key ? `saved: ${key.slice(0, 12)}…` : "not connected";
}

function requireKey() {
  key = getKey() || $apiKey.value.trim();
  if (key) setKey(key);
  if (!key) {
    setStatus(
      $encodeStatus,
      "Connect with Pollen or paste your own key first.",
      "err",
    );
    return false;
  }
  updateKeyHint();
  return true;
}

function paintSkyline() {
  if (!$skyline) return;
  $skyline.querySelectorAll(".b").forEach((n) => n.remove());
  const heights = [48, 72, 56, 94, 40, 110, 66, 88, 52, 98, 44, 76, 60, 84];
  heights.forEach((h, i) => {
    const b = document.createElement("div");
    b.className = "b";
    b.style.left = `${12 + i * 18}px`;
    b.style.height = `${h}px`;
    $skyline.appendChild(b);
  });
}

async function runExperiment() {
  const secret = $secret.value.trim();
  if (!secret) {
    setStatus($encodeStatus, "Enter a secret message.", "err");
    return;
  }
  if (secret.length > 80) {
    setStatus($encodeStatus, "Keep secrets under 80 characters.", "err");
    return;
  }
  if (!requireKey()) return;

  const preset = PRESETS[$presets.value] || PRESETS.fable;
  currentSecret = secret;
  currentSvg = null;
  $seekerLog.textContent = "";
  $metrics.style.display = "none";
  $schemePill.textContent = "scheme: —";
  setStatus($encodeStatus, `Hiding with ${preset.hider}…`);

  let hideRes;
  try {
    hideRes = await chat({
      key,
      model: preset.hider,
      messages: [{ role: "user", content: encodePrompt(secret) }],
      maxTokens: 12000,
      temperature: 0.8,
    });
  } catch (err) {
    setStatus($encodeStatus, `Hider error: ${err.message}`, "err");
    return;
  }

  try {
    currentSvg = extractSvg(hideRes.content);
  } catch (err) {
    setStatus($encodeStatus, `Hider did not return SVG: ${err.message}`, "err");
    $seekerLog.textContent = hideRes.content.slice(0, 2000);
    return;
  }

  const bitmap = await svgToBitmap(currentSvg, {
    size: 800,
    jpegQuality: $jpegLoss.checked ? 0.82 : null,
  });
  $imgFrame.innerHTML = "";
  const img = document.createElement("img");
  img.src = bitmap;
  img.alt = "Generated steganographic image";
  $imgFrame.appendChild(img);
  setStatus($encodeStatus, "Screenshot ready. Asking the seeker…");

  let scheme = { family: "unknown", detail: "" };
  try {
    const confess = await chat({
      key,
      model: preset.hider,
      messages: schemePrompt(currentSvg),
      maxTokens: 400,
      temperature: 0,
    });
    scheme = parseScheme(confess.content);
    $schemePill.textContent = `scheme: ${scheme.family}`;
  } catch {
    $schemePill.textContent = "scheme: unknown";
  }

  try {
    const seek = await chat({
      key,
      model: preset.seeker,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: DECODE_PROMPT },
            { type: "image_url", image_url: { url: bitmap } },
          ],
        },
      ],
      maxTokens: 4000,
      temperature: 0.2,
    });
    const answer = parseFinalAnswer(seek.content);
    const verdict = judge(currentSecret, answer);
    $seekerLog.textContent = answer.raw || "Seeker returned nothing.";
    $metrics.style.display = "grid";
    el("mHider").textContent = preset.hider.split("/").pop();
    el("mSeeker").textContent = preset.seeker.split("/").pop();
    const v = el("mVerdict");
    v.textContent = verdict.verdict;
    v.className =
      verdict.verdict === "decoded"
        ? "pill ok"
        : verdict.verdict === "close"
          ? "pill warn"
          : "pill danger";
    el("mSim").textContent = `${(verdict.score * 100).toFixed(0)}%`;
    if (scheme.detail) {
      $schemePill.title = scheme.detail;
      $schemePill.textContent = `scheme: ${scheme.family}`;
    }
    setStatus(
      $encodeStatus,
      verdict.verdict === "decoded"
        ? "Recovered — paper threshold met (≥90% similarity)."
        : `Seeker finished: ${verdict.verdict}.`,
      verdict.verdict === "decoded" ? "ok" : "",
    );
  } catch (err) {
    $seekerLog.textContent = `Seeker error: ${err.message}`;
    setStatus($encodeStatus, `Seeker error: ${err.message}`, "err");
  }
}

function wireTabs() {
  $tabs.addEventListener("click", (e) => {
    if (e.target.dataset.tab) setTab(e.target.dataset.tab);
  });
}

function wireLab() {
  const samples = sampleSecrets();
  $secret.placeholder = samples[2];
  el("btnSample").addEventListener("click", () => {
    $secret.value = samples[Math.floor(Math.random() * samples.length)];
  });
  el("btnEncode").addEventListener("click", runExperiment);
  el("btnTryDemo").addEventListener("click", () => {
    if (!$secret.value.trim()) $secret.value = samples[2];
    setTab("lab");
    runExperiment();
  });
  el("btnOpenGuide").addEventListener("click", () => window.open(PAPER, "_blank"));
  el("btnRerun").addEventListener("click", () => {
    if (currentSecret) $secret.value = currentSecret;
    runExperiment();
  });
  el("btnClear").addEventListener("click", () => {
    currentSvg = null;
    currentSecret = null;
    $imgFrame.innerHTML = '<span class="placeholder">No image yet</span>';
    $seekerLog.textContent = "";
    $metrics.style.display = "none";
    $schemePill.textContent = "scheme: —";
    setStatus($encodeStatus, "");
  });
  el("btnCopySvg").addEventListener("click", async () => {
    if (!currentSvg) return;
    await navigator.clipboard.writeText(currentSvg);
    el("btnCopySvg").textContent = "Copied!";
    setTimeout(() => {
      el("btnCopySvg").textContent = "Copy SVG";
    }, 1400);
  });
  el("btnDownload").addEventListener("click", () => {
    const img = $imgFrame.querySelector("img");
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.src;
    a.download = "cipherline-hidden.png";
    a.click();
  });
}

function wireSchemes() {
  const familiesLog = el("familiesLog");
  familiesLog.textContent = SCHEME_FAMILIES.map(
    (f) => `[${f.id}] ${f.label} — ${f.tip}`,
  ).join("\n");

  el("btnDetect").addEventListener("click", () => {
    const input = el("schemeSvg").value.trim();
    const log = el("schemeLog");
    if (!input) {
      log.textContent = "Paste an SVG first.";
      return;
    }
    try {
      const svg = extractSvg(input);
      const decoded = decodeSkylineSvg(svg);
      const hasHeightMarks = /data-letter=/.test(svg) || /<rect[^>]*height="\d+"/.test(svg);
      if (decoded && hasHeightMarks) {
        log.textContent =
          `Detected: height-family skyline\n` +
          `Decoded (deterministic): ${decoded}\n\n` +
          `Tip: height encodings survive screenshots; colour encodings often do not.`;
      } else {
        log.textContent =
          "No obvious height encoding found.\n" +
          "For model-drawn SVGs, run the Lab tab — the hider confesses its family after generation.";
      }
    } catch (err) {
      log.textContent = `Could not parse SVG: ${err.message}`;
    }
  });
}

function wireOffline() {
  el("btnOffEncode").addEventListener("click", () => {
    const msg = el("offSecret").value;
    const svg = buildSkylineSvg(msg);
    currentSvg = svg;
    const src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svg)));
    el("offFrameIn").innerHTML = "";
    el("offFrameIn").appendChild(
      Object.assign(document.createElement("img"), {
        src,
        alt: "skyline encoding",
      }),
    );
    el("offVerdict").textContent = "scheme: height";
    el("offFrameOut").textContent = decodeSkylineSvg(svg) || "(empty)";
  });
  el("btnOffEncode").click();
}

function wireAuth() {
  try {
    if (captureFragmentKey()) key = getKey();
  } catch (err) {
    setStatus($encodeStatus, err.message, "err");
  }
  $apiKey.addEventListener("change", () => {
    key = $apiKey.value.trim();
    setKey(key);
    updateKeyHint();
  });
  el("btnConnect").addEventListener("click", () => authorizeWithPollen());
  el("btnDisconnect").addEventListener("click", () => {
    key = "";
    setKey("");
    updateKeyHint();
  });
  updateKeyHint();
}

paintSkyline();
wireTabs();
wireLab();
wireSchemes();
wireOffline();
wireAuth();
