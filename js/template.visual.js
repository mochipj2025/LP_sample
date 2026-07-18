/* =========================================================================
 * template.visual.js
 * 画像作成 PromptMaker ― 単体画像（SNS投稿・バナー・商品写真など）の
 * 画像生成プロンプトを作るテンプレート
 * -------------------------------------------------------------------------
 * LP作成（template.lp.js）が各セクションの写真を作るときに参照している
 * 「姉妹ツール」の本体。LPの1セクションに縛られず、単体で使う画像
 * （SNS投稿・広告バナー・名刺・POP・OGP画像など）のプロンプトを作る。
 *
 * このテンプレートには LP のような「見取り図（wireframe）」の概念が無いので
 * wireframe は登録しない（app.js 側が自動でその見た目を隠す）。
 *
 * 「画像を用意する」ステップ（imageSlots）は登録する。build() が作った
 * プロンプトで画像生成AIに作らせた後、できあがった画像をここに戻して
 * セットすると、LP作成のときと同じ仕組み（app.js 側・共通）で
 * 自動リネーム→WebP変換→まとめてZIP書き出し、まで面倒を見てくれる。
 * パターン数ぶんのスロットを、buildOnePrompt() と同じロジックで作る。
 *
 * ここには「画像作成の知識」だけを書く。UI や登録の仕組みは core.js / app.js 側。
 * ========================================================================= */

