const REQUEST_QUEUE_KEY = "request_queue";

const STOP_WORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "need","on","in","at","to","for","of","and","or","not","no","by","with","from",
  "up","out","as","it","its","this","that","these","those","after","before",
  "between","into","through","during","above","below","then","once","here","there",
  "when","where","why","how","all","both","each","few","more","most","other",
  "some","such","than","too","very","just","but","also","so"
]);

const APP_DISPLAY_NAMES = {
  rag:  "Network Core Router (RAG)",
  dem:  "Digital Edge Mediation (DEM)",
  tsno: "Transport Stack NOC (TSNO)",
};
function appDisplayName(id) { return APP_DISPLAY_NAMES[id] || id.toUpperCase(); }

/* ─── HELPERS ─── */
function tokenize(text) {
  return String(text || "").toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}
function similarity(a, b) {
  const src = tokenize(a);
  if (!src.length) return 0;
  const cmp = new Set(tokenize(b));
  return src.filter(w => cmp.has(w)).length / src.length;
}
function getMatchedKeywords(a, b) {
  const src = [...new Set(tokenize(a))];
  const cmp = new Set(tokenize(b));
  return src.filter(w => cmp.has(w));
}
function getStatus(score) {
  if (score >= 0.55) return { label: "CONFIRMED SOLUTION", cls: "status-confirmed", badgeCls: "badge-confirmed" };
  if (score >= 0.25) return { label: "POSSIBLE MATCH",    cls: "status-possible",  badgeCls: "badge-possible"  };
  return                     { label: "NO KNOWN SOLUTION", cls: "status-none",      badgeCls: "badge-none"      };
}
function toPercent(v) { return `${Math.round(v * 100)}%`; }

function getStoredList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
function saveStoredList(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

/* ─── MESSAGE FLASH ─── */
function showMessage(el, text, cls = "status-possible") {
  if (!el) return;
  el.className = cls;
  el.textContent = text;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t = setTimeout(() => hideMessage(el), 5000);
}
function hideMessage(el) {
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
}

/* ─── APPS LOADER ─── */
async function loadApps(select, preferred = "") {
  const res = await fetch("./apps/apps.json");
  const apps = await res.json();
  select.innerHTML = '<option value="">Select an application</option>';
  apps.forEach(id => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = appDisplayName(id);
    o.selected = id === preferred;
    select.appendChild(o);
  });
  return apps;
}
async function loadCases(app) {
  const res = await fetch(`./apps/${app}/cases/index.json`);
  const stat = await res.json();
  return [...stat, ...getStoredList(`cases_${app}`)];
}

/* ─── SEARCH CONTROLS ─── */
function updateSearchControls(appSel, issueIn, btn) {
  const hasApp   = Boolean(appSel.value);
  const hasIssue = Boolean(issueIn.value.trim());
  issueIn.disabled = !hasApp;
  btn.disabled = !(hasApp && hasIssue);
}

/* ─── LOGOUT ─── */
function attachLogout(id = "logout-button") {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => {
    localStorage.removeItem("role");
    window.location.href = "index.html";
  });
}

/* ─── FIELD COMPLETENESS ─── */
function countFilledFields(item) {
  const fields = ["problem","symptoms","root_cause","resolution","verification"];
  const filled = fields.filter(f => item[f] && String(item[f]).trim() && item[f] !== "To be filled");
  return { filled: filled.length, total: fields.length };
}
function completenessBar(item) {
  const { filled, total } = countFilledFields(item);
  const pct = Math.round((filled / total) * 100);
  const color = filled === total ? "var(--green)" : filled >= 3 ? "var(--amber)" : "var(--coral)";
  return `<div style="display:flex;align-items:center;gap:.5rem;font-size:.75rem;color:var(--text-muted);">
    <div style="flex:1;height:4px;background:var(--border);border-radius:2px;">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div>
    </div>
    <span style="color:${color};font-family:'Space Mono',monospace;">${filled}/${total}</span>
  </div>`;
}

