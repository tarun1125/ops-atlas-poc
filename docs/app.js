// const APPS_PATH = "apps/apps.json";
const REQUEST_QUEUE_KEY = "request_queue";

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function similarity(a, b) {
  const sourceWords = tokenize(a);
  if (!sourceWords.length) {
    return 0;
  }

  const comparisonWords = new Set(tokenize(b));
  const overlappingWords = sourceWords.filter((word) => comparisonWords.has(word)).length;

  return overlappingWords / sourceWords.length;
}

function getMatchedKeywords(a, b) {
  const sourceWords = [...new Set(tokenize(a))];
  const comparisonWords = new Set(tokenize(b));
  return sourceWords.filter((word) => comparisonWords.has(word));
}

function getStatus(score) {
  if (score >= 0.75) {
    return { label: "CONFIRMED SOLUTION", className: "status-confirmed" };
  }

  if (score >= 0.4) {
    return { label: "POSSIBLE MATCH", className: "status-possible" };
  }

  return { label: "NO KNOWN SOLUTION", className: "status-none" };
}

function toPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function showMessage(container, text, statusClass = "status-possible") {
  if (!container) {
    return;
  }

  container.className = `card ${statusClass}`;
  container.textContent = text;
  container.classList.remove("hidden");
}

function hideMessage(container) {
  if (!container) {
    return;
  }

  container.classList.add("hidden");
  container.textContent = "";
}

function getStoredList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveStoredList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function loadApps(selectElement, preferredValue = "") {
  const response = await fetch(`./apps/apps.json`);
  const apps = await response.json();

  selectElement.innerHTML = '<option value="">Select an application</option>';

  apps.forEach((app) => {
    const option = document.createElement("option");
    option.value = app;
    option.textContent = app.toUpperCase();
    option.selected = preferredValue === app;
    selectElement.appendChild(option);
  });

  return apps;
}

async function loadCases(app) {
  const response = await fetch(`./apps/${app}/cases/index.json`);
  const staticCases = await response.json();
  const localCases = getStoredList(`cases_${app}`);
  return [...staticCases, ...localCases];
}

function buildRequest(selectedApp, issueDescription) {
  return {
    id: `REQ-${Date.now()}`,
    app: selectedApp,
    problem: issueDescription,
    status: "PENDING",
  };
}

function submitRequest(selectedApp, issueDescription) {
  if (!selectedApp || !issueDescription) {
    return false;
  }

  const confirmed = window.confirm(
    "Submit this incident as a request for admin approval to create a new case?"
  );

  if (!confirmed) {
    return false;
  }

  const queue = getStoredList(REQUEST_QUEUE_KEY);
  queue.push(buildRequest(selectedApp, issueDescription));
  saveStoredList(REQUEST_QUEUE_KEY, queue);
  return true;
}

function renderResult(container, bestCase, score, selectedApp, issueDescription, matchedKeywords) {
  const confidence = score;
  const accuracy = confidence * 0.9;
  const status = getStatus(score);
  const matchedLabel = matchedKeywords.length ? matchedKeywords.join(", ") : "None";
  const requestDisabled = status.label === "CONFIRMED SOLUTION";
  const tooltip = requestDisabled
    ? "High confidence solution exists"
    : "Submit this issue for admin review and case creation";

  container.className = `card result-card ${status.className}`;
  container.classList.remove("hidden");

  const detailMarkup =
    status.label === "NO KNOWN SOLUTION"
      ? `<p class="empty-state">No similar incident found.</p>`
      : `
        <div class="result-grid">
          <article>
            <h3>Problem</h3>
            <p>${bestCase.problem}</p>
          </article>
          <article>
            <h3>Resolution</h3>
            <pre>${bestCase.resolution}</pre>
          </article>
        </div>
        <div class="result-grid secondary-grid">
          <article>
            <h3>Symptoms</h3>
            <p>${bestCase.symptoms || "To be filled"}</p>
          </article>
          <article>
            <h3>Verification</h3>
            <p>${bestCase.verification || "To be filled"}</p>
          </article>
        </div>
      `;

  const warningMarkup =
    status.label === "POSSIBLE MATCH"
      ? '<p class="warning-text">Warning: review this partial match carefully before following the resolution.</p>'
      : "";

  container.innerHTML = `
    <div class="result-header">
      <h2>Status: ${status.label}</h2>
      ${bestCase?.case_id ? `<span class="badge">${bestCase.case_id}</span>` : ""}
    </div>
    <div class="metrics">
      <p><strong>Confidence Score:</strong> ${toPercent(confidence)}</p>
      <p><strong>Accuracy Score:</strong> ${toPercent(accuracy)}</p>
    </div>
    <p><strong>Matched Keywords:</strong> ${matchedLabel}</p>
    ${warningMarkup}
    ${detailMarkup}
    <div class="request-action">
      <button
        id="request-case-button"
        class="button ${status.label === "NO KNOWN SOLUTION" ? "button-emphasis" : "button-secondary"}"
        type="button"
        ${requestDisabled ? "disabled" : ""}
        title="${tooltip}"
      >
        Request for New Case
      </button>
      <span class="helper-text">${tooltip}</span>
    </div>
  `;

  const requestButton = document.getElementById("request-case-button");
  if (requestButton && !requestDisabled) {
    requestButton.addEventListener("click", () => {
      const submitted = submitRequest(selectedApp, issueDescription);
      if (submitted) {
        const helper = container.querySelector(".helper-text");
        if (helper) {
          helper.textContent = "Request submitted for admin approval";
        }
      }
    });
  }
}

