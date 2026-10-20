import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname } from 'node:path';
import { withCanvas, canvasCoordinates, saveScreenshot } from '../scripts/canvas-driver.mjs';

// Worked example: build a single-page mobile e-commerce product detail design
// ("叮当牌" dog food), optionally import a generated hero image, run lint,
// save and verify the portable .op on disk.
// Usage:
//   node examples/dogfood-detail-page.mjs --file /abs/design.op [--image /abs/hero.png] [--screenshot /abs/shot.png]
const usage = 'Usage: node examples/dogfood-detail-page.mjs --file ABS.op [--image ABS.png] [--screenshot ABS.png]';
const args = process.argv.slice(2);
let filePath, imagePath, screenshotPath;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) filePath = args[++i];
  else if (args[i] === '--image' && args[i + 1]) imagePath = args[++i];
  else if (args[i] === '--screenshot' && args[i + 1]) screenshotPath = args[++i];
  else throw new Error(usage);
}
if (!filePath) throw new Error(usage);

// Seed an empty document only when the file does not exist yet — never
// overwrite an existing design.
await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
try { await access(filePath, constants.F_OK); }
catch { await writeFile(filePath, JSON.stringify({ version: '0.8.5', children: [] })); }

const SECTIONS = ['hero', 'product-info', 'specs', 'features', 'reviews', 'buy-bar'];