/* ════════════════════════════════════════════════
   SEARCH PAGE
════════════════════════════════════════════════ */
async function initializeSearchPage() {
  const form = document.getElementById("search-form");
  if (!form) return;
  if (!isUser() && !isAdmin()) { window.location.href = "index.html"; return; }
  attachLogout();

  const appSel    = document.getElementById("app-select");
  const issueIn   = document.getElementById("issue-input");
  const searchBtn = document.getElementById("search-button");
  const resultCard = document.getElementById("result-card");

  try {
    await loadApps(appSel);
    updateSearchControls(appSel, issueIn, searchBtn);
  } catch {
    showMessage(resultCard, "Unable to load applications. Please refresh.", "status-none");
    return;
  }

  appSel.addEventListener("change",  () => updateSearchControls(appSel, issueIn, searchBtn));
  issueIn.addEventListener("input",  () => updateSearchControls(appSel, issueIn, searchBtn));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const app   = appSel.value;
    const query = issueIn.value.trim();
    if (!app || !query) return;

    searchBtn.disabled    = true;
    searchBtn.textContent = "Searching…";

    try {
      const cases = await loadCases(app);
      let best = null, bestScore = 0, bestKw = [];
      cases.forEach(item => {
        const txt = [item.problem, item.symptoms, item.root_cause, item.resolution, item.verification].join(" ");
        const sc  = similarity(query, txt);
        if (sc > bestScore) { bestScore = sc; best = item; bestKw = getMatchedKeywords(query, txt); }
      });
      renderResult(resultCard, best, bestScore, app, query, bestKw);
    } catch {
      showMessage(resultCard, "Search failed. Please try again.", "status-none");
    } finally {
      searchBtn.disabled    = false;
      searchBtn.textContent = "Search knowledge base";
      updateSearchControls(appSel, issueIn, searchBtn);
    }
  });

  /* ── Request modal wiring ── */
  const modal      = document.getElementById("request-modal");
  const closeBtn   = document.getElementById("modal-close-btn");
  const cancelBtn  = document.getElementById("modal-cancel-btn");
  const reqForm    = document.getElementById("request-form");

  function openModal(app, query) {
    document.getElementById("req-app").value           = app;
    document.getElementById("req-original-query").value = query;
    document.getElementById("req-app-display").value   = appDisplayName(app);
    document.getElementById("req-problem").value       = query;
    modal.classList.add("open");
  }
  function closeModal() { modal.classList.remove("open"); reqForm.reset(); }

  closeBtn.addEventListener("click",  closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

  reqForm.addEventListener("submit", e => {
    e.preventDefault();
    const app = document.getElementById("req-app").value;
    const item = {
      id:           `REQ-${Date.now()}`,
      app,
      status:       "PENDING",
      problem:      document.getElementById("req-problem").value.trim(),
      symptoms:     document.getElementById("req-symptoms").value.trim(),
      root_cause:   document.getElementById("req-root-cause").value.trim(),
      resolution:   document.getElementById("req-resolution").value.trim(),
      verification: document.getElementById("req-verification").value.trim(),
      submitted_at: new Date().toISOString(),
    };
    const queue = getStoredList(REQUEST_QUEUE_KEY);
    queue.push(item);
    saveStoredList(REQUEST_QUEUE_KEY, queue);
    closeModal();

    /* update helper text on result card */
    const helper = resultCard.querySelector(".helper-text");
    const reqBtn = resultCard.querySelector("#request-case-button");
    if (helper) helper.textContent = "Request submitted — an admin will review it shortly.";
    if (reqBtn) reqBtn.disabled = true;
  });

  /* expose openModal so renderResult can call it */
  window._openRequestModal = openModal;
}

