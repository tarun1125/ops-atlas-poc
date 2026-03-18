# Ops Atlas POC

## Web POC

This repository includes a minimal static web proof of concept in `web/` for demonstrating an OpsGuide workflow on GitHub Pages.

### Run locally

1. Start a simple static file server from the repository root, for example:
   - `python3 -m http.server 8000`
2. Open `http://localhost:8000/web/` in a browser.
3. Use the home page to search known incidents or open the admin-only add case form.

### Enable admin access

Open the browser developer console and run:

```js
localStorage.setItem("role", "admin")
```

To remove admin access later:

```js
localStorage.removeItem("role")
```

### Search flow

- `search.html` loads applications dynamically from `apps/apps.json`.
- After selecting an app and entering an issue description, the page loads `apps/<app>/cases/index.json` and compares the query against case text using keyword overlap.
- The UI classifies the best result into `CONFIRMED SOLUTION`, `POSSIBLE MATCH`, or `NO KNOWN SOLUTION` and displays confidence plus derived accuracy scores.
- If no known solution is found, the page offers a `Create New Case` action that stores a draft app and problem in `localStorage` before redirecting to the admin flow.

### Add case flow

- `add-case.html` requires `localStorage.getItem("role") === "admin"`; non-admin users are redirected to `index.html`.
- The form dynamically loads the application list and pre-fills any draft app/problem from the search flow.
- Submitting the form logs the case payload in the browser console and shows `Case saved (POC)`.
- No backend persistence is implemented in this proof of concept.
