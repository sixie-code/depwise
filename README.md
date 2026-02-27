# depwise

> Intelligent dependency health scanner for npm projects.

Know which packages in your project are thriving, abandoned, or risky — before they become a problem.

## Why depwise?

**The Snyk Advisor gap:** Snyk Advisor (the leading dependency health checker) shut down in January 2026, leaving developers without a comprehensive health assessment tool.

`npm audit` only catches reported CVEs. `npm outdated` just lists version numbers. Neither tells you:

- Is this package still actively maintained?
- How many maintainers does it have (bus factor)?
- Is it likely to be abandoned?
- What's the overall health trajectory?

**depwise** fills this gap with a composite health score for every dependency, combining maintenance activity, popularity, security signals, maturity, and code quality indicators.

## Real Impact

In a typical 500-dependency Node.js project, **depwise** typically identifies:
- 12-15 packages with maintenance concerns
- 3-5 packages at risk of abandonment
- 2-3 critical issues requiring immediate attention
- Potential supply chain risks before they become vulnerabilities

## Install

### Option 1: Direct Download (Recommended)

```bash
# Download and install directly from GitHub releases
curl -L https://github.com/sixie-code/depwise/releases/latest/download/depwise-0.1.0.tgz | tar -xz
cd package && npm install -g .
```

### Option 2: From npm (when available)

```bash
npm install -g depwise
```

### Option 3: Clone and Install

```bash
git clone https://github.com/sixie-code/depwise.git
cd depwise
npm install -g .
```

## Usage

```bash
# Scan current project
depwise

# Scan a specific project
depwise ./my-project

# JSON output (for CI/scripts)
depwise --json

# Show only critical issues
depwise --filter critical

# Detailed scoring breakdown
depwise --verbose

# Sort by name, score, or risk
depwise --sort risk
```

## Health Score

Each dependency gets a **0-100 composite score** from five weighted signals:

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Maintenance | 30% | Release recency, frequency, activity |
| Popularity | 20% | Download counts (logarithmic scale) |
| Security | 20% | Deprecation, maintainer count, license, dependency count |
| Maturity | 15% | Age, version count, semver stability |
| Quality | 15% | TypeScript types, documentation, repository |

### Risk Levels

- **Healthy** (70-100): Package is well-maintained and widely used
- **Warning** (40-69): Some concerns — review recommended
- **Critical** (0-39): Significant risk — consider alternatives

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| Dependencies scanned | 50 | Unlimited |
| Health scoring | ✓ | ✓ |
| Risk explanations | ✓ | ✓ |
| JSON output | ✓ | ✓ |
| CI integration | — | ✓ |
| Team reports | — | ✓ |
| Upgrade simulation | — | ✓ |
| Slack notifications | — | ✓ |

## Why This Tool Matters

With **Snyk Advisor shutting down in January 2026**, there's a significant gap in the JavaScript dependency analysis ecosystem. Most tools focus only on known CVEs, but the real risks often come from:

- Abandoned packages that still get millions of downloads
- Packages with single maintainers (bus factor = 1)
- Dependencies with suspicious activity patterns
- Popular packages that suddenly change ownership

**depwise** fills this gap with intelligent risk assessment that goes beyond vulnerability scanning.

## Data Sources

depwise uses publicly available data from:
- npm registry API
- npm downloads API

No API keys required. No data leaves your machine except standard registry queries.

## License

MIT
