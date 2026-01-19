/* =========================================================
   AR Showcase — script.js (clean version)
   - Loads data.json (dynamic items)
   - Starts WebXR AR (A-Frame)
   - Draws a dynamic ring of 3D cards
   - AR-first UX: no blocking UI by default
   - Menu toggle (⌂): shows/hides bottom sheet
   - Detailed error messages on AR failure
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

// ---------- UI ----------
const start = $("#start");
const btnStart = $("#btn-start");
// previewVideo removed

const topbar = $("#topbar");
const btnMenu = $("#btn-reset");   // we use as menu toggle
const btnClose = $("#btn-close");

const sheet = $("#sheet");
const sheetSub = $("#sheetSub");
const list = $("#list");
const search = $("#search");
const btnClear = $("#btn-clear");
const btnReload = $("#btn-reload");

const details = $("#details");
const btnDetailsClose = $("#btn-details-close");
const btnBackToList = $("#btn-back-to-list");
const dTitle = $("#dTitle");
const dTag = $("#dTag");
const dDesc = $("#dDesc");
const dLink = $("#dLink");
const dHint = $("#dHint");

const fail = $("#fail");
const failMsg = $("#failMsg");
const btnRetry = $("#btn-retry");
const btnOpenChrome = $("#btn-open-chrome");

// ---------- A-Frame ----------
const scene = $("#scene");
const cam = $("#cam");
const world = $("#world");

// ---------- State ----------
// previewStream removed
let items = [];
let trackingOk = false;
let currentItem = null;

// =========================================================
// Utilities
// =========================================================
function isSecure() {
  return window.isSecureContext && location.protocol === "https:";
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (m) => "\\" + m);
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function safeStr(v, fallback = "") {
  return (typeof v === "string" && v.trim().length) ? v : fallback;
}

function normalizeItem(raw, meta = {}) {
  return {
    id: safeStr(raw.id, "item_" + Math.random().toString(16).slice(2)),
    title: safeStr(raw.title, "Nomsiz yo‘nalish"),
    desc: safeStr(raw.desc, ""),
    tag: safeStr(raw.tag, "Yo‘nalish"),
    icon: safeStr(raw.icon, "✨"),
    color: safeStr(raw.color, "#00d2ff"),
    link: safeStr(raw.link, meta.defaultLink || "#"),
    image: safeStr(raw.image, "") // NEW: ./img/xxx.jpg
  };
}


// =========================================================
// Preview camera (optional)
// =========================================================
// Preview camera functions removed as requested
// to prevent camera resource conflicts and simplify UI.

// =========================================================
// Fail UI
// =========================================================
function showFail(message) {
  // stopPreview removed

  // Hide everything else
  start.hidden = true;
  topbar.hidden = true;
  sheet.hidden = true;
  details.hidden = true;

  failMsg.textContent = message;
  fail.hidden = false;

  try { btnOpenChrome.href = location.href; } catch (e) { }
}

function hideFail() {
  fail.hidden = true;
}

btnRetry.onclick = () => window.location.reload();

// =========================================================
// Load data.json
// =========================================================
async function loadData() {
  list.innerHTML = "";
  sheetSub.textContent = "Yuklanmoqda…";

  try {
    const res = await fetch("./data.json?v=" + Date.now());
    if (!res.ok) throw new Error("data.json fetch failed: " + res.status);

    const json = await res.json();
    const meta = json.meta || {};
    const rawItems = Array.isArray(json.items) ? json.items : [];

    items = rawItems.map((it) => normalizeItem(it, meta)).filter((x) => x.title);

    sheetSub.textContent = `${items.length} ta yo‘nalish`;
    renderList(items);

    return true;
  } catch (e) {
    console.warn("loadData error:", e);
    sheetSub.textContent = "Xatolik: data.json o‘qilmadi";
    list.innerHTML = `
      <div class="item">
        <div class="left">
          <div class="t">Xatolik</div>
          <div class="m">data.json topilmadi yoki format noto‘g‘ri.</div>
        </div>
        <div class="right">⚠️</div>
      </div>`;
    return false;
  }
}

// =========================================================
// List UI (sheet)
// =========================================================
function renderList(arr) {
  list.innerHTML = "";

  arr.forEach((it) => {
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.id = it.id;

    el.innerHTML = `
      <div class="left">
        <div class="t">${escapeHtml(`${it.icon} ${it.title}`)}</div>
        <div class="m">${escapeHtml(it.tag)} • Tanlash</div>
      </div>
      <div class="right">➜</div>
    `;

    el.onclick = (e) => {
      e.stopPropagation();
      openItem(it);
      pulseCard(it.id);
    };

    list.appendChild(el);
  });
}

function filterList(q) {
  const query = (q || "").trim().toLowerCase();
  if (!query) {
    renderList(items);
    return;
  }

  const filtered = items.filter((it) => {
    const hay = `${it.title} ${it.tag} ${it.desc}`.toLowerCase();
    return hay.includes(query);
  });

  renderList(filtered);
}

search.addEventListener("input", () => filterList(search.value));

btnClear.onclick = () => {
  search.value = "";
  filterList("");
  search.focus();
};

btnReload.onclick = async () => {
  await loadData();
  if (trackingOk) drawRing(items);
};

// Menu toggle (AR-first)
btnMenu.onclick = () => {
  if (!trackingOk) return;
  details.hidden = true;
  sheet.hidden = !sheet.hidden;

  if (!sheet.hidden) {
    search.value = "";
    filterList("");
    setTimeout(() => search.focus(), 50);
  }
};

// Close button just clears overlays
btnClose.onclick = () => {
  details.hidden = true;
  sheet.hidden = true;
};

// =========================================================
// Details modal
// =========================================================
function openItem(it) {
  currentItem = it;

  dTitle.textContent = `${it.icon} ${it.title}`;
  dTag.textContent = it.tag;
  dDesc.textContent = it.desc || "Tavsif tez orada qo‘shiladi.";
  dLink.href = it.link || "#";
  dLink.style.display = (it.link && it.link !== "#") ? "inline-flex" : "none";

  dHint.textContent = "Keyin: rasm/video/3D model qo‘shamiz (hozircha tekst).";

  // AR-first: show details, hide sheet
  details.hidden = false;
  sheet.hidden = true;
}

function closeDetails() {
  details.hidden = true;
  sheet.hidden = true;
}

btnDetailsClose.onclick = closeDetails;
btnBackToList.onclick = closeDetails;

// =========================================================
// 6DoF tracking watchdog
// =========================================================
async function waitForRealTracking(timeoutMs = 7000) {
  const camObj = cam.object3D;
  const startT = performance.now();

  const p0 = camObj.position.clone();
  const r0 = camObj.rotation.clone();

  let moved = 0;

  return new Promise((resolve) => {
    const tick = () => {
      const now = performance.now();
      const p = camObj.position;
      const r = camObj.rotation;

      const dp = Math.abs(p.x - p0.x) + Math.abs(p.y - p0.y) + Math.abs(p.z - p0.z);
      const dr = Math.abs(r.x - r0.x) + Math.abs(r.y - r0.y) + Math.abs(r.z - r0.z);

      if (dp > 0.02 || dr > 0.02) moved++;

      if (moved >= 3) return resolve(true);
      if (now - startT > timeoutMs) return resolve(false);

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  });
}

// =========================================================
// AR Ring drawing
// =========================================================
function clearWorld() {
  world.innerHTML = "";
}

function drawRing(arr) {
  clearWorld();
  if (!arr || arr.length === 0) return;

  const n = arr.length;

  // ====== REAL-WORLD SIZE (meters) ======
  const cardH = 1.20;          // 1.2m height
  const cardW = 0.78;          // 78cm width
  const bottomClear = 0.20;    // 20cm above floor
  const y = bottomClear + cardH / 2; // center position -> bottom is 20cm

  // Desired gap between cards (edge-to-edge)
  const gap = 0.50;            // 0.5m spacing
  const chord = cardW + gap;   // center-to-center approx

  // Radius derived from chord length
  // chord = 2R * sin(pi/n) -> R = chord / (2 sin(pi/n))
  const radius = clamp(chord / (2 * Math.sin(Math.PI / n)), 1.8, 4.2);

  const zForward = -0.35;

  // Layer depth offsets
  const dz0 = 0.000;
  const dz1 = 0.008;
  const dz2 = 0.014;

  // Content layout
  const imgH = 0.62;                       // image block height (m)
  const imgW = cardW - 0.08;               // little padding
  const imgY = (cardH / 2) - 0.10 - imgH / 2; // top area

  // Text positions (tuned for 1.2m card)
  const titleY = -0.06;
  const tagY = -0.22;
  const descY = -0.44;

  arr.forEach((it, i) => {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius + zForward;

    const card = document.createElement("a-entity");
    card.setAttribute("id", `card-${it.id}`);
    card.setAttribute("position", `${x.toFixed(3)} ${y.toFixed(3)} ${z.toFixed(3)}`);
    card.setAttribute("look-at", "#cam");

    // ---- Soft float animation (subtle) ----
    card.setAttribute(
      "animation__float",
      `property: position; to: ${x.toFixed(3)} ${(y + 0.03).toFixed(3)} ${z.toFixed(3)}; dir: alternate; loop: true; dur: ${1800 + (i % 5) * 220}; easing: easeInOutSine`
    );

    // ---- Shadow (fake) ----
    const shadow = document.createElement("a-plane");
    shadow.setAttribute("width", (cardW + 0.10).toFixed(2));
    shadow.setAttribute("height", (cardH + 0.10).toFixed(2));
    shadow.setAttribute("position", `0 -0.03 ${(-0.02).toFixed(3)}`);
    shadow.setAttribute("material", "color: #000000; opacity: 0.30; transparent: true; shader: flat; side: double");
    card.appendChild(shadow);

    // ---- Border frame ----
    const border = document.createElement("a-plane");
    border.setAttribute("width", (cardW + 0.04).toFixed(2));
    border.setAttribute("height", (cardH + 0.04).toFixed(2));
    border.setAttribute("position", `0 0 ${(-0.01).toFixed(3)}`);
    border.setAttribute("material", "color: #111827; shader: flat; side: double");
    card.appendChild(border);

    // ---- Main background ----
    const bg = document.createElement("a-plane");
    bg.setAttribute("width", cardW.toFixed(2));
    bg.setAttribute("height", cardH.toFixed(2));
    bg.setAttribute("position", `0 0 ${dz0.toFixed(3)}`);
    bg.setAttribute("material", "color: #0b1220; shader: flat; side: double");
    card.appendChild(bg);

    // ---- Accent strip ----
    const accent = document.createElement("a-plane");
    accent.setAttribute("width", cardW.toFixed(2));
    accent.setAttribute("height", "0.06");
    accent.setAttribute("position", `0 ${(cardH / 2 - 0.03).toFixed(2)} ${dz1.toFixed(3)}`);
    accent.setAttribute("material", `color: ${it.color}; shader: flat; side: double`);
    card.appendChild(accent);

    // ---- Image block ----
    const img = document.createElement("a-plane");
    img.setAttribute("width", imgW.toFixed(2));
    img.setAttribute("height", imgH.toFixed(2));
    img.setAttribute("position", `0 ${imgY.toFixed(2)} ${dz1.toFixed(3)}`);
    img.setAttribute("material", it.image
      ? `src: url(${it.image}); shader: flat; side: double`
      : `color: #0f172a; shader: flat; side: double`
    );
    card.appendChild(img);

    // ---- Image overlay gradient-ish (darker bottom for readability) ----
    const imgFade = document.createElement("a-plane");
    imgFade.setAttribute("width", imgW.toFixed(2));
    imgFade.setAttribute("height", imgH.toFixed(2));
    imgFade.setAttribute("position", `0 ${imgY.toFixed(2)} ${dz2.toFixed(3)}`);
    imgFade.setAttribute("material", "color: #000000; opacity: 0.20; transparent: true; shader: flat; side: double");
    card.appendChild(imgFade);

    // ---- Title ----
    const title = document.createElement("a-text");
    title.setAttribute("value", `${it.icon} ${it.title}`);
    title.setAttribute("align", "center");
    title.setAttribute("width", (cardW * 1.35).toFixed(2));
    title.setAttribute("position", `0 ${titleY.toFixed(2)} ${dz2.toFixed(3)}`);
    title.setAttribute("color", "white");
    title.setAttribute("wrap-count", "24");
    card.appendChild(title);

    // ---- Tag ----
    const tag = document.createElement("a-text");
    tag.setAttribute("value", it.tag);
    tag.setAttribute("align", "center");
    tag.setAttribute("width", (cardW * 1.55).toFixed(2));
    tag.setAttribute("position", `0 ${tagY.toFixed(2)} ${dz2.toFixed(3)}`);
    tag.setAttribute("color", "#cbd5e1");
    tag.setAttribute("wrap-count", "28");
    card.appendChild(tag);

    // ---- Description ----
    const desc = document.createElement("a-text");
    desc.setAttribute("value", it.desc || "");
    desc.setAttribute("align", "center");
    desc.setAttribute("width", (cardW * 1.70).toFixed(2));
    desc.setAttribute("position", `0 ${descY.toFixed(2)} ${dz2.toFixed(3)}`);
    desc.setAttribute("color", "#a3b0c2");
    desc.setAttribute("wrap-count", "32");
    card.appendChild(desc);

    world.appendChild(card);
  });

  // AR-first overlays off
  sheet.hidden = true;
  details.hidden = true;
}


function pulseCard(id) {
  const el = document.querySelector(`#card-${cssEscape(id)}`);
  if (!el) return;

  el.setAttribute(
    "animation__pulse",
    "property: scale; from: 1 1 1; to: 1.06 1.06 1.06; dur: 120; dir: alternate; loop: 2; easing: easeOutQuad"
  );

  setTimeout(() => {
    try { el.removeAttribute("animation__pulse"); } catch (e) { }
  }, 420);
}

// =========================================================
// FPS check (optional safety)
// =========================================================
AFRAME.registerComponent("fps-check", {
  init: function () {
    this.frames = 0;
    this.prevTime = Date.now();
    this.lowFpsCount = 0;
    this.startTime = Date.now();
    this.checkInterval = 1000;
  },
  tick: function () {
    this.frames++;
    const time = Date.now();

    if (time - this.startTime < 9000) return;

    if (time >= this.prevTime + this.checkInterval) {
      const fps = Math.round((this.frames * 1000) / (time - this.prevTime));

      if (fps < 15) this.lowFpsCount++;
      else this.lowFpsCount = 0;

      if (this.lowFpsCount >= 3) {
        try { this.el.pause(); } catch (e) { }
        showFail("FPS juda past bo‘lib qoldi. Qurilmada AR og‘ir ishlayapti. Kontentni yengillatish yoki kuchliroq telefon kerak bo‘lishi mumkin.");
      }

      this.prevTime = time;
      this.frames = 0;
    }
  }
});

// =========================================================
// App init
// =========================================================
(async function init() {
  // Initial UI state
  topbar.hidden = true;
  sheet.hidden = true;
  details.hidden = true;
  fail.hidden = true;

  // Load data
  await loadData();

  // Preview camera for start screen
  // startPreview() call removed

  // Show/hide close button only when details shown
  const detailsObserver = new MutationObserver(() => {
    btnClose.style.display = details.hidden ? "none" : "inline-grid";
  });
  detailsObserver.observe(details, { attributes: true, attributeFilter: ["hidden"] });

  // Start AR
  btnStart.onclick = async () => {
    btnStart.disabled = true;
    btnStart.textContent = "YUKLANMOQDA…";

    // stopPreview removed

    if (!isSecure()) {
      showFail("HTTPS kerak: GitHub Pages yoki HTTPS hostingda oching. (http yoki file:// ishlamaydi)");
      btnStart.disabled = false;
      btnStart.textContent = "BOSHLASH";
      return;
    }

    if (!("xr" in navigator)) {
      showFail("WebXR topilmadi. Android Chrome’da sinab ko‘ring yoki in-app browserdan chiqib, Chrome’da oching.");
      btnStart.disabled = false;
      btnStart.textContent = "BOSHLASH";
      return;
    }

    hideFail();

    // enterAR watchdog
    let enterDone = false;
    const enterWatchdog = setTimeout(() => {
      if (!enterDone) showFail("AR sessiya ochilmadi (timeout). Chrome yangilang va ARCore borligini tekshiring.");
    }, 6500);

    try {
      await scene.enterAR();
      enterDone = true;
      clearTimeout(enterWatchdog);

      const ok = await waitForRealTracking(7000);
      if (!ok) {
        showFail("6DoF tracking ishga tushmadi. Sabab: ARCore muammo bo‘lishi yoki brauzer XR’ni cheklashi mumkin.");
        return;
      }

      trackingOk = true;

      // AR-first UI
      start.hidden = true;
      topbar.hidden = false;
      sheet.hidden = true;
      details.hidden = true;

      // draw cards
      drawRing(items);

    } catch (e) {
      clearTimeout(enterWatchdog);
      console.warn("enterAR error:", e);

      const msg = (e && e.message) ? e.message : String(e);
      showFail("AR ochilmadi. Xato: " + msg);
    } finally {
      btnStart.disabled = false;
      btnStart.textContent = "BOSHLASH";
    }
  };
})();
