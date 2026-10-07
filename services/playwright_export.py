"""
services/playwright_export.py — approved scripts → a runnable Playwright project.

Deterministic translation of the structured step model (services/
automation_actions.py) into TypeScript: no model is involved, every string
from a script is emitted as a JSON-escaped literal, and nothing from a script
ever becomes code. Tests run on the user's machine or their own CI, so
BugMind itself never runs a browser (no cost, no server-side browsing).

Each test title carries "[BM-<script id> v<version>]", which is how an
uploaded results report is matched back to scripts and test cases.

Secrets are never exported: every {{vars.NAME}} becomes process.env.NAME,
supplied by the user (a local .env or CI secrets).
"""

import io
import json
import re
import zipfile

from services.automation_actions import referenced_variables

# Exact versions (no ranges): a run never silently picks up an unreviewed release.
# Playwright 1.49+ is needed for locator.ariaSnapshot() (failure snapshots).
PLAYWRIGHT_VERSION = "1.63.0"
# dotenv 17+ prints a banner on every run; 16.x is quiet.
DOTENV_VERSION = "16.6.1"
MAX_SNAPSHOT_CHARS = 30_000
_VAR_REF = re.compile(r"\{\{\s*vars\.([A-Za-z0-9_]+)\s*\}\}")
# An address safe to place in the workflow YAML: scheme, host, optional port, nothing else.
_SAFE_URL = re.compile(r"^https?://[A-Za-z0-9.-]+(:\d{1,5})?$")


def _js(value) -> str:
    """A safe JavaScript literal (JSON is valid JS; escape the separators older parsers dislike)."""
    return json.dumps(value).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def _value_expr(value: str) -> str:
    """"Hello {{vars.NAME}}" → "Hello " + v("NAME")"""
    parts, last = [], 0
    for match in _VAR_REF.finditer(value):
        if match.start() > last:
            parts.append(_js(value[last:match.start()]))
        parts.append(f"v({_js(match.group(1))})")
        last = match.end()
    if last < len(value):
        parts.append(_js(value[last:]))
    return " + ".join(parts) if parts else '""'


def _locator(target: dict) -> str:
    by, value = target["by"], target["value"]
    exact = ", exact: true" if target.get("exact") else ""
    if by == "role":
        options = []
        if target.get("name"):
            options.append(f"name: {_js(target['name'])}")
        if target.get("exact"):
            options.append("exact: true")
        return f"page.getByRole({_js(value)}{', { ' + ', '.join(options) + ' }' if options else ''})"
    if by == "label":
        return f"page.getByLabel({_js(value)}{', {' + exact[1:] + ' }' if exact else ''})"
    if by == "text":
        return f"page.getByText({_js(value)}{', {' + exact[1:] + ' }' if exact else ''})"
    if by == "placeholder":
        return f"page.getByPlaceholder({_js(value)}{', {' + exact[1:] + ' }' if exact else ''})"
    if by == "testid":
        return f"page.getByTestId({_js(value)})"
    return f"page.locator({_js(value)})"


def _statement(step: dict) -> str:
    action = step["action"]
    value = step.get("value", "")
    loc = _locator(step["target"]) if "target" in step else None
    match = step.get("match", "contains")
    if action == "goto":
        return f"await page.goto({_js(value)});"
    if action in ("click", "hover", "check", "uncheck"):
        return f"await {loc}.{action}();"
    if action == "fill":
        return f"await {loc}.fill({_value_expr(value)});"
    if action == "select":
        return f"await {loc}.selectOption({_value_expr(value)});"
    if action == "press":
        return f"await {loc}.press({_js(value)});" if loc else f"await page.keyboard.press({_js(value)});"
    if action == "wait":
        return f"await page.waitForTimeout({int(value)});"
    if action == "expect_visible":
        return f"await expect({loc}).toBeVisible();"
    if action == "expect_hidden":
        return f"await expect({loc}).toBeHidden();"
    if action == "expect_text":
        method = "toHaveText" if match == "equals" else "toContainText"
        return f"await expect({loc}).{method}({_value_expr(value)});"
    if action == "expect_url":
        if match == "equals":
            return f"await expect(page).toHaveURL({_js(value)});"
        return f"await expect(page).toHaveURL(contains({_js(value)}));"
    if action == "expect_title":
        if match == "equals":
            return f"await expect(page).toHaveTitle({_value_expr(value)});"
        return f"await expect(page).toHaveTitle(contains({_value_expr(value)}));"
    if action == "screenshot":
        name = value or "screenshot"
        return f"await page.screenshot({{ path: test.info().outputPath({_js(name + '.png')}) }});"
    raise ValueError(f"unsupported action {action}")


