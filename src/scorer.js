/**
 * Health scoring algorithm for npm dependencies.
 *
 * Produces a 0-100 composite health score from weighted signals:
 *   - Maintenance activity (30%): recency of releases, release frequency
 *   - Popularity/adoption (20%): download counts
 *   - Security signals (20%): deprecation, maintainer count, license
 *   - Maturity (15%): age, version count, stability indicators
 *   - Quality (15%): types, homepage/repo presence, dependency count
 */

const WEIGHTS = {
  maintenance: 0.30,
  popularity: 0.20,
  security: 0.20,
  maturity: 0.15,
  quality: 0.15,
};

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

function maintenanceScore(dep) {
  if (!dep.found) return 0;

  let score = 0;

  // Recency of last publish (0-40 points)
  // < 30 days = 40, < 90 days = 35, < 180 days = 25, < 365 days = 15, < 730 days = 5, else 0
  const days = dep.daysSinceLastPublish;
  if (days === null) {
    score += 0;
  } else if (days < 30) {
    score += 40;
  } else if (days < 90) {
    score += 35;
  } else if (days < 180) {
    score += 25;
  } else if (days < 365) {
    score += 15;
  } else if (days < 730) {
    score += 5;
  }

  // Release frequency (0-35 points)
  // > 2/month = 35, > 1/month = 30, > 0.5/month = 20, > 0.1/month = 10, else 0
  const rpm = dep.releasesPerMonth;
  if (rpm > 2) score += 35;
  else if (rpm > 1) score += 30;
  else if (rpm > 0.5) score += 20;
  else if (rpm > 0.1) score += 10;

  // Recent releases in last year (0-25 points)
  const recent = dep.recentReleaseCount;
  if (recent > 12) score += 25;
  else if (recent > 6) score += 20;
  else if (recent > 2) score += 15;
  else if (recent > 0) score += 8;

  return clamp(score);
}

function popularityScore(dep) {
  if (!dep.found) return 0;

  let score = 0;
  const weekly = dep.downloads?.weekly || 0;

  // Weekly downloads (0-100 points, logarithmic scale)
  if (weekly > 10_000_000) score = 100;
  else if (weekly > 1_000_000) score = 90;
  else if (weekly > 100_000) score = 75;
  else if (weekly > 10_000) score = 60;
  else if (weekly > 1_000) score = 40;
  else if (weekly > 100) score = 20;
  else if (weekly > 10) score = 10;

  return clamp(score);
}

function securityScore(dep) {
  if (!dep.found) return 0;

  let score = 80; // Start at 80, deduct for red flags

  // Deprecated = massive penalty
  if (dep.deprecated) score -= 60;

  // Single maintainer = bus factor risk
  if (dep.maintainerCount === 1) score -= 15;
  else if (dep.maintainerCount === 0) score -= 30;
  else if (dep.maintainerCount >= 3) score += 10;

  // License check
  const license = (dep.license || '').toUpperCase();
  const goodLicenses = ['MIT', 'ISC', 'BSD-2-CLAUSE', 'BSD-3-CLAUSE', 'APACHE-2.0', '0BSD'];
  if (!license) score -= 20;
  else if (goodLicenses.some((l) => license.includes(l))) score += 10;

  // Too many direct dependencies = larger attack surface
  if (dep.directDependencies > 20) score -= 15;
  else if (dep.directDependencies > 10) score -= 5;
  else if (dep.directDependencies === 0) score += 10;

  return clamp(score);
}

function maturityScore(dep) {
  if (!dep.found) return 0;

  let score = 0;

  // Age (older = more mature, generally)
  if (dep.created) {
    const ageYears = (Date.now() - new Date(dep.created).getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (ageYears > 5) score += 40;
    else if (ageYears > 3) score += 30;
    else if (ageYears > 1) score += 20;
    else score += 10;
  }

  // Version count (more releases = more refined)
  if (dep.versionCount > 50) score += 35;
  else if (dep.versionCount > 20) score += 25;
  else if (dep.versionCount > 10) score += 20;
  else if (dep.versionCount > 3) score += 10;

  // Has the version stabilized past 1.0?
  const ver = dep.version || '';
  if (ver.match(/^[1-9]\d*\./)) score += 25;
  else if (ver.startsWith('0.')) score += 10;

  return clamp(score);
}

function qualityScore(dep) {
  if (!dep.found) return 0;

  let score = 0;

  // TypeScript types available
  if (dep.hasTypes) score += 30;

  // Has homepage
  if (dep.homepage) score += 20;

  // Has repository
  if (dep.repository) score += 20;

  // Reasonable dependency count (not too many, has some signals careful design)
  if (dep.directDependencies === 0) score += 30;
  else if (dep.directDependencies <= 5) score += 20;
  else if (dep.directDependencies <= 10) score += 10;

  return clamp(score);
}

function riskLevel(score) {
  if (score >= 70) return 'healthy';
  if (score >= 40) return 'warning';
  return 'critical';
}

function riskExplanation(dep, scores) {
  const reasons = [];

  if (dep.deprecated) reasons.push('Package is deprecated');
  if (dep.daysSinceLastPublish > 730) reasons.push(`No release in ${Math.floor(dep.daysSinceLastPublish / 365)} years`);
  else if (dep.daysSinceLastPublish > 365) reasons.push('No release in over a year');
  if (dep.maintainerCount <= 1) reasons.push('Single maintainer (bus factor risk)');
  if (dep.directDependencies > 15) reasons.push(`${dep.directDependencies} direct dependencies (large attack surface)`);
  if (!dep.license) reasons.push('No license specified');
  if (dep.downloads?.weekly < 100) reasons.push('Very low download count');
  if (dep.recentReleaseCount === 0) reasons.push('No releases in the past year');

  if (scores.composite >= 70 && reasons.length === 0) {
    reasons.push('Package appears healthy');
  }

  return reasons;
}

/**
 * Score all scanned dependencies.
 */
export function scoreDependencies(scanResults) {
  return scanResults.map((dep) => {
    if (!dep.found) {
      return {
        ...dep,
        scores: null,
        composite: 0,
        risk: 'critical',
        reasons: [dep.error || 'Package not found'],
      };
    }

    const scores = {
      maintenance: Math.round(maintenanceScore(dep)),
      popularity: Math.round(popularityScore(dep)),
      security: Math.round(securityScore(dep)),
      maturity: Math.round(maturityScore(dep)),
      quality: Math.round(qualityScore(dep)),
    };

    const composite = Math.round(
      scores.maintenance * WEIGHTS.maintenance +
      scores.popularity * WEIGHTS.popularity +
      scores.security * WEIGHTS.security +
      scores.maturity * WEIGHTS.maturity +
      scores.quality * WEIGHTS.quality
    );

    const risk = riskLevel(composite);
    const reasons = riskExplanation(dep, { ...scores, composite });

    return {
      ...dep,
      scores,
      composite,
      risk,
      reasons,
    };
  });
}
