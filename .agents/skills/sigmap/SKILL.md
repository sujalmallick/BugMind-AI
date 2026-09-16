---
name: sigmap
description: Deterministic, zero-dependency codebase signature and evidence map. Use whenever you need to know where code, functions, classes, API routes, or features are located across the BugMind AI codebase without searching or scanning all files. Provides ~97% token reduction and instant AST-grounded file locations.
---

# SigMap Codebase Grounding Skill

Use SigMap (`https://github.com/manojmallick/sigmap` by Manoj Mallick) to find code locations, symbols, and dependencies in BugMind AI in seconds without reading entire files or performing brute-force greps.

## Quick Usage

### 1. Ranked Query (Where is code handled?)
Run this to get the top files, line anchors, and exported functions/classes matching any topic:
```powershell
npx --yes sigmap --query "<query>" --top 5 --json
```

Examples:
- `npx --yes sigmap --query "authentication jwt token login" --top 3 --json`
- `npx --yes sigmap --query "byok encryption api key" --top 3 --json`
- `npx --yes sigmap --query "test case generation workflow graph" --top 3 --json`
- `npx --yes sigmap --query "avatar profile image upload" --top 3 --json`

### 2. File Impact & Callers
To see what files and routes are impacted when changing a specific file:
```powershell
npx --yes sigmap --impact "<relative_path>" --json
```

### 3. Read Direct Signatures Map
View the pre-generated AST signature map directly in:
`.github/copilot-instructions.md`

### 4. Regenerate Map After Major Changes
If you add multiple new files or change many function signatures, refresh the map:
```powershell
npx --yes sigmap
```