def test_title(script, test_case_code: str | None) -> str:
    prefix = f"{test_case_code} " if test_case_code else ""
    return f"{prefix}{script.name} [BM-{script.id} v{script.version}]"


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "script"


def spec_filename(script) -> str:
    return f"{_slug(script.name)}-{script.id}.spec.ts"


def script_to_spec(script, environment: dict, test_case_code: str | None = None) -> str:
    """One self-contained test file."""
    steps = []
    for index, step in enumerate(script.steps or [], start=1):
        # "[S3] ..." lets an uploaded report say which step failed (self-healing suggestions).
        label = f"[S{index}] " + (step.get("description") or step["action"])
        steps.append(f"  await test.step({_js(label)}, async () => {{\n    {_statement(step)}\n  }});")
    body = "\n".join(steps) or "  // (no steps)"
    variables = sorted(referenced_variables(script.steps or []))
    return f"""// Generated by BugMind AI from automation script #{script.id} (version {script.version}).
// Edit the script in BugMind and export again instead of editing this file by hand.
import {{ test, expect, type Page }} from '@playwright/test';

// Hosts this test may navigate to (from the BugMind environment "{_safe_comment(environment['name'])}").
const ALLOWED_HOSTS: string[] = {_js(environment['allowedDomains'])};

function hostAllowed(host: string): boolean {{
  return ALLOWED_HOSTS.some((pattern) =>
    pattern.startsWith('*.') ? host === pattern.slice(2) || host.endsWith(pattern.slice(1)) : host === pattern);
}}

// Test data comes from environment variables (a local .env file or CI secrets), never from this file.
function v(name: string): string {{
  const value = process.env[name];
  if (value === undefined) throw new Error(`Set the ${{name}} environment variable (see .env.example).`);
  return value;
}}

function contains(text: string): RegExp {{
  return new RegExp(text.replace(/[.*+?^${{}}()|[\\]\\\\]/g, '\\\\$&'));
}}

// Variables this test uses: their values are redacted from failure snapshots.
const VARS: string[] = {_js(variables)};

function redact(text: string): string {{
  for (const name of VARS) {{
    const value = process.env[name];
    if (value && value.length >= 3) text = text.split(value).join(`{{{{vars.${{name}}}}}}`);
  }}
  return text;
}}

// When the test fails, attach what the page looked like (its accessibility tree: roles, names,
// text) so BugMind can suggest corrected steps. Test data is redacted here, on this machine,
// before the results file is written.
test.afterEach(async ({{ page }}, testInfo) => {{
  if (testInfo.status === testInfo.expectedStatus) return;
  try {{
    const snapshot = await page.locator('body').ariaSnapshot({{ timeout: 5000 }});
    await testInfo.attach('bugmind-page', {{
      body: JSON.stringify({{ url: redact(page.url()), snapshot: redact(snapshot).slice(0, {MAX_SNAPSHOT_CHARS}) }}),
      contentType: 'application/json',
    }});
  }} catch {{
    // The page may already be closed: the result still uploads, just without a snapshot.
  }}
}});

async function guardNavigation(page: Page): Promise<void> {{
  // Block top-level navigation away from the allowed hosts, in this page and in any
  // popup or new tab it opens (the route is on the whole browser context).
  await page.context().route('**/*', (route) => {{
    const request = route.request();
    let topLevel = false;
    try {{
      topLevel = request.isNavigationRequest() && request.frame().parentFrame() === null;
    }} catch {{
      // Service-worker requests have no frame: they aren't page navigations.
    }}
    if (topLevel && !hostAllowed(new URL(request.url()).hostname)) {{
      try {{
        // Shown in the report and in BugMind, so the failure that follows is easy to understand.
        test.info().annotations.push({{ type: 'bugmind-blocked-navigation', description: redact(request.url()) }});
      }} catch {{
        // Outside a running test: nothing to annotate.
      }}
      return route.abort('blockedbyclient');
    }}
    return route.continue();
  }});
}}

test({_js(test_title(script, test_case_code))}, async ({{ page }}) => {{
  await guardNavigation(page);
{body}
}});
"""


