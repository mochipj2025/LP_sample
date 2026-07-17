/* =========================================================================
 * template.mascot.js
 * マスコット作成 PromptMaker ― このLP/ブランドの「相棒キャラクター」1体を作る。
 * -------------------------------------------------------------------------
 * アイコン作成（template.icon.js）が favicon やボタンのような「機能的な印」を
 * 作るのに対し、こちらは主役級の「ブランドの相棒マスコット」を三面図の設定資料
 * として作る位置づけ（DESIGN.md §7 / JOURNEY.md 参照）。
 *
 * 別リポ Promptmaker002 のキャラ系ツール群（simple-character-promptmaker 等）と
 * 役割がかぶらないよう、このテンプレートは「LP専用・トーン継承・三面図を
 * imageSlots に流し込む」ことに絞る。多様なキャラの作り分け自体は別リポに任せる。
 *
 * 世界観（かわいい／サイバーパンク／スチームパンク）で固定プロンプトの文面を
 * 差し替え、見た目のトーンをまるごと変える。テイスト（tone）や brandName /
 * brandColor は LP作成・アイコン作成と同じ語彙で、タブ切替時に引き継がれる。
 *
 * build() で作ったプロンプトで画像を作った後、できた画像を imageSlots に
 * 戻してセットすると、LP作成・画像作成と同じ共通の仕組み（app.js 側）で
 * 自動リネーム→WebP変換→まとめてZIP書き出し、まで面倒を見てくれる。
 * LP のような「見取り図（wireframe）」の概念は無いので登録しない。
 * ========================================================================= */

