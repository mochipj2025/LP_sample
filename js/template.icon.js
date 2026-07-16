/* =========================================================================
 * template.icon.js
 * アイコン作成 PromptMaker ― favicon・アプリアイコン・SNSプロフィール・
 * UIの機能アイコンなど、小さく表示される「印」のための画像生成プロンプトを作る
 * -------------------------------------------------------------------------
 * 画像作成（template.visual.js）が「単体で使う画像（写真寄り）」を作るのに対し、
 * こちらは「小さく表示されても判別できる、記号的なアイコン」を作る。
 * そのため build() のプロンプト末尾には、画像作成には無い
 * 「背景透過」「小サイズでの視認性」「縁取りの均一さ」といった、
 * アイコンならではの制約を必ず添える。
 *
 * マスコットキャラクター（相棒maker系）とは別物。こちらは favicon やボタンの
 * ような「機能的な印」を作る位置づけで、キャラクターを主役にした
 * 三面図的なプロンプトは扱わない（詳細は DESIGN.md §7 / JOURNEY.md 参照）。
 *
 * 「画像を用意する」ステップ（imageSlots）は画像作成と同じ考え方で登録する。
 * build() が作ったプロンプトで画像生成AIに作らせた後、できあがった画像を
 * ここに戻してセットすると、LP作成・画像作成と同じ仕組み（app.js側・共通）で
 * 自動リネーム→WebP変換→まとめてZIP書き出し、まで面倒を見てくれる。
 *
 * このテンプレートにも LP のような「見取り図（wireframe）」の概念が無いので
 * wireframe は登録しない（app.js 側が自動でその見た目を隠す）。
 *
 * ここには「アイコン作成の知識」だけを書く。UI や登録の仕組みは core.js / app.js 側。
 * ========================================================================= */