def _safe_comment(text: str) -> str:
    """Text placed in a // comment: one line, no comment terminators."""
    return re.sub(r"[\r\n\u2028\u2029]+", " ", str(text)).replace("*/", "* /")[:100]


# ── Project archive ──────────────────────────────────────────────────────────

def _config(environment: dict) -> str:
    return f"""import {{ defineConfig, devices }} from '@playwright/test';
import 'dotenv/config';

export default defineConfig({{
  testDir: './tests',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['json', {{ outputFile: 'bugmind-results.json' }}], ['html', {{ open: 'never' }}]],
  use: {{
    baseURL: process.env.BASE_URL || {_js(environment['baseUrl'])},
    // A step whose element isn't there fails after 15s instead of using the whole test timeout.
    actionTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  }},
  projects: [{{ name: 'chromium', use: {{ ...devices['Desktop Chrome'] }} }}],
}});
"""


def _package() -> str:
    return json.dumps({
        "name": "bugmind-e2e-tests",
        "private": True,
        "scripts": {"test": "playwright test", "report": "playwright show-report"},
        "devDependencies": {"@playwright/test": PLAYWRIGHT_VERSION, "dotenv": DOTENV_VERSION},
    }, indent=2) + "\n"


def _env_example(environment: dict, names: list[str]) -> str:
    defined = {v["name"]: v for v in environment.get("variables") or []}
    lines = ["# Copy to .env and fill in. Never commit .env.", f"BASE_URL={environment['baseUrl']}"]
    for name in names:
        var = defined.get(name)
        # Secret values never leave BugMind; non-secret test data is filled in for convenience.
        value = "" if var is None or var["secret"] else (var.get("value") or "")
        lines.append(f"{name}={value}".replace("\n", " "))
    return "\n".join(lines) + "\n"


def _workflow(names: list[str], api_url: str) -> str:
    env_lines = "".join(f"      {name}: ${{{{ secrets.{name} }}}}\n" for name in names)
    return f"""# Runs the BugMind tests on GitHub's free runners in your own repository.
# Add each variable below under Settings → Secrets and variables → Actions.
name: BugMind E2E tests
on:
  workflow_dispatch:
  push:
    branches: [main]
# Least privilege: the job only reads the repository.
permissions:
  contents: read
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    env:
      CI: true
      BASE_URL: ${{{{ vars.BASE_URL }}}}
{env_lines}    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      # Commit package-lock.json after your first local install: CI then installs exactly those versions.
      - run: if [ -f package-lock.json ]; then npm ci; else npm install; fi
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      # Sends the results to BugMind when the BUGMIND_UPLOAD_TOKEN secret is set (an upload token
      # from Automation → Runs: it can only upload results to this project). Without it, upload
      # bugmind-results.json by hand. Runs even when tests failed; never fails the job itself.
      - name: Send results to BugMind
        if: always()
        env:
          BUGMIND_UPLOAD_TOKEN: ${{{{ secrets.BUGMIND_UPLOAD_TOKEN }}}}
          BUGMIND_URL: ${{{{ vars.BUGMIND_URL || '{api_url}' }}}}
        run: |
          if [ -z "$BUGMIND_UPLOAD_TOKEN" ]; then
            echo "BUGMIND_UPLOAD_TOKEN isn't set: upload bugmind-results.json in BugMind by hand."
            exit 0
          fi
          if [ -z "$BUGMIND_URL" ] || [ ! -f bugmind-results.json ]; then
            echo "::warning::Results not sent: set the BUGMIND_URL variable, and check the tests wrote bugmind-results.json."
            exit 0
          fi
          if ! curl --fail-with-body --silent --show-error --max-time 60 \\
              -H "Authorization: Bearer $BUGMIND_UPLOAD_TOKEN" \\
              -F "file=@bugmind-results.json;type=application/json" \\
              "$BUGMIND_URL/automation/runs/upload"; then
            echo "::warning::Could not send the results to BugMind. Upload bugmind-results.json by hand."
          fi
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: bugmind-results
          path: |
            bugmind-results.json
            playwright-report/
"""


