# Frontend Sync Guide: Story Library Refactor & Answer Memory Removal

This document describes backend/worker changes that require corresponding frontend updates.

---

## 1. Story Library: Data Model Changes

### What changed

The `StoryItem` model has been simplified:

**Removed fields:**
- `category` (was `StoryCategory` enum: challenge / leadership / teamwork / project / why_company / behavioral / general)
- `promptTags` (was `String[]`)
- `situation` (was `String`, required)
- `task` (was `String?`, optional)
- `action` (was `String`, required)
- `result` (was `String`, required)

**New/renamed fields:**
- `tags` (`String[]`) — replaces both `category` and `promptTags`. Users define their own free-form tags (e.g. "leadership", "react project", "team conflict").
- `content` (`String`, required) — replaces `situation` / `task` / `action` / `result`. A single free-text field. Users can write STAR format inside if they choose, but it's not enforced.

**Unchanged fields:**
- `id`, `title`, `createdAt`, `updatedAt` — no changes.

### New Story shape (API response)

```ts
type Story = {
  id: string;
  title: string;
  tags: string[];
  content: string;
  createdAt: string;
  updatedAt: string;
};
```

### API changes

**All endpoints remain the same** (`GET /api/stories`, `POST /api/stories`, `PUT /api/stories/:id`, `DELETE /api/stories/:id`). Only the request/response body shapes changed.

#### POST /api/stories & PUT /api/stories/:id

Old request body:
```json
{
  "title": "Led API migration",
  "category": "leadership",
  "promptTags": ["api", "migration"],
  "situation": "Our team needed to migrate...",
  "task": "I was responsible for...",
  "action": "I designed a plan...",
  "result": "We completed it 2 weeks early..."
}
```

New request body:
```json
{
  "title": "Led API migration",
  "tags": ["leadership", "api", "migration"],
  "content": "Our team needed to migrate from REST to GraphQL. I was responsible for leading the effort. I designed a phased migration plan and coordinated across 3 teams. We completed it 2 weeks ahead of schedule with zero downtime."
}
```

Validation rules:
- `title`: required, min 1 char
- `tags`: optional, defaults to `[]`
- `content`: required, min 1 char

### Frontend changes needed

#### `frontend/types/index.ts`

Update the `Story` type:

```ts
// Old
export type Story = {
  id: string;
  title: string;
  category: string;
  promptTags: string[];
  situation: string;
  task?: string | null;
  action: string;
  result: string;
};

// New
export type Story = {
  id: string;
  title: string;
  tags: string[];
  content: string;
};
```

#### `frontend/app/dashboard/stories/page.tsx`

Major changes required:

1. **Remove the `CATEGORIES` constant** — no more fixed category dropdown.

2. **Replace the form fields**:
   - Remove: `category` select dropdown, `situation` textarea, `task` textarea, `action` textarea, `result` textarea.
   - Add: `tags` input (reuse existing `TagInput` component), `content` textarea.

3. **Update `startNew()` initial state**:
   ```ts
   // Old
   setEditing({
     title: "",
     category: "project",
     promptTags: [],
     situation: "",
     task: "",
     action: "",
     result: "",
   });

   // New
   setEditing({
     title: "",
     tags: [],
     content: "",
   });
   ```

4. **Update `handleSave()` validation**:
   ```ts
   // Old
   if (!editing.title?.trim() || !editing.situation?.trim() ||
       !editing.action?.trim() || !editing.result?.trim()) { ... }

   // New
   if (!editing.title?.trim() || !editing.content?.trim()) { ... }
   ```

5. **Update the card display for each story**:
   - Remove: category badge, separate S/T/A/R sections.
   - Add: tags display (pills/badges), content display (single text block).

   ```tsx
   // Old display
   <span className="...">{CATEGORIES.find(c => c.value === story.category)?.label}</span>
   <p>Situation: {story.situation}</p>
   <p>Task: {story.task}</p>
   <p>Action: {story.action}</p>
   <p>Result: {story.result}</p>

   // New display
   <div className="flex flex-wrap gap-1">
     {story.tags.map(tag => (
       <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{tag}</span>
     ))}
   </div>
   <p className="whitespace-pre-wrap">{story.content}</p>
   ```

6. **Update the edit form**:
   - Replace the `category` dropdown with `TagInput` for `tags`:
     ```tsx
     <TagInput
       label="Tags"
       tags={editing.tags || []}
       onChange={(tags) => setEditing({ ...editing, tags })}
       placeholder="e.g. leadership, react, team conflict"
     />
     ```
   - Replace the 4 STAR textareas with a single `content` textarea:
     ```tsx
     <div>
       <label className="block text-sm font-medium mb-1">
         Content <span className="text-red-500">*</span>
       </label>
       <textarea
         value={editing.content || ""}
         onChange={(e) => setEditing({ ...editing, content: e.target.value })}
         rows={8}
         className="w-full rounded-lg border px-3 py-2 text-sm"
         placeholder="Write your story here. You can use any format (STAR, free-form, etc.)"
       />
     </div>
     ```
   - Remove the old `promptTags` TagInput (was labeled "Tags" — the new `tags` TagInput replaces it).

---

## 2. Answer Memory: Complete Removal

### What changed

The entire Answer Memory feature has been removed from the backend:

- `AnswerMemory` Prisma model dropped from the database.
- `DELETE /api/answer-memory`, `GET /api/answer-memory`, `PUT /api/answer-memory/:id`, `DELETE /api/answer-memory/:id` — all endpoints removed.
- The autofill flow no longer caches or reads from AnswerMemory. Each open-ended question is answered fresh by the LLM.

### Frontend changes needed

#### `frontend/types/index.ts`

Remove the `AnswerMemory` type entirely:

```ts
// Delete this entire type
export type AnswerMemory = {
  id: string;
  questionHash: string;
  companyKey: string;
  roleKey: string;
  question: string;
  answer: string;
  hitCount: number;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
};
```

#### `frontend/app/dashboard/answer-memory/page.tsx`

Delete this entire file. The page is no longer functional since all backend endpoints have been removed.

#### `frontend/components/dashboard-layout.tsx`

Remove the Answer Memory nav item:

```ts
// Remove this line from the navItems array:
{ href: "/dashboard/answer-memory", label: "Answer Memory" },
```

#### Extension / other consumers

If the browser extension or any other client imports or references `AnswerMemory`, those references should also be removed. The autofill endpoint (`POST /api/autofill/suggestions`) continues to work as before — it just no longer uses a cache internally.

---

## 3. Database Migration

After deploying the backend code changes, run:

```bash
cd backend && npx prisma migrate dev --name story-refactor-drop-answer-memory
```

This migration will:
1. Drop the `AnswerMemory` table.
2. Drop the `StoryCategory` enum.
3. Remove columns `category`, `promptTags`, `situation`, `task`, `action`, `result` from `StoryItem`.
4. Add columns `tags` (`text[]`) and `content` (`text`) to `StoryItem`.

**WARNING**: This is a destructive migration. Existing Story data in `situation`/`task`/`action`/`result` will be lost. If data preservation is needed, write a migration script to concatenate STAR fields into `content` before running the schema migration.

---

## 4. Summary of files to change (frontend)

| File | Action |
|---|---|
| `frontend/types/index.ts` | Update `Story` type, delete `AnswerMemory` type |
| `frontend/app/dashboard/stories/page.tsx` | Rewrite form & display for new Story shape |
| `frontend/app/dashboard/answer-memory/page.tsx` | Delete file |
| `frontend/components/dashboard-layout.tsx` | Remove Answer Memory nav link |