// One batch_design script per visual group; every call stays within the
// 25-operation transactional limit (docs/agent-scripting.md).
function buildBatches(ids) {
  const script1 = `
const hero = I('${ids.hero}', { type: 'frame', name: '主图', width: 'fill_container', height: 360, layout: 'vertical', clipContent: true });
I(hero, { type: 'image', name: '产品主图', width: 'fill_container', height: 360 });

const info = I('${ids['product-info']}', { type: 'frame', name: '信息列', width: 'fill_container', height: 'fit_content', layout: 'vertical', gap: 10 });
const brandRow = I(info, { type: 'frame', name: '品牌行', width: 'fit_content', height: 'fit_content', layout: 'horizontal', gap: 8 });
const brand = I(brandRow, { type: 'frame', name: '品牌标', width: 'fit_content', height: 'fit_content', layout: 'horizontal', cornerRadius: 999, fill: [{ type: 'solid', color: '#FDEBDD' }], padding: [4, 10] });
I(brand, { type: 'text', content: '叮当牌 DINGDANG', fontSize: 12, fontWeight: 600, fill: [{ type: 'solid', color: '#C2521A' }] });
const shop = I(brandRow, { type: 'frame', name: '店铺标', width: 'fit_content', height: 'fit_content', layout: 'horizontal', cornerRadius: 999, fill: [{ type: 'solid', color: '#EEE9E3' }], padding: [4, 10] });
I(shop, { type: 'text', content: '官方旗舰店', fontSize: 12, fontWeight: 500, fill: [{ type: 'solid', color: '#6B6258' }] });
I(info, { type: 'text', name: '标题', content: '全价成犬粮 鸡肉牛肉双重配方 10kg 袋装', fontSize: 22, fontWeight: 600, width: 'fill_container', textGrowth: 'fixed-width', fill: [{ type: 'solid', color: '#221C15' }] });
const rating = I(info, { type: 'frame', name: '评分行', width: 'fit_content', height: 'fit_content', layout: 'horizontal', gap: 12, alignItems: 'center' });
I(rating, { type: 'text', content: '4.9 分', fontSize: 14, fontWeight: 600, fill: [{ type: 'solid', color: '#C2521A' }] });
I(rating, { type: 'text', content: '已售 2.3万+ 件', fontSize: 13, fill: [{ type: 'solid', color: '#8A8177' }] });
I(rating, { type: 'text', content: '好评率 98%', fontSize: 13, fill: [{ type: 'solid', color: '#8A8177' }] });
const priceRow = I(info, { type: 'frame', name: '价格行', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 10, alignItems: 'center' });
I(priceRow, { type: 'text', content: '¥89', fontSize: 44, fontWeight: 600, fill: [{ type: 'solid', color: '#E8622C' }] });
I(priceRow, { type: 'text', content: '日常价 ¥129', fontSize: 13, fill: [{ type: 'solid', color: '#B4AC9F' }] });
const deal = I(priceRow, { type: 'frame', name: '优惠标', width: 'fit_content', height: 'fit_content', layout: 'horizontal', cornerRadius: 8, fill: [{ type: 'solid', color: '#FDEBDD' }], padding: [5, 9] });
I(deal, { type: 'text', content: '限时直降 40 元', fontSize: 12, fontWeight: 600, fill: [{ type: 'solid', color: '#C2521A' }] });
`;
  const script2 = `
const specs = I('${ids.specs}', { type: 'frame', name: '规格列', width: 'fill_container', height: 'fit_content', layout: 'vertical', gap: 12 });
I(specs, { type: 'text', content: '规格与配方', fontSize: 20, fontWeight: 600, fill: [{ type: 'solid', color: '#221C15' }] });
const chips = I(specs, { type: 'frame', name: '规格芯片', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 8, clipContent: true });
for (const label of ['鸡肉牛肉配方', '成犬全价粮', '10kg 袋装', '添加冻干颗粒']) {
  const chip = I(chips, { type: 'frame', name: '芯片', width: 'fit_content', height: 'fit_content', layout: 'horizontal', cornerRadius: 999, fill: [{ type: 'solid', color: '#F3EDE6' }], padding: [8, 14] });
  I(chip, { type: 'text', content: label, fontSize: 14, fill: [{ type: 'solid', color: '#4A423A' }] });
}
const stats = I(specs, { type: 'frame', name: '营养值', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 8 });
for (const [value, label] of [['26%', '粗蛋白'], ['14%', '粗脂肪'], ['5%', '粗纤维']]) {
  const card = I(stats, { type: 'frame', name: '营养卡', width: 'fill_container', height: 'fit_content', layout: 'vertical', cornerRadius: 12, fill: [{ type: 'solid', color: '#FFFFFF' }], padding: [12, 0], alignItems: 'center', gap: 2 });
  I(card, { type: 'text', content: value, fontSize: 22, fontWeight: 600, fill: [{ type: 'solid', color: '#221C15' }] });
  I(card, { type: 'text', content: label, fontSize: 12, fill: [{ type: 'solid', color: '#8A8177' }] });
}

const features = I('${ids.features}', { type: 'frame', name: '卖点列', width: 'fill_container', height: 'fit_content', layout: 'vertical', gap: 12 });
I(features, { type: 'text', content: '为什么选它', fontSize: 20, fontWeight: 600, fill: [{ type: 'solid', color: '#221C15' }] });
for (const [icon, title, sub] of [
  ['鲜', '鲜肉直制', '鸡肉牛肉低温慢煮，锁住鲜味与营养'],
  ['冻', '冻干加倍', '添加 5% 冻干生骨肉颗粒，适口性更好'],
  ['护', '肠胃友好', '添加益生元，呵护狗狗肠胃吸收'],
]) {
  const row = I(features, { type: 'frame', name: '卖点行', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 12, alignItems: 'center' });
  const tile = I(row, { type: 'frame', name: '图标位', width: 44, height: 44, cornerRadius: 999, fill: [{ type: 'solid', color: '#FDEBDD' }], layout: 'horizontal', alignItems: 'center', justifyContent: 'center' });
  I(tile, { type: 'text', content: icon, fontSize: 18, fontWeight: 600, fill: [{ type: 'solid', color: '#C2521A' }] });
  const col = I(row, { type: 'frame', name: '卖点文字', width: 'fill_container', height: 'fit_content', layout: 'vertical', gap: 2 });
  I(col, { type: 'text', content: title, fontSize: 16, fontWeight: 600, fill: [{ type: 'solid', color: '#221C15' }] });
  I(col, { type: 'text', content: sub, fontSize: 13, fill: [{ type: 'solid', color: '#8A8177' }] });
}
`;
  const script3 = `
const reviews = I('${ids.reviews}', { type: 'frame', name: '评价列', width: 'fill_container', height: 'fit_content', layout: 'vertical', gap: 12 });
const head = I(reviews, { type: 'frame', name: '评价头', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 6, alignItems: 'center' });
I(head, { type: 'text', content: '用户评价', fontSize: 20, fontWeight: 600, fill: [{ type: 'solid', color: '#221C15' }] });
I(head, { type: 'text', content: '4.9', fontSize: 20, fontWeight: 600, fill: [{ type: 'solid', color: '#C2521A' }] });
I(head, { type: 'text', content: '（2381 条）', fontSize: 13, fill: [{ type: 'solid', color: '#8A8177' }] });
const card = I(reviews, { type: 'frame', name: '评价卡', width: 'fill_container', height: 'fit_content', layout: 'vertical', cornerRadius: 12, fill: [{ type: 'solid', color: '#FFFFFF' }], padding: [14, 16], gap: 8 });
const who = I(card, { type: 'frame', name: '评价人', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 8, alignItems: 'center' });
const avatar = I(who, { type: 'frame', name: '头像', width: 32, height: 32, cornerRadius: 999, fill: [{ type: 'solid', color: '#F3EDE6' }], layout: 'horizontal', alignItems: 'center', justifyContent: 'center' });
I(avatar, { type: 'text', content: '毛', fontSize: 13, fontWeight: 600, fill: [{ type: 'solid', color: '#8A6A4B' }] });
I(who, { type: 'text', content: '毛毛家长', fontSize: 14, fontWeight: 600, fill: [{ type: 'solid', color: '#221C15' }] });
I(who, { type: 'text', content: '金毛 · 3 岁', fontSize: 12, fill: [{ type: 'solid', color: '#8A8177' }] });
I(card, { type: 'text', content: '颗粒大小合适，便便成型明显改善，换粮过渡也没拉稀，吃了两个月毛色亮了很多。', fontSize: 15, width: 'fill_container', textGrowth: 'fixed-width', fill: [{ type: 'solid', color: '#4A423A' }] });

const bar = I('${ids['buy-bar']}', { type: 'frame', name: '购买栏', width: 'fill_container', height: 'fit_content', layout: 'horizontal', gap: 10, alignItems: 'center' });
const side = I(bar, { type: 'frame', name: '辅助位', width: 'fit_content', height: 'fit_content', layout: 'horizontal', gap: 8 });
for (const label of ['客服', '购物车']) {
  const box = I(side, { type: 'frame', name: label, width: 48, height: 50, cornerRadius: 12, fill: [{ type: 'solid', color: '#EEE9E3' }], layout: 'horizontal', alignItems: 'center', justifyContent: 'center' });
  I(box, { type: 'text', content: label, fontSize: 12, fontWeight: 500, fill: [{ type: 'solid', color: '#4A423A' }] });
}
const buy = I(bar, { type: 'frame', name: '立即购买', width: 'fill_container', height: 50, cornerRadius: 12, fill: [{ type: 'solid', color: '#E8622C' }], layout: 'horizontal', alignItems: 'center', justifyContent: 'center' });
I(buy, { type: 'text', content: '立即购买 ¥89', fontSize: 17, fontWeight: 600, fill: [{ type: 'solid', color: '#FFFFFF' }] });
`;
  return [script1, script2, script3];
}

