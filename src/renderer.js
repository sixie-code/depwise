/**
 * Render dependency health reports to console or JSON.
 */

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function c(color, text) {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function riskBadge(risk) {
  switch (risk) {
    case 'critical': return c('red', '● CRITICAL');
    case 'warning': return c('yellow', '◐ WARNING ');
    case 'healthy': return c('green', '○ HEALTHY ');
    default: return risk;
  }
}

function scoreBar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  const color = score >= 70 ? 'green' : score >= 40 ? 'yellow' : 'red';
  return c(color, '█'.repeat(filled)) + c('dim', '░'.repeat(empty)) + ` ${score}`;
}

function sortResults(results, field) {
  const sorted = [...results];
  switch (field) {
    case 'score':
      sorted.sort((a, b) => a.composite - b.composite); // worst first
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'risk':
      const riskOrder = { critical: 0, warning: 1, healthy: 2 };
      sorted.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
      break;
    default:
      sorted.sort((a, b) => a.composite - b.composite);
  }
  return sorted;
}

function filterResults(results, risk) {
  if (!risk) return results;
  return results.filter((r) => r.risk === risk);
}

export function renderReport(results, options = {}) {
  if (options.json) {
    const output = {
      project: options.projectName,
      scanned: options.scannedDeps,
      total: options.totalDeps,
      timestamp: new Date().toISOString(),
      summary: {
        critical: results.filter((r) => r.risk === 'critical').length,
        warning: results.filter((r) => r.risk === 'warning').length,
        healthy: results.filter((r) => r.risk === 'healthy').length,
        averageScore: Math.round(results.reduce((sum, r) => sum + r.composite, 0) / results.length),
      },
      dependencies: results.map((r) => ({
        name: r.name,
        version: r.version,
        score: r.composite,
        risk: r.risk,
        reasons: r.reasons,
        scores: r.scores,
        downloads: r.downloads,
        lastPublish: r.lastPublish,
        maintainerCount: r.maintainerCount,
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  let display = sortResults(results, options.sort);
  display = filterResults(display, options.filter);

  if (display.length === 0) {
    console.log(`  No dependencies match filter "${options.filter}"\n`);
    return;
  }

  // Summary header
  const critical = results.filter((r) => r.risk === 'critical').length;
  const warning = results.filter((r) => r.risk === 'warning').length;
  const healthy = results.filter((r) => r.risk === 'healthy').length;
  const avgScore = Math.round(results.reduce((s, r) => s + r.composite, 0) / results.length);

  console.log(c('bold', '  ─── Summary ───────────────────────────────────────'));
  console.log(`  ${c('green', `${healthy} healthy`)}  ${c('yellow', `${warning} warning`)}  ${c('red', `${critical} critical`)}  avg score: ${avgScore}/100`);
  console.log(c('bold', '  ──────────────────────────────────────────────────\n'));

  // Individual results
  for (const dep of display) {
    const nameStr = dep.name.padEnd(35);
    console.log(`  ${riskBadge(dep.risk)}  ${c('bold', nameStr)} ${scoreBar(dep.composite)}`);

    if (options.verbose && dep.scores) {
      console.log(c('dim', `${''.padStart(14)}maintenance: ${dep.scores.maintenance}  popularity: ${dep.scores.popularity}  security: ${dep.scores.security}  maturity: ${dep.scores.maturity}  quality: ${dep.scores.quality}`));
    }

    if (dep.reasons.length > 0 && dep.risk !== 'healthy') {
      for (const reason of dep.reasons) {
        console.log(c('dim', `${''.padStart(14)}→ ${reason}`));
      }
    }
  }

  // Footer
  console.log('');
  console.log(c('dim', `  Scanned ${options.scannedDeps} of ${options.totalDeps} dependencies`));

  if (options.scannedDeps < options.totalDeps) {
    console.log('');
    console.log(c('cyan', '  ┌─────────────────────────────────────────────────┐'));
    console.log(c('cyan', '  │') + '  Upgrade to ' + c('bold', 'depwise Pro') + ' for unlimited scans,     ' + c('cyan', '│'));
    console.log(c('cyan', '  │') + '  CI integration, and team reports.              ' + c('cyan', '│'));
    console.log(c('cyan', '  │') + '  → ' + c('bold', 'https://depwise.dev/pro') + '                      ' + c('cyan', '│'));
    console.log(c('cyan', '  └─────────────────────────────────────────────────┘'));
  }

  console.log('');
}
