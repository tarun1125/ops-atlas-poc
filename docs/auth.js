function isAdmin() {
  return localStorage.getItem("role") === "admin";
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = "index.html";
    return false;
  }

  return true;
}
