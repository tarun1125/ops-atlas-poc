# Ops Atlas POC

## Web POC

This repository includes a minimal static web proof of concept in `web/` for demonstrating an Ops Atlas workflow on GitHub Pages using only HTML, CSS, JavaScript, static JSON, and `localStorage`.

### Run locally

1. Start a simple static file server from the repository root, for example:
   - `python3 -m http.server 8000`
2. Open `http://localhost:8000/web/` in a browser.
3. Sign in with one of the demo accounts below.

### Demo logins

- General user:
  - Username: `user1`
  - Password: `p@ssword`
- Admin:
  - Username: `admin`
  - Password: `admin`

### Search flow

- Users sign in and land on `search.html`.
- The search page loads applications dynamically from `apps/apps.json`.
- The incident description field stays disabled until an application is selected, and the search button remains disabled until both required fields are filled.
- Search combines static cases from `apps/<app>/cases/index.json` with approved or manually added local cases stored in `localStorage` as `cases_<app>`.
- The UI computes keyword-overlap similarity, classifies the best result as `CONFIRMED SOLUTION`, `POSSIBLE MATCH`, or `NO KNOWN SOLUTION`, and shows matched keywords plus confidence and derived accuracy scores.
- Users can submit a `Request for New Case`, which is stored in `localStorage` under `request_queue` for admin approval.

### Admin flow

- Admin users sign in and land on `admin.html`.
- The admin portal includes a manual add-case form and an approval queue table for pending requests.
- Saving a case stores it in `localStorage` under `cases_<app>`.
- Approving a request converts it into a placeholder case and removes the request from `request_queue`.
- Rejecting a request removes it from the queue.

### Logout

- Both the search page and admin portal include a logout button.
- Logout removes `role` from `localStorage` and redirects back to `index.html`.
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