(function (global) {
  'use strict';

  const { joinLines, renderSections } = global.PromptMaker.utils;

  /* ======================================================================
   * 1. 世界観ごとの固定プロンプト（見た目のトーンをまるごと差し替える）
   * ====================================================================== */
  const WORLD_FIXED = {
    'かわいい': '白に近い生成りの背景、細い罫線、余白は多め。かわいいが騒がしくない、やさしい設定資料風。',
    'サイバーパンク': 'ネオンの発色、金属パーツやケーブルを小物に効かせ、背景は暗め。かわいいけれど無機質さも同居する近未来の設定資料風。',
    'スチームパンク': '真鍮・歯車・パイプなどアンティークな機械パーツ、セピア寄りの生成り背景。骨董の図鑑のような落ち着いた設定資料風。'
  };

  function worldFixed(state) {
    return WORLD_FIXED[state.world] || WORLD_FIXED['かわいい'];
  }

  /* ======================================================================
   * 2. 三面図のビュー定義（正面・横・背面）
   * ====================================================================== */
  const VIEWS = [
    { id: 'mascot-front', label: '正面', view: '正面（顔と全身がまっすぐ見える向き）' },
    { id: 'mascot-side', label: '横', view: '真横（左を向いたシルエットが分かる向き）' },
    { id: 'mascot-back', label: '背面', view: '背面（後ろ姿）' }
  ];

  /* ======================================================================
   * 3. build() ― 完成した画像生成プロンプト
   * ====================================================================== */

  function aim(state) {
    const motif = (state.motif || '').trim() || '（モチーフ未入力）';
    const tone = state.tone ? '「' + state.tone + '」を基調にした' : '';
    return 'ブランドの相棒マスコット。' + tone + motif + 'をベースに、' + (state.world || 'かわいい') + 'の世界観で三面図の設定資料をつくる。';
  }

  /** 1ビューぶんの完成プロンプト（build と imageSlots で共有＝二重管理しない） */
  function buildOnePrompt(state, view) {
    const brand = state.brandName ? '「' + state.brandName + '」の' : '';
    const motif = (state.motif || '').trim() || '小さな相棒キャラクター';
    const toneWord = state.tone || '親しみやすい';
    const colorNote = state.brandColor ? '配色は' + state.brandColor + 'を基調に。' : '';

    const text = brand + 'ブランドマスコット。' + motif + 'をベースにした、' + toneWord + 'な小さな相棒キャラクター。' +
      'この設定資料の' + view.view + 'を1枚。' + worldFixed(state) + colorNote +
      '同じキャラクターだと分かるよう、体型・色・特徴を三面図で完全に統一する。' +
      '文字・ロゴ・余計な小物の描き込みは最小限にし、背景はシンプルに。';

    return text.replace(/。+/g, '。');
  }

  function build(state) {
    const prompts = VIEWS.map(function (v) { return buildOnePrompt(state, v); });

    const usage = '【使い方】① 下のプロンプトをコピー → ② 画像生成AI（Midjourney / Image 2.0 / DALL·E など）に貼る → ③ 三面図として一貫した見た目で3枚つくる → ④「画像を用意する」で正面・横・背面をセット';

    const head = renderSections([{ title: 'このマスコットの狙い', body: aim(state) }]);

    const promptBody = VIEWS
      .map(function (v, i) { return '□ ' + v.label + '\n' + prompts[i]; })
      .join('\n\n');

    const promptSection = joinLines([
      '同じキャラクターの三面図として、次の3枚を一貫した見た目で作ってください。',
      '',
      '■ プロンプト（三面図・正面／横／背面）',
      promptBody
    ]);

    const tail = renderSections([
      { title: '世界観', body: state.world },
      { title: '参考にしたいトーン・作風', body: state.ref },
      { title: '補足・調整したいこと', body: state.extra }
    ]);

    return [usage, head, promptSection, tail]
      .filter(function (s) { return s && String(s).trim(); })
      .join('\n\n');
  }

  /* ======================================================================
   * 3b. imageSlots() ― 「画像を用意する」ステップ用のスロット（三面図）
   * ====================================================================== */
  function imageSlots(state) {
    return VIEWS.map(function (v) {
      return {
        id: v.id,
        label: v.label,
        ratio: '2:3（全身）',
        prompt: buildOnePrompt(state, v)
      };
    });
  }

  /* ======================================================================
   * 4. 入力項目（fields）
   * ====================================================================== */
  const FIELDS = [
    {
      key: 'world',
      label: '世界観',
      icon: '🌏',
      group: 'basic',
      type: 'chips',
      hint: '固定の設定資料風トーンがまるごと切り替わります。',
      options: ['かわいい', 'サイバーパンク', 'スチームパンク']
    },
    {
      key: 'motif',
      label: '何をベースにする？',
      icon: '🎯',
      group: 'basic',
      type: 'textarea',
      rows: 2,
      random: false,
      placeholder: '例）まめ大福／小さなロボ／柴犬'
    },
    {
      key: 'tone',
      label: 'テイスト',
      icon: '✨',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '雰囲気（任意）。LP作成・アイコン作成と同じ語彙です。',
      options: ['高級感', '親しみやすい', 'ポップ・元気', '信頼・誠実', 'おしゃれ・洗練', 'エモい']
    },

    /* --- 掲載情報（折りたたみ / group:info） --- */
    { key: 'brandName', label: 'ブランド名・キャラ名', icon: '🏷️', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）ほぐしラボ／もちすけ' },
    { key: 'brandColor', label: 'ブランドカラー・参考色', icon: '🎨', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）深緑と生成り' },

    /* --- 詳細設定（折りたたみ / group:advanced） --- */
    { key: 'ref', label: '参考にしたいトーン・作風', icon: '🔎', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）〇〇のマスコットのような親しみやすさ／設定資料集の雰囲気' },
    { key: 'extra', label: '補足・調整したいこと', icon: '📝', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）目を大きめに／アイテムを持たせたい など' }
  ];

  const DEFAULT_STATE = {
    world: 'かわいい',
    motif: '',
    tone: '親しみやすい',
    brandName: '',
    brandColor: '',
    ref: '',
    extra: ''
  };

  /* ======================================================================
   * 5. プリセット
   * ====================================================================== */
  const PRESETS = [
    {
      id: 'kawaii', name: 'かわいい相棒', icon: '🧸',
      description: '生成りの背景に、やさしく親しみやすい小さな相棒。',
      useCases: ['お店やブランドのゆるいマスコットが欲しい'],
      values: { world: 'かわいい', tone: '親しみやすい' }
    },
    {
      id: 'cyber', name: 'サイバーパンクな相棒', icon: '🤖',
      description: 'ネオンと金属パーツを効かせた、無機質さも同居する近未来の相棒。',
      useCases: ['テック系・ゲーム系の世界観に合うマスコットが欲しい'],
      values: { world: 'サイバーパンク', tone: 'おしゃれ・洗練' }
    },
    {
      id: 'steam', name: 'スチームパンクな相棒', icon: '⚙️',
      description: '真鍮と歯車の、骨董図鑑のように落ち着いた設定資料風の相棒。',
      useCases: ['クラシックで重厚な世界観のマスコットが欲しい'],
      values: { world: 'スチームパンク', tone: '高級感' }
    }
  ];

  /* ======================================================================
   * 6. 登録
   * ====================================================================== */
  global.PromptMaker.registerTemplate({
    id: 'mascot',
    name: 'マスコット作成',
    icon: '🧸',
    enabled: true,
    fields: FIELDS,
    presets: PRESETS,
    defaults: DEFAULT_STATE,
    build: build,
    imageSlots: imageSlots
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PromptMaker.getTemplate('mascot');
  }
})(typeof window !== 'undefined' ? window : global);
