# Valrano

## Stack
- React 19 + TypeScript + Vite 8, Tailwind 4 + shadcn/ui, TanStack Query v5
- Supabase backend (PostgreSQL + Edge Functions in Deno)

## Dev Server
- URL: http://localhost:5173
- Start: `npm run dev`

---

## Visual Development

### Design References
- Design brief: `docs/DESIGN_BRIEF.md`
- Design tokens: `docs/design-tokens.json`
- When making visual (front-end, UI/UX) changes, ALWAYS refer to these files for guidance

### Quick Visual Check
IMMEDIATELY after implementing any front-end change:
1. **Identify what changed** — Review the modified components/pages
2. **Navigate to affected pages** — Use Chrome DevTools MCP to visit each changed view
3. **Verify design compliance** — Compare against `docs/DESIGN_BRIEF.md` and `docs/design-tokens.json`
4. **Validate feature implementation** — Ensure the change fulfills the user's specific request
5. **Capture evidence** — Take full-page screenshot at desktop viewport (1440px) of each changed view
6. **Check for errors** — Check console messages and fix any errors before reporting completion

---

## Verification Loop (MANDATORY)

After ANY code change, verify before reporting completion:
1. **Build** — `npm run build` must pass with zero TypeScript errors
2. **Lint** — `npm run lint` must pass with zero errors
3. **Test** — `npm test -- --run` must pass (all green)
4. If any step fails, fix the issue before proceeding — do NOT move on with broken code
5. **Evidence rule**: Report actual command output (exit code, pass count, error text) — never use "should work" or "probably passes"
6. **New code rule**: Every new function, hook, or endpoint MUST have at least one test
7. **Stuck rule**: 3+ failed fix attempts on the same issue → STOP, reassess architecture, ask the user

---

## Code Quality

### Rules
- NO hardcoded hex colors or magic pixel values — use design tokens from `docs/design-tokens.json`
- NO new frameworks or libraries without discussion
- All components must support light and dark mode
- Comments explain 'why', not 'what'
- Dark mode is the default theme

---

## Branch Strategy

- **Direct to `main`**: One-commit fixes with clear, bounded scope (typo, config tweak, single-file bug fix)
- **Feature branch**: Anything requiring 2+ commits, new features, risky or experimental changes
- **Branch naming**: `feature/<name>`, `fix/<name>`, `refactor/<name>`

---

## Supabase Edge Functions

### Deno Import Patterns
```typescript
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
```

### Shared Helpers
- `supabase/functions/_shared/auth.ts` — `authenticateRequest()`, `errorResponse()`, `jsonResponse()`
- `supabase/functions/_shared/cors.ts` — `getCorsHeaders()`, `corsHeaders`

### Edge Function Pattern
Every edge function follows this structure:
```typescript
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  try {
    const { user, adminClient } = await authenticateRequest(req)
    // ... business logic ...
    return jsonResponse({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
})
```

### Deploy Edge Functions
```bash
supabase functions deploy <function-name> --no-verify-jwt
```

---

## Deployment (Metanet FTP)

- **Target:** `valrano.com`
- **CI/CD:** GitHub Actions → lint → typecheck → test → build → FTP deploy
- **Strategy:** Zero-downtime (assets first → index.html → cleanup stale)
- **FTP credentials:** Stored as GitHub Secrets (`FTP_HOST`, `FTP_USER`, `FTP_PASS`)
- **NEVER deploy to Vercel** — always use Metanet FTP

### GitHub Secrets Required
| Secret | Purpose |
|--------|---------|
| `FTP_HOST` | Metanet FTP host |
| `FTP_USER` | FTP username |
| `FTP_PASS` | FTP password |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_URL` | Used by keep-alive workflow |
| `SUPABASE_ANON_KEY` | Used by keep-alive workflow |

---

## Supabase Project

- **URL:** https://mkdeftmubrkseyrrbzvp.supabase.co
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZGVmdG11YnJrc2V5cnJienZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTIzODIsImV4cCI6MjA5Mzk4ODM4Mn0.lnNUslHt--2_GzOZFB_UH1mVd0bfGfWTnHIU3e7Umwc
- **CSP connect-src:** mkdeftmubrkseyrrbzvp.supabase.co

---

## Project-Specific Rules

- Use `globals: true` in Vitest — do NOT import from 'vitest'
- All edge functions must be deployed with `--no-verify-jwt`
- OTP config: 6 digits, 600 seconds expiry
- Password gate: predivo2026
- Dark mode is the default theme
- NO public pricing on landing page — use "Request a Demo" CTA
- Financial blue #3B82F6 is the primary accent color (dark mode) / #2563EB (light mode)
- All design decisions trace back to `docs/DESIGN_BRIEF.md` and `docs/design-tokens.json`
