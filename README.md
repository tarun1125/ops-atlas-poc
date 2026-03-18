# Ops Atlas POC

## Static documentation app layout

This repository hosts the Ops Atlas static proof of concept from the `doc/` directory, with case data stored under `doc/app/`. The implementation is fully static and uses only HTML, CSS, JavaScript, static JSON, and `localStorage`.

### Run locally

1. Start a simple static file server from the repository root, for example:
   - `python3 -m http.server 8000`
2. Open `http://localhost:8000/doc/` in a browser.
3. Sign in with one of the demo accounts below.

### Demo logins

- General user:
  - Username: `user1`
  - Password: `p@ssword`
- Admin:
  - Username: `admin`
  - Password: `admin`

### Folder structure

- UI entry pages and assets live in `doc/`.
- Application metadata and mock case libraries live in `doc/app/`.
- Approved or manually added cases are stored in browser `localStorage` under keys such as `cases_rag`, `cases_dem`, and `cases_tsno`.
- New-case requests are stored in `localStorage` under `request_queue`.

### Search flow

- Users sign in and land on `doc/search.html`.
- The search page loads applications dynamically from `doc/app/apps.json`.
- The incident description field stays disabled until an application is selected, and the search button remains disabled until both required fields are filled.
- Search combines static cases from `doc/app/<app>/cases/index.json` with approved or manually added local cases stored in `localStorage` as `cases_<app>`.
- The UI computes keyword-overlap similarity, classifies the best result as `CONFIRMED SOLUTION`, `POSSIBLE MATCH`, or `NO KNOWN SOLUTION`, and shows matched keywords plus confidence and derived accuracy scores.
- Users can submit a `Request for New Case`, which is stored in `localStorage` under `request_queue` for admin approval.

### Admin flow

- Admin users sign in and land on `doc/admin.html`.
- The admin portal includes a manual add-case form and an approval queue table for pending requests.
- Saving a case stores it in `localStorage` under `cases_<app>`.
- Approving a request converts it into a placeholder case and removes the request from `request_queue`.
- Rejecting a request removes it from the queue.

### Logout

- Both the search page and admin portal include a logout button.
- Logout removes `role` from `localStorage` and redirects back to `index.html`.