(function (global) {
  'use strict';

  const { joinLines, renderSections } = global.PromptMaker.utils;

  /* ======================================================================
   * 1. 構成パターン（バリエーション生成用）
   * ====================================================================== */
  const VARIANTS = [
    '輪郭を太めの均一な線でまとめ、小さく表示してもシルエットで判別できる構成に。',
    '要素を1つだけに絞り込んだ、より抽象的でミニマルな構成に。',
    '角を丸めた、やわらかく親しみのある構成に。',
    '要素を斜めに配置し、動きを感じる構成に。',
    '縁取りに小さな模様や飾りを添えた、華やかな構成に。'
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
    return usage + '用のアイコン。' + tone + '雰囲気。' +
      (state.style || 'フラット（ベタ塗り）') + '・' + (state.colorCount || 'フルカラー') + '。';
  }

  /** 1つぶんの完成プロンプト（句読点の重複も整える） */
  function buildOnePrompt(state, variant) {
    const brand = state.brandName ? '「' + state.brandName + '」の' : '';
    const motif = (state.motif || '').trim() || '主役となるモチーフ';
    const styleWord = state.style || 'フラット（ベタ塗り）';
    const colorWord = state.colorCount || 'フルカラー';
    const toneWord = state.tone || '親しみやすい';
    const colorNote = state.brandColor ? '配色は' + state.brandColor + 'を基調に。' : '';

    const text = brand + motif + 'をモチーフにしたアイコン。' + styleWord + '、' + colorWord + 'で、' + toneWord + 'の雰囲気。' +
      variant + colorNote +
      '背景は透過（PNG）。文字、ロゴ、影の描き込みなし。正方形のキャンバスに、要素を中央に大きく配置。' +
      '小さいサイズ（40px程度）で表示してもシルエットで判別できるレベルまでシンプルに。';

    return text.replace(/。+/g, '。');
  }

  function build(state) {
    const count = variationCount(state);
    const prompts = [];
    for (let i = 0; i < count; i++) {
      prompts.push(buildOnePrompt(state, VARIANTS[i % VARIANTS.length]));
    }

    const usage = '【使い方】① 下のプロンプトをコピー → ② 画像生成AI（Midjourney / Image 2.0 / DALL·E など）に貼る → ③ 気に入ったものを保存（背景透過のPNGがおすすめ）';

    const head = renderSections([{ title: 'このアイコンの狙い', body: aim(state) }]);

    const promptTitle = prompts.length === 1
      ? '■ プロンプト'
      : '■ プロンプト（' + prompts.length + 'パターン・構成違い）';

    const promptBody = prompts.length === 1
      ? prompts[0]
      : prompts.map(function (p, i) { return '□ パターン' + (i + 1) + '\n' + p; }).join('\n\n');

    const tail = renderSections([
      { title: '参考にしたいトーン・作風', body: state.ref },
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
   * アイコンは常に正方形で使うため、画像作成（visual）と違い比率の入力は
   * 持たせず、ratio は固定で '1:1（正方形）' を返す。
   */
  function imageSlots(state) {
    const count = variationCount(state);
    const slots = [];
    for (let i = 0; i < count; i++) {
      const variant = VARIANTS[i % VARIANTS.length];
      slots.push({
        id: 'icon-' + (i + 1),
        label: count === 1 ? '完成アイコン' : 'パターン' + (i + 1),
        ratio: '1:1（正方形）',
        prompt: buildOnePrompt(state, variant)
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
      icon: '🔶',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '用途。スタイルの既定値がここで変わります。',
      options: [
        'アプリ・ファビコン',
        'SNSアイコン（プロフィール用）',
        'ボタン・機能アイコン（UI用）',
        'ロゴマーク',
        'グッズ・スタンプ用アイコン'
      ]
    },
    {
      key: 'motif',
      label: '何をモチーフにする？',
      icon: '🎯',
      group: 'basic',
      type: 'textarea',
      rows: 2,
      random: false,
      placeholder: '例）コーヒーカップ／ハサミ／吹き出し'
    },
    {
      key: 'style',
      label: 'スタイル',
      icon: '🖊️',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '線・塗りの質感。',
      options: ['フラット（ベタ塗り）', 'ラインアート（線画）', '3D・立体', 'グラデーション', '手描き風']
    },
    {
      key: 'colorCount',
      label: 'カラー数',
      icon: '🎨',
      group: 'basic',
      type: 'chips',
      random: false,
      hint: '色数を絞るほど、小さく表示したときに見やすくなります。',
      options: ['1色（単色）', '2色', 'フルカラー']
    },
    {
      key: 'tone',
      label: 'テイスト',
      icon: '✨',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '雰囲気（任意）。LP作成・画像作成と同じ語彙です。',
      options: ['高級感', '親しみやすい', 'ポップ・元気', '信頼・誠実', 'おしゃれ・洗練', 'エモい']
    },
    {
      key: 'variations',
      label: 'パターン数',
      icon: '🔁',
      group: 'basic',
      type: 'chips',
      random: false,
      hint: '構成違いをまとめて何個ぶん出すか。',
      options: ['1つだけ', '3パターン（バリエーション）', '5パターン（バリエーション）']
    },

    /* --- 掲載情報（折りたたみ / group:info） --- */
    { key: 'brandName', label: 'ブランド名・アプリ名', icon: '🏷️', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）ほぐしラボ' },
    { key: 'brandColor', label: 'ブランドカラー・参考色', icon: '🎨', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）深緑と生成り' },

    /* --- 詳細設定（折りたたみ / group:advanced） --- */
    { key: 'ref', label: '参考にしたいトーン・作風', icon: '🔎', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）Feather Iconsのような線の太さ／〇〇アプリのアイコン群の雰囲気' },
    { key: 'extra', label: '補足・調整したいこと', icon: '📝', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）影をつけない／円形の枠に収める など' }
  ];

  const DEFAULT_STATE = {
    usage: 'アプリ・ファビコン',
    motif: '',
    style: 'フラット（ベタ塗り）',
    colorCount: 'フルカラー',
    tone: '親しみやすい',
    variations: '1つだけ',
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
      id: 'favicon', name: 'ファビコン・アプリアイコン', icon: '🌐',
      description: '小さく表示されても崩れない、記号としての完成度を優先する構成。',
      useCases: ['サイトのfaviconが欲しい', 'アプリのホーム画面アイコンを作りたい'],
      values: { usage: 'アプリ・ファビコン', style: 'フラット（ベタ塗り）', colorCount: '2色', tone: '信頼・誠実' }
    },
    {
      id: 'sns', name: 'SNSプロフィールアイコン', icon: '👤',
      description: '一覧の中でも目に留まる、親しみやすい構成。',
      useCases: ['Instagram/Xのプロフィールアイコンが欲しい'],
      values: { usage: 'SNSアイコン（プロフィール用）', style: 'フラット（ベタ塗り）', colorCount: 'フルカラー', tone: '親しみやすい' }
    },
    {
      id: 'ui', name: 'UIボタン・機能アイコン', icon: '🔘',
      description: '線のみで意味が伝わる、UI部品として使いやすい構成。',
      useCases: ['アプリ内のボタンアイコンが欲しい', 'メニューの機能アイコンを揃えたい'],
      values: { usage: 'ボタン・機能アイコン（UI用）', style: 'ラインアート（線画）', colorCount: '1色（単色）', tone: '信頼・誠実' }
    },
    {
      id: 'logo', name: 'ロゴマーク', icon: '🔖',
      description: '名刺やヘッダーに置いても様になる、端正な構成。',
      useCases: ['ブランドのシンボルマークが欲しい'],
      values: { usage: 'ロゴマーク', style: 'フラット（ベタ塗り）', colorCount: '2色', tone: '高級感' }
    },
    {
      id: 'goods', name: 'グッズ・スタンプ用', icon: '🎀',
      description: '手描きの温かみを残した、賑やかで楽しい構成。',
      useCases: ['LINEスタンプ風の素材が欲しい', 'グッズに使うワンポイントが欲しい'],
      values: { usage: 'グッズ・スタンプ用アイコン', style: '手描き風', colorCount: 'フルカラー', tone: 'ポップ・元気' }
    }
  ];

  /* ======================================================================
   * 5. 登録
   * ====================================================================== */
  global.PromptMaker.registerTemplate({
    id: 'icon',
    name: 'アイコン作成',
    icon: '🔶',
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
    module.exports = global.PromptMaker.getTemplate('icon');
  }
})(typeof window !== 'undefined' ? window : global);
