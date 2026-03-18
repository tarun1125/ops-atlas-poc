const BASE_PATH = window.location.pathname.includes("github.io")
  ? "/ops-atlas-poc"   // ⚠️ replace with your repo name
  : "";
const APPS_PATH = "${BASE_PATH}/apps/apps.json";

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

async function loadApps(selectElement, preferredValue = "") {
  const response = await fetch(APPS_PATH);
  const apps = await response.json();

  selectElement.innerHTML = '<option value="">Select an application</option>';

  apps.forEach((app) => {
    const option = document.createElement("option");
    option.value = app;
    option.textContent = app.toUpperCase();
    if (preferredValue && preferredValue === app) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  return apps;
}

function renderResult(container, bestCase, score, selectedApp, issueDescription) {
  const confidence = score;
  const accuracy = confidence * 0.9;
  const status = getStatus(score);

  container.className = `card result-card ${status.className}`;
  container.classList.remove("hidden");

  if (status.label === "NO KNOWN SOLUTION") {
    container.innerHTML = `
      <div class="result-header">
        <h2>Status: ${status.label}</h2>
      </div>
      <p><strong>Confidence Score:</strong> ${toPercent(confidence)}</p>
      <p><strong>Accuracy Score:</strong> ${toPercent(accuracy)}</p>
      <p class="empty-state">No similar incident found.</p>
      <button id="create-case" class="button button-secondary">Create New Case</button>
    `;

    document.getElementById("create-case").addEventListener("click", () => {
      const confirmed = window.confirm(
        "No known solution was found. Do you want to create a new incident case draft?"
      );

      if (!confirmed) {
        return;
      }

      localStorage.setItem("draft_problem", issueDescription);
      localStorage.setItem("draft_app", selectedApp);
      window.location.href = "add-case.html";
    });

    return;
  }

  container.innerHTML = `
    <div class="result-header">
      <h2>Status: ${status.label}</h2>
      <span class="badge">${bestCase.case_id}</span>
    </div>
    <div class="metrics">
      <p><strong>Confidence Score:</strong> ${toPercent(confidence)}</p>
      <p><strong>Accuracy Score:</strong> ${toPercent(accuracy)}</p>
    </div>
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
        <p>${bestCase.symptoms}</p>
      </article>
      <article>
        <h3>Verification</h3>
        <p>${bestCase.verification}</p>
      </article>
    </div>
  `;
}

async function initializeSearchPage() {
  const form = document.getElementById("search-form");
  if (!form) {
    return;
  }

  const appSelect = document.getElementById("app-select");
  const issueInput = document.getElementById("issue-input");
  const resultCard = document.getElementById("result-card");

  try {
    await loadApps(appSelect);
  } catch (error) {
    resultCard.className = "card result-card status-none";
    resultCard.classList.remove("hidden");
    resultCard.textContent = "Unable to load applications.";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selectedApp = appSelect.value;
    const issueDescription = issueInput.value.trim();

    if (!selectedApp || !issueDescription) {
      return;
    }

    const response = await fetch(`${BASE_PATH}/apps/${app}/cases/index.json`);
    const cases = await response.json();

    let bestCase = null;
    let bestScore = 0;

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
      }
    });

    renderResult(resultCard, bestCase, bestScore, selectedApp, issueDescription);
  });
}

async function initializeAddCasePage() {
  const form = document.getElementById("case-form");
  if (!form) {
    return;
  }

  if (typeof requireAdmin === "function" && !requireAdmin()) {
    return;
  }

  const draftApp = localStorage.getItem("draft_app") || "";
  const draftProblem = localStorage.getItem("draft_problem") || "";

  const appSelect = document.getElementById("case-app");
  const problemInput = document.getElementById("case-problem");
  const symptomsInput = document.getElementById("case-symptoms");
  const rootCauseInput = document.getElementById("case-root-cause");
  const resolutionInput = document.getElementById("case-resolution");
  const verificationInput = document.getElementById("case-verification");

  await loadApps(appSelect, draftApp);
  problemInput.value = draftProblem;

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

    console.log("Case saved (POC):", payload);
    localStorage.removeItem("draft_app");
    localStorage.removeItem("draft_problem");
    window.alert("Case saved (POC)");
    form.reset();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initializeSearchPage();
  initializeAddCasePage();
});
