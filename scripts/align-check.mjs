#!/usr/bin/env node
// Cross-column heading alignment for .op documents.
//
// AI-generated multi-section designs often place each section's first
// subheading at a slightly different global y (each section is laid out
// independently, with no cross-column baseline). The structure tree is fine —
// alignment is pure coordinate arithmetic along the parent chain, so this tool
// measures and repairs it offline without flattening anything.
//
// Usage:
//   node scripts/align-check.mjs <file.op>                 # report only
//   node scripts/align-check.mjs <file.op> --fix           # align to the first section
//   node scripts/align-check.mjs <file.op> --fix --target 901
//
// Exit codes: 0 = aligned or successfully fixed, 1 = misaligned (check mode),
// 2 = usage/IO error.

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const SUBHEADING_MARKER = 'subheading｜';

// Depth-first walk carrying the accumulated global offset.
function walk(node, gx, gy, visit) {
  const x = (node.x ?? 0) + gx;
  const y = (node.y ?? 0) + gy;
  visit(node, x, y);
  for (const child of node.children ?? []) walk(child, x, y, visit);
}

// Section frames are the numbered top-level boards ("01 时空长轴"). Each may
// hold several subheadings (one per content block); the cross-column baseline
// is each section's TOPMOST subheading (min y), not the first in child order.
// Invisible frames are ignored.
export function analyzeSections(doc) {
  const roots = doc.children ?? [];
  const sections = [];
  for (const root of roots) {
    for (const section of root.children ?? []) {
      if (section.type !== 'frame' || !/^\d/.test(String(section.name ?? ''))) continue;
      if (section.visible === false) continue;
      const kids = section.children ?? [];
      const headings = kids.filter(c => String(c.name ?? '').startsWith(SUBHEADING_MARKER));
      if (headings.length === 0) continue;
      const heading = headings.reduce((top, c) => ((c.y ?? 0) < (top.y ?? 0) ? c : top));
      let sectionY = 0;
      walk(root, 0, 0, (n, _x, y) => { if (n === section) sectionY = y; });
      sections.push({
        section,
        sectionName: section.name,
        heading,
        headingName: heading.name,
        headingGlobalY: sectionY + (heading.y ?? 0),
        kids,
      });
    }
  }
  return sections;
}

export function alignmentReport(doc) {
  const sections = analyzeSections(doc);
  if (sections.length === 0) return { sections, aligned: true, baseline: null, drift: [] };
  const baseline = sections[0].headingGlobalY;
  const drift = sections
    .filter(s => s.headingGlobalY !== baseline)
    .map(s => ({ section: s.sectionName, globalY: s.headingGlobalY, delta: s.headingGlobalY - baseline }));
  return { sections, aligned: drift.length === 0, baseline, drift };
}

// Shift everything at or below the section's topmost subheading by `delta`.
// Absolute-positioned children shift directly. A `group` without its own
// x/y is a transparent container whose children share the parent coordinate
// space (bbox derived), so qualifying group children shift instead — this is
// how the engine stores the 宋体标题字形 vector groups. Flow-layout or
// coordinate-less non-group children make the section unfixable and skipped.
export function alignSection(section, delta) {
  const kids = section.children ?? [];
  const headings = kids.filter(c => String(c.name ?? '').startsWith(SUBHEADING_MARKER));
  if (headings.length === 0) return { shifted: 0, skipped: 'no subheading' };
  const unpositioned = kids.filter(k => typeof k.x !== 'number' || typeof k.y !== 'number');
  if (unpositioned.some(k => k.type !== 'group')) {
    return { shifted: 0, skipped: 'flow layout or missing coordinates' };
  }
  const headingY = Math.min(...headings.map(h => h.y ?? 0));
  let shifted = 0;
  const shift = node => {
    if (typeof node.y === 'number') { node.y += delta; shifted++; return; }
    for (const child of node.children ?? []) {
      if (typeof child.y !== 'number' || child.y >= headingY) shift(child);
    }
  };
  for (const kid of kids) {
    if (typeof kid.y === 'number' && kid.y < headingY) continue; // above the baseline stays
    shift(kid);
  }
  return { shifted, skipped: null };
}

// Fix mode: align every section's first subheading to `target` (default: the
// first section's own heading — the reference column). Mutates `doc`.
export function alignDocument(doc, target) {
  const { sections, baseline } = alignmentReport(doc);
  const goal = target ?? baseline;
  if (goal === null) return { changed: false, results: [] };
  const results = [];
  for (const s of sections) {
    const delta = goal - s.headingGlobalY;
    if (delta === 0) { results.push({ section: s.sectionName, delta: 0, shifted: 0, skipped: null }); continue; }
    const r = alignSection(s.section, delta);
    results.push({ section: s.sectionName, delta, ...r });
  }
  return { changed: results.some(r => r.delta !== 0 && r.shifted > 0), results, target: goal };
}

async function main(argv) {
  const file = argv.find(a => !a.startsWith('--'));
  const fix = argv.includes('--fix');
  const targetFlag = argv.indexOf('--target');
  const target = targetFlag !== -1 ? Number(argv[targetFlag + 1]) : undefined;
  if (!file || Number.isNaN(target)) {
    console.error('Usage: node scripts/align-check.mjs <file.op> [--fix [--target <y>]]');
    process.exit(2);
  }
  const doc = JSON.parse(await readFile(file, 'utf8'));
  const report = alignmentReport(doc);
  if (report.sections.length === 0) {
    console.log('No numbered section frames with subheading｜ children found; nothing to check.');
    process.exit(0);
  }
  console.log(`Sections: ${report.sections.length}, baseline (first section) global y = ${report.baseline}`);
  for (const s of report.sections) {
    const mark = s.headingGlobalY === report.baseline ? 'ok ' : 'OFF';
    console.log(`  [${mark}] ${s.sectionName}: heading global y = ${s.headingGlobalY} (delta ${s.headingGlobalY - report.baseline})`);
  }
  if (!fix) {
    if (report.aligned) { console.log('All headings share one baseline.'); process.exit(0); }
    console.log('Misaligned. Re-run with --fix to align (a .align-backup copy is kept).');
    process.exit(1);
  }
  const backup = `${file.replace(/\.op$/, '')}.align-backup-${Date.now()}.op`;
  await copyFile(file, backup);
  const result = alignDocument(doc, target);
  await writeFile(file, JSON.stringify(doc, null, 2));
  console.log(`Backup: ${basename(backup)}`);
  for (const r of result.results) {
    if (r.delta === 0) console.log(`  = ${r.section}: already on baseline`);
    else if (r.skipped) console.log(`  ! ${r.section}: skipped (${r.skipped})`);
    else console.log(`  → ${r.section}: shifted heading and ${r.shifted - 1} following nodes by ${r.delta}`);
  }
  console.log(result.changed ? 'Fixed and saved.' : 'Nothing needed changing.');
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(2); });
}
