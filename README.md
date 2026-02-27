# depwise

> Intelligent dependency health scanner for npm projects.

Know which packages in your project are thriving, abandoned, or risky — before they become a problem.

## Why depwise?

`npm audit` only catches reported CVEs. `npm outdated` just lists version numbers. Neither tells you:

- Is this package still actively maintained?
- How many maintainers does it have (bus factor)?
- Is it likely to be abandoned?
- What's the overall health trajectory?

**depwise** gives you a composite health score for every dependency, combining maintenance activity, popularity, security signals, maturity, and code quality indicators.

## Install

```bash
npm install -g depwise
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

## Data Sources

depwise uses publicly available data from:
- npm registry API
- npm downloads API

No API keys required. No data leaves your machine except standard registry queries.

## License

MIT
