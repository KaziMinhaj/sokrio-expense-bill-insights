// Hierarchy parser for TA/DA Insights
// Arrow separator: U+27A1 optionally followed by U+FE0F
import type { ParsedHierarchy } from '../types';

const ARROW_RE = /\u27A1\uFE0F?/;

/** Strip U+FE0F variation selector and trim whitespace */
function clean(s: string): string {
  return s.replace(/\uFE0F/g, '').trim();
}

/**
 * Test if a part represents a regional head.
 * Pattern: contains "(<region>)" where <region> matches (case-insensitive,
 * internal spaces tolerated) the region name.
 */
function isRegionalHead(part: string, region: string): boolean {
  // Build a loose pattern: region words separated by \s*
  const regionWords = region.trim().split(/\s+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\(\\s*${regionWords.join('\\s*')}\\s*\\)`, 'i');
  return pattern.test(part);
}

export function parseHierarchy(raw: string): ParsedHierarchy {
  const parts = raw.split(ARROW_RE).map(clean).filter(Boolean);

  const country = parts[0] ?? '-';
  const national = parts[1] ?? '-';
  const nationalHead = parts[2] ?? '-';
  const region = parts[3] ?? '-';

  let idx = 4;
  let regionalHead = '-';

  // Check if parts[4] is a regional head (contains (<region>))
  if (idx < parts.length && isRegionalHead(parts[idx], region)) {
    regionalHead = parts[idx];
    idx++;
  }

  // area
  const areaRaw = idx < parts.length ? parts[idx] : '-';
  // We need to determine if this is truly an area or something else.
  // After regional head check, next is always area (if it exists)
  const area = areaRaw !== undefined ? areaRaw : '-';
  idx++;

  const areaLabel = area !== '-' ? `${area} . ${region}` : '-';

  // area manager
  const areaManager = idx < parts.length ? parts[idx] : '-';
  idx++;

  // territory and officer
  let territory = '-';
  let territoryLabel = '-';
  let officer = '-';

  if (idx < parts.length) {
    // If there are at least 2 more parts, next is territory then officer
    if (idx + 1 < parts.length) {
      territory = parts[idx];
      territoryLabel = territory !== '-' ? `${territory} . ${area}` : '-';
      idx++;
      officer = parts[idx]; // last
    } else {
      // Only 1 part left: it's the officer (TSO directly under ASM, no territory)
      officer = parts[idx];
    }
  } else {
    // No parts left — the person IS the area manager or above
    // Officer = the last meaningful person we found
    if (areaManager !== '-') {
      officer = areaManager;
      // Shift: areaManager is also the officer in this case
    } else if (area !== '-') {
      officer = area;
    } else {
      officer = regionalHead !== '-' ? regionalHead : nationalHead;
    }
  }

  return {
    country,
    national,
    nationalHead,
    region,
    regionalHead,
    area,
    areaLabel,
    areaManager,
    territory,
    territoryLabel,
    officer,
  };
}
