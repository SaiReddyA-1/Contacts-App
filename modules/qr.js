// Simple QR-based contact sharing (name + primary phone only)
// No external dependencies; uses a compact QR encoder for short text.

/* ---- Galois field + Reed-Solomon helpers (simplified) ---- */

const GF_EXP = new Array(512);
const GF_LOG = new Array(256);
let gfInitDone = false;

function gfInit() {
  if (gfInitDone) return;
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
  gfInitDone = true;
}

function gfMul(a, b) {
  if (!a || !b) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

function rsGenerator(degree) {
  gfInit();
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = [1];
    const p = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] = gfMul(poly[j], p);
    }
    next.push(0);
    for (let j = 0; j < poly.length; j++) {
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecCount) {
  const gen = rsGenerator(ecCount);
  const res = new Array(ecCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.shift();
    res.push(0);
    if (factor) {
      for (let j = 0; j < gen.length; j++) {
        res[j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return res;
}

// Byte capacities for QR versions 1–5 at error correction level M
const CAP_M = [0, 14, 26, 42, 62, 84];

function chooseVersion(len) {
  for (let v = 1; v <= 5; v++) {
    if (len <= CAP_M[v]) return v;
  }
  return 5;
}

function sizeForVersion(v) {
  return 17 + 4 * v;
}

function createMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(null));
}

function placeFinder(m, r, c) {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const y = r + dy;
      const x = c + dx;
      if (y < 0 || x < 0 || y >= m.length || x >= m.length) continue;
      const inBox = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
      const onBorder = dy === 0 || dy === 6 || dx === 0 || dx === 6;
      const inCenter = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
      let val = false;
      if (inBox && (onBorder || inCenter)) val = true;
      m[y][x] = val;
    }
  }
}

function placePatterns(m, version) {
  const n = m.length;
  placeFinder(m, 0, 0);
  placeFinder(m, 0, n - 7);
  placeFinder(m, n - 7, 0);

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    const v = i % 2 === 0;
    if (m[6][i] === null) m[6][i] = v;
    if (m[i][6] === null) m[i][6] = v;
  }

  // Reserve format info (we'll just mark them light)
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      m[8][i] = m[8][i] ?? false;
      m[i][8] = m[i][8] ?? false;
    }
  }
  for (let i = 0; i < 8; i++) {
    m[n - 1 - i][8] = m[n - 1 - i][8] ?? false;
    m[8][n - 1 - i] = m[8][n - 1 - i] ?? false;
  }
}

function encodeBytes(text, version) {
  const data = new TextEncoder().encode(text);
  const capacity = CAP_M[version];
  if (data.length > capacity) {
    throw new Error("Text too long for QR");
  }
  const bits = [];
  // Mode: byte (0100)
  bits.push(0, 1, 0, 0);
  // length (8 bits for versions 1–9)
  const len = data.length;
  for (let i = 7; i >= 0; i--) bits.push((len >> i) & 1);
  for (const b of data) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  const totalBits = capacity * 8;
  const remaining = totalBits - bits.length;
  for (let i = 0; i < Math.min(4, remaining); i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  let pad = 0xec;
  while (bits.length < totalBits) {
    for (let i = 7; i >= 0 && bits.length < totalBits; i--) {
      bits.push((pad >> i) & 1);
    }
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return bits;
}

function bitsToBytes(bits) {
  const out = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    out.push(v);
  }
  return out;

}

function placeData(m, bits) {
  const n = m.length;
  let bitIndex = 0;
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < n; i++) {
      const row = upward ? n - 1 - i : i;
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        if (m[row][c] !== null) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex] : 0;
        m[row][c] = !!bit;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

function applyMask(m) {
  const n = m.length;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c] === null) continue;
      // simple mask: (r + c) % 2 === 0
      if ((r + c) % 2 === 0) {
        m[r][c] = !m[r][c];
      }
    }
  }
}

function makeMatrix(text) {
  const v = chooseVersion(text.length);
  const n = sizeForVersion(v);
  const m = createMatrix(n);
  placePatterns(m, v);
  const dataBits = encodeBytes(text, v);
  const dataBytes = bitsToBytes(dataBits);

  // Rough EC: use 1/3 of capacity as parity
  const totalCodewords = CAP_M[v];
  const ecCount = Math.max(7, Math.min(30, Math.floor(totalCodewords / 3)));
  const ec = rsEncode(dataBytes, ecCount);
  const full = dataBytes.concat(ec);
  const fullBits = [];
  for (const b of full) {
    for (let i = 7; i >= 0; i--) fullBits.push((b >> i) & 1);
  }

  placeData(m, fullBits);
  applyMask(m);
  return m;
}

function drawMatrixToCanvas(matrix, canvas) {
  const n = matrix.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const pad = 8;
  const size = Math.min(canvas.width, canvas.height) - pad * 2;
  const cell = Math.max(1, Math.floor(size / n));
  const offsetX = Math.floor((canvas.width - cell * n) / 2);
  const offsetY = Math.floor((canvas.height - cell * n) / 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(offsetX + c * cell, offsetY + r * cell, cell, cell);
      }
    }
  }
}

export function setupQR({ getSelectedContact }) {
  const btn = document.getElementById("btn-detail-qr");
  const overlay = document.getElementById("qr-overlay");
  const closeBtn = document.getElementById("qr-close");
  const canvas = document.getElementById("qr-canvas");
  const backdrop = overlay.querySelector(".overlay-backdrop");

  if (!btn || !overlay || !canvas || !closeBtn || !backdrop) return;

  function close() {
    overlay.hidden = true;
  }

  closeBtn.addEventListener("click", () => {
    close();
  });
  backdrop.addEventListener("click", () => {
    close();
  });

  btn.addEventListener("click", async () => {
    const contact = await getSelectedContact();
    if (!contact) return;
    const first = (contact.firstName || "").trim();
    const last = (contact.lastName || "").trim();
    const primaryPhone =
      (contact.phoneNumbers || []).find((p) => p.isPrimary) || (contact.phoneNumbers || [])[0];

    if (!primaryPhone || !primaryPhone.number) {
      alert("This contact has no phone number to share.");
      return;
    }

    // Minimal payload: just name + primary phone
    const payload = JSON.stringify({
      t: "phone-card",
      n: first,
      l: last,
      p: String(primaryPhone.number),
    });

    try {
      const matrix = makeMatrix(payload);
      drawMatrixToCanvas(matrix, canvas);
      overlay.hidden = false;
    } catch (e) {
      console.error(e);
      alert("Could not generate QR code for this contact.");
    }
  });
}

