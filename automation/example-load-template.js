/* =========================================================================
 * automation/example-load-template.js
 * -------------------------------------------------------------------------
 * 「Node から js/core.js + js/template.lp.js をそのまま require して、
 *  ブラウザと同じプロンプト生成ロジックを使い回せる」ことを確認するための
 *  最小サンプル。外部APIは一切呼ばない（動作確認だけ）。
 *
 * 実行方法：
 *   node automation/example-load-template.js
 * ========================================================================= */

'use strict';

require('../js/core.js');
const lp = require('../js/template.lp.js');

// ブラウザの「①基本設定」で選ぶのと同じ形の state。
// 実際の自動化では、ブラウザ側からこの state をそのまま受け取る想定。
const state = {
  type: 'サロン・整体',
  reader: '迷っている人（比較検討）',
  goal: '予約する',
  tone: '信頼・誠実',
  volume: 'しっかり（長め）',
  infoName: 'ほぐしラボ'
};

console.log('=== ① 画像生成APIに渡すジョブ一覧（imageSlots） ===');
const slots = lp.imageSlots(state);
slots.forEach(function (slot, i) {
  console.log((i + 1) + '. [' + slot.id + '] ' + slot.label + '（' + slot.ratio + '）');
});
console.log('\n先頭スロットのプロンプト例：');
console.log(slots[0].prompt);

console.log('\n=== ② LPコード生成APIに渡すプロンプト（build） ===');
const codePrompt = lp.build(Object.assign({}, state, { output: 'LP制作プロンプト（コードまで）' }));
console.log(codePrompt.slice(0, 300) + '\n...(以下省略)...');

console.log('\n✅ ブラウザ用のロジックをそのままNodeから呼び出せることを確認しました。');
console.log('   実際のAPI呼び出しは automation/README.md の手順に沿って追加してください。');
