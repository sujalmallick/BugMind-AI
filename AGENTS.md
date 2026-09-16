# Project Guidelines for Antigravity

## Codebase Discovery & Navigation with SigMap
- **Never perform blind, brute-force file scanning or broad greps across the repository.**
- Use **SigMap** to pinpoint where files, symbols, functions, classes, and API endpoints are located:
  - Run: `npx --yes sigmap --query "<query>" --top 5 --json`
  - Or check `.github/copilot-instructions.md` for the deterministic AST signature map.
- When planning or modifying any file, check its impact graph:
  - Run: `npx --yes sigmap --impact "<file_path>" --json`
- This ensures maximum speed, grounded accuracy, and ~97% token reduction.
