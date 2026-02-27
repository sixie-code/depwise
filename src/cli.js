import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scanDependencies } from './scanner.js';
import { scoreDependencies } from './scorer.js';
import { renderReport } from './renderer.js';

const FREE_TIER_LIMIT = 50;

const HELP = `
depwise — Intelligent dependency health scanner

Usage:
  depwise [options] [path]

Options:
  --json          Output as JSON
  --sort <field>  Sort by: score, name, risk (default: score)
  --filter <risk> Show only: critical, warning, healthy
  --verbose       Show detailed scoring breakdown
  --help          Show this help
  --version       Show version

Examples:
  depwise                  Scan current directory
  depwise ./my-project     Scan a specific project
  depwise --json           Machine-readable output
  depwise --filter critical Show only critical dependencies
`;

export async function run(args) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    console.log(pkg.version);
    return;
  }

  const jsonOutput = args.includes('--json');
  const verbose = args.includes('--verbose');

  let sortField = 'score';
  const sortIdx = args.indexOf('--sort');
  if (sortIdx !== -1 && args[sortIdx + 1]) {
    sortField = args[sortIdx + 1];
  }

  let filterRisk = null;
  const filterIdx = args.indexOf('--filter');
  if (filterIdx !== -1 && args[filterIdx + 1]) {
    filterRisk = args[filterIdx + 1];
  }

  // Find project path (first arg that's not a flag)
  let projectPath = '.';
  for (const arg of args) {
    if (!arg.startsWith('-') && arg !== sortField && arg !== filterRisk) {
      projectPath = arg;
      break;
    }
  }

  const fullPath = resolve(projectPath);

  // Read package.json
  let packageJson;
  try {
    const raw = await readFile(resolve(fullPath, 'package.json'), 'utf8');
    packageJson = JSON.parse(raw);
  } catch {
    throw new Error(`No package.json found in ${fullPath}`);
  }

  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const depNames = Object.keys(deps);

  if (depNames.length === 0) {
    console.log('No dependencies found in package.json');
    return;
  }

  const isFreeUser = depNames.length > FREE_TIER_LIMIT;
  const scanNames = isFreeUser ? depNames.slice(0, FREE_TIER_LIMIT) : depNames;

  if (!jsonOutput) {
    console.log(`\n  depwise v0.1.0 — Dependency Health Scanner\n`);
    console.log(`  Scanning ${scanNames.length} dependencies in ${packageJson.name || fullPath}...\n`);
    if (isFreeUser) {
      console.log(`  ⚠ Free tier: scanning ${FREE_TIER_LIMIT} of ${depNames.length} dependencies.`);
      console.log(`  ⚠ Upgrade to Pro for unlimited scans: https://depwise.dev/pro\n`);
    }
  }

  // Scan
  const scanResults = await scanDependencies(scanNames, (name, i, total) => {
    if (!jsonOutput) {
      process.stdout.write(`\r  Scanning [${i + 1}/${total}] ${name}...`.padEnd(60));
    }
  });

  if (!jsonOutput) {
    process.stdout.write('\r'.padEnd(70) + '\r');
  }

  // Score
  const scored = scoreDependencies(scanResults);

  // Render
  renderReport(scored, {
    json: jsonOutput,
    verbose,
    sort: sortField,
    filter: filterRisk,
    totalDeps: depNames.length,
    scannedDeps: scanNames.length,
    projectName: packageJson.name || fullPath,
  });
}