def _readme(environment: dict, names: list[str], count: int, api_url: str) -> str:
    variables = "\n".join(f"- `{n}`" for n in names) or "- (none)"
    return f"""# BugMind E2E tests

{count} approved test{'s' if count != 1 else ''} exported from BugMind for the environment
**{_safe_comment(environment['name'])}** ({environment['baseUrl']}).

## Run on your computer

1. Install Node.js 20 or newer.
2. In this folder: `npm install` then `npx playwright install chromium`. Commit the
   `package-lock.json` this creates, so every run (and CI) uses exactly the same versions.
3. Copy `.env.example` to `.env` and fill in the values. Variables used:
{variables}
4. Run `npx playwright test`. `npx playwright show-report` opens the report.

## Run on GitHub Actions (free)

Put this folder in a GitHub repository, add the variables above as repository secrets
(Settings → Secrets and variables → Actions), optionally a `BASE_URL` variable (it must stay
on one of the allowed domains: tests can't navigate anywhere else), then run
the "BugMind E2E tests" workflow. Download the `bugmind-results` artifact when it finishes.

## Send the results to BugMind

Each run writes `bugmind-results.json`. Linked test cases are then marked Passed or Failed
and their assignees are notified. Results from tests whose script changed since this export
are recorded but don't change test case statuses (export again to pick up the changes).

- **Automatically from GitHub Actions:** in BugMind open Automation → Runs → Upload tokens,
  create a token, and add it to this repository as the secret `BUGMIND_UPLOAD_TOKEN`. The
  workflow then sends the results after every run. The token can only upload results to
  this one project; revoke it in BugMind at any time.{'' if api_url else '''
  Also add a repository variable `BUGMIND_URL` with your BugMind API address.'''}
- **By hand:** in BugMind open Automation → Runs → Upload results and choose the file.
"""


def build_project_zip(scripts_with_codes: list[tuple], environment: dict, api_url: str = "") -> bytes:
    """
    [(script, test_case_code)] → a zip of a ready-to-run Playwright project. api_url (BugMind's
    public API address) is the default the workflow sends results to.
    """
    api_url = api_url if _SAFE_URL.match(api_url or "") else ""
    names = sorted({name for script, _ in scripts_with_codes for name in referenced_variables(script.steps or [])})
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for script, code in scripts_with_codes:
            archive.writestr(f"bugmind-e2e/tests/{spec_filename(script)}", script_to_spec(script, environment, code))
        archive.writestr("bugmind-e2e/playwright.config.ts", _config(environment))
        archive.writestr("bugmind-e2e/package.json", _package())
        archive.writestr("bugmind-e2e/.env.example", _env_example(environment, names))
        archive.writestr("bugmind-e2e/.gitignore", ".env\nnode_modules/\ntest-results/\nplaywright-report/\n"
                                                   "bugmind-results.json\n")
        archive.writestr("bugmind-e2e/.github/workflows/bugmind-e2e.yml", _workflow(names, api_url))
        archive.writestr("bugmind-e2e/README.md", _readme(environment, names, len(scripts_with_codes), api_url))
    return buffer.getvalue()
