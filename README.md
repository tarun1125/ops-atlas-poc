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
