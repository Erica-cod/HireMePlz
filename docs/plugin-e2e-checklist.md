# HireMePlz Extension E2E Checklist

This checklist is for demo and validation of the core extension flow: scan fields -> fetch suggestions -> user confirms -> fill form -> save application record.

## 0. Prerequisites

1. Services are running:
   - `docker compose up -d --build`
2. Frontend is reachable: `http://localhost:3000`
3. Backend health check: `http://localhost:4000/api/health`
4. Dashboard data is prepared:
   - Profile info (name, email, phone, school, etc.)
   - At least 1 experience
   - At least 1 story (preferably `challenge`)

## 1. Build and Load Extension

1. Build extension:
   - `npm run build --workspace extension`
2. Open Chrome: `chrome://extensions/`
3. Enable Developer mode
4. Click "Load unpacked"
5. Select directory: `extension`

## 2. Open Local Mock Application Page

Use the built-in page for stable validation:

- Open file: `docs/mock-application-form.html`

This page contains structured fields (name, email, phone, school, degree, LinkedIn) and open-ended fields (why company, challenge).

## 3. Configure Connection in Extension Panel

Fill the panel at the top-right of the page:

1. API URL: `http://localhost:4000`
2. Token from browser localStorage after signing in on Dashboard:
   - Key: `hiremeplz-token`
3. Company: e.g. `ExampleAI`
4. Role: e.g. `Backend Developer`

## 4. Run Scan and Fetch Suggestions

1. Click "Scan and fetch suggestions"
2. Expected:
   - Panel shows suggestion count (typically >= 2)
   - Structured fields have suggested values
   - Open-ended fields have editable generated answers (from story library/templates)

## 5. Fill and Confirm

1. Click "Fill this field" for each suggestion
2. Form values should appear immediately
3. Verify:
   - `Full Name`, `Email`, `Mobile Number` are filled
   - Open-ended textarea contains readable answer text

## 6. Save Application Record

1. Click "Save this application record"
2. Expected:
   - Panel confirms record saved
   - New entry appears in Dashboard `Applications` page
   - Company and role values are correct

## 7. Quick Troubleshooting

- No suggestions:
  - Check whether token is expired
  - Check whether profile/stories are empty
- Cannot fill fields:
  - Target elements may be dynamically rendered; refresh and rescan
- Cannot save record:
  - Check backend logs: `docker compose logs backend --tail 100`

## 8. Suggested Demo Order

1. Show prepared profile and story library in Dashboard
2. Open mock application page and run one-click scan
3. Show editable open-ended answer before filling
4. Save record and switch back to Dashboard to verify history update