function updateSearchControls(appSelect, issueInput, searchButton) {
  const hasApp = Boolean(appSelect.value);
  const hasIssue = Boolean(issueInput.value.trim());

  issueInput.disabled = !hasApp;
  searchButton.disabled = !(hasApp && hasIssue);
}

function attachLogout(buttonId = "logout-button") {
  const button = document.getElementById(buttonId);
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    localStorage.removeItem("role");
    window.location.href = "index.html";
  });
}

function initializeLoginPage() {
  const userForm = document.getElementById("user-login-form");
  const adminForm = document.getElementById("admin-login-form");
  const message = document.getElementById("login-message");

  if (!userForm || !adminForm || !message) {
    return;
  }

  const handleLogin = (username, password, expectedUsername, expectedPassword, role, target) => {
    hideMessage(message);

    if (username === expectedUsername && password === expectedPassword) {
      localStorage.setItem("role", role);
      window.location.href = target;
      return;
    }

    showMessage(message, "Invalid username or password.", "status-none");
  };

  userForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin(
      document.getElementById("user-username").value.trim(),
      document.getElementById("user-password").value,
      "user1",
      "p@ssword",
      "user",
      "search.html"
    );
  });

  adminForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin(
      document.getElementById("admin-username").value.trim(),
      document.getElementById("admin-password").value,
      "admin",
      "admin",
      "admin",
      "admin.html"
    );
  });
}

async function initializeSearchPage() {
  const form = document.getElementById("search-form");
  if (!form) {
    return;
  }

  if (!isUser() && !isAdmin()) {
    window.location.href = "index.html";
    return;
  }

  attachLogout();

  const appSelect = document.getElementById("app-select");
  const issueInput = document.getElementById("issue-input");
  const searchButton = document.getElementById("search-button");
  const resultCard = document.getElementById("result-card");

  try {
    await loadApps(appSelect);
    updateSearchControls(appSelect, issueInput, searchButton);
  } catch (error) {
    showMessage(resultCard, "Unable to load applications.", "status-none");
    return;
  }

  appSelect.addEventListener("change", () => updateSearchControls(appSelect, issueInput, searchButton));
  issueInput.addEventListener("input", () => updateSearchControls(appSelect, issueInput, searchButton));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedApp = appSelect.value;
    const issueDescription = issueInput.value.trim();

    if (!selectedApp || !issueDescription) {
      return;
    }

    const cases = await loadCases(app);

    let bestCase = null;
    let bestScore = 0;
    let bestKeywords = [];

    cases.forEach((item) => {
      const candidateText = [
        item.problem,
        item.symptoms,
        item.root_cause,
        item.resolution,
        item.verification,
      ].join(" ");
      const score = similarity(issueDescription, candidateText);

      if (score > bestScore) {
        bestScore = score;
        bestCase = item;
        bestKeywords = getMatchedKeywords(issueDescription, candidateText);
      }
    });

    renderResult(resultCard, bestCase, bestScore, selectedApp, issueDescription, bestKeywords);
  });
}

