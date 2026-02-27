import https from 'node:https';

/**
 * Fetch JSON from a URL using raw https (zero dependencies).
 */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode === 404) {
        resolve(null);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${url}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

/**
 * Get package metadata from the npm registry.
 */
async function fetchNpmData(name) {
  const encoded = encodeURIComponent(name);
  const data = await fetchJson(`https://registry.npmjs.org/${encoded}`);
  if (!data) return null;

  const latest = data['dist-tags']?.latest;
  const latestVersion = latest ? data.versions?.[latest] : null;
  const time = data.time || {};

  // Get all version timestamps for release frequency calculation
  const versionDates = Object.entries(time)
    .filter(([k]) => k !== 'created' && k !== 'modified')
    .map(([ver, date]) => ({ version: ver, date: new Date(date) }))
    .sort((a, b) => b.date - a.date);

  return {
    name: data.name,
    latest,
    description: data.description,
    license: latestVersion?.license || data.license,
    homepage: data.homepage,
    repository: data.repository?.url,
    maintainers: data.maintainers || [],
    created: time.created ? new Date(time.created) : null,
    lastPublish: time.modified ? new Date(time.modified) : null,
    versionCount: Object.keys(data.versions || {}).length,
    versionDates,
    keywords: data.keywords || [],
    deprecated: latestVersion?.deprecated || data.versions?.[latest]?.deprecated || null,
    dependencies: Object.keys(latestVersion?.dependencies || {}),
    hasTypes: !!(latestVersion?.types || latestVersion?.typings || data.name.startsWith('@types/')),
  };
}

/**
 * Get package data from deps.dev (Google's Open Source Insights).
 */
async function fetchDepsDevData(name) {
  const encoded = encodeURIComponent(name);
  try {
    const data = await fetchJson(
      `https://api.deps.dev/v3alpha/systems/npm/packages/${encoded}`
    );
    return data;
  } catch {
    return null;
  }
}

/**
 * Get download counts from the npm API.
 */
async function fetchDownloads(name) {
  const encoded = encodeURIComponent(name);
  try {
    const [lastWeek, lastMonth] = await Promise.all([
      fetchJson(`https://api.npmjs.org/downloads/point/last-week/${encoded}`),
      fetchJson(`https://api.npmjs.org/downloads/point/last-month/${encoded}`),
    ]);
    return {
      weekly: lastWeek?.downloads || 0,
      monthly: lastMonth?.downloads || 0,
    };
  } catch {
    return { weekly: 0, monthly: 0 };
  }
}

/**
 * Scan a single dependency.
 */
async function scanOne(name) {
  const [npm, downloads] = await Promise.all([
    fetchNpmData(name),
    fetchDownloads(name),
  ]);

  if (!npm) {
    return {
      name,
      found: false,
      error: 'Package not found on npm registry',
    };
  }

  const now = new Date();
  const daysSinceLastPublish = npm.lastPublish
    ? Math.floor((now - npm.lastPublish) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate release frequency (releases per month over last year)
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentReleases = npm.versionDates.filter((v) => v.date > oneYearAgo);
  const releasesPerMonth = recentReleases.length / 12;

  return {
    name,
    found: true,
    version: npm.latest,
    description: npm.description,
    license: npm.license,
    deprecated: npm.deprecated,
    maintainerCount: npm.maintainers.length,
    maintainers: npm.maintainers.map((m) => m.name),
    created: npm.created?.toISOString(),
    lastPublish: npm.lastPublish?.toISOString(),
    daysSinceLastPublish,
    versionCount: npm.versionCount,
    releasesPerMonth: Math.round(releasesPerMonth * 10) / 10,
    recentReleaseCount: recentReleases.length,
    downloads,
    directDependencies: npm.dependencies.length,
    hasTypes: npm.hasTypes,
    homepage: npm.homepage,
    repository: npm.repository,
  };
}

/**
 * Scan all dependencies with concurrency control.
 */
export async function scanDependencies(names, onProgress) {
  const results = [];
  const concurrency = 6;

  for (let i = 0; i < names.length; i += concurrency) {
    const batch = names.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (name, j) => {
        onProgress?.(name, i + j, names.length);
        try {
          return await scanOne(name);
        } catch (err) {
          return { name, found: false, error: err.message };
        }
      })
    );
    results.push(...batchResults);
  }

  return results;
}