/* ─── RENDER RESULT ─── */
function renderResult(container, best, score, app, query, kw) {
  const status = getStatus(score);
  const kwHtml = kw.length
    ? `<div class="matched-keywords">${kw.map(w => `<span class="keyword-chip">${w}</span>`).join("")}</div>`
    : `<div class="matched-keywords"><span class="keyword-chip" style="color:var(--text-muted);">no keywords matched</span></div>`;

  const noResult    = status.label === "NO KNOWN SOLUTION";
  const requestDisabled = status.label === "CONFIRMED SOLUTION";
  const tooltip     = requestDisabled ? "High-confidence solution exists" : "Submit for admin review";

  const detailHtml = noResult
    ? `<div class="empty-state"><div class="empty-state-icon">?</div>No matching incident found in the knowledge base.</div>`
    : `<div class="result-grid">
        <article><h3>Problem</h3><p>${best.problem}</p></article>
        <article><h3>Symptoms</h3><p>${best.symptoms || "Not documented"}</p></article>
        <article><h3>Root cause</h3><p>${best.root_cause || "Not documented"}</p></article>
        <article><h3>Resolution</h3><pre>${best.resolution}</pre></article>
        <article style="grid-column:1/-1"><h3>Verification</h3><p>${best.verification || "Not documented"}</p></article>
      </div>`;

  const warningHtml = status.label === "POSSIBLE MATCH"
    ? `<p class="warning-text">Partial match — review carefully before following this resolution.</p>` : "";

  container.className = `card result-card ${status.cls}`;
  container.classList.remove("hidden");
  container.innerHTML = `
    <div class="result-header">
      <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;">
        <h2>${status.label}</h2>
        ${best?.case_id ? `<span class="badge badge-id">${best.case_id}</span>` : ""}
      </div>
      <span class="badge ${status.badgeCls}">${status.label}</span>
    </div>
    <div class="metrics-row">
      <div class="metric">
        <span class="metric-label">Confidence</span>
        <span class="metric-value">${toPercent(score)}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Matched keywords</span>
        <span class="metric-value" style="font-size:1.1rem;">${kw.length}</span>
      </div>
    </div>
    ${kwHtml}
    ${warningHtml}
    ${detailHtml}
    <div class="request-action">
      <button
        id="request-case-button"
        class="button ${noResult ? "button-amber" : "button-secondary"}"
        type="button"
        ${requestDisabled ? "disabled" : ""}
        title="${tooltip}"
      >
        ${noResult ? "Document this incident" : "Request new case"}
      </button>
      <span class="helper-text">${tooltip}</span>
    </div>`;

  const reqBtn = container.querySelector("#request-case-button");
  if (reqBtn && !requestDisabled && window._openRequestModal) {
    reqBtn.addEventListener("click", () => window._openRequestModal(app, query));
  }
}

/* ════════════════════════════════════════════════
   LOGIN PAGE
════════════════════════════════════════════════ */
function initializeLoginPage() {
  const uForm  = document.getElementById("user-login-form");
  const aForm  = document.getElementById("admin-login-form");
  const msg    = document.getElementById("login-message");
  if (!uForm || !aForm) return;

  const handle = (un, pw, expUn, expPw, role, dest) => {
    hideMessage(msg);
    if (un === expUn && pw === expPw) { localStorage.setItem("role", role); window.location.href = dest; return; }
    showMessage(msg, "Invalid username or password.", "status-none");
  };

  uForm.addEventListener("submit", e => { e.preventDefault();
    handle(document.getElementById("user-username").value.trim(),
           document.getElementById("user-password").value,
           "user1","p@ssword","user","search.html"); });

  aForm.addEventListener("submit", e => { e.preventDefault();
    handle(document.getElementById("admin-username").value.trim(),
           document.getElementById("admin-password").value,
           "admin","admin","admin","admin.html"); });
}

/* ════════════════════════════════════════════════
   ADMIN PAGE
════════════════════════════════════════════════ */
function storeCaseForApp(app, payload) {
  const key   = `cases_${app}`;
  const cases = getStoredList(key);
  cases.push(payload);
  saveStoredList(key, cases);
}

function validateCasePayload(p) {
  return Boolean(p.app && p.problem && p.symptoms && p.root_cause && p.resolution && p.verification);
}