(function (global) {
  'use strict';

  const { joinLines, renderSections } = global.PromptMaker.utils;

  /* ======================================================================
   * 1. 構図パターン（バリエーション生成用）
   * ====================================================================== */
  const ANGLES = [
    '正面からの構図で、主役をはっきり大きく見せて。',
    '斜め上からの構図で、奥行きと立体感を出して。',
    '余白を広く取った引きの構図で、上品な余韻を残して。',
    '斜め下からのアングルで、力強い印象に。',
    '真上からの俯瞰構図で、配置の美しさを見せて。'
  ];

  function variationCount(state) {
    const v = state.variations || '';
    if (v.indexOf('5') >= 0) return 5;
    if (v.indexOf('3') >= 0) return 3;
    return 1;
  }

  /* ======================================================================
   * 2. build() ― 完成した画像生成プロンプト
   * ====================================================================== */

  function aim(state) {
    const usage = state.usage || '（用途未選択）';
    const tone = state.tone ? '「' + state.tone + '」を基調にした' : '';
    return usage + '用の画像。' + tone + '雰囲気。比率は ' + (state.ratio || '1:1（正方形）') + '。';
  }

  /** 1枚ぶんの完成プロンプト（句読点の重複も整える） */
  function buildOnePrompt(state, angle) {
    const subject = (state.subject || '').trim() || '主役となる被写体';
    const brand = state.brandName ? '「' + state.brandName + '」の' : '';
    const colorNote = state.brandColor ? '配色は' + state.brandColor + 'を基調に。' : '';
    const toneWord = state.tone || '自然な';

    const text = brand + subject + '。' + angle + toneWord + 'の雰囲気。' + colorNote +
      '文字、ロゴ、透かしなし。比率 ' + (state.ratio || '1:1（正方形）') + '。';

    return text.replace(/。+/g, '。');
  }

  function build(state) {
    const count = variationCount(state);
    const prompts = [];
    for (let i = 0; i < count; i++) {
      prompts.push(buildOnePrompt(state, ANGLES[i % ANGLES.length]));
    }

    const usage = '【使い方】① 下のプロンプトをコピー → ② 画像生成AI（Midjourney / Image 2.0 / DALL·E など）に貼る → ③ 気に入った1枚を保存';

    const head = renderSections([{ title: 'この画像の狙い', body: aim(state) }]);

    const promptTitle = prompts.length === 1
      ? '■ プロンプト'
      : '■ プロンプト（' + prompts.length + 'パターン・構図違い）';

    const promptBody = prompts.length === 1
      ? prompts[0]
      : prompts.map(function (p, i) { return '□ パターン' + (i + 1) + '\n' + p; }).join('\n\n');

    const tail = renderSections([
      { title: '参考トーン・作風', body: state.ref },
      { title: '補足・調整したいこと', body: state.extra }
    ]);

    return [usage, head, promptTitle + '\n' + promptBody, tail]
      .filter(function (s) { return s && String(s).trim(); })
      .join('\n\n');
  }

  /* ======================================================================
   * 2b. imageSlots() ― 「画像を用意する」ステップ用のスロット
   * ====================================================================== */

  /**
   * build() で作ったプロンプト（の各パターン）を、画像を戻してセットする
   * ための「スロット」の形に変換する。中身の文面は buildOnePrompt() と
   * 完全に同じロジックを使うので、二重管理にならない。
   *
   * スロットの id はファイル名にそのまま使われる（app.js 側の共通処理）ので、
   * 何のパターンかが後から見て分かるよう "pattern-1" のような固定の形にする。
   */
  function imageSlots(state) {
    const count = variationCount(state);
    const slots = [];
    for (let i = 0; i < count; i++) {
      const angle = ANGLES[i % ANGLES.length];
      slots.push({
        id: 'pattern-' + (i + 1),
        label: count === 1 ? '完成イメージ' : 'パターン' + (i + 1),
        ratio: state.ratio || '1:1（正方形）',
        prompt: buildOnePrompt(state, angle)
      });
    }
    return slots;
  }

  /* ======================================================================
   * 3. 入力項目（fields）
   * ====================================================================== */
  const FIELDS = [
    {
      key: 'usage',
      label: '何に使う？',
      icon: '🖼️',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '用途。テイストの既定値がここで変わります。',
      options: [
        'SNS投稿',
        '広告バナー',
        'ウェブサイトのヒーロー画像',
        '商品写真',
        '名刺・ショップカード',
        '店内POP',
        'OGP画像（リンク用サムネイル）'
      ]
    },
    {
      key: 'subject',
      label: '何を写す？',
      icon: '🎯',
      group: 'basic',
      type: 'textarea',
      rows: 2,
      random: false,
      placeholder: '例）湯気の立つラーメンの器'
    },
    {
      key: 'ratio',
      label: '比率',
      icon: '📐',
      group: 'basic',
      type: 'chips',
      random: false,
      hint: '使う場所に合わせて選びます。',
      options: [
        '1:1（正方形）',
        '4:5（縦長SNS）',
        '16:9（横長・バナー）',
        '9:16（ストーリーズ）',
        '3:2（写真標準）'
      ]
    },
    {
      key: 'tone',
      label: 'テイスト',
      icon: '🎨',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '雰囲気（任意）。',
      options: ['高級感', '親しみやすい', 'ポップ・元気', '信頼・誠実', 'おしゃれ・洗練', 'エモい']
    },
    {
      key: 'variations',
      label: 'パターン数',
      icon: '🔁',
      group: 'basic',
      type: 'chips',
      random: false,
      hint: '構図違いをまとめて何枚ぶん出すか。',
      options: ['1枚だけ', '3パターン（構図違い）', '5パターン（構図違い）']
    },

    /* --- 掲載情報（折りたたみ / group:info） --- */
    { key: 'brandName', label: 'ブランド名・店名', icon: '🏷️', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）ほぐしラボ' },
    { key: 'brandColor', label: 'ブランドカラー・参考色', icon: '🎨', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）深緑と生成り' },

    /* --- 詳細設定（折りたたみ / group:advanced） --- */
    { key: 'ref', label: '参考にしたいトーン・作風', icon: '🔎', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）雑誌の巻頭ページのような余白 / 〇〇のサイトの雰囲気' },
    { key: 'extra', label: '補足・調整したいこと', icon: '📝', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）人物は入れない／文字組みは縦書きで など' }
  ];

  const DEFAULT_STATE = {
    usage: 'SNS投稿',
    subject: '',
    ratio: '4:5（縦長SNS）',
    tone: '親しみやすい',
    variations: '1枚だけ',
    brandName: '',
    brandColor: '',
    ref: '',
    extra: ''
  };

  /* ======================================================================
   * 4. プリセット
   * ====================================================================== */
  const PRESETS = [
    {
      id: 'sns', name: 'SNS投稿用の1枚', icon: '📱',
      description: '縦長で、フィード上でも目に留まる1枚を作る構成。',
      useCases: ['Instagram/Xの投稿画像を作りたい'],
      values: { usage: 'SNS投稿', ratio: '4:5（縦長SNS）', tone: '親しみやすい' }
    },
    {
      id: 'banner', name: '広告バナー', icon: '📣',
      description: '横長で、短時間で伝わる訴求力のあるバナー用構成。',
      useCases: ['Web広告のバナーを作りたい', 'キャンペーン告知画像が欲しい'],
      values: { usage: '広告バナー', ratio: '16:9（横長・バナー）', tone: 'おしゃれ・洗練' }
    },
    {
      id: 'hero', name: 'サイトのヒーロー画像', icon: '🌅',
      description: 'LPやコーポレートサイトの一番上に置く、横長の主役ビジュアル。',
      useCases: ['LPのメインビジュアルを作りたい'],
      values: { usage: 'ウェブサイトのヒーロー画像', ratio: '16:9（横長・バナー）', tone: 'おしゃれ・洗練' }
    },
    {
      id: 'product', name: '商品写真', icon: '📦',
      description: '正方形で、質感が伝わる商品単体の写真構成。',
      useCases: ['ECサイトの商品画像を作りたい'],
      values: { usage: '商品写真', ratio: '1:1（正方形）', tone: '信頼・誠実' }
    },
    {
      id: 'card', name: '名刺・ショップカード', icon: '🪪',
      description: '上品で端正な、名刺やショップカードに使える構成。',
      useCases: ['名刺やショップカードのデザイン素材が欲しい'],
      values: { usage: '名刺・ショップカード', ratio: '1:1（正方形）', tone: '高級感' }
    },
    {
      id: 'ogp', name: 'OGP画像', icon: '🔗',
      description: 'リンクをシェアしたときに表示される、横長のサムネイル用構成。',
      useCases: ['ブログ記事やページのシェア画像を作りたい'],
      values: { usage: 'OGP画像（リンク用サムネイル）', ratio: '16:9（横長・バナー）', tone: 'おしゃれ・洗練' }
    }
  ];

  /* ======================================================================
   * 5. 登録
   * ====================================================================== */
  global.PromptMaker.registerTemplate({
    id: 'visual',
    name: '画像作成',
    icon: '🖼️',
    enabled: true,
    fields: FIELDS,
    presets: PRESETS,
    defaults: DEFAULT_STATE,
    build: build,
    imageSlots: imageSlots
    // wireframe は登録しない（この用途では「1セクションずつの積み木」という
    // LP側の概念自体が無いため）。
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PromptMaker.getTemplate('visual');
  }
})(typeof window !== 'undefined' ? window : global);
