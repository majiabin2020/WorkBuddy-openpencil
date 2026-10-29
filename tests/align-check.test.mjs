import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { alignmentReport, alignDocument, alignSection } from '../scripts/align-check.mjs';

function sectionFrame(name, headingY, contentY) {
  return {
    type: 'frame', name, x: 40, y: 200, width: 300, height: 600,
    children: [
      { type: 'text', name: `label｜${name}`, x: 0, y: 20 },
      { type: 'text', name: `subheading｜${name}标题`, x: 0, y: headingY },
      { type: 'text', name: `text｜${name}正文`, x: 0, y: contentY },
      { type: 'text', name: `text｜${name}脚注`, x: 0, y: contentY + 60 },
    ],
  };
}

function sampleDoc() {
  // 02 and 03 drift +14/+9 from the 01 reference column, like the real
  // 田林展墙 document that motivated this tool. Section 02 also carries a
  // second content block whose subheading appears EARLIER in child order but
  // sits lower on canvas — the baseline must pick the topmost heading.
  return {
    version: '0.8.5',
    children: [{
      type: 'frame', name: '展墙', x: 0, y: 0, width: 1200, height: 900,
      children: [
        sectionFrame('01 时空长轴', 311, 370),
        {
          type: 'frame', name: '02 土司印记', x: 40, y: 200, width: 300, height: 600,
          children: [
            { type: 'text', name: 'subheading｜治理变迁', x: 0, y: 1560 },
            { type: 'text', name: 'label｜02 土司印记', x: 0, y: 20 },
            { type: 'text', name: 'subheading｜岑公保墓碑', x: 0, y: 325 },
            { type: 'text', name: 'text｜岑公保墓位于', x: 0, y: 384 },
          ],
        },
        sectionFrame('03 定安一刻', 320, 379),
        // Section 04 also carries a transparent vector group (宋体标题字形
        // style): no own coordinates, children share the parent space. Only
        // group children at or below the heading baseline may shift.
        {
          type: 'frame', name: '04 战火中的文脉', x: 40, y: 200, width: 300, height: 600,
          children: [
            { type: 'group', name: '宋体标题字形｜战火中的文脉', children: [
              { type: 'path', name: '宋体字形｜战火中的文脉', x: 12, y: 0 },
              { type: 'path', name: '宋体字形｜装饰线', x: 12, y: 340 },
            ] },
            { type: 'text', name: 'subheading｜田西师范', x: 0, y: 325 },
            { type: 'text', name: 'text｜校史正文', x: 0, y: 384 },
          ],
        },
        { type: 'text', name: '标题文字原稿（隐藏）', visible: false },
      ],
    }],
  };
}

test('alignment report measures global y through the parent chain', () => {
  const doc = sampleDoc();
  const report = alignmentReport(doc);
  assert.equal(report.sections.length, 4);
  // Section frames sit at global y=200; headings add their local y.
  assert.equal(report.sections[0].headingGlobalY, 200 + 311);
  assert.equal(report.aligned, false);
  assert.equal(report.baseline, 200 + 311);
  assert.deepEqual(report.drift.map(d => d.delta), [14, 9, 14]);
});

test('alignDocument shifts heading and following siblings, preserving spacing', () => {
  const doc = sampleDoc();
  const result = alignDocument(doc);
  assert.equal(result.changed, true);
  const sections = doc.children[0].children;
  const s1 = sections.find(s => s.name === '01 时空长轴');
  const s2 = sections.find(s => s.name === '02 土司印记');
  const s3 = sections.find(s => s.name === '03 定安一刻');
  const s4 = sections.find(s => s.name === '04 战火中的文脉');
  const byName = (s, n) => s.children.find(c => c.name === n);
  assert.equal(byName(s2, 'subheading｜岑公保墓碑').y, 311);   // topmost heading aligned
  assert.equal(byName(s2, 'text｜岑公保墓位于').y, 370);       // body moved by the same delta
  assert.equal(byName(s2, 'subheading｜治理变迁').y, 1546);    // lower blocks shift too
  assert.equal(byName(s2, 'label｜02 土司印记').y, 20);        // pre-heading content untouched
  assert.equal(byName(s1, 'subheading｜01 时空长轴标题').y, 311); // reference column untouched
  assert.equal(byName(s3, 'subheading｜03 定安一刻标题').y, 311);
  // Transparent group: children below the baseline shift, the top glyph stays.
  assert.equal(byName(s4, 'subheading｜田西师范').y, 311);
  assert.equal(byName(s4, 'text｜校史正文').y, 370);
  const glyphs = s4.children.find(c => c.type === 'group');
  assert.equal(glyphs.children.find(c => c.name === '宋体字形｜装饰线').y, 326);
  assert.equal(glyphs.children.find(c => c.name === '宋体字形｜战火中的文脉').y, 0);
  const after = alignmentReport(doc);
  assert.equal(after.aligned, true);
});

test('alignSection refuses flow-layout or coordinate-less sections', () => {
  const section = { type: 'frame', name: '04 auto', layout: 'vertical', children: [
    { type: 'text', name: 'subheading｜无坐标' },
  ] };
  const r = alignSection(section, -14);
  assert.equal(r.shifted, 0);
  assert.match(r.skipped, /flow layout/);
});

test('alignDocument is idempotent once aligned', () => {
  const doc = sampleDoc();
  alignDocument(doc);
  const second = alignDocument(doc);
  assert.equal(second.changed, false);
});

test('CLI fixes a file, keeps a backup and exits 0 on the follow-up check', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'align-check-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'wall.op');
  const { writeFile } = await import('node:fs/promises');
  await writeFile(file, JSON.stringify(sampleDoc()));
  const { execFileSync } = await import('node:child_process');
  const script = new URL('../scripts/align-check.mjs', import.meta.url).pathname;

  const fixed = execFileSync(process.execPath, [script, file, '--fix'], { encoding: 'utf8' });
  assert.match(fixed, /Fixed and saved/);
  const backups = (await readdir(dir)).filter(f => f.includes('.align-backup-'));
  assert.equal(backups.length, 1);
  const backupDoc = JSON.parse(await readFile(join(dir, backups[0]), 'utf8'));
  const backupHeading = backupDoc.children[0].children[1].children.find(c => c.name === 'subheading｜岑公保墓碑');
  assert.equal(backupHeading.y, 325); // original drift preserved

  const check = execFileSync(process.execPath, [script, file], { encoding: 'utf8' });
  assert.match(check, /All headings share one baseline/);
});
