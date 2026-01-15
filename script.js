/* =========================================================
   AR Showcase — script.js
   - Loads data.json
   - Starts WebXR AR (A-Frame)
   - Draws a dynamic ring of cards from JSON items[]
   - Click on 3D cards OR select from bottom sheet list
   - Shows details modal
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

// UI elements
const ui = $("#ui");
const start = $("#start");
const btnStart = $("#btn-start");
const previewVideo = $("#previewVideo");

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

const btnReset = $("#btn-reset");
const btnClose = $("#btn-close");

// A-Frame
const scene = $("#scene");
const cam = $("#cam");
const world = $("#world");

// state
let previewStream = null;
let data = null;
let items = [];
let trackingOk = false;
let currentItem = null;

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function isSecure() {
    return window.isSecureContext && location.protocol === "https:";
}

function stopPreview() {
    try {
        if (previewStream) previewStream.getTracks().forEach((t) => t.stop());
    } catch (e) { }
    previewStream = null;
    try { previewVideo.srcObject = null; } catch (e) { }
}

function showFail(message) {
    stopPreview();
    start.hidden = true;
    sheet.hidden = true;
    details.hidden = true;

    failMsg.textContent = message;
    fail.hidden = false;

    // Provide "open in chrome" link (best-effort)
    // (On Android, intent:// can be used, but not always reliable)
    try {
        btnOpenChrome.href = location.href;
    } catch (e) { }
}

function hideFail() {
    fail.hidden = true;
}

function safeStr(v, fallback = "") {
    return (typeof v === "string" && v.trim().length) ? v : fallback;
}

function normalizeItem(raw, metaDefaults = {}) {
    const id = safeStr(raw.id, "item_" + Math.random().toString(16).slice(2));
    const title = safeStr(raw.title, "Nomsiz yo‘nalish");
    const desc = safeStr(raw.desc, "");
    const tag = safeStr(raw.tag, "Yo‘nalish");
    const icon = safeStr(raw.icon, "✨");
    const color = safeStr(raw.color, "#00d2ff");
    const link = safeStr(raw.link, metaDefaults.defaultLink || "#");

    return { id, title, desc, tag, icon, color, link };
}

function clearWorld() {
    world.innerHTML = "";
}

// ---------------------------------------------------------
// Camera preview (optional, just UX)
// ---------------------------------------------------------
async function startPreview() {
    try {
        const s = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        previewStream = s;
        previewVideo.srcObject = s;
    } catch (e) {
        // Preview is optional; do nothing
        console.warn("Preview camera failed:", e);
    }
}

// ---------------------------------------------------------
// Load JSON data
// ---------------------------------------------------------
async function loadData() {
    list.innerHTML = "";
    sheetSub.textContent = "Yuklanmoqda…";

    try {
        // cache-bust for GitHub Pages
        const res = await fetch("./data.json?v=" + Date.now());
        if (!res.ok) throw new Error("data.json fetch failed: " + res.status);
        const json = await res.json();

        const meta = json.meta || {};
        const rawItems = Array.isArray(json.items) ? json.items : [];

        data = { meta, rawItems };
        items = rawItems.map((it) => normalizeItem(it, meta)).filter((x) => x.title);

        sheetSub.textContent = `${items.length} ta yo‘nalish`;
        renderList(items);

        return true;
    } catch (e) {
        console.warn(e);
        sheetSub.textContent = "Xatolik: data.json o‘qilmadi";
        list.innerHTML = `<div class="item"><div class="left"><div class="t">Xatolik</div><div class="m">data.json topilmadi yoki noto‘g‘ri format.</div></div><div class="right">⚠️</div></div>`;
        return false;
    }
}

// ---------------------------------------------------------
// List UI
// ---------------------------------------------------------
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
            // also highlight the 3D card a bit (optional)
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

btnClear.onclick = () => {
    search.value = "";
    filterList("");
    search.focus();
};

btnReload.onclick = async () => {
    await loadData();
    // redraw ring if already in AR
    if (trackingOk) drawRing(items);
};

search.addEventListener("input", () => filterList(search.value));

// ---------------------------------------------------------
// Details modal
// ---------------------------------------------------------
function openItem(it) {
    currentItem = it;

    dTitle.textContent = `${it.icon} ${it.title}`;
    dTag.textContent = it.tag;
    dDesc.textContent = it.desc || "Tavsif tez orada qo‘shiladi.";
    dLink.href = it.link || "#";
    dLink.style.display = (it.link && it.link !== "#") ? "inline-flex" : "none";

    // hint
    dHint.textContent = "Keyin: rasm/video/3D model qo‘shamiz (hozircha tekst).";

    details.hidden = false;
    sheet.hidden = true;
}

function closeDetails() {
    details.hidden = true;
    sheet.hidden = true;
}

btnDetailsClose.onclick = closeDetails;
btnBackToList.onclick = closeDetails;

// Close button: hides details + shows list
btnClose.onclick = () => {
  details.hidden = true;
  sheet.hidden = true;
};


// Reset: redraw ring + show list
btnReset.onclick = () => {
    if (!trackingOk) return;
    sheet.hidden = !sheet.hidden;   // toggle
    details.hidden = true;
};


// ---------------------------------------------------------
// WebXR start + "real tracking" watchdog
// ---------------------------------------------------------
async function waitForRealTracking(timeoutMs = 7000) {
    // Detect true 6DoF motion by observing camera object3D changes
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

            if (moved >= 3) {
                resolve(true);
                return;
            }

            if (now - startT > timeoutMs) {
                resolve(false);
                return;
            }

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    });
}

btnRetry.onclick = () => window.location.reload();

// ---------------------------------------------------------
// AR Ring drawing
// ---------------------------------------------------------
function drawRing(arr) {
    clearWorld();

    if (!arr || arr.length === 0) return;

    // Adaptive radius: more items -> bigger radius (within safe range)
    const n = arr.length;
    const radius = clamp(1.15 + n * 0.06, 1.25, 1.75);
    const y = 1.35;          // card height
    const zForward = -0.25;  // slight forward shift
    const lift = 0.02;

    // spread evenly around
    arr.forEach((it, i) => {
        const angle = (i / n) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius + zForward;

        const card = document.createElement("a-entity");
        card.setAttribute("id", `card-${it.id}`);
        card.setAttribute("position", `${x} ${y} ${z}`);
        card.setAttribute("look-at", "#cam");
        card.classList.add("clickable");

        // Panel background
        const panel = document.createElement("a-plane");
        panel.setAttribute("width", "1.15");
        panel.setAttribute("height", "0.68");
        panel.setAttribute("material", `color: #0f172a; opacity: 0.93; transparent: true; shader: standard`);
        panel.setAttribute("animation", `property: position; from: 0 ${lift} 0; to: 0 ${-lift} 0; dir: alternate; loop: true; dur: ${1200 + (i % 4) * 180}; easing: easeInOutSine`);
        card.appendChild(panel);

        // Accent bar
        const bar = document.createElement("a-plane");
        bar.setAttribute("width", "1.15");
        bar.setAttribute("height", "0.05");
        bar.setAttribute("position", `0 0.315 0.01`);
        bar.setAttribute("material", `color: ${it.color}; opacity: 0.95; transparent: true; shader: flat`);
        card.appendChild(bar);

        // Icon
        const icon = document.createElement("a-text");
        icon.setAttribute("value", it.icon);
        icon.setAttribute("align", "center");
        icon.setAttribute("width", "2.2");
        icon.setAttribute("position", "0 0.14 0.02");
        icon.setAttribute("color", "white");
        card.appendChild(icon);

        // Title
        const title = document.createElement("a-text");
        title.setAttribute("value", it.title);
        title.setAttribute("align", "center");
        title.setAttribute("width", "1.7");
        title.setAttribute("position", "0 0.00 0.02");
        title.setAttribute("color", "white");
        card.appendChild(title);

        // Tag
        const tag = document.createElement("a-text");
        tag.setAttribute("value", it.tag);
        tag.setAttribute("align", "center");
        tag.setAttribute("width", "2.0");
        tag.setAttribute("position", "0 -0.18 0.02");
        tag.setAttribute("color", "#cbd5e1");
        card.appendChild(tag);

        // Tiny hint text
        const hint = document.createElement("a-text");
        hint.setAttribute("value", "Tap");
        hint.setAttribute("align", "center");
        hint.setAttribute("width", "2.2");
        hint.setAttribute("position", "0 -0.30 0.02");
        hint.setAttribute("color", it.color);
        card.appendChild(hint);

        // Click action
        card.addEventListener("click", (e) => {
            e.stopPropagation();
            openItem(it);
            pulseCard(it.id);
        });

        world.appendChild(card);
    });

    // Show list by default
    sheet.hidden = true;
    details.hidden = true;
}

function pulseCard(id) {
    const el = document.querySelector(`#card-${cssEscape(id)}`);
    if (!el) return;

    // Add a quick scale pulse (via animation component)
    el.setAttribute("animation__pulse", "property: scale; from: 1 1 1; to: 1.06 1.06 1.06; dur: 120; dir: alternate; loop: 2; easing: easeOutQuad");
    setTimeout(() => {
        try { el.removeAttribute("animation__pulse"); } catch (e) { }
    }, 420);
}

// ---------------------------------------------------------
// FPS check component (fail if too low for too long)
// ---------------------------------------------------------
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

        // wait a bit after entering AR to stabilize
        if (time - this.startTime < 9000) return;

        if (time >= this.prevTime + this.checkInterval) {
            const fps = Math.round((this.frames * 1000) / (time - this.prevTime));

            if (fps < 15) this.lowFpsCount++;
            else this.lowFpsCount = 0;

            if (this.lowFpsCount >= 3) {
                try { this.el.pause(); } catch (e) { }
                showFail("FPS juda past bo‘lib qoldi. Qurilmada AR og‘ir ishlayapti. Yengilroq kontent yoki kuchliroq telefon kerak bo‘lishi mumkin.");
            }

            this.prevTime = time;
            this.frames = 0;
        }
    }
});

// ---------------------------------------------------------
// Utilities
// ---------------------------------------------------------
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

// Escape HTML for list rendering
function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// Escape for querySelector id usage
function cssEscape(s) {
    // lightweight escape for ids in querySelector
    return String(s).replace(/[^a-zA-Z0-9_-]/g, (m) => "\\" + m);
}

// ---------------------------------------------------------
// App start
// ---------------------------------------------------------
(async function init() {
    // Top buttons default
    btnClose.style.display = "none"; // only useful when details open

    // Load data early
    await loadData();

    // Start preview right away (optional)
    startPreview();

    // Hook: show/hide close button depending on details
    const detailsObserver = new MutationObserver(() => {
        btnClose.style.display = details.hidden ? "none" : "inline-grid";
    });
    detailsObserver.observe(details, { attributes: true, attributeFilter: ["hidden"] });

    // Start button -> enter AR
    btnStart.onclick = async () => {
        // UI state
        btnStart.disabled = true;
        btnStart.textContent = "YUKLANMOQDA…";

        // Stop preview so AR can use camera
        stopPreview();

        // Guards
        if (!isSecure()) {
            showFail("HTTPS kerak: GitHub Pages yoki HTTPS hostingda oching. (http ishlamaydi)");
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

        // Watchdog for enterAR
        let enterDone = false;
        const enterWatchdog = setTimeout(() => {
            if (!enterDone) showFail("AR sessiya ochilmadi (timeout). Chrome yangilang va ARCore borligini tekshiring.");
        }, 5500);

        try {
            await scene.enterAR();
            enterDone = true;
            clearTimeout(enterWatchdog);

            // Verify real tracking (anti “support aldaydi”)
            const ok = await waitForRealTracking(7000);
            if (!ok) {
                showFail("6DoF tracking ishga tushmadi. Qurilmada ARCore muammo bo‘lishi mumkin yoki in-app brauzer XR’ni cheklayapti.");
                return;
            }

            trackingOk = true;

            // Hide start UI, show sheet
            start.hidden = true;
            sheet.hidden = false;

            // Draw ring from JSON
            drawRing(items);

        } catch (e) {
            clearTimeout(enterWatchdog);
            console.warn("enterAR error:", e);
            showFail("AR ochilmadi. In-app brauzer bo‘lishi mumkin. Chrome’da ochib ko‘ring yoki ARCore tekshiring.");
        } finally {
            btnStart.disabled = false;
            btnStart.textContent = "BOSHLASH";
        }
    };
})();
