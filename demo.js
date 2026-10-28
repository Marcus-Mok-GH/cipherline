/**
 * Offline height-encoding demo.
 * Encodes a short phrase as building heights (A=1 … Z=26, space=gap),
 * the same family Fable used in 33/50 paper images.
 */

function letterHeight(ch) {
  if (ch === " ") return 0;
  const code = ch.toUpperCase().charCodeAt(0) - 64;
  if (code < 1 || code > 26) return 0;
  return 8 + code * 4;
}

export function buildSkylineSvg(message) {
  const text = String(message || "HELLO")
    .toUpperCase()
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
  const chars = [...text];
  const width = Math.max(520, 40 + chars.length * 18);
  const ground = 360;
  let x = 28;
  const buildings = [];
  for (const ch of chars) {
    const h = letterHeight(ch);
    if (h === 0) {
      x += 16;
      continue;
    }
    const y = ground - h;
    const windows = [];
    for (let wy = y + 8; wy < ground - 10; wy += 14) {
      windows.push(
        `<rect x="${x + 3}" y="${wy}" width="3" height="4" fill="#d6b062" opacity="0.75"/>`,
        `<rect x="${x + 9}" y="${wy}" width="3" height="4" fill="#d6b062" opacity="0.45"/>`,
      );
    }
    buildings.push(
      `<g data-letter="${ch}">` +
        `<rect x="${x}" y="${y}" width="15" height="${h}" fill="#1a2740" stroke="#2b3d5c"/>` +
        windows.join("") +
        `</g>`,
    );
    x += 18;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 400" width="${width}" height="400">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1424"/>
      <stop offset="100%" stop-color="#121c30"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  <circle cx="${width - 56}" cy="48" r="22" fill="#f1e4c2" opacity="0.9"/>
  <circle cx="70" cy="60" r="1.5" fill="#e8e2d4"/>
  <circle cx="120" cy="40" r="1.2" fill="#e8e2d4"/>
  <circle cx="180" cy="72" r="1.4" fill="#e8e2d4"/>
  <circle cx="240" cy="36" r="1.1" fill="#e8e2d4"/>
  <circle cx="300" cy="58" r="1.3" fill="#e8e2d4"/>
  ${buildings.join("\n  ")}
  <rect x="0" y="${ground}" width="${width}" height="${400 - ground}" fill="#0a101c"/>
</svg>`;
}

export function decodeSkylineSvg(svg) {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const groups = [...doc.querySelectorAll("g[data-letter]")];
  if (groups.length) {
    return groups.map((g) => g.getAttribute("data-letter") || "").join("");
  }
  const rects = [...doc.querySelectorAll("svg > g rect:first-child, svg > rect")]
    .filter((r) => Number(r.getAttribute("height")) >= 12)
    .sort((a, b) => Number(a.getAttribute("x")) - Number(b.getAttribute("x")));
  let out = "";
  let prevX = null;
  for (const r of rects) {
    const x = Number(r.getAttribute("x"));
    const h = Number(r.getAttribute("height"));
    if (prevX != null && x - prevX > 24) out += " ";
    const n = Math.round((h - 8) / 4);
    if (n >= 1 && n <= 26) out += String.fromCharCode(64 + n);
    prevX = x;
  }
  return out.trim();
}