await withCanvas(filePath, async ({ canvas, native }) => {
  // 1) skeleton: root frame + section frames (reply is a JSON document with
  // rootId and a comma-separated sectionIds string mapped by index).
  const skeleton = await native('design_skeleton', {
    rootFrame: { name: '叮当牌狗粮详情页', width: 390, height: 844, layout: 'vertical', fill: [{ type: 'solid', color: '#F7F5F2' }] },
    sections: SECTIONS.map(name => ({ name })),
    canvasWidth: 390,
  });
  const rootId = skeleton.rootId;
  const ids = Object.fromEntries(String(skeleton.sectionIds).split(',').map((id, i) => [SECTIONS[i], id]));
  console.log('skeleton:', rootId);

  // 2) content batches (transactional; fix and resend a whole batch on errors)
  const batches = buildBatches(ids);
  for (const [index, script] of batches.entries()) {
    await native('batch_design', { script });
    console.log(`batch ${index + 1}/${batches.length} OK`);
  }

  // 3) content-driven page height contract
  await native('update_node', { nodeId: rootId, data: { height: 'fit_content' } });

  // 4) optional generated-image import (host-side image generation happens
  // before this step; canvas_import_image only embeds local bytes)
  if (imagePath) {
    const { version, pageId } = await canvasCoordinates(canvas);
    const hero = await native('find_node_by_name', { name: '产品主图' });
    const { size } = await stat(imagePath);
    if (size > 8 * 1024 * 1024) throw new Error('hero image exceeds 8 MiB');
    const imported = await native('canvas_import_image', {
      filePath: imagePath, nodeId: hero.node?.id ?? hero.id, pageId, expectedVersion: version,
    });
    console.log('image imported:', JSON.stringify(imported).slice(0, 160));
  }

  // 5) QA, guarded save, portable verification, render
  const lint = await native('lint_document', {});
  console.log('lint issues:', lint.count ?? 0);
  await canvas.call('canvas_save', { filePath });
  const saved = await readFile(filePath, 'utf8');
  console.log('saved:', filePath, '| bytes:', saved.length, '| image embedded:', /"src":\s*"data:image\/png;base64/.test(saved));
  if (screenshotPath) console.log('screenshot:', await saveScreenshot(native, rootId, screenshotPath));
});