/* ── VIEW MODAL ── */
let _viewModalCurrentItem = null;
let _viewModalMessageEl   = null;

function openViewModal(item, messageEl) {
  _viewModalCurrentItem = item;
  _viewModalMessageEl   = messageEl;

  const { filled, total } = countFilledFields(item);
  const eyebrow = document.getElementById("view-modal-eyebrow");
  const title   = document.getElementById("view-modal-title");
  const body    = document.getElementById("view-modal-body");
  const modal   = document.getElementById("view-modal");

  eyebrow.textContent = `${item.id} · ${appDisplayName(item.app)}`;
  title.textContent   = item.problem || "Untitled request";

  const field = (label, value, color = "var(--text-primary)") => `
    <div>
      <p style="font-family:'Space Mono',monospace;font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin-bottom:.35rem;">${label}</p>
      <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:.75rem 1rem;font-size:.875rem;color:${color};white-space:pre-wrap;line-height:1.6;">${value || '<span style="color:var(--text-muted);font-style:italic;">Not provided</span>'}</div>
    </div>`;

  body.innerHTML = `
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-bottom:.25rem;">
      <span class="badge badge-pending">PENDING REVIEW</span>
      <span class="badge badge-id">${appDisplayName(item.app)}</span>
      <span style="font-size:.75rem;color:var(--text-muted);">${item.submitted_at ? "Submitted " + new Date(item.submitted_at).toLocaleString() : ""}</span>
    </div>
    ${completenessBar(item)}
    <div style="height:.5rem;"></div>
    ${field("Problem", item.problem)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      ${field("Symptoms", item.symptoms)}
      ${field("Root cause", item.root_cause)}
    </div>
    ${field("Resolution", item.resolution, "var(--teal)")}
    ${field("Verification", item.verification)}`;

  modal.classList.add("open");
}

function closeViewModal() {
  document.getElementById("view-modal").classList.remove("open");
  _viewModalCurrentItem = null;
}

