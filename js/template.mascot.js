/* =========================================================================
 * template.mascot.js
 * マスコット作成 PromptMaker ― このLP/ブランドの「相棒キャラクター」1体を作る。
 * -------------------------------------------------------------------------
 * かわいい素材を「ボタン（chips）」で選び、その組み合わせで個性的なキャラを
 * 作る仕組み。かたち・モチーフ・色・目・ほっぺ・口・アイテム・アクセント・性格を
 * 1つずつ選ぶ（🎲ランダムで一気にシャッフル／🎁おまかせで相性のいいプリセット）。
 * 世界観（かわいい／サイバーパンク／スチームパンク）で固定プロンプトの文面を
 * 差し替え、見た目のトーンをまるごと変える。
 *
 * アイコン作成（template.icon.js）が favicon のような「機能的な印」なのに対し、
 * こちらは主役級の「ブランドの相棒マスコット」を三面図の設定資料として作る
 * 位置づけ（DESIGN.md §7 / JOURNEY.md 参照）。別リポ Promptmaker002 のキャラ系
 * ツール群とは「LP専用・トーン継承・三面図を imageSlots に流し込む」で住み分ける。
 *
 * テイスト（tone）・brandName・brandColor は LP作成・アイコン作成と同じ語彙で、
 * タブ切替時に引き継がれる。build() で作ったプロンプトで画像を作った後、
 * できた画像を imageSlots（正面・横・背面）に戻すと、LP作成・画像作成と同じ
 * 共通の仕組み（app.js 側）で 自動リネーム→WebP変換→ZIP書き出し、まで面倒を見る。
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

  /* 世界観ごとの画風（レンダリング）。ChatGPT Image 2.0 など自然文で
   * 画風を具体的に指定できるモデル向けに、線・塗り・質感を言語化する。 */
  const RENDER_STYLE = {
    'かわいい': 'フラットでやわらかいベクターイラスト、均一な太さの線、軽い陰影、明るくクリーンな塗り。',
    'サイバーパンク': '半光沢のセル調イラスト、ネオンの発光、金属やケーブルの反射、暗い背景に映えるハイライト。',
    'スチームパンク': '質感のある線画に淡い水彩、真鍮の光沢と歯車のディテール、セピア寄りの落ち着いた発色。'
  };

  function renderStyle(state) {
    return RENDER_STYLE[state.world] || RENDER_STYLE['かわいい'];
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
   * 3. 素材ボタンの組み合わせ → キャラクター説明文
   * ====================================================================== */
  function charaDesc(state) {
    const shape = state.base || 'まんまる';
    const color = state.color || 'ミルクホワイト';
    const motif = (state.motif || '').trim() || 'くま';
    const parts = [shape + 'のかたちで、' + color + 'の' + motif];

    const face = [];
    if (state.eyes) face.push('目は' + state.eyes);
    if (state.cheek && state.cheek !== 'なし') face.push('ほっぺは' + state.cheek);
    if (state.mouth) face.push('口は' + state.mouth);
    if (face.length) parts.push(face.join('、'));

    if (state.item && state.item !== 'なし') parts.push(state.item + 'を身につけている');
    if (state.accent && state.accent !== 'なし') parts.push(state.accent + 'を差し色に');
    if (state.personality) parts.push('せいかくは' + state.personality);

    return parts.join('。') + '。';
  }

  /* ======================================================================
   * 4. build() ― 完成した画像生成プロンプト
   * ====================================================================== */

  function aim(state) {
    const motif = (state.motif || '').trim() || 'くま';
    return 'ボタンを組み合わせて作る、あなたのブランドの相棒マスコット（' +
      (state.world || 'かわいい') + 'の世界観／モチーフ：' + motif + '）。三面図の設定資料として書き出します。';
  }

  /** 1ビューぶんの完成プロンプト（build と imageSlots で共有＝二重管理しない） */
  function buildOnePrompt(state, view) {
    const brand = state.brandName ? '「' + state.brandName + '」の' : '';
    const toneWord = state.tone || '親しみやすい';
    const colorNote = state.brandColor ? '全体の配色は' + state.brandColor + 'に寄せる。' : '';

    const text = brand + 'ブランドマスコットの設定資料。小さな相棒キャラクター。' +
      charaDesc(state) + '雰囲気は' + toneWord + '。' +
      '【構図】この1枚は' + view.view + '。キャラクターを中央に大きく、全身が収まるように配置。' +
      '【画風】' + renderStyle(state) + worldFixed(state) + colorNote +
      '【一貫性】三面図として体型・色・パーツ・比率を他のビューと完全に統一する。' +
      '【背景】無地に近いシンプルな背景で、キャラクターを引き立てる。' +
      '【注意】ビュー名・キャプションなどの文字ラベル、ロゴ、透かしは一切入れない。';

    return text.replace(/。+/g, '。');
  }

  function build(state) {
    const prompts = VIEWS.map(function (v) { return buildOnePrompt(state, v); });

    const usage = '【使い方】① ボタンを選ぶ（🎲ランダムで組み合わせ変更）→ ② 下のプロンプトをコピー → ③ 画像生成AI（ChatGPT Image 2.0 / Midjourney / DALL·E など）に貼る。Image 2.0 なら三面図を1枚にまとめて出すと統一しやすい → ④「画像を用意する」で正面・横・背面をセット';

    const head = renderSections([{ title: 'このマスコットの狙い', body: aim(state) }]);

    const promptBody = VIEWS
      .map(function (v, i) { return '□ ' + v.label + '\n' + prompts[i]; })
      .join('\n\n');

    const promptSection = joinLines([
      '同じキャラクターの三面図として、次の3枚を一貫した見た目で作ってください（ChatGPT Image 2.0 なら、正面・横・背面を1枚に横並びで出すと統一しやすいです）。',
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
   * 4b. imageSlots() ― 「画像を用意する」ステップ用のスロット（三面図）
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
   * 5. 入力項目（fields）― かわいい素材のボタン。random:false 以外は
   *    🎲ランダムでシャッフルされ、組み合わせで個性が出る。
   * ====================================================================== */
  const FIELDS = [
    {
      key: 'world', label: '世界観', icon: '🌏', group: 'basic', type: 'chips', random: false,
      hint: '固定の設定資料風トーンがまるごと切り替わります。',
      options: ['かわいい', 'サイバーパンク', 'スチームパンク']
    },
    {
      key: 'base', label: 'かたち', icon: '⬤', group: 'basic', type: 'chips',
      hint: 'シルエットの基本の形。',
      options: ['まんまる', 'たまご型', 'ぷにぷに', 'ずんぐり', 'ふわふわ']
    },
    {
      key: 'motif', label: 'モチーフ', icon: '🐻', group: 'basic', type: 'chips', allowCustom: true,
      hint: '何をベースにするか（自由入力も可）。',
      options: ['くま', 'うさぎ', 'ねこ', 'いぬ', 'とり', 'ひよこ', 'おばけ', 'まめ', 'おだんご', 'ロボ', 'しずく']
    },
    {
      key: 'color', label: 'いろ', icon: '🎨', group: 'basic', type: 'chips', allowCustom: true,
      hint: 'メインカラー。',
      options: ['ミルクホワイト', 'ベビーピンク', 'ミントグリーン', 'レモンイエロー', 'ラベンダー', 'スカイブルー', 'くすみベージュ', 'コーラル']
    },
    {
      key: 'eyes', label: 'め', icon: '👀', group: 'basic', type: 'chips',
      options: ['つぶら', 'まんまる', 'たれ目', 'きらきら', 'てんてん', 'ジト目']
    },
    {
      key: 'cheek', label: 'ほっぺ', icon: '🌸', group: 'basic', type: 'chips',
      options: ['ぽっと赤い', 'そばかす', 'うずまき', 'なし']
    },
    {
      key: 'mouth', label: 'くち', icon: '👄', group: 'basic', type: 'chips',
      options: ['にこにこ', 'むふ', 'ちいさめ', 'への字', 'あーん']
    },
    {
      key: 'item', label: 'アイテム', icon: '🎀', group: 'basic', type: 'chips',
      options: ['リボン', 'ぼうし', 'マフラー', 'はっぱ', 'ちいさなカバン', '王冠', 'めがね', 'なし']
    },
    {
      key: 'accent', label: 'アクセント', icon: '✨', group: 'basic', type: 'chips',
      hint: '差し色・模様。',
      options: ['ほし', 'みずたま', 'しましま', 'チェック', 'ハート', 'なし']
    },
    {
      key: 'personality', label: 'せいかく', icon: '💭', group: 'basic', type: 'chips',
      options: ['人懐っこい', 'のんびりや', '元気いっぱい', 'はずかしがり', 'まじめ', 'いたずらっ子']
    },
    {
      key: 'tone', label: 'テイスト', icon: '🎭', group: 'basic', type: 'chips', random: false, allowCustom: true,
      hint: '雰囲気（任意）。LP作成・アイコン作成と同じ語彙です。',
      options: ['高級感', '親しみやすい', 'ポップ・元気', '信頼・誠実', 'おしゃれ・洗練', 'エモい']
    },

    /* --- 掲載情報（折りたたみ / group:info） --- */
    { key: 'brandName', label: 'ブランド名・キャラ名', icon: '🏷️', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）ほぐしラボ／もちすけ' },
    { key: 'brandColor', label: 'ブランドカラー・参考色', icon: '🎨', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）深緑と生成り' },

    /* --- 詳細設定（折りたたみ / group:advanced） --- */
    { key: 'ref', label: '参考にしたいトーン・作風', icon: '🔎', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）〇〇のマスコットのような親しみやすさ／設定資料集の雰囲気' },
    { key: 'extra', label: '補足・調整したいこと', icon: '📝', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）目を大きめに／手足は短めに など' }
  ];

  const DEFAULT_STATE = {
    world: 'かわいい',
    base: 'まんまる',
    motif: 'くま',
    color: 'ミルクホワイト',
    eyes: 'つぶら',
    cheek: 'ぽっと赤い',
    mouth: 'にこにこ',
    item: 'リボン',
    accent: 'ほし',
    personality: '人懐っこい',
    tone: '親しみやすい',
    brandName: '',
    brandColor: '',
    ref: '',
    extra: ''
  };

  /* ======================================================================
   * 6. プリセット（🎁おまかせで相性のいい組み合わせが1つ出る）
   * ====================================================================== */
  const PRESETS = [
    {
      id: 'kuma', name: 'まんまるクマの相棒', icon: '🧸',
      description: '生成り背景に映える、王道でやさしいゆるキャラ。',
      useCases: ['お店やブランドの親しみやすいマスコットが欲しい'],
      values: { world: 'かわいい', base: 'まんまる', motif: 'くま', color: 'ミルクホワイト', eyes: 'つぶら', cheek: 'ぽっと赤い', mouth: 'にこにこ', item: 'リボン', accent: 'ほし', personality: '人懐っこい', tone: '親しみやすい' }
    },
    {
      id: 'mochi', name: 'ぷにぷにおだんご', icon: '🍡',
      description: 'まるっと柔らかい、ポップで元気なおだんごキャラ。',
      useCases: ['スイーツ・カフェ系のゆるいマスコットが欲しい'],
      values: { world: 'かわいい', base: 'ぷにぷに', motif: 'おだんご', color: 'ベビーピンク', eyes: 'てんてん', cheek: 'うずまき', mouth: 'むふ', item: 'なし', accent: 'みずたま', personality: 'のんびりや', tone: 'ポップ・元気' }
    },
    {
      id: 'cyber', name: 'サイバーな相棒ロボ', icon: '🤖',
      description: 'ネオンを効かせた、無機質さも同居する近未来の相棒。',
      useCases: ['テック系・ゲーム系の世界観に合うマスコットが欲しい'],
      values: { world: 'サイバーパンク', base: 'ずんぐり', motif: 'ロボ', color: 'スカイブルー', eyes: 'きらきら', cheek: 'なし', mouth: 'ちいさめ', item: 'めがね', accent: 'しましま', personality: 'まじめ', tone: 'おしゃれ・洗練' }
    },
    {
      id: 'steam', name: 'スチームパンクなとり', icon: '⚙️',
      description: '真鍮と歯車の、骨董図鑑のように落ち着いた設定資料風。',
      useCases: ['クラシックで重厚な世界観のマスコットが欲しい'],
      values: { world: 'スチームパンク', base: 'たまご型', motif: 'とり', color: 'くすみベージュ', eyes: 'ジト目', cheek: 'そばかす', mouth: 'への字', item: 'ぼうし', accent: 'チェック', personality: 'いたずらっ子', tone: '高級感' }
    }
  ];

  /* ======================================================================
   * 7. 登録
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
