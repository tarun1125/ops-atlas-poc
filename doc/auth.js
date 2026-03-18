function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

function isUser() {
  return localStorage.getItem("role") === "user";
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = "index.html";
    return false;
  }

  return true;
}