function renderQueue(msgEl) {
  const body  = document.getElementById("queue-body");
  const empty = document.getElementById("queue-empty");
  if (!body || !empty) return;

  const queue = getStoredList(REQUEST_QUEUE_KEY).filter(
    i => i && i.id && i.app && i.problem && i.status === "PENDING"
  );

  body.innerHTML = "";
  empty.classList.toggle("hidden", queue.length > 0);

  queue.forEach(item => {
    const { filled, total } = countFilledFields(item);
    const pct = Math.round((filled / total) * 100);
    const color = filled === total ? "var(--green)" : filled >= 3 ? "var(--amber)" : "var(--coral)";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="badge badge-id" style="font-size:.65rem;">${item.id.slice(0,12)}</span></td>
      <td style="font-size:.8rem;">${appDisplayName(item.app)}</td>
      <td style="max-width:220px;">
        <div style="font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.problem}</div>
        <div style="margin-top:.3rem;display:flex;align-items:center;gap:.4rem;">
          <div style="width:60px;height:3px;background:var(--border);border-radius:2px;"><div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div></div>
          <span style="font-size:.68rem;color:${color};font-family:'Space Mono',monospace;">${filled}/${total} fields</span>
        </div>
      </td>
      <td>
        <span style="font-size:.75rem;color:${color};font-family:'Space Mono',monospace;">${pct}%</span>
      </td>
      <td>
        <div class="table-actions">
          <button class="button button-ghost" style="padding:.35rem .7rem;font-size:.78rem;" data-action="view"    data-id="${item.id}">View</button>
          <button class="button button-primary" style="padding:.35rem .7rem;font-size:.78rem;" data-action="approve" data-id="${item.id}">Approve</button>
          <button class="button button-danger"  style="padding:.35rem .7rem;font-size:.78rem;" data-action="reject"  data-id="${item.id}">Reject</button>
        </div>
      </td>`;
    body.appendChild(row);
  });

  /* Event delegation for queue actions */
  body.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      const q      = getStoredList(REQUEST_QUEUE_KEY).filter(
        i => i && i.id && i.app && i.problem && i.status === "PENDING"
      );
      const target = q.find(i => i.id === id);
      if (!target) { showMessage(msgEl, "Entry not found.", "status-none"); return; }

      if (action === "view") {
        openViewModal(target, msgEl);
        return;
      }
      if (action === "approve") {
        approveItem(target, q, msgEl);
        return;
      }
      if (action === "reject") {
        saveStoredList(REQUEST_QUEUE_KEY, q.filter(i => i.id !== id));
        showMessage(msgEl, `Request ${id} rejected.`, "status-possible");
        renderQueue(msgEl);
      }
    });
  });
}

function approveItem(target, currentQueue, msgEl) {
  storeCaseForApp(target.app, {
    case_id:      `CASE-${Date.now()}`,
    app:          target.app,
    problem:      target.problem,
    symptoms:     target.symptoms     || "To be documented",
    root_cause:   target.root_cause   || "To be documented",
    resolution:   target.resolution   || "To be documented",
    verification: target.verification || "To be documented",
  });
  saveStoredList(REQUEST_QUEUE_KEY, currentQueue.filter(i => i.id !== target.id));
  showMessage(msgEl, `Case approved and published to the knowledge base.`, "status-confirmed");
  renderQueue(msgEl);
  closeViewModal();
}

async function initializeAdminPage() {
  const form = document.getElementById("case-form");
  if (!form) return;
  if (typeof requireAdmin === "function" && !requireAdmin()) return;
  attachLogout();

  const msgEl   = document.getElementById("admin-message");
  const appSel  = document.getElementById("case-app");

  try { await loadApps(appSel); }
  catch { showMessage(msgEl, "Unable to load applications.", "status-none"); return; }

  form.addEventListener("submit", e => {
    e.preventDefault();
    const payload = {
      case_id:      `CASE-${Date.now()}`,
      app:          appSel.value,
      problem:      document.getElementById("case-problem").value.trim(),
      symptoms:     document.getElementById("case-symptoms").value.trim(),
      root_cause:   document.getElementById("case-root-cause").value.trim(),
      resolution:   document.getElementById("case-resolution").value.trim(),
      verification: document.getElementById("case-verification").value.trim(),
    };
    if (!validateCasePayload(payload)) {
      showMessage(msgEl, "Please complete all required fields.", "status-none"); return;
    }
    storeCaseForApp(payload.app, payload);
    showMessage(msgEl, "Case saved and published to the knowledge base.", "status-confirmed");
    form.reset();
    renderQueue(msgEl);
  });

  /* ── View modal events ── */
  const viewModal = document.getElementById("view-modal");
  document.getElementById("view-modal-close").addEventListener("click",        closeViewModal);
  document.getElementById("view-modal-close-footer").addEventListener("click", closeViewModal);
  viewModal.addEventListener("click", e => { if (e.target === viewModal) closeViewModal(); });

  document.getElementById("view-approve-btn").addEventListener("click", () => {
    if (!_viewModalCurrentItem) return;
    const q = getStoredList(REQUEST_QUEUE_KEY).filter(
      i => i && i.id && i.app && i.problem && i.status === "PENDING"
    );
    approveItem(_viewModalCurrentItem, q, _viewModalMessageEl);
  });

  document.getElementById("view-reject-btn").addEventListener("click", () => {
    if (!_viewModalCurrentItem) return;
    const q = getStoredList(REQUEST_QUEUE_KEY).filter(
      i => i && i.id && i.app && i.problem && i.status === "PENDING"
    );
    saveStoredList(REQUEST_QUEUE_KEY, q.filter(i => i.id !== _viewModalCurrentItem.id));
    showMessage(_viewModalMessageEl, `Request rejected.`, "status-possible");
    renderQueue(_viewModalMessageEl);
    closeViewModal();
  });

  renderQueue(msgEl);
}

/* ─── BOOT ─── */
document.addEventListener("DOMContentLoaded", () => {
  initializeLoginPage();
  initializeSearchPage();
  initializeAdminPage();
});