function validateCasePayload(payload) {
  return Boolean(
    payload.app &&
      payload.problem &&
      payload.symptoms &&
      payload.root_cause &&
      payload.resolution &&
      payload.verification
  );
}

function storeCaseForApp(app, payload) {
  const key = `cases_${app}`;
  const cases = getStoredList(key);
  cases.push(payload);
  saveStoredList(key, cases);
}

function renderQueue(messageContainer) {
  const queueBody = document.getElementById("queue-body");
  const emptyState = document.getElementById("queue-empty");
  if (!queueBody || !emptyState) {
    return;
  }

  const queue = getStoredList(REQUEST_QUEUE_KEY).filter(
    (item) => item && item.id && item.app && item.problem && item.status === "PENDING"
  );

  queueBody.innerHTML = "";
  emptyState.classList.toggle("hidden", queue.length > 0);

  queue.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.id}</td>
      <td>${item.app.toUpperCase()}</td>
      <td>${item.problem}</td>
      <td>
        <div class="table-actions">
          <button class="button" type="button" data-action="approve" data-id="${item.id}">Approve</button>
          <button class="button button-secondary" type="button" data-action="reject" data-id="${item.id}">Reject</button>
        </div>
      </td>
    `;
    queueBody.appendChild(row);
  });

  queueBody.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      const id = button.getAttribute("data-id");
      const currentQueue = getStoredList(REQUEST_QUEUE_KEY).filter(
        (item) => item && item.id && item.app && item.problem && item.status === "PENDING"
      );
      const target = currentQueue.find((item) => item.id === id);
      if (!target) {
        showMessage(messageContainer, "Invalid queue entry.", "status-none");
        return;
      }

      if (action === "approve") {
        storeCaseForApp(target.app, {
          case_id: `CASE-${Date.now()}`,
          app: target.app,
          problem: target.problem,
          symptoms: "To be filled",
          root_cause: "To be filled",
          resolution: "To be filled",
          verification: "To be filled",
        });
        saveStoredList(
          REQUEST_QUEUE_KEY,
          currentQueue.filter((item) => item.id !== id)
        );
        showMessage(messageContainer, "Case approved and added", "status-confirmed");
      }

      if (action === "reject") {
        saveStoredList(
          REQUEST_QUEUE_KEY,
          currentQueue.filter((item) => item.id !== id)
        );
        showMessage(messageContainer, "Request rejected", "status-possible");
      }

      renderQueue(messageContainer);
    });
  });
}

async function initializeAdminPage() {
  const form = document.getElementById("case-form");
  if (!form) {
    return;
  }

  if (typeof requireAdmin === "function" && !requireAdmin()) {
    return;
  }

  attachLogout();

  const messageContainer = document.getElementById("admin-message");
  const appSelect = document.getElementById("case-app");
  const problemInput = document.getElementById("case-problem");
  const symptomsInput = document.getElementById("case-symptoms");
  const rootCauseInput = document.getElementById("case-root-cause");
  const resolutionInput = document.getElementById("case-resolution");
  const verificationInput = document.getElementById("case-verification");

  try {
    await loadApps(appSelect);
  } catch (error) {
    showMessage(messageContainer, "Unable to load applications.", "status-none");
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const payload = {
      case_id: `CASE-${Date.now()}`,
      app: appSelect.value,
      problem: problemInput.value.trim(),
      symptoms: symptomsInput.value.trim(),
      root_cause: rootCauseInput.value.trim(),
      resolution: resolutionInput.value.trim(),
      verification: verificationInput.value.trim(),
    };

    if (!validateCasePayload(payload)) {
      showMessage(messageContainer, "Please complete all fields before saving.", "status-none");
      return;
    }

    storeCaseForApp(payload.app, payload);
    showMessage(messageContainer, "Case saved (POC)", "status-confirmed");
    form.reset();
    renderQueue(messageContainer);
  });

  renderQueue(messageContainer);
}

document.addEventListener("DOMContentLoaded", () => {
  initializeLoginPage();
  initializeSearchPage();
  initializeAdminPage();
});
