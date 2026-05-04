# 🚀 One-Person AI Business — Claude Code Agent Teams Workflow
> Reusable playbook using Claude Code's native **Agent Teams** feature (not subagents).
> Each phase uses a Team Lead + Teammates who communicate directly with each other.

---

## ⚙️ ONE-TIME SETUP (do this before first use)

### 1. Enable Agent Teams
Add to your project's `.claude/settings.json`:
```json
{
  "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
}
```
Or set as an environment variable:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### 2. Requirements
- Claude Code v2.1.32 or later
- **Opus 4.6 model** (required — Agent Teams won't run on Sonnet/Haiku)
- Pro plan ($20/mo) covers 2–3 Agent Teams sessions/day
- Max plan ($100–200/mo) for heavy daily use
- Optional but recommended: `tmux` installed — gives you a separate terminal pane per teammate so you can watch and redirect each agent independently

### 3. Why Agent Teams instead of subagents?
| Subagents | Agent Teams |
|---|---|
| Report results back to main only | Teammates message **each other directly** |
| Single context window | Each teammate has **its own context window** |
| Fire-and-forget | You can **interrupt/redirect** mid-task via tmux |
| Good for isolated tasks | Built for **cross-cutting work** (frontend ↔ backend ↔ tests) |

**Key benefit for this workflow:** when your backend teammate changes an API interface, it can message your frontend teammate immediately — no conflicts discovered after the fact.

---

## HOW TO READ THIS WORKFLOW
1. Pick the phase you need
2. Paste the prompt block into Claude Code
3. The Team Lead will ask you questions, then spawn teammates automatically
4. Watch progress with `Ctrl+T` (shared task list) or per-pane via tmux
5. Review outputs → approve → move to next phase

### Interaction Rules
- **Always use the `AskUserQuestion` tool** when asking the user to make a decision or answer a question. Never present choices as plain text — always use the interactive clickable UI.
- Ask **one question at a time** — wait for the answer before asking the next.
- When there is a clear recommended option based on the product brief or best practices, mark it with `(Recommended)` and list it first.
- The user can always select "Other" to provide custom input.

---

## PHASE 1 — IDEA VALIDATION
**Goal:** Validated idea + competitive analysis + exact customer language.
**Team setup:** Lead + 3 teammates (research in parallel, then synthesize)

### 📋 Paste into Claude Code:
```
You are my AI business strategist acting as Team Lead.

First, ask me:
1. Do you have a rough idea already, or research from scratch?
   (A) I have an idea  (B) Research from scratch
2. What niche or industry? (e.g. B2B SaaS, creator tools, Swiss SMEs)
3. B2B or B2C?
4. Available build time per week?

Then create an Agent Team with 3 teammates working in parallel:

TeamCreate: "idea-validation"

Teammate 1 — "market-researcher"
Task: Browse Product Hunt for top 20 recent launches in our niche.
Find 3–5 Reddit communities. Pull top upvoted posts describing user frustrations.
Extract the EXACT language customers use to describe their pain (word-for-word).
Output: ranked list of 5 underserved opportunities with market size estimate + buildability score 1–10.
Message team-lead when done.

Teammate 2 — "competitor-analyst"
Task: Search for existing competitors in the niche.
For each competitor: find pricing page, G2/Capterra reviews, top user complaints.
Output: competitor gap matrix showing what's missing in the market.
Message team-lead when done.

Teammate 3 — "idea-validator"
Wait for messages from market-researcher and competitor-analyst.
Synthesize both findings.
Recommend ONE winning idea with: pain point evidence, gap evidence, MRR potential estimate, buildability score for solo dev.
Output: "Winning Idea Brief" (one paragraph) + backup idea.
Message team-lead when done.

Team Lead: After all teammates complete, compile full output to /outputs/phase1_idea_validation.md and ask me: "Phase 1 complete. Ready to proceed to offer design?"

Then ask: "Should I create a new project folder for [winning idea name]?"
If yes:
1. Ask for the project folder path (suggest: /c/Business/[Product Name]/)
2. Create the new folder with this structure:
   /docs/
   /docs/Credentials.txt (empty template — populated in Phase 2.5 Bootstrap)
   /outputs/
   /.claude/settings.json (copy from playbook)
   /.claude/skills/brand-guidelines/ (empty, populated in Phase 3)
3. Copy /outputs/phase1_idea_validation.md to the new project's /outputs/
4. Copy this workflow file to the new project's /docs/ for reference
5. Switch working directory to the new project folder
6. Confirm: "Project folder created at [path]. All future phases will run here. Proceed to Phase 2?"

If no: Continue working in the current playbook folder.
```

> **Important:** Phase 1 (Idea Validation) always runs inside the playbook folder. Once a project is greenlit, a dedicated project folder is created and all subsequent phases (2–6) run there. This keeps the playbook clean as a reusable template and gives each product its own workspace.

### ✅ Output: `phase1_idea_validation.md`

---

## PHASE 2 — PRODUCT BRIEF & OFFER DESIGN
**Goal:** Concrete product brief + irresistible offer with pricing tiers.
**Team setup:** Lead + 2 teammates (product + offer in parallel)

### 📋 Paste into Claude Code:
```
You are my product strategist acting as Team Lead. Read /outputs/phase1_idea_validation.md.

First, ask me:
1. Happy with the winning idea? (Yes / No — if No, which alternative?)
2. Preferred tech stack? (default: React 19 + Vite 8 + TypeScript + Tailwind 4 + Supabase + Metanet FTP)
3. Target price point? (e.g. $29/mo, $99/mo, one-time, usage-based)
4. Exact target customer? (e.g. "Swiss SME owner, 5–50 employees")

Then create an Agent Team with 2 teammates working in parallel:

TeamCreate: "offer-design"

Teammate 1 — "product-definer"
Task: Using the winning idea and my answers above, write a Product Brief including:
- App name (suggest 3 options)
- One-line description
- Specific target persona
- Core problem solved
- Exactly 3 MVP features (no more)
- Chosen tech stack with rationale
- Explicit scope guard: what this is NOT
Save to /outputs/product_brief.md. Message team-lead when done.

Teammate 2 — "offer-designer"
Task: Using the customer pain language from phase1_idea_validation.md and my pricing input, design:
- 3 pricing tiers (Free/Starter/Pro or equivalent) with exact feature lists
- The "Irresistible Offer" hook sentence (e.g. "Replace your entire research team for $49/mo")
- 3 objection busters (top 3 reasons someone would say no + response to each)
- Launch pricing strategy (e.g. lifetime deal, beta discount, founding member rate)
Save to /outputs/offer_design.md. Message team-lead when done.

Team Lead: After both teammates complete, ask me: "Phase 2 complete — review the brief and offer. Approve to proceed to Phase 2.5 (Project Bootstrap — credentials & infrastructure)?"
```

### ✅ Outputs: `product_brief.md`, `offer_design.md`

---

## PHASE 2.5 — PROJECT BOOTSTRAP (Credentials, Infrastructure & Services)
**Goal:** All credentials collected, infrastructure provisioned, `docs/Credentials.txt` fully populated, `.env.local` ready, CI/CD configured — so that Phases 3–6 can run without ever stopping to ask for a password or URL.
**Team setup:** Lead only (interactive, one step at a time with user)

> **Why a separate phase?** Credentials and infrastructure setup was previously scattered across Sprint 1 (scaffold), Sprint 3 (auth+payments), and ad-hoc moments. This caused repeated interruptions ("what's the FTP password?", "which Supabase account?") and lost credentials. Consolidating it into one focused phase means every subsequent phase has everything it needs from the start.

### 📋 Paste into Claude Code:
```
You are my infrastructure engineer acting as Team Lead. Read /outputs/product_brief.md to understand the tech stack and product requirements.

IMPORTANT: Follow Rule 16 — present ONE step at a time and wait for confirmation before the next. Do NOT dump all steps at once.

Your job is to create and populate docs/Credentials.txt with every credential, URL, and account detail this project will need — so that no future phase ever has to stop and ask for a missing key.

---

STEP 1: CREATE docs/Credentials.txt WITH TEMPLATE

Create docs/Credentials.txt with the following standardized template. Mark all values as [TODO] initially. As each step below is completed, update the file with real values immediately.

```
# [PRODUCT NAME] — Credentials
# Last updated: [DATE]
# ⚠️ This file contains secrets. Never commit to git. Always listed in .gitignore.

## Metanet FTP
Host: [TODO]
Username: [TODO]
Password: [TODO]
Deploy path: [TODO]

## Domain
Production URL: [TODO]
Type: [predivo.ch subdomain / standalone domain]

## Supabase
Account email: [TODO]
Account password: [TODO]
Project ID: [TODO]
Project URL: [TODO]
Anon Key: [TODO]
Service Role Key: [TODO]
DB Password: [TODO]
Access Token: [TODO] (expires: [DATE])
Dashboard: [TODO]

## SMTP (Email)
Host: mail.predivo.ch
Port: 465
Email address: noreply@[DOMAIN]
Password: [TODO]
Sender name: [PRODUCT NAME]

## Stripe
Publishable Key: [TODO]
Secret Key: [TODO]
Webhook Secret: [TODO]
Account ID: [TODO]

## Password Gate (if applicable)
Password: [TODO]

## API Keys (project-specific)
# Add any third-party API keys needed for this project below.
# Example:
# ANTHROPIC_API_KEY: [TODO]
# FIRECRAWL_API_KEY: [TODO]

## GitHub Actions Secrets (derived from above — set these in GitHub repo settings)
# FTP_SERVER: (from Metanet FTP → Host)
# FTP_USERNAME: (from Metanet FTP → Username)
# FTP_PASSWORD: (from Metanet FTP → Password)
# SUPABASE_URL: (from Supabase → Project URL)
# SUPABASE_ANON_KEY: (from Supabase → Anon Key)

## Supabase Edge Function Secrets (set via `supabase secrets set`)
# ANTHROPIC_API_KEY: (from API Keys)
# SMTP_HOST: mail.predivo.ch
# SMTP_PORT: 465
# SMTP_USER: (from SMTP → Email address)
# SMTP_PASS: (from SMTP → Password)
# SMTP_FROM: (from SMTP → Email address)
# APP_URL: (from Domain → Production URL)
# STRIPE_SECRET_KEY: (from Stripe → Secret Key)
# STRIPE_WEBHOOK_SECRET: (from Stripe → Webhook Secret)
```

Also add `docs/Credentials.txt` to `.gitignore` if not already there.

Ask: "Template created. Ready to start provisioning? I'll walk through each service one at a time."

---

STEP 2: DOMAIN & FTP

Determine the domain strategy based on product_brief.md:
- If predivo.ch subdomain → subdomain is [product].predivo.ch, FTP credentials are shared (check existing projects for creds)
- If standalone domain → ask Roger for the domain name, then he creates FTP access in Plesk

Ask ONE question: "Will this project use a predivo.ch subdomain (e.g., [product].predivo.ch) or a standalone domain?"

Based on the answer:
- For predivo.ch subdomain: Search other projects' Credentials.txt for the shared FTP credentials and copy them. Update the deploy path.
- For standalone domain: Ask Roger to create the FTP access in Plesk and provide the credentials.

Update docs/Credentials.txt with the FTP and domain details immediately.

Ask: "FTP and domain configured. Next: Supabase project setup?"

---

STEP 3: SUPABASE PROJECT

Check C:\Business\Audits\supabase-accounts.html to see which Supabase accounts exist and their current project counts.

Ask Roger: "Which Supabase account should this project use?" (show available accounts from supabase-accounts.html)

Once Roger confirms the account:
1. Roger creates the Supabase project (or Claude does it via Management API if access token is available)
2. Collect: Project ID, Project URL, Anon Key, Service Role Key, DB Password
3. Update docs/Credentials.txt immediately
4. Update C:\Business\Audits\supabase-accounts.html with the new project

Then configure Supabase auth settings via Management API (per Rule 26):
- OTP: 6 digits, 600s expiry
- Site URL: http://localhost:5173 (dev — noted for production update)
- Redirect URLs: http://localhost:5173/auth/callback

Ask: "Supabase project created and configured. Next: email address setup?"

---

STEP 4: EMAIL ADDRESS (SMTP)

Create a noreply@ email address for the project domain:
- For predivo.ch subdomains: noreply@predivo.ch may already exist (check other projects)
- For standalone domains: Ask Roger to create noreply@[domain] in Plesk

Once the email is created:
1. Update docs/Credentials.txt with SMTP credentials
2. Configure custom SMTP in Supabase via Management API (per Rule 26):
   ```
   PATCH /v1/projects/{PROJECT_ID}/config/auth
   {
     "smtp_host": "mail.predivo.ch",
     "smtp_port": "465",
     "smtp_user": "noreply@[DOMAIN]",
     "smtp_pass": "[PASSWORD]",
     "smtp_admin_email": "noreply@[DOMAIN]",
     "smtp_sender_name": "[PRODUCT NAME]"
   }
   ```

Ask: "SMTP configured in Supabase. Next: Stripe setup?"

---

STEP 5: STRIPE (if applicable)

Check product_brief.md — if the product has pricing tiers / payments:
1. Ask Roger: "Create a new Stripe product for [PRODUCT NAME], or use existing Stripe account?"
2. Collect: Publishable Key, Secret Key, Webhook Secret, Account ID
3. Update docs/Credentials.txt immediately

If the product has no payments (e.g., internal tool), mark Stripe section as "N/A — no payments" and skip.

Ask: "Stripe configured. Next: API keys?"

---

STEP 6: PROJECT-SPECIFIC API KEYS

Based on the tech stack in product_brief.md, determine which API keys are needed:
- Claude/Anthropic API key (if using AI features) → check if a shared key exists across projects
- Firecrawl API key (if using web scraping) → check existing projects
- Any other third-party APIs mentioned in the product brief

For each key:
1. Search existing projects' Credentials.txt files first (Rule 5 — search before asking)
2. If found, copy the key (many keys are shared across projects)
3. If not found, ask Roger for the key
4. Update docs/Credentials.txt immediately

Ask: "API keys collected. Next: password gate?"

---

STEP 7: PASSWORD GATE (if applicable)

If the product is internal or in beta:
1. Ask Roger: "Should this project have a password gate? If yes, what password?"
2. Update docs/Credentials.txt and .env.local

If not needed, skip.

Ask: "Password gate configured. Next: creating .env.local?"

---

STEP 8: CREATE .env.local

Using all values collected in docs/Credentials.txt, create the project's .env.local file:
```
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co
VITE_SUPABASE_ANON_KEY=[ANON_KEY]
VITE_PASSWORD_GATE=[PASSWORD] (if applicable)
VITE_STRIPE_PUBLISHABLE_KEY=[KEY] (if applicable)
VITE_APP_URL=[PRODUCTION_URL]
```

Verify .env.local is in .gitignore.

Ask: "Environment file ready. Next: CI/CD setup?"

---

STEP 9: CI/CD & GITHUB ACTIONS

1. Copy deploy.yml.template from project-starter, customize with FTP credentials and deploy path
2. Copy keep-alive.yml.template from project-starter
3. Set GitHub Actions secrets in the repo (derived from Credentials.txt):
   - FTP_SERVER, FTP_USERNAME, FTP_PASSWORD
   - SUPABASE_URL, SUPABASE_ANON_KEY
4. Update docs/Credentials.txt "GitHub Actions Secrets" section to mark each as ✅ SET

Ask: "CI/CD configured. Next: Supabase Edge Function secrets?"

---

STEP 10: SUPABASE EDGE FUNCTION SECRETS

Set all edge function secrets using the Supabase CLI or Management API:
```
supabase secrets set \
  ANTHROPIC_API_KEY=[KEY] \
  SMTP_HOST=mail.predivo.ch \
  SMTP_PORT=465 \
  SMTP_USER=noreply@[DOMAIN] \
  SMTP_PASS=[PASSWORD] \
  SMTP_FROM=noreply@[DOMAIN] \
  APP_URL=[PRODUCTION_URL] \
  STRIPE_SECRET_KEY=[KEY] \
  STRIPE_WEBHOOK_SECRET=[KEY]
```

Update docs/Credentials.txt "Edge Function Secrets" section to mark each as ✅ SET.

Ask: "Edge function secrets configured. Next: final verification?"

---

STEP 11: VERIFICATION & MEMORY

1. Read docs/Credentials.txt end-to-end — verify no [TODO] values remain (except sections marked N/A)
2. Verify .env.local has all required values
3. Verify .gitignore includes both docs/Credentials.txt and .env.local
4. Save a Claude memory reference pointing to this project's Credentials.txt
5. Update C:\Business\Audits\supabase-accounts.html if a new Supabase project was created

Present final summary:
"Phase 2.5 Bootstrap complete. All credentials collected and stored in docs/Credentials.txt. Infrastructure ready:
- ✅ Domain: [URL]
- ✅ FTP: configured
- ✅ Supabase: [PROJECT_ID] — OTP 6-digit, custom SMTP
- ✅ Email: noreply@[DOMAIN]
- ✅ Stripe: [configured / N/A]
- ✅ API Keys: [list]
- ✅ .env.local: ready
- ✅ CI/CD: deploy.yml + keep-alive.yml
- ✅ Edge function secrets: set

Ready to proceed to Phase 3 (Design Pipeline + MVP Build)?"
```

> **Important:** Phase 2.5 must be completed before Phase 3 starts. Every credential and service account needed for the project lifetime is provisioned here. If a new API key or credential is discovered later during development, it gets added to docs/Credentials.txt immediately (per Rule 30) — but the goal is to minimize surprises by front-loading all known requirements.

### ✅ Outputs: `docs/Credentials.txt` (fully populated), `.env.local`, CI/CD workflows, edge function secrets

---

## PHASE 3 — MVP BUILD
**Goal:** Working MVP with core feature, auth, payments, landing page.
**Team setup:** Lead + 4 teammates per sprint (frontend / backend / DB / QA)

### 📋 Step 0: Design Pipeline (before any code)

Before Sprint 1, run the full design pipeline to establish visual identity, brand foundation, and key screen mockups. This ensures all code is built against approved designs with brand tokens enforced from the start — and gives you a complete brand book, not just UI screens.

```
/design-pipeline [product name from product_brief.md]
```

This triggers a **7-step interactive workflow** (logo-first approach) producing:
- **Stitch screens** — AI-generated reference designs (landing page + key screens) as the visual source of truth
- **Brand Book** — Standalone HTML document formalizing the brand identity
- **Design Tokens** — Canonical JSON token file extracted from the approved Stitch designs
- **Brand Guidelines Skill** — Auto-enforced during all frontend coding

> **Stitch-to-Code philosophy:** Stitch (Gemini-powered) generates high-quality mockups that serve as the design reference. The brand book is a standalone HTML document styled in the brand's own design language. All page refinements and implementation happen directly in code — there is no intermediate design tool rebuild step. This eliminates friction between design and code, and ensures the live product is always the source of truth.

---

#### Step 0.1: DEFINE — Brand Direction + Scope

Provide reference screenshots/URLs of sites with the desired look and feel. AI analyzes them to extract color palette, typography, spacing, layout patterns, and tone. Combined with product_brief.md to produce:
- `docs/DESIGN_BRIEF.md` — brand direction + anti-slop rules

**Step 0.1a: Firecrawl Brand Scrape (for each reference URL)**

Before manual analysis, run an automated brand extraction on each reference URL using the Firecrawl API. This pulls structured branding data (colors, fonts, typography, spacing, components, layout, and more) directly from live websites — giving you a machine-readable baseline instead of eyeballing screenshots.

**Process:**
1. User provides 1–5 reference URLs (sites with the desired look and feel)
2. For each URL, call the Firecrawl `/v2/scrape` endpoint with `formats: ["branding"]` only (no markdown, summary, links, HTML, screenshot, JSON, or images — just branding)
3. Save each response to `docs/references/brand-scrape-[domain].json`
4. AI analyzes all scraped branding data together to extract:
   - **Color palette** — primary, secondary, accent, background, text colors + color scheme (light/dark)
   - **Typography** — font families, sizes, weights, line heights
   - **Spacing** — base unit, border radius, padding/margin patterns
   - **Components** — button styles, input styles, icon styling
   - **Layout** — grid configuration, header/footer dimensions
   - **Assets** — logo URL, favicon, OG image
   - **Brand personality** — tone, audience, traits
   - **Animations** — transitions, easing, durations
5. Findings are merged with manual analysis (screenshots, user preferences) into `docs/DESIGN_BRIEF.md`

**API call (per URL):**
```bash
curl -X POST https://api.firecrawl.dev/v2/scrape \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $FIRECRAWL_API_KEY" \
  -d '{
    "url": "https://example.com",
    "formats": ["branding"]
  }'
```

**Why this matters:** Instead of manually inspecting reference sites and guessing at exact hex values, font stacks, and spacing systems, the brand scrape gives you precise, structured data. This is especially valuable when the user says "I want it to look like X" — you get the exact design tokens that make X look the way it does.

**Credit cost:** 1 Firecrawl credit per URL scraped. Budget: 1–5 credits per project.

---

**Project-specific questions asked during this step:**
1. Reference URLs to scrape for branding? (1–5 sites with the desired look and feel)
2. Light mode only, or light + dark mode?
3. Include brand collateral section? (business cards, email signatures, social templates)
4. UI component library scope: full set (~59 components) or product-relevant subset only?
5. Key screens to mock up (e.g. login, dashboard, main feature, settings)

These answers shape the scope of Steps 0.2–0.6.

---

#### Step 0.2: LOGO & FAVICON — Brand Mark (logo-first)

**Why logo first?** The logo is the anchor of the entire brand identity. Colors, typography weight, and visual tone are derived from or validated against the logo. Generating tokens before the logo risks misalignment — the logo should inform the tokens, not the other way around. If the project already has an existing logo, this step formalizes it into reusable components and variants instead of generating a new one.

**Logo Generation Method: Recraft MCP (Credit-Conscious)**

Always use the Recraft MCP to generate logos. This produces higher-quality, style-consistent results through a two-phase approach: first creating a style from reference images, then generating logos using that style.

**⚠️ CREDIT BUDGET RULES — Recraft API credits are finite and expensive. Follow these rules strictly:**
- **Check balance first** — Always call `get_user()` before starting to know the credit baseline.
- **Generate 2 images per call, not 6** — Use `numberOfImages: 2` to test direction before committing more credits.
- **Iterate with user approval** — Show each batch to the user. Only generate more if they ask for it.
- **Never bulk-generate** — Do NOT generate 16 images hoping one works. Use 2–3 targeted rounds of 2 images each (4–6 total).
- **Budget target:** ~6–8 images total per logo project (3–4 generate calls).
- **Never use Recraft for background removal** — Use free Python/Pillow instead (see Phase C below).
- **Track credits spent** — Report balance after the final generation so the user knows what was used.

**Phase A — Create a Recraft Style from References**

1. **Collect 3–5 reference logos** — Place reference logo images (PNG, min 400×400px) into the project's `docs/references/Logos/` folder. These represent the visual direction: shape language, weight, negative space, icon style, and type treatment.

2. **Choose references carefully for color consistency** — The custom style absorbs colors from the reference images. If you want black & white output, use only B&W references. Mixing in colored references (e.g. a cyan logo alongside B&W ones) will cause the style to bleed those colors into every generation, overriding prompt instructions like "black and white only." Match reference colors to desired output colors.

3. **Prepare reference images** — Before uploading, ensure all reference images meet Recraft requirements:
   - Minimum resolution: **400×400px** (upscale smaller images with Pillow `resize()` + `LANCZOS`)
   - Format: **PNG with RGBA mode** (convert palette-mode PNGs: `img.convert('RGBA')`)
   - File names: **no spaces** (replace spaces with underscores)
   - Copy prepared images to a clean path without spaces (e.g. `recraft-output/style-refs/`)

4. **Create the style via Recraft MCP** — Call `create_style` with base style `vector_illustration` and all prepared reference image URIs:
   ```
   create_style(
     style: "vector_illustration",
     imageURIs: [
       "file:///C:/path/to/style-refs/ref1.png",
       "file:///C:/path/to/style-refs/ref2.png",
       ...
     ]
   )
   ```
   This returns a **style_id** (e.g. `d1ca0e80-1faf-4e21-9376-3ed159b12a25`). Save this ID — it encodes the visual DNA of the references and will be used for all logo generation.

5. **Store the style_id** — Record the style_id in the project's `docs/DESIGN_BRIEF.md` under a `## Recraft Style` section and in the playbook's `docs/references/recraft-styles.md` for cross-project reuse.

**Phase B — Generate Logo Variations (Iterative, 2 at a time)**

6. **First test batch (2 images)** — Call `generate_image` with `numberOfImages: 2`, the style_id, and a carefully crafted prompt. Show results to user before generating more.

7. **Prompt engineering rules** — The prompt is critical. Follow these rules:
   - **Describe the aesthetic, never name other brands** — Recraft interprets brand names literally and renders them as text. Say "flowing ribbon curves, petal-like overlapping shapes" NOT "like the Fey logo."
   - **Be explicit about what you DON'T want** — Include "no text, no words, no letters below, no decoration" to prevent unwanted elements.
   - **Specify color explicitly** — "black mark on white background, strictly monochrome" or "single color on white." The custom style may override vague color instructions.
   - **Match shape language to references** — If references are soft/organic, say "smooth rounded edges, no sharp points, flowing curves." If references are geometric, say "clean angular lines, sharp edges."
   - **Keep it focused** — "minimal logomark, abstract letter [X], [2–3 shape descriptors], [color], no text" works better than long detailed prompts.

   Example progression (good):
   ```
   Round 1: "minimal logomark, abstract letter A, clean bold lines, black on white, no text"
   → Too geometric/sharp? Adjust:
   Round 2: "minimal logomark, abstract letter A, smooth flowing curves, ribbon-like, black on white, no text, no sharp edges"
   → Getting closer? Refine:
   Round 3: "minimal logomark, abstract letter A, soft rounded petal-like overlapping curves, flowing ribbon with subtle depth, black on white, no text"
   ```

8. **When custom style fights the prompt** — If the custom style overrides prompt instructions (e.g. keeps adding color despite "black and white" in prompt), drop the `styleID` parameter and use `style: "vector_illustration"` directly instead. The base style respects prompt instructions more faithfully. This is a known Recraft behavior: custom styles encode color palettes from references that override prompt-level color instructions.

9. **User picks one** — Present all generated options to the user for selection. Convert SVGs to PNGs using `resvg-js` for use in the brand book and frontend code.

10. **Lock the image file** — Once selected, copy the chosen image to `docs/images/logo-original.png`. This file is the single source of truth. **NEVER regenerate** the logo — AI produces a different image every time. Also copy the SVG source to `docs/images/logo-original.svg` for future vector editing.

**Phase C — Background Removal (Free, No Recraft Credits)**

11. **Remove background with Python/Pillow (FREE)** — Do NOT use Recraft `remove_background` as it burns credits unnecessarily. For logos on solid backgrounds, use Pillow:
    ```python
    from PIL import Image
    img = Image.open('docs/images/logo-original.png').convert('RGBA')
    data = list(img.getdata())
    new_data = []
    for pixel in data:
        if pixel[0] > 240 and pixel[1] > 240 and pixel[2] > 240:  # white/near-white
            new_data.append((pixel[0], pixel[1], pixel[2], 0))     # make transparent
        else:
            new_data.append(pixel)
    img.putdata(new_data)
    img.save('docs/images/logo-transparent.png')
    ```
    Adjust the threshold (240) if the background is not pure white.

12. **Create inverted version for dark backgrounds** — For Mono-White variants, invert the logo:
    ```python
    from PIL import Image, ImageOps
    img = Image.open('docs/images/logo-transparent.png').convert('RGBA')
    r, g, b, a = img.split()
    img_white = Image.merge('RGBA', (ImageOps.invert(r), ImageOps.invert(g), ImageOps.invert(b), a))
    img_white.save('docs/images/logo-white.png')
    ```

13. **SVG to PNG conversion** — Recraft generates SVGs for `vector_illustration` style. Convert to PNG using `resvg-js` (pure JS, no native dependencies) for use in brand book and frontend:
    ```bash
    cd /path/to/recraft-output && npm install @resvg/resvg-js
    node -e "
    const { Resvg } = require('@resvg/resvg-js');
    const fs = require('fs');
    const svg = fs.readFileSync('logo.svg', 'utf8');
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 800 } });
    fs.writeFileSync('logo.png', resvg.render().asPng());
    "
    ```

**Output files in `docs/images/`:**
- `logo-original.png` — chosen logo as-is from Recraft
- `logo-original.svg` — vector source from Recraft
- `logo-transparent.png` — black mark, transparent background
- `logo-white.png` — white mark, transparent background (for dark surfaces)

These files are referenced in the brand book (HTML) and used directly in frontend code (nav, footer, favicon, OG image).

**Critical rules:**
- **NEVER regenerate a selected logo** — AI produces a different image each time. Once the user picks one, only reference that exact file.
- **NEVER use Recraft `remove_background`** — it burns API credits. Use Pillow instead (free, instant, works perfectly for solid-background logos).
- **NEVER bulk-generate logos** — Generate 2 at a time, get user feedback, iterate. Budget: 6–8 images total.
- **ALWAYS check `get_user()` before and after** generation rounds to track credit spend.
- **ALWAYS convert SVGs to PNGs** using `resvg-js` (not cairosvg which requires native Cairo library on Windows).
- **NEVER use Lucide icons** as logo marks — they are generic and not suitable for brand identity.
- **NEVER name other brands in Recraft prompts** — Recraft renders brand names as literal text. Describe the aesthetic instead.
- **Reference images must be ≥400×400px, RGBA mode, no spaces in filenames** — Recraft API rejects images that don't meet these requirements.

---

#### Step 0.3: MOCKUP — Design Language Discovery

##### Decision Point: Claude Design Parallel Run

Before starting mockup generation, ask the user:

> "Do you also want to run Claude Design in parallel with Stitch for this project?"
> - **Stitch only** (default) — fully automated via MCP, proven workflow
> - **Stitch + Claude Design in parallel** — generates mockups in both tools, user compares and picks the winner

If the user opts in to Claude Design, see **Step 0.3b** below. Stitch always runs regardless.

---

##### Step 0.3a: Stitch (default, always runs)

Stitch is the design language driver and the **final visual reference**. It receives the raw outputs of Steps 0.1 + 0.2 + the product brief as input and **discovers** the visual language through iteration with the user. Approved Stitch screens are the source of truth for implementation — there is no rebuild step in another tool. All further page refinements happen directly in code.

**Why Stitch?** Pre-generating design tokens before any visual exploration produces arbitrary values that were never validated. Stitch explores what looks good using real reference data, tokens are extracted from what it produces, and the approved HTML is used as direct reference for frontend implementation.

**Design Context Prefix = Raw Reference Data + Logo + Product Brief**
Every Stitch `generate_screen_from_text` call MUST include a prefix containing:
- **Step 0.1 (Firecrawl) raw data:** Full brand comparison from scraped references — their specific colors, fonts, radii, tone, energy level. What the product should borrow from each and why. What to avoid. Source: `docs/references/brand-scrape-*.json` + comparison in `docs/DESIGN_BRIEF.md`.
- **Step 0.2 (Logo):** Detailed logo description — mark type, visual characteristics, placement rules, sizes. Source: logo specs in `docs/DESIGN_BRIEF.md`.
- **Product brief:** What the product does, target audience, personality, tone. Source: `docs/product_brief.md` or equivalent.
- **User decisions from Step 0.1:** Light/dark mode, screen count, collateral scope, etc.

Do NOT include pre-baked design tokens — let Stitch discover the visual language.

**Stitch API Reliability (learned from production use):**

| Tool | Reliability | Rule |
|------|------------|------|
| `generate_screen_from_text` | ~60% success rate | Always call `get_project` after to verify screens were created (often returns no output even on success) |
| `edit_screens` | **0% success rate** | NEVER use — always fails silently |
| `generate_variants` | Unreliable | NEVER rely on — results are inconsistent |
| `list_screens` | **Broken** | Always returns empty `{}`. Use `get_project` instead (includes `screenInstances` array) |
| `get_screen` | Works | Use `projects/{projectId}/screens/{screenId}` format |

**Best iteration method:** When `generate_screen_from_text` via MCP fails, prepare **paste-ready prompts** for the user to apply directly in the Stitch UI. This works every time.

**Writing good Stitch prompts:**
- **DO** tell Stitch WHAT sections to include and the brand constraints (colors, fonts, radius, personality)
- **DO** include all content sections with real copy — what the product does, who it's for, what each section communicates
- **DO NOT** dictate exact HTML structure or pixel-level layout — let Stitch design
- **DO NOT** use generic placeholder text — use product-specific content derived from the product brief
- Keep prompts content-focused: sections needed, brand personality, constraints. Give Stitch guidance and constraints, not prescriptive layouts.

**Two-phase iteration (structure first, polish last):**
- **Phase 1: STRUCTURE** — Get all sections right, correct content, right UX flow, right elements. Iterate until the page has everything it needs and nothing it doesn't. Focus feedback on what's missing or wrong structurally.
- **Phase 2: POLISH** — Only after structure is approved, fix colors, shadows, spacing, exact token alignment.
- Do NOT waste iterations on color fixes while the structure still needs work.

**Process:**

1. **Create a Stitch project** for the product via `create_project`
2. **Build the Design Context Prefix** from the raw sources listed above — include the full data, not summaries. If the prompt is long, that's fine — better to give Stitch too much context than too little.
3. **Build the base prompt** — combine the Design Context Prefix with the landing page content (all sections, real copy, what the product does, who it's for). This base prompt stays the same across all variations.
4. **Generate 5 landing page variations** — make 5 separate `generate_screen_from_text` calls in the same project, each with the same base prompt but a different one-line style direction appended. Always use `deviceType: "DESKTOP"` and `modelId: "GEMINI_3_1_PRO"`.

   | Variation | Style direction | What varies |
   |-----------|----------------|-------------|
   | 1 | Minimal & spacious — generous whitespace, hero-dominant | Visual density |
   | 2 | Content-rich — detailed sections, feature cards, more visual elements | Information density |
   | 3 | Bold editorial — large typography, expressive layout, magazine feel | Typography & scale |
   | 4 | Trust-first — social proof and metrics prominent, testimonials early | Section ordering & emphasis |
   | 5 | Conversion-focused — strong CTAs, urgency elements, compact flow | Conversion hierarchy |

   All five share the same brand constraints, colors, fonts, logo, and content — only the layout approach and emphasis differ.

5. **Verify all generated** — call `get_project` to confirm screens were created (don't trust silent returns). Stitch may silently create extra screens from retry attempts — include ALL generated screens in the evaluation, not just the original 5. If any required variations are missing, retry or prepare paste-ready prompts for the Stitch UI.
6. **Run multi-agent design evaluation** — spawn 4 expert agents in parallel, each receiving ALL generated screenshot files. Each agent evaluates every variation independently. The evaluation produces a structured Markdown report saved to `docs/stitch-exploration/design-evaluation-report.md`.

   **The 4 Expert Agents:**

   | Agent | Persona | Evaluates |
   |-------|---------|-----------|
   | **Web Designer** | Senior designer from Apple/Pentagram, 20+ years, award-winning websites | Visual aesthetics, typography, color harmony, spacing, visual hierarchy, design excellence |
   | **UX Designer** | Principal UX from Google/IDEO, human psychology + interaction design | User flow, navigation clarity, cognitive load, readability, information architecture, usability |
   | **Copywriter** | David Ogilvy meets modern SaaS, persuasion + messaging hierarchy | Headline strength, value prop clarity, CTA copy, tone, messaging consistency |
   | **CRO Specialist** | CRO lead from Basecamp/Booking.com, data-driven conversion psychology | Trust signals, social proof placement, friction points, conversion flow, action impulse |

   **Scoring criteria (each agent scores each variation 1-10 on all 5):**
   - First impression
   - Clarity of message
   - Visual quality
   - Trust & credibility
   - Action impulse

   **Each agent also provides:**
   - A sharp 2-3 sentence expert comment per variation (in their persona's voice, referencing specific design elements)
   - Their personal winner pick with clear reasoning

   **Report output structure:**
   - Score matrix: all agents × all variations × all criteria
   - Rankings table: grand totals sorted descending with per-agent subtotals
   - Agent winner picks section
   - Expert comments grouped by variation
   - Overall winner with summary of why it won
   - Recommended iteration notes (best elements from non-winning variations worth incorporating)
   - Screen reference table (Stitch IDs + screenshot filenames)

   **Agent prompt template** — each agent receives:
   - Their persona description and evaluation focus
   - Product context (name, value prop, target persona, core mechanism)
   - Paths to ALL screenshot files in `docs/stitch-exploration/`
   - The exact output format (enforced via structured template)
   - Instructions to read every screenshot and provide concrete, specific feedback

   Run all 4 agents in parallel via the Agent tool. After all return, aggregate scores into the final report.

7. **Auto-generate refined Stitch prompt** — immediately after the evaluation report is produced, automatically generate a refined `generate_screen_from_text` prompt that combines:
   - The **winning variation's strengths** (all elements that made it win, explicitly listed)
   - The **iteration notes from all 4 agents** (best elements from non-winning variations)
   - The **full Design Context Prefix** (product context, brand constraints, colors, fonts)
   - An **optimized section order** based on the conversion architecture the agents validated

   **Prompt structure (always follow this template):**

   ```
   Part 1 — Product Context
   One paragraph: app name, what it does, target user, core mechanism.

   Part 2 — Base Direction (from winner)
   "This design MUST retain all the strengths that made [Winner Name] win:"
   Numbered list of 4-6 specific winning elements, each with WHY it works
   (e.g. "Loss-aversion headline — frames status quo as mistake, 2x more motivating")

   Part 3 — CRITICAL IMPROVEMENTS TO INCORPORATE
   One subsection per agent iteration note, formatted as:
   "### From [Agent Name] ([source variation] insight):"
   What to add/change and WHY it tested stronger.

   Part 4 — Brand Constraints
   All hard design rules: colors (hex), fonts, radius, shadows, anti-patterns.

   Part 5 — Section Order
   Numbered list of all sections in optimized conversion flow order.
   Each section gets a one-line description of what it contains.

   Closing line: "This is the FINAL design combining the best elements from
   [N] variations as evaluated by expert agents."
   ```

   Send this prompt to `generate_screen_from_text` with `deviceType: "DESKTOP"` and `modelId: "GEMINI_3_1_PRO"` in the same Stitch project. Verify creation via `get_project`. Download the screenshot to `docs/stitch-exploration/final-refined.png`.

8. **Present final refined design to user** — show the final refined screenshot alongside the evaluation report. The user reviews and either approves the design language or requests further iteration. This is the approval gate.
9. **Refine if needed** — if the user wants changes, iterate by generating new screens in the same Stitch project with adjusted prompts. The user may also manually iterate in the Stitch UI (structure first, polish last). AI prepares paste-ready prompts if needed but does NOT use `edit_screens` or `generate_variants` (both unreliable).
   - **Do NOT proceed to other screens until the user explicitly approves the design language**
10. **Once design language is approved**, generate the remaining screens one-by-one or in small batches (3-5), always using the same Design Context Prefix + the approved design direction
11. **Iterate on each screen** using new `generate_screen_from_text` calls with refined prompts — or paste-ready prompts for the Stitch UI if MCP is unresponsive
12. **Review and approve** all screens before proceeding to Step 0.4

> **Stitch project remains available** for future brainstorming — when you need to explore new screens or major redesigns, start in Stitch first. Approved Stitch HTML files are saved to `docs/` and serve as the direct reference for frontend implementation.

**Importing Stitch output for downstream steps:**

All Stitch export methods produce the same two artifacts — an **HTML file** and a **screenshot (PNG)**. No export method provides additional data beyond these two.

| Export method | How to access | Output |
|--------------|---------------|--------|
| **MCP API** | `get_screen` → `htmlCode.downloadUrl` + `screenshot.downloadUrl` | HTML + PNG URLs |
| **ZIP download** (Stitch UI) | Manual download from Stitch | `code.html` + `screen.png` in zip |
| **MCP prompt** (Stitch UI) | Copy → paste into Claude Code | Text with project/screen IDs to call `get_screen` |
| **Code to clipboard** (Stitch UI) | Copy → paste into Claude Code | Raw HTML (identical to file) |

**Preferred method:** Use MCP API (`get_screen`) to retrieve the HTML download URL, then `curl -L` to download. This is fully automatable.

**CRITICAL — Screenshot resolution:** Stitch screenshot URLs (`lh3.googleusercontent.com`) serve **small thumbnails by default** (e.g. 104×512px). Always append `=s0` to the URL to get the **full-resolution** image (e.g. 2560×12616px). Without `=s0`, screenshots are unusable for design evaluation or visual QA.

```
# Wrong (thumbnail):
curl -sL "https://lh3.googleusercontent.com/aida/..." -o screenshot.png

# Correct (full resolution):
curl -sL "https://lh3.googleusercontent.com/aida/...=s0" -o screenshot.png
```

**For design evaluation:** Full-resolution pages are often 10,000+ pixels tall. Crop into ~2500px sections using PIL before feeding to evaluation agents — a single full-page image is too large to evaluate detail. Always verify image dimensions after download before using for any evaluation.

**What the HTML file contains (verified — this is what feeds Step 0.4):**
- **Tailwind config** with all design tokens: colors (semantic names + hex values), font families, border radius values, gradient definitions
- **Custom CSS** with shadow definitions, gradient classes, effects
- **Full semantic HTML** with Tailwind utility classes for every element
- **Google-hosted image URLs** (from Stitch's image generation)
- **Material Symbols icon names**
- **Responsive breakpoint classes** (sm, md, lg)

The HTML's embedded Tailwind config is the primary source for token extraction in Step 0.4.

**What Stitch does NOT export (verified):**
- Stitch's internal design strategy document (design.md) — not accessible via API or any export
- `DESIGN_SYSTEM_INSTANCE` entries visible in `get_project` — not retrievable via `get_screen`
- Project Brief / PRD — available as a separate screen in Stitch but contains only high-level project framing that duplicates information we already have from Step 0.1. Not useful for the workflow.

---

#### Step 0.4: EXTRACT — Design Tokens & System Docs

**Built AFTER Step 0.3 (Stitch approval).** Design tokens are EXTRACTED from the approved Stitch mockups — not invented beforehand.

AI analyzes the approved Stitch screens and creates:
- `docs/design-tokens.json` — canonical brand tokens extracted from what Stitch actually rendered (colors, typography, spacing, radius, shadows, breakpoints)
- `docs/DESIGN_SYSTEM.md` — human-readable design spec documenting the visual patterns Stitch established
- `docs/DESIGN_BRIEF.md` — updated with final brand direction reflecting the approved design language
- `.claude/skills/brand-guidelines/SKILL.md` — auto-enforced during coding

If dark mode was selected in Step 0.1, tokens include both light and dark values.

---

#### Step 0.5: BRAND BOOK — Standalone HTML Document

**Built AFTER Step 0.3 (Stitch approval) and Step 0.4 (token extraction).** The Brand Book formalizes the design language that was established and approved in Stitch. It documents the brand identity as rendered in the approved mockups, not as an abstract spec.

AI builds a comprehensive brand book as a **standalone HTML document** (`docs/brand-book.html`) styled in the brand's own design language. The file is fully self-contained — it loads only Google Fonts and Material Symbols via CDN, with all styles inline. It can be opened directly in a browser, printed to PDF, or shared as-is.

**Why HTML instead of a design tool?**
- Opens in any browser — no special software needed to view
- Styled in the brand's own tokens — the brand book IS the brand
- Easy to update as the brand evolves — just edit the HTML
- Can reference local logo files directly (relative paths from `docs/`)
- Printable to PDF for stakeholder sharing

**Sections (as scrollable page with sticky nav):**

1. **Brand Story** — Creative north star, brand personality traits (warm/trustworthy/premium/effortless), voice & tone guidelines with example copy for headlines, body text, and CTAs.

2. **Logo** — Primary mark on light/dark backgrounds, wordmark lockup, mark-only usage, minimum sizes (32px mark, 16px favicon), clear space rules. References local logo PNGs via relative paths.

3. **Color System** — Full palette with hex values and semantic roles: primary/accent colors, text colors, surface hierarchy (5-tier tonal scale), gradients. Rendered as visual swatches.

4. **Typography** — Font family, full weight scale, type ramp from Display (largest) to Label (smallest). Each level shown as a live rendered sample with size/weight/tracking specs.

5. **Spacing & Layout** — Base grid unit, spacing scale visualization, border radius scale (with rendered demos), layout constants (max-width, container padding, nav height, section padding).

6. **Effects & Elevation** — Glassmorphism/blur effects with CSS specs, shadow scale (5 levels rendered), hover/active/transition animations with timing values.

7. **Components** — Core UI patterns extracted from the approved Stitch design: button variants, card types (standard/tonal/featured), search input, trust signals, stats bar, iconography with the icon set used.

8. **Design Guidelines** — Do's and Don'ts with visual examples. Key rules like the "No-Line Rule" (no 1px borders for sectioning), no pure black text, no sharp corners, no blue links.

**Styling rules for the brand book itself:**
- Use the brand's own fonts, colors, and spacing — the document IS the brand
- Sticky navigation with section links
- CSS variables for all brand tokens (easy to update)
- Responsive layout (readable on mobile)
- Print-friendly (nav hides, sections don't break mid-page)
- No JavaScript required (pure HTML + CSS)
- References logo images via relative paths (`images/logo-transparent.png`, `images/logo-white.png`)

---

#### Step 0.6: ADDITIONAL SCREENS — Generate in Winning Tool

After the primary landing page is approved and tokens extracted, generate remaining key screens in whichever tool won in Step 0.3 (Stitch by default, or Claude Design if chosen). These serve as visual references for frontend implementation.

**If Stitch won (default):**

1. **Generate each screen** via `generate_screen_from_text` with the same Design Context Prefix from Step 0.3a, plus the approved design direction
2. **Desktop first** (`deviceType: "DESKTOP"`), then mobile versions (`deviceType: "MOBILE"`) for key screens
3. **Iterate** using new `generate_screen_from_text` calls — never use `edit_screens` or `generate_variants` (both unreliable)
4. **Approve and export** — download HTML + screenshots via `get_screen` for each approved screen, save to `docs/`

**Typical screens (product-dependent):**

| Screen | Purpose |
|--------|---------|
| Login / Signup | Auth flow |
| Dashboard | Main authenticated experience |
| Search / Results | Core feature interaction |
| Settings / Profile | User management |
| Admin Dashboard | Admin-only views |
| Pricing / Checkout | Payment flow |

**Mobile responsive references:**

For key screens, also generate mobile versions in Stitch. These define how elements adapt:

| Desktop element | Mobile behavior |
|----------------|----------------|
| **Sidebar navigation** | Bottom tab bar or hamburger menu |
| **Multi-column layouts** | Stack vertically (single column) |
| **Data tables** | Card/list view or horizontal scroll |
| **Side-by-side panels** | Stack with primary panel on top |
| **Modal dialogs** | Full-screen sheets (slide up) |
| **Large headings** | Scaled down per mobile type ramp |

44px min tap targets, mobile spacing scale, navigation state shown.

All approved Stitch HTML files are saved to `docs/` and serve as direct implementation references. There is no rebuild step — refinements happen in code.

**If Claude Design won:**

1. Generate each remaining screen in Claude Design by describing it in the chat (same product context and design direction)
2. Iterate using chat, inline comments, direct editing, and sliders
3. For mobile versions, describe the mobile adaptation requirements in chat
4. When all screens are approved: Export → "Hand off to Claude Code" → paste bundle into Claude Code
5. Claude Code receives the full structured handoff bundle for implementation

---

#### Step 0.7: DESIGN QA — Review Before Code

Before moving to Sprint 1, review all approved design artifacts for completeness and consistency.

**Checklist:**

1. **Brand Book HTML** — open in browser, verify all sections render correctly, logo images load, colors match tokens
2. **Design Tokens JSON** — verify all colors from the approved Stitch screens are captured, typography scale is complete, spacing/radius values match the HTML
3. **Stitch Screens** — verify all key screens are exported (HTML + screenshot) and saved to `docs/`
4. **Brand Guidelines Skill** — verify `.claude/skills/brand-guidelines/SKILL.md` exists and contains the correct token values
5. **Logo Files** — verify all variants exist in `docs/images/` (original, transparent, white, SVG)

This is a lightweight verification step — not an automated multi-agent audit. The user reviews the brand book and Stitch screens and confirms they're ready for implementation.

---

**Why this matters:** Iterating on mockups and brand decisions is free. Iterating on code is expensive. Anti-slop rules are baked into the design brief so generic AI aesthetics are blocked at design time, not just at code time. The Stitch-to-Code workflow ensures high-quality AI-generated designs serve as direct implementation references — no intermediate rebuild step means less friction and the live product is always the source of truth. A complete brand book ensures consistency across not just the app UI, but also marketing materials, proposals, social content, and anything else the brand touches.

**Outputs:**

| Artifact | Location | Purpose |
|----------|----------|---------|
| Brand Book | `docs/brand-book.html` | Standalone HTML brand identity document — logo, colors, typography, spacing, components, guidelines |
| Stitch Project | Stitch MCP (cloud) | AI-generated reference screens (visual source of truth) |
| Stitch HTML Exports | `docs/stitch-*.html` | Downloaded HTML from each approved Stitch screen — direct implementation reference |
| Stitch Screenshots | `docs/stitch-*-screenshot.png` | Full-resolution screenshots of approved screens |
| Claude Design Bundle | Handoff bundle via Export → Claude Code | Structured component specs, tokens, layout, assets (if Claude Design was used) |
| Design Tokens | `docs/design-tokens.json` | Canonical token values (absolute truth for code) |
| Design System Spec | `docs/DESIGN_SYSTEM.md` | Human-readable design spec |
| Design Brief | `docs/DESIGN_BRIEF.md` | Brand direction + anti-slop rules |
| Brand Guidelines Skill | `.claude/skills/brand-guidelines/SKILL.md` | Auto-enforced during all frontend coding |
| Logo Files | `docs/images/logo-*.png/svg` | All logo variants (original, transparent, white, SVG) |

Step 0.7 (Design QA) is a lightweight review before Sprints begin. The brand-guidelines skill ensures every line of frontend code matches the approved designs.

> Skip this step only if you already have an existing design system and brand book.

---

#### Step 0.3b: Claude Design (optional parallel path — user must opt in)

**Only runs if the user chose "Stitch + Claude Design in parallel" at the Step 0.3 decision point.**

Claude Design is a separate web application at [claude.ai/design](https://claude.ai/design) (requires manual login, included with Pro/Max/Team/Enterprise plans). It generates interactive prototypes conversationally, powered by Claude Opus 4.7.

**What Claude Design can do:**
- Generate interactive prototypes, wireframes, landing pages, dashboards, mobile flows from text descriptions
- Accept uploads: screenshots, wireframes, DOCX, PPTX, XLSX, PDF, design-tokens.json
- Link a GitHub repo to read existing components, tokens, and styling
- Auto-generate a design system (colors, typography, components) from inputs
- Iterate via 4 methods: chat, inline comments, direct text editing, AI-generated adjustment sliders
- Export: PDF, PPTX, standalone HTML, ZIP, Canva, shareable URL
- Hand off structured bundle to Claude Code (not screenshots — machine-readable component specs)

**What Claude Design cannot do:**
- No MCP server, no API, no CLI — web-only, manual interaction required
- No logo creation — only placeholder wordmarks (logos always come from Recraft in Step 0.2)
- No Figma export (.fig not supported)
- No multiplayer real-time editing
- Heavy token consumption: ~58% of Pro weekly limit for 2 sessions

**Process:**

1. **Open Claude Design** — go to [claude.ai/design](https://claude.ai/design) (requires manual login). Create a new project with "High fidelity" mode.
2. **Provide context** — paste the following into Claude Design's chat:
   - Product brief (from `docs/product_brief.md` or equivalent)
   - Design tokens (paste `docs/design-tokens.json` content if it exists from a prior project)
   - Logo description (from Step 0.2)
   - Brand direction and anti-slop rules (from `docs/DESIGN_BRIEF.md`)
   - Key screens needed (from Step 0.1 decisions)
3. **Optional: Link GitHub repo** — in Claude Design's design system settings, link the project's GitHub repo so it can read existing components and styling
4. **Iterate** — use chat for structural changes, inline comments for specific elements, direct text editing for copy, AI-generated sliders for spacing/color/sizing adjustments
5. **Generate all key screens** — landing page, login, dashboard, settings, etc. (same screens as Stitch)
6. **When satisfied, hand off to Claude Code:**
   - Click **Export → "Hand off to Claude Code" → Local Claude Code**
   - Claude Design generates a prompt + URL
   - Paste the generated prompt + URL into the Claude Code session
   - Claude Code fetches the handoff bundle (component structure, design tokens, layout hierarchy, assets, chat history, README)

**Handoff bundle contents:**

| Component | Description |
|-----------|-------------|
| Component structure | Machine-readable spec of the component hierarchy |
| Design tokens | Colors, typography, spacing values used on canvas |
| Layout hierarchy | Spatial relationships between elements |
| Referenced assets | Images, icons |
| Chat history | Design decisions and iteration rationale |
| README | Instructions for Claude Code to interpret the designs |

**If both Stitch and Claude Design ran:** Present both sets of outputs to the user. User picks the winner. All subsequent steps (0.4 token extraction, 0.5 brand book, 0.6 additional screens) use the winning tool's output as the source of truth. The losing tool's output is kept in `docs/` for reference but is not the implementation target.

### 📋 Step 1: Paste into Claude Code to start building:
```
You are my lead engineer acting as Team Lead. Read /outputs/product_brief.md, /outputs/offer_design.md, and docs/DESIGN_BRIEF.md.

The design system is already set up:
- docs/design-tokens.json — canonical brand tokens (absolute truth)
- .claude/skills/brand-guidelines/SKILL.md — auto-enforced during all frontend work
- docs/DESIGN_SYSTEM.md — human-readable design spec
- docs/brand-book.html — standalone HTML brand book
- docs/stitch-*.html — approved Stitch screen references (direct implementation targets)

All frontend work MUST match the approved Stitch references and use design tokens. Never hardcode colors, fonts, or spacing.

First, ask me:
1. Existing codebase or start from scratch?
2. Any third-party APIs that must be integrated? (e.g. Stripe, Anthropic Claude API, Supabase)
3. Hosting: Metanet FTP (default for all predivo.ch subdomains) or other?
4. Which sprint should I start with? (Scaffold / Core Feature / Auth+Payments / Landing Page)

IMPORTANT: Use the project-starter template (`/c/Business/Internal Projects/project-starter/`) to bootstrap:
- Copy `.claude/`, `.github/`, `context/` directories
- Copy Supabase shared helpers (auth.ts, cors.ts) if using Supabase
- Copy `.htaccess` template for SPA routing
- Rename deploy.yml.template → deploy.yml and customize subdomain + app dir

Then for EACH sprint, create a fresh Agent Team:

--- SPRINT 1: PROJECT SCAFFOLD + TEST INFRASTRUCTURE ---
TeamCreate: "scaffold"
Teammate 1 — "project-setup": Initialize repo, folder structure, README, .env.example per tech stack in product_brief.md. Set up Tailwind config with design tokens from docs/design-tokens.json. Configure CSS variables / theme from brand-guidelines.
Teammate 2 — "db-architect": Design and write database schema for all core entities. Create migrations.
Teammate 3 — "test-architect": Set up the full testing infrastructure:
  1. Install test dependencies: vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, @playwright/test, @axe-core/playwright, jsdom
  2. Create vitest.config.ts with jsdom environment, path aliases, and coverage thresholds (start at 5%)
  3. Create playwright.config.ts with chromium + mobile projects and webServer config
  4. Create src/test/setup.ts with DOM matchers and global Supabase mock (prevents CI crashes when env vars are missing)
  5. Copy templates/test.yml from the playbook to .github/workflows/test.yml — customize branch name, Node version, and npm flags (search for "# CUSTOMIZE:" comments)
  6. Create scripts/check-feature-coverage.mjs (feature-test sync validator)
  7. Create docs/FEATURES.md with the initial feature registry — add ALL planned features from product_brief.md with status: planned
  8. Create e2e/smoke.spec.ts with all routes, e2e/accessibility.spec.ts with public routes, e2e/features.spec.ts (empty, filled per sprint)
  9. Add test npm scripts to package.json: test, test:ci, test:watch, test:coverage, test:e2e, test:a11y, test:all
  Coordinate with project-setup on path aliases and with db-architect on table names for mock setup.
Teammates message each other to align on naming conventions before writing files.
Team Lead: Stitch together, verify it runs locally. Verify design tokens are wired into Tailwind/CSS. Run `npm run test` to confirm test infrastructure works. Ask me: "Scaffold done. Start core feature sprint?"

--- SPRINT 2: CORE FEATURE ---
TeamCreate: "core-feature"
Teammate 1 — "backend-dev": Build API routes for the core feature. Document the interface.
Teammate 2 — "db-dev": Write migrations, seed data, schema validation. Coordinate with backend-dev on data shapes.
Teammate 3 — "frontend-dev": Build main UI component. Coordinate with backend-dev on API contract.
Teammate 4 — "qa-tester": Write tests for the core feature built by the other teammates:
  - Unit tests for hooks, utils, and data transformations (src/**/__tests__/*.test.ts)
  - Component tests for UI components (src/**/__tests__/*.test.tsx)
  - E2E tests for the core user journey (e2e/features.spec.ts)
  - Update docs/FEATURES.md: change core feature entries from "planned" to "tested", add test file paths
  Message each teammate directly to understand API contracts and component behavior before writing tests.
Teammates use lateral messaging to coordinate API contracts in real time.
Team Lead: Stitch, verify end-to-end. Run `npm run test` to confirm all tests pass. Ask me: "Core feature done. Start auth+payments sprint?"

--- SPRINT 3: AUTH + PAYMENTS ---
TeamCreate: "auth-payments"
Teammate 1 — "auth-dev": Implement the FULL authentication workflow documented below in the Auth Implementation Reference. Use ReplyFlow's auth code as the source — copy and adapt, don't rebuild from scratch.
Teammate 2 — "payments-dev": Implement Stripe checkout for pricing tiers from offer_design.md. Coordinate with auth-dev on user identity linking.
Teammate 3 — "qa-tester": Write tests for auth and payment features:
  - Unit tests for auth hooks, subscription hooks, quota logic
  - Integration tests for trial system, Stripe checkout, Stripe webhook, billing portal
  - E2E tests for auth flows (signup, login, forgot password) and payment flows
  - Update docs/FEATURES.md: change auth/payment feature entries to "tested", add test file paths
  Message auth-dev and payments-dev to understand edge cases and error states.
Team Lead: Verify ALL auth flows work end-to-end (signup → OTP → profile → login → forgot password → reset). Verify email templates render correctly in Outlook. Run `npm run test` to confirm all tests pass. Ask me: "Auth and payments done. Start landing page sprint?"

--- SPRINT 4: LANDING PAGE ---
TeamCreate: "landing-page"
Teammate 1 — "copywriter": Write all copy using the exact customer pain language from phase1_idea_validation.md. Sections: Hero, Problem, Solution, Features, Pricing, FAQ, CTA.
Teammate 2 — "frontend-builder": Build the landing page with the copy from the copywriter teammate. Use the approved mockups as the visual reference. All colors, fonts, spacing from design-tokens.json — brand-guidelines skill is auto-enforced. Coordinate directly with copywriter for copy handoff.
Teammate 3 — "conversion-reviewer": Review the page for conversion best practices AND brand compliance (matches approved mockups, uses design tokens). Message frontend-builder directly with specific changes.
Teammate 4 — "qa-tester": Write tests for the landing page and any remaining untested features:
  - Unit tests for landing page components (hero, pricing, FAQ)
  - Smoke tests for all routes (e2e/smoke.spec.ts — verify pages load without JS errors)
  - Accessibility tests for all public routes (e2e/accessibility.spec.ts — axe-core WCAG 2.1 AA)
  - Update docs/FEATURES.md: change landing page entries to "tested", verify ALL features have test files listed
  - Run scripts/check-feature-coverage.mjs to confirm 100% feature coverage
Teammate 5 — "seo-engineer": Implement Technical SEO for all public pages. Reference: `C:\Business\Audits\audit-framework.md` Domain 2. Checklist:
  - Set up prerendering for all public routes (vite-plugin-prerender or post-build script) — each page gets baked-in meta/canonical/OG tags
  - Create/validate sitemap.xml with all public URLs (no trailing-slash mismatch with .htaccess)
  - Create/validate robots.txt (block auth routes, reference sitemap)
  - .htaccess: HTTPS redirect, www-to-non-www, trailing-slash strip (all before SPA fallback)
  - Add JSON-LD structured data: Organization + SoftwareApplication (with raster logo). Add FAQPage schema if FAQ section exists.
  - Verify all public pages have: unique title, meta description, canonical, OG tags (og:title, og:description, og:image 1200x630, og:url), Twitter card tags
  - Verify heading hierarchy: one H1 per page, proper H1 > H2 > H3 nesting
  - Verify internal linking: all public pages linked from nav or footer, footer links to homepage
  - Add preconnect hints for external services (Supabase, font CDN)
  - Generate OG image (1200x630px PNG, correct domain, branded)
  - Verify noindex on auth/private routes
  - For SaaS: create standalone /pricing route if pricing exists only as anchor section
  - Post-deploy: verify domain in Google Search Console (HTML file or DNS TXT), submit sitemap.xml
  - Post-deploy: if using Google OAuth, submit branding verification in Google Cloud Console (Verification Center)
  Message frontend-builder to coordinate on meta tags and prerendering setup.
Team Lead: Final review. Verify design matches approved mockups. Run `npm run test:all` to confirm full test suite passes. Ask me: "MVP complete. All features tested. Ready to build the marketing pipeline?"
```

### Auth Implementation Reference

This is the exact workflow for implementing Supabase Auth in any new project. The reference implementation lives in **ReplyFlow** (`c:/Business/Internal Projects/replyflow/`). Always copy from ReplyFlow and adapt — never rebuild from scratch.

#### A. Auth Pages & Components (copy from ReplyFlow, adapt branding)

**Source files to copy** (all paths relative to project root):

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` or `src/features/auth/AuthContext.tsx` | Full auth context: signInWithPassword, sendOtp (signup), sendLoginOtp, verifyOtp, completeProfile, hasCompletedProfile, resetPassword, updatePassword, deleteAccount, signOut. Keep project-specific profile/org loading. |
| `src/pages/auth/LoginPage.tsx` or `src/features/auth/LoginPage.tsx` | Two tabs: Password + Email Code (OTP). Email Code has 2 steps: email input → OTP verify. |
| `src/pages/auth/SignUpPage.tsx` or `src/features/auth/SignupPage.tsx` | 3-step flow: email → verify 6-digit OTP → complete profile (name + password). Step progress dots. Handles `?verified=true` from deep link. After profile completion → `/onboarding` or `/dashboard`. |
| `src/pages/auth/ForgotPasswordPage.tsx` | Two steps: email form → "check your email" confirmation with Mail icon. |
| `src/pages/auth/ResetPasswordPage.tsx` | New password + confirm + PasswordStrength. Redirects to /forgot-password if no session. Shows success with CheckCircle icon. |
| `src/pages/auth/AuthCallbackPage.tsx` | Handles Supabase hash fragments from magic links. Routes: recovery → /reset-password, new user → /signup, existing → /dashboard. |
| `src/pages/auth/AuthVerifyPage.tsx` | Auto-verifies OTP from email deep link (`/auth/verify?token=&email=&type=`). Checks `hasCompletedProfile()` to route signup vs dashboard. |
| `src/components/auth/OtpInput.tsx` | 6 individual inputs with auto-advance, backspace handling, paste support, auto-submit on completion. |
| `src/components/auth/PasswordStrength.tsx` | 5-bar strength indicator with color progression. |
| `src/components/auth/ResendTimer.tsx` | 60s cooldown countdown, then "Resend code" button. |
| `src/components/auth/AuthLayout.tsx` | Centered auth page wrapper with product logo linking to `/`. |
| `src/components/auth/password-utils.ts` | `getPasswordScore()` checking 5 criteria: 8+ chars, uppercase, lowercase, number, special char. |
| `src/lib/utils.ts` | `friendlyAuthError()` — maps Supabase auth errors to user-friendly messages. |

**Key adaptation points when copying:**
- Replace all brand colors/classes with new project's design tokens
- Change navigation targets (`/app` → `/dashboard`, etc.)
- Update AuthContext to keep project-specific state (profile, organization, etc.)
- `sendOtp()` must use `shouldCreateUser: true` (signup) vs `sendLoginOtp()` with `shouldCreateUser: false`
- `completeProfile()` sets password + full_name via `supabase.auth.updateUser()`
- `hasCompletedProfile()` checks `user_metadata.full_name`

**Routes to add in App.tsx:**
```
/login, /signup, /forgot-password, /reset-password, /auth/callback, /auth/verify
```

#### B. Supabase Project Configuration (via Management API)

Configure auth settings via the Supabase Management API — never rely on the dashboard UI alone.

**Step 1: Get an access token**
Go to `https://supabase.com/dashboard/account/tokens` → Generate new token for the project's organization.

**Step 2: Set OTP config (CRITICAL — do this FIRST)**
```bash
curl -X PATCH "https://api.supabase.com/v1/projects/{PROJECT_ID}/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mailer_otp_length": 6, "mailer_otp_exp": 600}'
```
Default Supabase OTP is 8 digits — this BREAKS the 6-digit OTP input. Always set to 6 digits, 600s expiry.

**Step 3: Configure custom SMTP**
```bash
curl -X PATCH "https://api.supabase.com/v1/projects/{PROJECT_ID}/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "smtp_host": "DOMAIN",
    "smtp_port": "465",
    "smtp_user": "noreply@DOMAIN",
    "smtp_pass": "PASSWORD",
    "smtp_admin_email": "noreply@DOMAIN",
    "smtp_sender_name": "PRODUCT_NAME"
  }'
```
Without custom SMTP, emails come from `noreply@mail.app.supabase.io` with Supabase branding.

**Step 4: Set email templates (copy from ReplyFlow, find-and-replace)**

The email templates must be copied from an existing working project (ReplyFlow) — never write from scratch. The templates use XHTML email best practices including MSO conditionals for Outlook.

```bash
# 1. Fetch ReplyFlow's templates
curl -s "https://api.supabase.com/v1/projects/{REPLYFLOW_PROJECT_ID}/config/auth" \
  -H "Authorization: Bearer $REPLYFLOW_TOKEN" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for key in ['mailer_templates_confirmation_content',
            'mailer_templates_magic_link_content',
            'mailer_templates_recovery_content']:
    with open(f'tmp-{key}.html', 'w') as f:
        f.write(data[key])
"

# 2. Find-and-replace brand values:
#    - Product name: ReplyFlow → NewProduct
#    - Primary color: #0D9488 → new brand color
#    - Code box bg: #f0fdfa → light tint of new brand color
#    - Code box border: #99f6e4 → medium tint of new brand color
#    - Domain: replyflow.predivo.ch → newproduct domain
#    - Logo image URL (or remove img tag for text-only header)

# 3. Push to new project (save as JSON, use -d @file.json)
curl -X PATCH "https://api.supabase.com/v1/projects/{PROJECT_ID}/config/auth" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @new-templates.json
```

**Template subject lines** (use `mailer_subjects_*` keys, NOT `mailer_templates_*_subject`):
```json
{
  "mailer_subjects_confirmation": "{{ .Token }} is your PRODUCT verification code",
  "mailer_subjects_magic_link": "{{ .Token }} is your PRODUCT sign-in code",
  "mailer_subjects_recovery": "Reset your PRODUCT password"
}
```

**What the templates include:**
- XHTML email doctype with MSO conditionals for Outlook
- Hidden preheader text for email client previews
- Zero-width joiner spacers to prevent Gmail clipping
- Centered brand name (with optional logo image)
- OTP code in colored box (clickable → deep link to `/auth/verify`)
- CTA button with `mso-padding-alt` for Outlook button rendering
- Footer: `© YEAR Predivo GmbH · Bahnhofstrasse 55 · 6403 Küssnacht am Rigi` + product domain link

**Step 5: Set redirect URLs**
In the Supabase dashboard (`https://supabase.com/dashboard/project/{PROJECT_ID}/auth/url-configuration`):
- **Site URL:** `http://localhost:5173` (dev) — CHANGE TO PRODUCTION DOMAIN BEFORE DEPLOY
- **Redirect URLs:** add `http://localhost:5173/auth/callback` (dev) — ADD PRODUCTION URL BEFORE DEPLOY

#### C. Edge Functions (transactional emails)

Copy from ReplyFlow and adapt:

| File | Purpose |
|------|---------|
| `supabase/functions/_shared/email.ts` | SMTP module using `denomailer@1.6.0`. Branded layout wrapper, CTA button helper, all email templates (welcome, trial ending, payment failed, plan changed, account deleted). |
| `supabase/functions/send-welcome/index.ts` | Sends branded welcome email after profile completion. Uses authenticated user's JWT. |
| `supabase/functions/delete-account/index.ts` | Cascade deletion of all project tables + auth user + sends confirmation email. Adapt table list per project. |

**Edge function env vars required:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`

#### D. Verification Checklist (before declaring auth "done")

Run through ALL of these before moving on:

- [ ] OTP length is 6 digits (not Supabase default of 8)
- [ ] OTP expiry is 600s (10 min)
- [ ] Custom SMTP configured — emails come from `noreply@DOMAIN`, not Supabase
- [ ] Email template matches ReplyFlow's layout (copy, don't rebuild)
- [ ] Subject line includes OTP code: `{{ .Token }} is your PRODUCT verification code`
- [ ] Signup flow: email → receive OTP → enter code → complete profile (name + password) → redirect to onboarding/dashboard
- [ ] Login (password tab): email + password → dashboard
- [ ] Login (email code tab): email → receive OTP → enter code → dashboard
- [ ] Forgot password: email → receive reset email with button → click → new password form → success
- [ ] Email renders correctly in Outlook (test in actual Outlook, not just browser)
- [ ] Button in email is centered and properly sized in Outlook
- [ ] Footer shows copyright + company address + product domain link
- [ ] `friendlyAuthError()` used in ALL auth pages (not raw Supabase errors)
- [ ] Site URL and redirect URLs noted for production update before deploy
- [ ] TypeScript compiles with zero errors
- [ ] All 6 auth routes return 200: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/auth/verify`

#### E. Production Deploy Reminder

Before deploying to production, update these Supabase settings:
1. **Site URL** → change from `http://localhost:5173` to `https://PRODUCTION_DOMAIN`
2. **Redirect URLs** → add `https://PRODUCTION_DOMAIN/auth/callback`
3. **Custom SMTP** → verify SMTP credentials work for production domain
4. **APP_URL env var** on edge functions → point to production domain
5. **Email template logo image** → ensure URL is accessible on production

---

### ✅ Output: Working local MVP

---

## PHASE 4 — MARKETING CONTENT PIPELINE
**Goal:** 7-day content calendar across platforms + outreach templates.
**Team setup:** Lead + 3 teammates (written / video / outreach in parallel)

> **Distribution strategy:** Before diving into content, read `DISTRIBUTION_PLAYBOOK.md` (in the playbook root) — the six-engine framework (Pull, Push, Bridge, Search, Equity, Persistence) for choosing and sequencing your go-to-market channels. Pick one primary engine first. The content pipeline below supports primarily the Push engine (audience building + waitlist) and Pull engine (SEO content).

### 📋 Paste into Claude Code:
```
You are my content strategist acting as Team Lead. Read all files in /outputs/.

First, ask me:
1. Which platforms? (select: X/Twitter, LinkedIn, Instagram, YouTube, TikTok)
2. Posting frequency goal? (e.g. daily, 3x/week)
3. Narrative angle: "build in public" or direct launch campaign?
4. Personal brand angle? (e.g. "Swiss dev going indie", "ex-corporate founder")

Then create an Agent Team with 3 teammates:

TeamCreate: "marketing-pipeline"

Teammate 1 — "written-content"
Task: Using exact customer pain language from phase1_idea_validation.md, produce for each of 7 days:
- 1x short-form written post for X/LinkedIn
- 1x LinkedIn article outline (for 1 post that week)
Write like a founder, not a copywriter. No generic AI marketing language.
Message outreach-writer with the top 3 pain phrases to use in DMs.
Save to /outputs/marketing_written.md

Teammate 2 — "video-scripts"
Task: For each of 7 days, produce:
- 1x short-form video script (60–90 sec) for Instagram/TikTok/YouTube Shorts
- 1x thumbnail brief (text description of visual concept)
Coordinate with written-content teammate to ensure messaging is consistent.
Save to /outputs/marketing_video.md

Teammate 3 — "outreach-writer"
Wait for pain phrases from written-content teammate.
Then produce:
- 5x personalized B2B outreach DM templates (for direct outreach to target customers)
- 3x email subject line options for launch announcement
- 1x launch announcement email (full draft)
Save to /outputs/marketing_outreach.md

Team Lead: Compile all three into /outputs/marketing_week1.md. Ask me: "Marketing pipeline ready. Review and approve posts before I schedule them."
```

### ✅ Outputs: `marketing_week1.md` (written + video + outreach combined)

---

## PHASE 5 — DEAL CLOSING (PROPOSAL GENERATOR)
**Goal:** Sales call transcript → tailored client proposal in under 5 minutes.
**Team setup:** Lead + 2 teammates (proposal writer + objection handler)

### 📋 Paste into Claude Code:
```
You are my sales strategist acting as Team Lead.

First, ask me:
1. Paste the sales call transcript or describe the conversation.
2. Client's industry and company size?
3. Target deal size?
4. Your delivery timeline estimate?
5. Pricing format: fixed / monthly retainer / milestone-based?

Then create an Agent Team with 2 teammates:

TeamCreate: "proposal-[client-name]"

Teammate 1 — "proposal-writer"
Task: Draft a fully tailored proposal using the client's exact words where possible.
Structure:
1. Executive Summary (2 sentences — mirror the client's language back)
2. Their Problem (as they described it, not as we interpreted it)
3. Our Solution (specific to their situation)
4. Scope of Work (3–5 bullet points, time-boxed)
5. Deliverables (format + timeline)
6. Investment (Good / Better / Best pricing tiers)
7. Why Us (specific proof, no generic claims)
8. Next Steps (single CTA: "Reply YES to reserve your spot")
Message objection-handler with the 3 biggest hesitations the client expressed.
Save to /outputs/proposal_[client].md

Teammate 2 — "objection-handler"
Wait for hesitations from proposal-writer.
Then produce:
- Objection handling cheat sheet (top 5 objections + specific responses)
- 1x follow-up email (to send 48h after proposal if no reply)
- 1x "closing nudge" message (friendly short message for day 5)
Append all to /outputs/proposal_[client].md

Team Lead: Review the compiled proposal. Ask me: "Proposal ready. Want me to adjust pricing tiers or any section before you send?"
```

### ✅ Output: `proposal_[client].md` with follow-up sequence

---

## PHASE 6 — DAILY OPERATING ROUTINE
**Goal:** Run the full one-person business loop in one focused daily session.
**Team setup:** Varies by business phase — Lead spins up lightweight teams as needed.

### 📋 Paste into Claude Code:
```
Run my daily AI business routine. I use Agent Teams. Act as Team Lead.

First, ask me:
1. Business phase today?
   (A) Pre-launch — still building
   (B) Launch week
   (C) Post-launch — growing MRR
   (D) Closing active deals
2. Any blockers or priorities to address first?

Then run these blocks in sequence. Pause and ask my approval between each:

--- MORNING: MARKET PULSE (15 min) ---
TeamCreate: "daily-research"
Teammate 1 — "market-watcher": Search for new competitor moves, community posts, trends in our niche (read product_brief.md for context). Output: 3-bullet "Market Pulse" summary.
Save to /outputs/daily_summary_[today's date].md

--- MID-MORNING: BUILD SPRINT ---
Ask me: "What is the single most important thing to build or fix today?"
TeamCreate: "daily-build"
Spawn teammates based on what I answer (e.g. frontend + backend if it's a feature; single reviewer if it's a bug).
Run ONE focused sprint. Teammates coordinate directly on any cross-cutting changes.
Append progress to daily summary.

--- AFTERNOON: CONTENT (20 min) ---
TeamCreate: "daily-content"
Teammate 1 — "post-writer": Take today's build progress (from daily summary) and write 1x post (X/LinkedIn).
Teammate 2 — "script-writer": Write 1x short video script based on same update. Coordinate with post-writer for consistency.
Teammate 3 — "thumbnail-designer": Write 1x thumbnail brief.
Save to /outputs/content_[today's date].md
Ask me: "Content ready — approve to schedule?"

--- EVENING: OUTREACH / PROPOSALS ---
Ask me: "Do you have a new lead to proposal, or should I write outreach DMs?"
If lead: run Phase 5 flow (proposal team).
If no lead:
TeamCreate: "daily-outreach"
Teammate 1 — "prospect-researcher": Find 3 new target prospects matching our ideal customer profile.
Teammate 2 — "dm-writer": Write 3 personalized outreach DMs using prospect research. Coordinate directly with prospect-researcher.
Save to /outputs/outreach_[today's date].md

Team Lead: End of day — append to daily summary:
- What shipped today
- What's next
- One risk to watch
```

---

## 📁 FILE STRUCTURE

There are two distinct folder structures: the **playbook** (reusable template) and each **project** (specific product).

### Playbook Folder (this folder — reusable template)
```
1-Person AI Business Playbook/
  docs/
    ONE_PERSON_AI_BUSINESS_WORKFLOW.md  <-- This file (the workflow)
    references/                         <-- Design reference screenshots for Step 0.1
  outputs/                              <-- Phase 1 outputs (before project folder exists)
    phase1_idea_validation.md
  DISTRIBUTION_PLAYBOOK.md              <-- Six-engine go-to-market framework
  .claude/
    settings.json                       <-- Agent Teams config
```

### Project Starter Template (shared infrastructure)
```
project-starter/                        <-- Copy from here when creating new projects
  .claude/
    agents/                             <-- build-validator, code-review, design-review, security-review
    commands/                           <-- /code-review, /design-review, /security-review, /plan, /learn
    skills/                             <-- brand-guidelines, design-pipeline, reviews, plan, learn
    settings.json
  .github/workflows/
    deploy.yml.template                 <-- Metanet FTP zero-downtime deploy (customize subdomain)
    keep-alive.yml.template             <-- Supabase free-tier ping (every 2 days)
    code-review.yml                     <-- Automated PR code review
    design-review.yml                   <-- Automated PR design review
    security-review.yml                 <-- Automated PR security review
  supabase/functions/_shared/
    auth.template.ts                    <-- JWT auth + admin/user client factory
    cors.template.ts                    <-- Dynamic CORS with origin allowlist
  context/
    design-principles.md                <-- Customizable design checklist
    style-guide.md                      <-- Customizable brand style guide
  public/
    .htaccess.template                  <-- SPA routing for Apache/Metanet
  CLAUDE.md.template                    <-- Base CLAUDE.md with all standard sections
```

> **Rule:** The playbook folder never contains project-specific artifacts (design tokens, design briefs, brand skills, brand books, Stitch exports). Those are created inside each project's own folder.

### Project Folder (created per product — e.g. `/c/Business/Internal Projects/[Product Name]/`)
```
[Product Name]/
  brand-book.html                       <-- Standalone HTML brand book
  stitch-*.html                         <-- Approved Stitch screen references
  docs/
    Credentials.txt                     <-- All credentials, API keys, URLs (created in Phase 2.5, NEVER committed to git)
    DESIGN_BRIEF.md                     <-- Brand direction + anti-slop rules
    design-tokens.json                  <-- Canonical tokens (absolute truth)
    DESIGN_SYSTEM.md                    <-- Human-readable design spec
  outputs/
    product_brief.md
    offer_design.md
    marketing_week1.md
  .env.local                            <-- Environment variables for dev (created in Phase 2.5, NEVER committed to git)
  src/                                  <-- Frontend (React + TypeScript + Vite + Tailwind)
  supabase/
    functions/                          <-- Edge Functions (Deno)
      _shared/                          <-- auth.ts, cors.ts, email.ts
      [function-name]/index.ts
    migrations/                         <-- SQL migrations (run in Supabase SQL editor)
  public/
    .htaccess                           <-- SPA routing for Metanet
  .claude/
    settings.json
    agents/                             <-- build-validator, code-review, design-review, security-review
    commands/                           <-- /code-review, /design-review, /security-review, /plan
    skills/brand-guidelines/
      SKILL.md                          <-- Auto-enforced during all frontend work
  .github/workflows/
    deploy.yml                          <-- Metanet FTP zero-downtime deploy
    keep-alive.yml                      <-- Supabase free-tier ping
  context/
    design-principles.md
    style-guide.md
  CLAUDE.md                             <-- Project-specific rules and verification loop
```

---

## 🔁 WORKFLOW DECISION TREE
```
New business idea?
  └─> PHASE 1 (Idea Validation — runs in PLAYBOOK folder)
      └─> Create new project folder? (Y/N)
          └─> PHASE 2 (Brief + Offer — runs in PROJECT folder)
              └─> PHASE 2.5 (Bootstrap — credentials, infra, CI/CD)
                  └─> PHASE 3 Step 0: /design-pipeline (Stitch screen mockups + HTML brand book + design tokens)
                      └─> PHASE 3 Sprints 1-4 (MVP Build — 4-agent teams)
                          └─> PHASE 4 (Marketing — 3-agent team, repeat weekly)
                              └─> PHASE 5 (Proposals — 2-agent team, per deal)
                                  └─> PHASE 6 (Daily Routine — lightweight teams, every day)

Already have an idea?     → Create project folder, then start at PHASE 2
Already have a product?   → Start at PHASE 4 (in project folder)
Hot lead right now?       → Run PHASE 5 standalone
Just need today's loop?   → Run PHASE 6
Need a design system?     → Run /design-pipeline standalone
Existing project missing Credentials.txt? → Run PHASE 2.5 standalone to backfill
```

> **Folder rule:** Phase 1 always runs in the playbook folder. Phases 2–6 always run in the dedicated project folder.

---

## 💡 AGENT TEAMS TIPS

**Ctrl+T** — View the shared task list at any time to see what each teammate is doing.

**tmux panes** — If you have tmux installed, each teammate appears in its own terminal pane. You can type directly into any pane to redirect a specific agent without going through the lead.

**Token cost warning** — Agent Teams use significantly more tokens than a single session. For simple single-file tasks, use a regular Claude Code session instead. Use teams when work genuinely spans multiple layers (frontend + backend + tests).

**Context tip** — Teammates don't inherit the lead's conversation history. Always include relevant file paths in spawn prompts so teammates load the right context (they auto-load CLAUDE.md and MCP servers, but not prior chat).

**Shutdown order** — Always shut down teammates before running cleanup. Never have a teammate run cleanup.

---

## ⏰ SCHEDULING — PUT THE PLAYBOOK ON AUTOPILOT

> Released March 7, 2026. Two flavors — pick the right one for each task.

### The Two Scheduling Tools

| | `/loop` + Cron (CLI) | Desktop Scheduled Tasks |
|---|---|---|
| **Where** | Claude Code terminal session | Claude Desktop app (macOS/Windows) |
| **Survives restart?** | ❌ Dies when you close terminal | ✅ Persistent across restarts |
| **Max duration** | 3 days (auto-expires) | Indefinite |
| **Best for** | In-session polling, deploy checks | Daily/weekly recurring business tasks |
| **Setup** | Type `/loop` in Claude Code | Click "Scheduled" in Desktop sidebar |

---

### 🔄 SESSION-SCOPED: `/loop` (Claude Code CLI)

Use this during active work sessions for real-time monitoring and in-session automation.

**Syntax:**
```
/loop [interval] [prompt or slash command]
```

**Practical examples for this playbook:**

```bash
# Phase 3 — Monitor a deployment while you work on something else
/loop 5m check if the deploy at localhost:3000 is healthy and report any errors

# Phase 3 — Auto-review PRs as they come in during a sprint
/loop 15m /review-pr check for any open PRs and flag issues directly to the relevant teammate

# Phase 4 — Check if scheduled posts went live
/loop 30m check if today's content in /outputs/content_[today].md has been published and confirm

# Phase 1 — Poll for new Product Hunt launches during research
/loop 1h check Product Hunt for any new launches in our niche and append findings to /outputs/phase1_idea_validation.md

# General — One-time reminder (fires once, then deletes itself)
remind me at 5pm to review and approve today's outreach DMs before sending
```

**Rules to know:**
- Default interval if you omit it: every 10 minutes
- Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days)
- Max 50 scheduled tasks per session
- Auto-expires after 3 days — recreate if needed
- Tasks run between your turns, not while Claude is responding
- No catch-up: if Claude was busy when a task was due, it fires once when idle

---

### 📅 PERSISTENT: Desktop Scheduled Tasks

Use this for recurring business automation that should run every day or week, with or without an active session.

**Setup:** Open Claude Desktop → click **"Scheduled"** in the left sidebar → **"+ New task"**

**Where prompts are stored:** `~/.claude/scheduled-tasks/<task-name>/SKILL.md`

> ⚠️ Requires computer to be awake and Claude Desktop open. If the machine is asleep, it runs automatically once you wake it.

---

### 🗓️ RECOMMENDED SCHEDULE FOR THIS PLAYBOOK

Set these up once in Claude Desktop and let them run automatically:

**Every weekday at 7:30am — Morning Market Pulse**
```
Read /outputs/product_brief.md to understand our niche.
Search for: new competitor moves, relevant Reddit/community posts, and trending topics in our market from the last 24 hours.
Write a 3-bullet "Market Pulse" summary.
Append it to /outputs/daily_summary_[today's date].md
```

**Every Sunday at 9:00am — Weekly Marketing Refresh**
```
Read /outputs/phase1_idea_validation.md, /outputs/product_brief.md, and last week's marketing files.
Generate a new 7-day content calendar:
- 7x short-form posts (X/LinkedIn)
- 7x video scripts (60–90 sec)
- 7x thumbnail briefs
Use the customer pain language from phase1_idea_validation.md. Write like a founder, not a copywriter.
Save to /outputs/marketing_week_[YYYY-MM-DD].md
```

**Every weekday at 6:00pm — Outreach Pipeline**
```
Read /outputs/product_brief.md and /outputs/phase1_idea_validation.md.
Find 3 new target prospects matching our ideal customer profile.
Write 3 personalized B2B outreach DMs — use the exact pain language from phase1_idea_validation.md.
Save to /outputs/outreach_[today's date].md
```

**Every Friday at 4:00pm — Weekly Business Review**
```
Read all files created this week in /outputs/.
Summarize:
- What shipped (features, content, outreach sent)
- MRR/revenue progress (if any deal files exist)
- Top 3 things to prioritize next week
- One risk to watch
Save to /outputs/weekly_review_[YYYY-MM-DD].md
```

**Every Monday at 8:00am — Competitor Check**
```
Read /outputs/product_brief.md.
Search for any product updates, pricing changes, or new features from our top competitors in the last 7 days.
Flag anything we should react to.
Append to /outputs/daily_summary_[today's date].md
```

---

### 🔗 COMBINING SCHEDULING WITH AGENT TEAMS

For the most powerful automation, trigger an Agent Team from a scheduled task:

```
# In your Desktop scheduled task prompt:
You are Team Lead. Today is [date].

Create an Agent Team "weekly-marketing":
  Teammate 1 — research new customer pain posts from Reddit this week
  Teammate 2 — write 7 posts using findings from teammate 1
  Teammate 3 — write 7 video scripts consistent with teammate 2's posts

Compile all outputs to /outputs/marketing_week_[today].md
```

This runs every Sunday without you touching anything — a full 3-agent marketing team fires automatically.

---

### ⚡ QUICK REFERENCE: WHICH SCHEDULER TO USE

| Task | Use |
|---|---|
| Monitor a deploy during a sprint | `/loop 5m` |
| Check if build tests pass | `/loop 2m` |
| Daily morning market brief | Desktop Scheduled Task (7:30am daily) |
| Weekly content calendar | Desktop Scheduled Task (Sunday 9am) |
| Auto outreach DMs | Desktop Scheduled Task (weekdays 6pm) |
| Remind yourself mid-session | `/loop` one-shot reminder |
| Weekly business review | Desktop Scheduled Task (Friday 4pm) |

---

*Built for: Predivo GmbH / Roger*
*Features: Claude Code Agent Teams (v2.1.32+, Opus 4.6 required) + Scheduling (/loop + Desktop, v2.1.32+)*
*Last updated: 2026-03-18 — synced with project-starter template, Supabase patterns, Metanet deploy workflow*
