function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

function isUser() {
  return localStorage.getItem("role") === "user";
}

// FIX: Redirect immediately — before DOMContentLoaded — so the admin
// page never renders for unauthorised visitors.
function requireAdmin() {
  if (!isAdmin()) {
    window.location.replace("index.html");
    return false;
  }
  return true;
}

// Eagerly guard the admin page as soon as this script is parsed.
// auth.js is loaded before app.js on admin.html, so this runs first.
(function guardAdminPage() {
  if (document.currentScript) {
    const page = window.location.pathname.split("/").pop();
    if (page === "admin.html") {
      requireAdmin();
    }
  }
})();