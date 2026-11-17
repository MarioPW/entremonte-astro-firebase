# AGENTS.md — Architecture and Token Efficiency Guidelines

## Stack & Architecture
- **Framework:** Astro (static output) + Preact (`client:only="preact"` on interactive islands) + Tailwind CSS.
- **Backend / Data:** Firebase (Auth + Firestore) with lazy imports on the client; Cloudinary (unsigned upload) for media.
- **Language:** All user interface (UI) text, error messages, and validations must be in **Spanish**.

## Token Efficiency Rules (Strict)
1. **Selective Reading:** Do not read entire files or execute unnecessary global searches. Read only the files directly involved in the current task.
2. **Surgical Edits:** Apply scoped changes (minimal diffs). Do not rewrite entire modules or reformat unrelated code.
3. **Zero Padding:** In your final responses, provide only a concise technical summary with bullet points (files touched and verification results). Avoid lengthy explanations or repeating code already written.
4. **Reusability:** Leverage existing base components in `src/components/islands/admin/ui.tsx` and CRUD functions in `src/lib/admin/`.

## Mandatory Verification
- Before finishing any task, run `npm run check` and `npm run build` ensuring **0 errors and 0 warnings**.