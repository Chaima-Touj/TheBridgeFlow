# Project Memory — TheBridgeFlow

> Edit the placeholders below to match your real folder/collection names.

## Stack
- Frontend: React (adjust: Vite / CRA / Next — specify which)
- Backend: Node.js + Express
- Database: MongoDB (managed/inspected via MongoDB Compass)
- ODM: Mongoose (remove this line if using the native MongoDB driver instead)

## Project Structure
- `/thebridgeflow-front` → React frontend (Vite)
- `/thebridgeflow-back` → Express backend: routes, controllers, models
- This is an EXISTING project. Never assume a folder layout or naming convention —
  always inspect the real files first (`ls`, `view`, grep for similar features) before
  creating anything new. Reuse existing patterns; don't invent a parallel structure.

## Core Workflow — Build One Page/Feature at a Time
We build this app page by page (e.g. Profile, Settings, Dashboard...). For EVERY page,
follow this exact sequence and don't skip steps:

1. **Inspect first** — read related existing files (components, routes, controllers,
   models, schemas) before writing anything. Never duplicate logic that already exists
   somewhere else in the codebase.
2. **Plan briefly** — before editing, list which files you'll create/touch and why.
3. **Build fully** — implement frontend component(s) + backend route(s)/controller(s) +
   Mongoose schema/model if the data doesn't already exist.
4. **Connect to MongoDB properly**:
   - Use proper Mongoose schemas: correct types, `required`, validation, sensible defaults.
   - Never hardcode mock data — always read/write through the real DB.
   - Check existing collections/field names in Compass before creating new ones — match
     existing naming conventions, don't introduce inconsistent field names.
5. **Clean up — mandatory, not optional**:
   - Remove unused imports, dead code, leftover `console.log`s.
   - Keep naming consistent with the rest of the codebase.
   - Split bloated components/functions into smaller, readable ones.
   - Add comments only where the logic genuinely isn't obvious.
6. **Verify before declaring done** — check for runtime/import errors, confirm the
   feature actually works end-to-end (frontend ↔ backend ↔ MongoDB). Don't say "done"
   without having actually checked this.
7. **Report back** — short summary of what changed, files touched, and anything that
   needs a decision from me (ambiguous requirement, missing field, naming conflict).

## Code Quality Rules (always enforced)
- Clean, production-style code — no leftover debug code or commented-out blocks.
- Consistent error handling: try/catch on all async DB/route logic, clear error messages,
  proper HTTP status codes.
- Consistent, RESTful API route naming across the project.
- Don't make breaking changes to other existing pages/features without flagging it first.
- Do a self-review pass before finishing — fix sloppy code proactively, don't wait to be
  asked twice.

## What NOT to Do
- Don't redesign the architecture or folder structure on your own initiative.
- Don't silently change the schema of an EXISTING collection if it could affect existing
  data — ask first.
- Don't mark something "done" without having verified it runs.
- Don't add new npm packages unless necessary — ask first if one seems needed.

## Useful Context (fill this in)
- [ ] Auth method used (JWT / sessions / etc.):
- [ ] MongoDB connection: local Compass instance or Atlas URI?
- [ ] Existing collections so far:
- [ ] Naming convention (camelCase / snake_case) for DB fields: