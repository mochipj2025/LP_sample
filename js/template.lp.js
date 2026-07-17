/* =========================================================================
 * template.lp.js
 * LP StructureMaker ― 「LPの構成（骨組み）の設計図」テンプレート定義
 * -------------------------------------------------------------------------
 * このファイルだけで完結する:
 *   - FIELDS    : 入力項目（UIはこれを見て自動生成される）
 *   - PRESETS   : ワンクリックで全項目が埋まる内蔵プリセット
 *   - build()   : state -> 完成した「構成の設計図」テキスト
 *   - wireframe(): state -> 見取り図（積み木ワイヤーフレーム）用のブロック配列
 *
 * ここには「LPの知識」だけを書く。UI や登録の仕組みは core.js / app.js 側。
 * ========================================================================= */

(function (global) {
  'use strict';

  const { joinLines, renderSections } = global.PromptMaker.utils;

  /* ======================================================================
   * 1. 業種 → ジャンル判定
   * ====================================================================== */
  const FOOD = ['飲食店', 'カフェ・ベーカリー', 'バー・居酒屋'];
  const STORE = ['サロン・整体', '美容室', 'ネイルサロン', '美容室・ネイル', 'クリニック・歯科', 'ジム・教室'];

  function genreOf(type) {
    if (FOOD.indexOf(type) >= 0) return 'food';
    if (STORE.indexOf(type) >= 0) return 'store';
    if (type === 'SaaS・アプリ') return 'saas';
    if (type === 'EC・物販') return 'ec';
    if (type === 'セミナー・講座') return 'seminar';
    if (type === 'コーポレート' || type === '個人・作家') return 'corp';
    return 'store'; // 自由入力・未知はサービス系を既定に
  }

  /* ======================================================================
   * 2. セクション辞書（部品）
   * ====================================================================== */
  const LABELS = {
    fv: 'ファーストビュー',
    empathy: '共感（悩み・憧れ）',
    concept: 'コンセプト・選ばれる理由',
    benefit: 'ベネフィット（得られる未来）',
    feature: '特徴・機能',
    gallery: '雰囲気・ギャラリー',
    proof: '実績・お客様の声',
    flow: '利用の流れ',
    access: 'アクセス・店舗情報',
    profile: '運営者・スタッフ紹介',
    faq: 'よくある質問',
    news: 'お知らせ・特典',
    cta: '最後のひと押し（CTA）'
  };

  function menuLabel(genre) {
    return {
      food: '看板メニュー',
      store: '料金・メニュー',
      saas: '料金プラン',
      ec: '商品ラインナップ',
      seminar: 'カリキュラム・料金',
      corp: 'サービス内容'
    }[genre] || 'メニュー・料金';
  }

  function labelOf(id, state) {
    if (id === 'gallery' && state.type === '個人・作家') return '制作実績・作品';
    if (id === 'gallery' && state.type === '美容室') return 'スタイルギャラリー';
    if (id === 'feature' && state.type === '個人・作家') return 'サービス内容';
    if (id === 'feature' && state.type === 'サロン・整体') return '選ばれる理由';
    if (id === 'feature' && state.type === '美容室') return '選ばれる理由・サロンの特徴';
    if (id === 'feature' && state.type === 'セミナー・講座') return '講座の特徴';
    if (id === 'feature' && state.type === 'EC・物販') return '比較・選ばれる理由';
    if (id === 'profile' && state.type === '美容室') return 'スタイリスト紹介';
    if (id === 'profile' && state.type === 'サロン・整体') return '施術者紹介';
    if (id === 'profile' && state.type === 'セミナー・講座') return '講師紹介';
    if (id === 'profile' && state.type === '個人・作家') return 'プロフィール';
    if (id === 'proof' && state.type === 'セミナー・講座') return '受講生の声・実績';
    if (id === 'proof' && state.type === 'SaaS・アプリ') return '導入実績・お客様の声';
    if (id === 'proof' && state.type === '個人・作家') return 'お客様の声';
    return id === 'menu' ? menuLabel(genreOf(state.type)) : LABELS[id];
  }

  /**
   * 入力欄（FIELDS）のラベルを業種で少し変える。
   * labelOf() は「設計図の見出し」用、こちらは「入力フォームのラベル」用。
   * 該当なし（null）を返したときは、呼び出し側が FIELDS 側の既定ラベルを使う。
   * v2（作り直し中の情報設計）が「掲載情報のラベルも業種で変わってほしい」
   * という要望から追加。app.js 側は業種の知識を一切持たないので、
   * ここに書くだけで v1 / v2 どちらからも呼べるようにしておく。
   */
  function inputLabelOf(key, state) {
    if (key === 'menuItems') return menuLabel(genreOf(state.type));
    if (key === 'infoFeature') {
      if (state.type === '個人・作家') return 'こだわり・制作スタイル';
      if (state.type === 'サロン・整体') return '選ばれる理由・こだわり';
      if (state.type === '美容室') return '選ばれる理由・サロンの特徴';
      if (state.type === 'クリニック・歯科') return '選ばれる理由・こだわり';
      if (state.type === 'ジム・教室') return '選ばれる理由・こだわり';
      if (state.type === 'セミナー・講座') return '講座の特徴・こだわり';
      if (state.type === 'SaaS・アプリ') return '機能・こだわり';
      if (state.type === 'EC・物販') return '比較・選ばれるこだわり';
    }
    return null;
  }

  /** そのセクションに「何を書くか」のガイド（業種で少し変える） */
  function guideOf(id, state) {
    const g = genreOf(state.type);
    const goal = state.goal || '行動';
    switch (id) {
      case 'fv':
        return g === 'food'
          ? '店名／一番の魅力をひと言／「' + goal + '」ボタン。主役写真は看板料理か内装。'
          : '誰の何を解決・実現するかを一言で／サブコピー／「' + goal + '」ボタン。主役ビジュアルを大きく。';
      case 'empathy':
        return '読み手が「自分のことだ」と感じる悩み・憧れを、そのままの言葉で2〜4個。';
      case 'concept':
        return g === 'food'
          ? 'なぜこの店か。素材・つくり手・空間のこだわりを短く。'
          : 'なぜ選ばれるのか＝提案の核。他とどう違うかを一言で。';
      case 'benefit':
        return '機能ではなく「得られる結果・未来」を3つ。読み手の目線で。';
      case 'feature':
        if (state.type === 'サロン・整体') return '根本原因へのアプローチ、負担の少ない施術、カウンセリングなど、選ばれる理由を3〜4つ。';
        if (state.type === '美容室') return 'カウンセリング、薬剤・ケア、空間、再現性など、サロンの特徴を3〜4つ。';
        if (state.type === 'セミナー・講座') return '実践的な教材、質問・添削、サポート、成果物など、講座ならではの特徴を3〜4つ。';
        if (state.type === 'EC・物販') return '一般的な商品との違いを比較表で明確に。成分、品質、使いやすさ、保証などを具体的に。';
        if (state.type === '個人・作家') return '提供できるサービスを3〜4つ。対象、納品物、依頼するメリットが分かるように。';
        return '主要な機能・特徴を、数字や具体例で。使い方のイメージが湧くように。';
      case 'menu':
        return menuGuide(g);
      case 'gallery':
        if (state.type === '美容室') return 'ショート、ロング、メンズなど、得意なスタイルを写真で一覧化。髪型の違いが分かる構図で。';
        if (state.type === 'ネイルサロン') return 'シンプル、ニュアンス、アートなど、ネイルデザインを写真で一覧化。';
        if (state.type === '個人・作家') return '代表的な制作実績・作品を3〜6件。案件の種類と担当範囲を短く添える。';
        return '雰囲気が伝わる写真を数枚（料理・内装・スタッフなど）。世界観を見せる。';
      case 'proof':
        return '実績の数字／お客様の声を2〜3件。年代や職業など属性を添えると信頼が増す。';
      case 'flow':
        return 'はじめての人が迷わないよう、' + goal + 'までの流れを3〜4ステップで。';
      case 'access':
        return '住所・営業時間・定休日・電話・地図・駐車場など、来店に必要な情報。';
      case 'profile':
        if (state.type === '美容室') return 'スタイリストの顔写真、得意なスタイル、経験、人柄。指名予約につながる内容に。';
        if (state.type === 'サロン・整体') return '施術者の顔写真、資格、経験、施術への考え方。安心して任せられる根拠を示す。';
        if (state.type === 'セミナー・講座') return '講師の顔写真、経歴、実務経験、受講生に伝えられること。';
        if (state.type === '個人・作家') return '本人の顔写真、経歴、得意分野、仕事で大切にしていること。';
        return '運営者・講師・スタッフの人柄や経歴。信頼と親近感を添える。';
      case 'faq':
        return '申し込み前の不安をQ&Aで先回り。3〜5個。';
      case 'news':
        return '常連さん向けの新情報・季節メニュー・限定特典など。「また来る理由」を作る。';
      case 'cta':
        return '最後にもう一度「' + goal + '」へ。手段（電話・フォーム・ボタン）と背中を押す一言。';
      default:
        return '';
    }
  }

  function menuGuide(g) {
    return {
      food: '写真＋名前＋価格で看板メニューを3品ほど。一番の推しを先頭に。',
      store: '料金・コースを分かりやすく。おすすめプランを目立たせる。',
      saas: '料金プランを松竹梅で。売りたいプランを目立たせ、無料枠があれば明記。',
      ec: '商品ラインナップと価格。人気・おすすめを先頭に。',
      seminar: 'カリキュラム（学べること）と受講料。日程・定員も明記。',
      corp: '提供サービスの一覧と特徴を簡潔に。'
    }[g] || '内容と価格を分かりやすく。';
  }

  /** 見取り図でのブロックの見た目の種類 */
  const KIND = { fv: 'hero', cta: 'cta', menu: 'cards', gallery: 'gallery', proof: 'cards', feature: 'cards' };

  /* ======================================================================
   * 3. 並べ替えルール（ジャンル × ボリューム）
   * ====================================================================== */
  const ORDERS = {
    food: {
      short: ['fv', 'concept', 'menu', 'access', 'cta'],
      standard: ['fv', 'concept', 'menu', 'gallery', 'proof', 'access', 'cta'],
      full: ['fv', 'concept', 'menu', 'gallery', 'proof', 'flow', 'access', 'faq', 'cta']
    },
    store: {
      short: ['fv', 'empathy', 'concept', 'menu', 'cta'],
      standard: ['fv', 'empathy', 'concept', 'benefit', 'proof', 'menu', 'cta'],
      full: ['fv', 'empathy', 'concept', 'benefit', 'proof', 'menu', 'flow', 'access', 'faq', 'cta']
    },
    saas: {
      short: ['fv', 'benefit', 'feature', 'menu', 'cta'],
      standard: ['fv', 'empathy', 'benefit', 'feature', 'proof', 'menu', 'cta'],
      full: ['fv', 'empathy', 'concept', 'benefit', 'feature', 'proof', 'menu', 'faq', 'cta']
    },
    ec: {
      short: ['fv', 'benefit', 'menu', 'cta'],
      standard: ['fv', 'benefit', 'concept', 'proof', 'menu', 'cta'],
      full: ['fv', 'benefit', 'concept', 'proof', 'menu', 'faq', 'cta']
    },
    seminar: {
      short: ['fv', 'benefit', 'menu', 'cta'],
      standard: ['fv', 'empathy', 'benefit', 'menu', 'proof', 'cta'],
      full: ['fv', 'empathy', 'benefit', 'menu', 'proof', 'profile', 'faq', 'cta']
    },
    corp: {
      short: ['fv', 'concept', 'cta'],
      standard: ['fv', 'concept', 'benefit', 'proof', 'cta'],
      full: ['fv', 'concept', 'benefit', 'proof', 'profile', 'cta']
    }
  };

  /* プリセット完成見本に合わせた業種専用の構成。
   * プリセット画像がある業種はこちらを優先し、共通ジャンル型は自由入力時の予備にする。 */
  const TYPE_ORDERS = {
    '飲食店': {
      short: ['fv', 'concept', 'menu', 'access', 'cta'],
      standard: ['fv', 'concept', 'menu', 'gallery', 'proof', 'access', 'cta'],
      full: ['fv', 'concept', 'menu', 'gallery', 'proof', 'flow', 'access', 'faq', 'cta']
    },
    'カフェ・ベーカリー': {
      short: ['fv', 'concept', 'menu', 'access', 'cta'],
      standard: ['fv', 'concept', 'menu', 'gallery', 'proof', 'access', 'cta'],
      full: ['fv', 'concept', 'menu', 'gallery', 'proof', 'flow', 'access', 'faq', 'cta']
    },
    'サロン・整体': {
      short: ['fv', 'empathy', 'concept', 'menu', 'cta'],
      standard: ['fv', 'empathy', 'concept', 'feature', 'menu', 'proof', 'flow', 'cta'],
      full: ['fv', 'empathy', 'concept', 'feature', 'profile', 'menu', 'proof', 'flow', 'cta']
    },
    '美容室': {
      short: ['fv', 'concept', 'gallery', 'menu', 'cta'],
      standard: ['fv', 'concept', 'feature', 'gallery', 'profile', 'menu', 'proof', 'access', 'cta'],
      full: ['fv', 'concept', 'feature', 'gallery', 'profile', 'menu', 'proof', 'flow', 'access', 'faq', 'cta']
    },
    'ネイルサロン': {
      short: ['fv', 'concept', 'menu', 'cta'],
      standard: ['fv', 'concept', 'gallery', 'profile', 'menu', 'proof', 'access', 'cta'],
      full: ['fv', 'empathy', 'concept', 'feature', 'gallery', 'profile', 'menu', 'proof', 'flow', 'access', 'faq', 'cta']
    },
    'セミナー・講座': {
      short: ['fv', 'benefit', 'menu', 'cta'],
      standard: ['fv', 'benefit', 'feature', 'menu', 'proof', 'profile', 'cta'],
      full: ['fv', 'benefit', 'feature', 'menu', 'proof', 'profile', 'faq', 'cta']
    },
    'SaaS・アプリ': {
      short: ['fv', 'benefit', 'feature', 'menu', 'cta'],
      standard: ['fv', 'empathy', 'benefit', 'feature', 'flow', 'proof', 'menu', 'faq', 'cta'],
      full: ['fv', 'empathy', 'concept', 'benefit', 'feature', 'flow', 'proof', 'menu', 'faq', 'cta']
    },
    'EC・物販': {
      short: ['fv', 'benefit', 'menu', 'cta'],
      standard: ['fv', 'empathy', 'benefit', 'concept', 'flow', 'feature', 'proof', 'menu', 'faq', 'cta'],
      full: ['fv', 'empathy', 'benefit', 'concept', 'flow', 'feature', 'proof', 'menu', 'faq', 'cta']
    },
    '個人・作家': {
      short: ['fv', 'gallery', 'feature', 'cta'],
      standard: ['fv', 'benefit', 'gallery', 'feature', 'flow', 'proof', 'profile', 'cta'],
      full: ['fv', 'concept', 'benefit', 'gallery', 'feature', 'flow', 'proof', 'profile', 'faq', 'cta']
    }
  };

  function volumeKey(volume) {
    if (!volume) return 'standard';
    if (volume.indexOf('短') >= 0) return 'short';
    if (volume.indexOf('しっかり') >= 0 || volume.indexOf('長') >= 0) return 'full';
    return 'standard';
  }

  /** 読み手の状態で強弱を微調整（不足セクションを CTA の前に補う） */
  function adjustForReader(order, reader) {
    order = order.slice();
    function ensureBeforeCta(id) {
      if (order.indexOf(id) >= 0) return;
      const i = order.indexOf('cta');
      if (i >= 0) order.splice(i, 0, id);
      else order.push(id);
    }
    if (reader && reader.indexOf('比較検討') >= 0) {
      ensureBeforeCta('proof');
      ensureBeforeCta('faq');
    } else if (reader && reader.indexOf('認知') >= 0) {
      if (order.indexOf('empathy') < 0) {
        const i = order.indexOf('concept');
        order.splice(i >= 0 ? i : 1, 0, 'empathy');
      }
      ensureBeforeCta('benefit');
    } else if (reader && reader.indexOf('購入寸前') >= 0) {
      ensureBeforeCta('menu');
      ensureBeforeCta('flow');
    } else if (reader && (reader.indexOf('常連') >= 0 || reader.indexOf('既存') >= 0)) {
      // すでに知っている相手に「共感からの説得」は不要。新情報と特典で再訪を作る
      const e = order.indexOf('empathy');
      if (e >= 0) order.splice(e, 1);
      const fv = order.indexOf('fv');
      order.splice(fv + 1, 0, 'news');
    }
    return order;
  }

  function resolveOrder(state) {
    const g = genreOf(state.type);
    const vol = volumeKey(state.volume);
    const typeOrder = TYPE_ORDERS[state.type];
    if (typeOrder) return typeOrder[vol].slice();
    const base = (ORDERS[g] || ORDERS.store)[vol].slice();
    return adjustForReader(base, state.reader);
  }

  /* ======================================================================
   * 4. build() ― 完成した「構成の設計図」
   * ====================================================================== */

  const USAGE = '【使い方】① 下をコピー → ② ChatGPT か Claude を開く → ③ 貼って送信';
  const USAGE_MAKE = '【使い方】① 下をコピー → ② Claude / ChatGPT / v0 に貼る → ③ その場でLPのプレビューが表示されます';

  function aim(state) {
    const tone = state.tone ? '「' + state.tone + '」を基調にした' : '';
    const type = state.type || '（業種未選択）';
    const reader = state.reader || '（読み手未選択）';
    const goal = state.goal || '（ゴール未選択）';
    return tone + type + 'のLP。読み手は「' + reader + '」。ゴールは「' + goal + '」。';
  }

  /** menuItems（商品・メニュー、行を増減できる欄）を「・品名：価格」の行配列にする */
  function menuItemLines(state) {
    return (state.menuItems || [])
      .filter(function (item) { return item && (item.name || item.price); })
      .map(function (item) {
        return '・' + (item.name || '（品名未入力）') + (item.price ? '：' + item.price : '');
      });
  }

  /** links（SNS・予約・地図などのリンク、行を増減できる欄）を「・種類：URL」の行配列にする */
  function linkLines(state) {
    return (state.links || [])
      .filter(function (item) { return item && (item.label || item.url); })
      .map(function (item) {
        return '・' + (item.label || 'リンク') + '：' + (item.url || '（URL未入力）');
      });
  }

  function infoBody(state) {
    const pairs = [
      ['店名・ブランド名', state.infoName],
      ['日時・期間', state.infoDate],
      ['場所・アクセス', state.infoPlace],
      ['特徴・こだわり', state.infoFeature]
    ];
    const lines = pairs
      .filter(function (p) { return p[1]; })
      .map(function (p) { return '・' + p[0] + '：' + p[1]; });

    const menuLines = menuItemLines(state);
    if (menuLines.length) {
      // 店名の直後に差し込む（店名が無ければ先頭になる）
      lines.splice(1, 0, '・商品・メニュー：\n  ' + menuLines.join('\n  '));
    }

    const linkLinesArr = linkLines(state);
    if (linkLinesArr.length) {
      // リンクは末尾（他の情報を読んだ後にたどる導線なので最後でよい）
      lines.push('・リンク：\n  ' + linkLinesArr.join('\n  '));
    }

    if (lines.length === 0) return '';
    return joinLines(['以下は必ずLPに正確に入れる情報です（空欄は無視）。', joinLines(lines)]);
  }

  function tasteOf(state) {
    const byType = {
      '飲食店': 'シズル感のある料理写真／温かく落ち着いた照明',
      'カフェ・ベーカリー': '明るい自然光／木の温もり／やわらかなカフェ写真',
      'バー・居酒屋': '夜の暖色照明／料理とドリンクのシズル感',
      '美容室': '清潔感のある実写／やわらかな自然光／髪の艶と毛流れ',
      'ネイルサロン': '明るく清潔な実写／指先の色と質感が伝わる接写'
    };
    if (byType[state.type]) return byType[state.type];
    return {
      food: 'シズル感のある料理写真／温かい自然光',
      store: '清潔感のある実写・やわらかい自然光',
      saas: 'クリーンでモダンなプロダクト／余白多め',
      ec: '商品が主役の高精細写真',
      seminar: '明るく信頼感のあるビジネス写真',
      corp: '端正で都会的な写真'
    }[genreOf(state.type)] || '統一感のある写真';
  }

  function imageNote(state) {
    return '各セクションの写真は、姉妹ツール「Visual PromptMaker」の Graphic タブで、テイスト＝“' + tasteOf(state) + '”にすると世界観が揃います。';
  }

  function designDirection(state) {
    const directions = {
      '美容室': 'プリセット完成見本のデザインDNA：白〜アイボリーを基調に淡いピンクを差し色。細い罫線、十分な余白、明朝体の大見出し。ヒーローは左に短いコピー、右にモデル写真。スタイル写真は整然としたグリッド、料金・スタッフ・口コミは淡い色面でコンパクトにまとめる。黒い全面背景や強いグラデーションは使わない。',
      'ネイルサロン': 'プリセット完成見本のデザインDNA：白〜アイボリーを基調に、くすみピンクとベージュを差し色。指先の写真を主役に、細い罫線、明朝体見出し、繊細で清潔な余白。デザイン見本は整ったカードグリッドで見せる。',
      '飲食店': 'プリセット完成見本のデザインDNA：墨色と生成りを軸に、料理写真を大きく見せる和モダン。明朝体、細い金色の線、落ち着いた余白。メニューは写真付きカード、アクセスは濃色面で締める。',
      'カフェ・ベーカリー': 'プリセット完成見本のデザインDNA：アイボリー、セージグリーン、テラコッタ。丸みのあるカードと自然光の写真、やさしい余白。店内・メニュー・口コミを明るく親しみやすく並べる。',
      'サロン・整体': 'プリセット完成見本のデザインDNA：白と淡いブルーを基調に、清潔感と安心感を最優先。悩み、選ばれる理由、施術者、コース、流れを情報整理されたカードで見せる。',
      'セミナー・講座': 'プリセット完成見本のデザインDNA：ネイビー、白、ゴールド。実績とカリキュラムを端正なカードで整理し、講師の信頼感と申込導線を強く見せる。',
      'SaaS・アプリ': 'プリセット完成見本のデザインDNA：白を基調に青〜紫のアクセント。ダッシュボードUIを大きく見せ、機能、導入フロー、料金を均整の取れたB2Bカードで整理する。',
      'EC・物販': 'プリセット完成見本のデザインDNA：アイボリー、深いグリーン、銅色。商品写真と成分・使用手順を上質に見せ、オファー部分は明快な価格とCTAで締める。',
      '個人・作家': 'プリセット完成見本のデザインDNA：白とチャコールにコーラルを一点。作品実績を大きなグリッドで見せ、サービス、制作フロー、プロフィールを編集的に構成する。'
    };
    return directions[state.type] || '選択したプリセット完成見本と同系統の配色、書体、余白、写真比率、セクション密度で統一する。';
  }

  /** 出力タイプで切り替える（設計図 / 制作プロンプト / 画像プロンプト集） */
  function build(state) {
    if (state.output && state.output.indexOf('画像') >= 0) return buildImagePrompts(state);
    if (state.output && state.output.indexOf('制作') >= 0) return buildMakePrompt(state);
    return buildBlueprint(state);
  }

  /** (A) 構成の設計図 ― 考える・原稿づくり用 */
  function buildBlueprint(state) {
    const order = resolveOrder(state);

    const listBody = order
      .map(function (id, i) { return (i + 1) + '. ' + labelOf(id, state); })
      .join('\n');

    const guideBody = order
      .map(function (id, i) { return (i + 1) + '. ' + labelOf(id, state) + '：' + guideOf(id, state); })
      .join('\n');

    const sections = renderSections([
      { title: 'このLPの狙い', body: aim(state) },
      { title: '構成（この順で並べます）', body: listBody },
      { title: '各セクションに書くこと', body: guideBody },
      { title: '掲載する情報（必ず入れる）', body: infoBody(state) },
      { title: '参考トーン・サイト', body: state.ref },
      { title: '補足・調整したいこと', body: state.extra },
      { title: '画像づくり（Visual PromptMaker 連携）', body: imageNote(state) },
      {
        title: 'このあと',
        body:
          'この設計図をコピーして、AIに「この構成でLPの原稿を書いて」と渡せば原稿ができます。\n' +
          '「出力タイプ」を “LP制作プロンプト（コードまで）” にすればLPそのもの、\n' +
          '“必要な画像プロンプト集” にすれば、このLPに使う画像の生成プロンプトが一式出ます。'
      }
    ]);

    return USAGE + '\n\n' + sections;
  }

  /** (B) LP制作プロンプト ― そのままAIに投げてLPのコードにする */
  function buildMakePrompt(state) {
    const order = resolveOrder(state);

    const structure = order
      .map(function (id, i) { return (i + 1) + '. ' + labelOf(id, state) + '：' + guideOf(id, state); })
      .join('\n');

    // ステップ②でセットされた画像（app.js が state._images に入れる）
    const have = state._images || [];
    const haveMap = {};
    have.forEach(function (x) { haveMap[x.id] = x.file; });
    const slots = imageSlots(state);
    const readyLines = slots
      .filter(function (s) { return haveMap[s.id]; })
      .map(function (s) { return '・' + haveMap[s.id] + ' … ' + s.label + '（' + s.ratio + '）'; });
    const missingLines = slots
      .filter(function (s) { return !haveMap[s.id]; })
      .map(function (s) { return '・' + s.label + '（' + s.ratio + '）'; });

    const imageBody = readyLines.length
      ? joinLines([
          '以下の画像ファイルを、index.html と同じフォルダに用意してあります。',
          '<img src="images/xxx.jpg"> のように、この相対パスをそのまま使ってください（別のURLに変えない）。',
          readyLines.join('\n'),
          missingLines.length ? '\nまだ無い画像（下記）は https://placehold.co の仮画像で実装し、後で差し替えられるようにしてください。\n' + missingLines.join('\n') : '',
          '各画像のテイストは “' + tasteOf(state) + '” で統一しています。'
        ])
      : joinLines([
          '・画像は https://placehold.co のプレースホルダーで実装し、後で差し替え可能にする。',
          '・各画像のテイストは “' + tasteOf(state) + '” を想定（実画像は姉妹ツール Visual PromptMaker で作成）。'
        ]);

    const usage = readyLines.length
      ? '【使い方】① 下をコピー → ② Claude / ChatGPT / v0 に貼る → ③ プレビューを確認 → ④ できた index.html を、書き出した images フォルダと同じ場所に保存すれば完成'
      : USAGE_MAKE;

    const sections = renderSections([
      {
        title: '依頼',
        body: joinLines([
          'あなたは世界トップクラスのWebデザイナー兼フロントエンドエンジニアです。',
          '以下の要件で、テンプレート感のない“オリジナルで高品質”なランディングページ(LP)を、完成品として1枚つくってください。'
        ])
      },
      {
        title: '表示のしかた（プレビュー必須）',
        body: joinLines([
          'コードを返すだけでなく、その場で見られる“動くプレビュー”として表示してください。あなたのツールのプレビュー機能を使ってください：',
          '・Claude → アーティファクトでLPをプレビュー表示',
          '・ChatGPT → Canvas（HTMLプレビュー）で表示',
          '・v0 / bolt / Cursor → ライブプレビューで表示',
          '・Gemini など → HTMLプレビューが使えれば表示',
          'まず動くLPを見せ、そのうえでコードを提示してください。'
        ])
      },
      { title: 'このLPの狙い', body: aim(state) },
      { title: '構成（この順で・各セクションに入れる内容）', body: structure },
      {
        title: '掲載する情報（正確に反映）',
        body: infoBody(state) || joinLines([
          '掲載情報は未入力です。店名・価格・日時・場所などの固有情報は、',
          '【店名】【価格】のような仮置きで示し、あとで差し替えやすくしてください。',
          '架空の実績・数字・お客様の声を「事実」として作らないでください（例文である旨がわかる形に）。'
        ])
      },
      {
        title: 'デザイン方向性',
        body: joinLines([
          state.tone ? '・トーン：' + state.tone : '',
          state.ref ? '・参考：' + state.ref : '',
          '・' + designDirection(state),
          '・プリセット完成見本から外れた別テイストへ再解釈しない。配色・書体・余白・カード形状・写真の見せ方を一貫させる。',
          '・日本語の可読性を最優先。見出しと本文でコントラストをつける。',
          '・スクロールで軽やかに現れる、上品なマイクロインタラクション。'
        ])
      },
      { title: '画像', body: imageBody },
      {
        title: '技術要件',
        body: joinLines([
          '・単一のHTMLファイル（レスポンシブ）。CSSは<style>に内包、JSは必要最小限を<script>に内包。外部依存は原則なし。',
          '・モバイルファースト。セマンティックHTML、アクセシビリティ（十分なコントラスト・alt・フォーカス）。',
          '・実在の商標や特定個人の写真は使わない。',
          '・まず完成した1ファイルを提示し、説明は最小限に。'
        ])
      },
      { title: '補足', body: state.extra }
    ]);

    return usage + '\n\n' + sections;
  }

  /* --------------------------------------------------------------------
   * 画像スロット ― 1枚ごとに「固有の被写体」を持つ。
   * 同じ文章の使い回しはしない（4枚頼んで同じ絵が返るのを防ぐ）。
   * -------------------------------------------------------------------- */

  const SLOT_DEF = {
    fv: { label: 'メインビジュアル', ratio: '16:9', count: 1 },
    empathy: { label: '悩み・共感', ratio: '3:2', count: 1 },
    concept: { label: 'こだわりカット', ratio: '4:5', count: 1 },
    benefit: { label: '得られる未来', ratio: '3:2', count: 1 },
    feature: { label: '特徴・機能', ratio: '3:2', count: 1 },
    menu: { ratio: '3:2', count: 3 },
    gallery: { label: '雰囲気カット', ratio: '4:3', count: 4 },
    proof: { label: 'お客様ポートレート', ratio: '1:1', count: 2 },
    flow: { label: '利用の流れ', ratio: '3:2', count: 1 },
    access: { label: 'アクセス・店舗情報', ratio: '3:2', count: 1 },
    profile: { label: 'スタッフ・講師ポートレート', ratio: '4:5', count: 1 },
    faq: { label: 'よくある質問', ratio: '3:2', count: 1 },
    news: { label: 'お知らせ・特典', ratio: '3:2', count: 1 },
    cta: { label: 'CTA背景', ratio: '16:9', count: 1 }
  };

  const FV_SUBJ = {
    food: '看板料理または店内の主役カット。湯気や照りのシズル感を主役に、奥行きのある構図で',
    store: '明るく清潔なサービス・施術シーンの主役カット。安心感と心地よさが伝わる構図で',
    saas: 'プロダクトの画面を主役にした、クリーンで抽象的なキービジュアル',
    ec: '商品を主役にした、質感の伝わるキービジュアル',
    seminar: '講師が生き生きと話す明るい登壇シーン',
    corp: 'オフィスやチームの端正で都会的なカット'
  };

  const CONCEPT_SUBJ = {
    food: '素材や仕込みの手元、つくり手の所作が伝わる寄りのカット',
    store: 'カウンセリングや施術の、ていねいな手元・所作のカット',
    saas: 'チームがプロダクトを使いこなしている様子のクローズアップ',
    ec: '製造・素材・裏側のこだわりが伝わるカット',
    seminar: '受講生と向き合う講師、教材のクローズアップ',
    corp: '仕事の現場・技術のディテールが伝わるカット'
  };

  /** メニュー各品の土台となる被写体（品目ごとに構図を変える） */
  const MENU_SUBJ = {
    food: 'の料理単品カット。器と質感が映えるように',
    store: 'の施術・コース内容が伝わるシーン。受けている心地よさが伝わるように',
    saas: 'のプランを象徴するクリーンなビジュアル',
    ec: 'の商品単品の物撮り。背景はシンプルに',
    seminar: 'の回のイメージカット。学びの手応えが伝わるように',
    corp: 'のサービスを象徴するカット'
  };
  const MENU_ANGLE = [
    '真横からの寄りで、質感とディテールを主役に。',
    '斜め上からの構図で、全体の美しさと余白を活かして。',
    '俯瞰（真上）気味の構図で、配置の美しさを見せて。'
  ];

  /** 雰囲気カット4枚：ジャンルごとの被写体 × 4方向 */
  const GENRE_SCENES = {
    food: { place: '店内・カウンター全体', detail: '料理や器、素材', people: '調理や接客の様子', outside: '店の外観や看板' },
    store: { place: '施術ルーム・個室全体', detail: 'ケア用品やタオルなどの小物', people: 'カウンセリングや施術の様子', outside: '店の外観や街並み' },
    saas: { place: 'プロダクトのメイン画面', detail: '特徴的な機能のUI', people: 'チームで使っている様子', outside: '導入企業のオフィスイメージ' },
    ec: { place: '商品のある暮らしのシーン', detail: 'パッケージや素材の質感', people: '商品を使う人の様子', outside: 'ブランドの世界観が伝わる情景' },
    seminar: { place: '会場やオンライン受講の風景', detail: '教材やノートの寄り', people: '受講風景・講師との対話', outside: '会場の外観や街並み' },
    corp: { place: 'オフィスの全景', detail: '技術・道具のディテール', people: 'チームが働く様子', outside: '社屋の外観' }
  };
  function gallerySubjects(g) {
    const s = GENRE_SCENES[g] || GENRE_SCENES.store;
    return [
      s.place + 'が伝わる引きのカット。奥行きのある構図で',
      s.detail + 'のクローズアップ。質感が際立つ寄りで',
      s.people + 'が自然に写る、ドキュメンタリー風のカット',
      s.outside + 'のカット。思わず入りたくなる佇まいで'
    ];
  }

  function customerVoiceSubjects(state) {
    const common = {
      food: [
        '40代の日本人男性客。私服のジャケット姿で客席のテーブルに座り、食事後に満足して微笑む。店を利用する来店客として撮影。制服、作務衣、エプロン、名札なし。店員や料理人に見せない',
        '30代の日本人女性客。上品な私服で客席のテーブルに座り、食事後に自然に微笑む。店を利用する来店客として撮影。制服、作務衣、エプロン、名札なし。店員に見せない'
      ],
      store: [
        '30代の日本人女性客。施術やサービスを受けた後、私服で受付側に座り自然に微笑む利用者。制服、白衣、エプロン、名札なし。スタッフに見せない',
        '40代の日本人男性客。施術やサービスを受けた後、私服で落ち着いて微笑む利用者。制服、白衣、エプロン、名札なし。スタッフに見せない'
      ],
      saas: [
        '30代の日本人女性会社員。導入企業の利用担当者として私服のオフィスカジュアルでノートPCの前に座り、自然に微笑む',
        '40代の日本人男性会社員。導入企業の管理者としてスーツではないオフィスカジュアルで画面を確認し、満足した表情を見せる'
      ],
      ec: [
        '30代の日本人女性購入者。商品を実際に使う一般消費者として自宅で自然に微笑む。販売員、研究員、スタッフに見せない',
        '40代の日本人男性購入者。商品を手にした一般消費者として自宅で自然に微笑む。制服、名札なし。販売員に見せない'
      ],
      seminar: [
        '20代後半の日本人女性受講生。私服で教材とノートを持ち、受講後の自信が伝わる自然な笑顔。講師や運営スタッフに見せない',
        '30代の日本人男性受講生。私服でノートPCと成果物を持ち、受講後に満足して微笑む。講師や運営スタッフに見せない'
      ],
      corp: [
        '30代の日本人女性クライアント。依頼企業の担当者として私服のオフィスカジュアルで完成物を見ながら微笑む',
        '40代の日本人男性クライアント。発注者側の担当者として私服のオフィスカジュアルで完成物に満足する自然な表情'
      ]
    };
    const byType = {
      '個人・作家': [
        '30代の日本人女性依頼者。受け取った作品を手に、私服で自然に微笑む利用者。作家本人やスタッフに見せない',
        '40代の日本人男性依頼者。依頼した作品を手にして、私服で満足そうに微笑む利用者。作家本人やスタッフに見せない'
      ]
    };
    if (byType[state.type]) return byType[state.type];
    return common[genreOf(state.type)] || common.store;
  }

  /* 画像はLP構成用の大分類ではなく、選択された業種ごとに描き分ける。 */
  const IMAGE_TYPE = {
    '飲食店': {
      fv: '看板料理を主役にした食欲をそそる一皿。湯気と照り、店内をぼかした背景',
      concept: '料理人が旬の食材を丁寧に仕込む手元のアップ',
      menu: '料理', place: '落ち着いた店内とテーブル席', detail: '料理、器、旬の食材', people: '料理人の調理とスタッフの接客', outside: '入口、暖簾、店の看板'
    },
    'カフェ・ベーカリー': {
      fv: '焼きたてのパンとコーヒーを並べた明るいカフェテーブル。朝の柔らかな光',
      concept: 'バリスタがコーヒーを淹れる手元、またはパンを成形する職人の手元',
      menu: 'ドリンクや焼き菓子、パン', place: '自然光が入る居心地のよいカフェ店内', detail: 'ラテ、焼き菓子、パン、木のトレー', people: '会話を楽しむ来店客とスタッフ', outside: 'カフェの入口と小さな看板'
    },
    'バー・居酒屋': {
      fv: '看板の一皿とドリンクを主役にした夜のテーブル。暖色の照明とシズル感',
      concept: 'バーテンダーのカクテル作り、または料理人の炙り調理の手元',
      menu: '料理やドリンク', place: '暖色照明のカウンターと店内', detail: 'グラス、酒瓶、料理の盛り付け', people: '乾杯する客と接客するスタッフ', outside: '夜の店先、提灯や看板'
    },
    'サロン・整体': {
      fv: '清潔な個室で、施術ベッドにうつ伏せで横たわりリラックスする利用者の肩や背中に、施術者が両手を自然に添える整体シーン。体は真横から見た構図にして、腕や脚が不自然にねじれたり関節が破綻したりしないように、解剖学的に自然なポーズと体の向きで。安心できる穏やかな表情',
      concept: 'カウンセリングと丁寧な施術の手元のアップ',
      menu: '施術・コース', place: '清潔で落ち着いた施術室', detail: '施術ベッド、タオル、ケア用品', people: '施術ベッドにうつ伏せで横たわりリラックスする利用者と、その脇に自然な姿勢で立つ施術者。体の向きや手足の関節が破綻しない、解剖学的に自然なポーズで、真横または斜め後ろから見た構図', outside: '入りやすいサロンの入口'
    },
    '美容室': {
      fv: '洗練された美容室で、完成したヘアスタイルを美しく見せる日本人モデル',
      concept: '美容師が髪をカットする繊細な手元と、美しいカットライン',
      menu: 'ヘアスタイル', place: '鏡とスタイリングチェアが並ぶ洗練された美容室', detail: 'ハサミ、コーム、カラー道具、髪の艶と毛流れ', people: '髪をカットする美容師と日本人モデル', outside: 'おしゃれな美容室の入口と外観'
    },
    'ネイルサロン': {
      fv: '洗練されたネイルサロンで、美しいネイルデザインを見せる日本人女性の手元',
      concept: 'ネイリストが細い筆でネイルアートを施す繊細な手元の接写',
      menu: 'ネイルデザイン', place: '清潔でおしゃれなネイルテーブルとサロン店内', detail: 'ジェル、カラーチャート、ネイルチップ、完成した指先', people: '向かい合って施術するネイリストと利用者の手元', outside: '上品で入りやすいネイルサロンの入口'
    },
    'クリニック・歯科': {
      fv: '明るく清潔な診察室で医療スタッフが患者に優しく説明する場面',
      concept: '医師が模型やモニターを使って丁寧に説明する手元',
      menu: '診療・治療内容', place: '衛生的で明るい受付と診察室', detail: '医療機器、診察道具、清潔な設備', people: '説明する医療スタッフと安心した患者', outside: '清潔感のある医院入口'
    },
    'ジム・教室': {
      fv: '明るいスタジオでトレーナーや講師と参加者が前向きに取り組む場面',
      concept: '一人ひとりにフォームや課題を丁寧に教える指導シーン',
      menu: 'レッスン・コース', place: '明るく整ったスタジオや教室', detail: 'トレーニング器具や教材', people: '指導する講師と集中する参加者', outside: '教室やジムの入口'
    },
    'SaaS・アプリ': {
      fv: 'ノートPCに表示された見やすい業務ダッシュボード。クリーンなデスク',
      concept: 'チームが画面を見ながら業務改善を話し合う場面',
      menu: '料金プラン', place: 'プロダクトのダッシュボード全体', detail: '主要機能のUIとデータ表示', people: 'オフィスでサービスを使うチーム', outside: '導入企業の現代的なオフィス'
    },
    'EC・物販': {
      fv: '商品を主役にした上質な物撮り。素材と質感が分かる柔らかな光',
      concept: '素材選びや製造工程、職人の手元のアップ',
      menu: '商品', place: '商品を使う心地よい暮らしの場面', detail: 'パッケージ、素材、細部の質感', people: '商品を自然に使う人物', outside: 'ブランドの世界観を表す情景'
    },
    'セミナー・講座': {
      fv: '講師が受講者に向けて生き生きと話す明るい講座風景',
      concept: '講師が受講者の質問に寄り添って答える場面',
      menu: '講座・カリキュラム', place: '会場またはオンライン講座の全景', detail: '教材、ノート、学習画面', people: '集中して学ぶ受講者と講師', outside: '明るいセミナー会場の入口'
    },
    'コーポレート': {
      fv: '現代的なオフィスで協働するプロフェッショナルなチーム',
      concept: '現場の技術や仕事へのこだわりが伝わる手元のアップ',
      menu: '企業サービス', place: '整ったオフィスや仕事の現場', detail: '技術、設備、仕事道具', people: '打ち合わせや作業をするチーム', outside: '企業の社屋や受付'
    },
    '個人・作家': {
      fv: '作品とともに仕事場に立つクリエイター。人柄が伝わる自然な表情',
      concept: '作品を制作する手元と道具のクローズアップ',
      menu: '作品・提供サービス', place: '個性が伝わるアトリエや仕事場', detail: '作品、素材、愛用する道具', people: '制作に集中する本人', outside: 'アトリエや活動場所の入口'
    }
  };

  const EMPATHY_SUBJ = {
    '飲食店': '店選びに迷い、スマートフォンで飲食店を比較している日本人の男女。自然な日常の表情',
    'カフェ・ベーカリー': '落ち着いて過ごせる場所を探し、街中でカフェを検索している日本人女性。少し疲れた自然な表情',
    'バー・居酒屋': '仕事帰りに入る店を決められず、スマートフォンで店を探す日本人の友人グループ',
    'サロン・整体': '肩や腰のつらさを感じ、日常生活で体を気にしている日本人。無理に体をひねらない、解剖学的に自然な立ち姿勢・座り姿勢で。症状を誇張しない自然な場面',
    '美容室': '髪型が決まらず鏡の前で髪を整えながら悩む日本人女性。傷みや広がりが自然に分かる場面',
    'ネイルサロン': '自分に似合うネイルが分からず、デザインを見比べながら迷う日本人女性の手元',
    'クリニック・歯科': '体や歯の不調に不安を感じ、受診先をスマートフォンで調べる日本人。怖さを煽らない穏やかな場面',
    'ジム・教室': '運動や学習を始めたいが続けられるか迷い、自宅で情報を調べる日本人。前向きだが少し不安な表情',
    'SaaS・アプリ': '複数の表計算、チャット、書類に情報が散らばり、確認作業に困っている日本人のオフィスチーム',
    'EC・物販': '商品の違いが分からず、スマートフォンで比較しながら購入を迷う日本人。生活の中の自然な場面',
    'セミナー・講座': '学び直したいが講座選びや将来に迷い、PCで情報を比較する日本人。前向きな悩みが伝わる場面',
    'コーポレート': '業務課題を抱え、資料を前に解決策を検討する日本人の担当者とチーム',
    '個人・作家': '依頼先が見つからず、複数のポートフォリオを比較して迷う日本人の依頼者'
  };

  function imageTypeOf(state) {
    // 旧版で保存された設定は美容室として扱い、ネイル画像と混在させない
    if (state.type === '美容室・ネイル') return IMAGE_TYPE['美容室'];
    return IMAGE_TYPE[state.type] || null;
  }

  function visualTone(state) {
    return {
      '高級感': '上質で落ち着いた光、深みのある色',
      '親しみやすい': '明るい自然光、やわらかい色',
      'ポップ・元気': '明るく鮮やかな色、軽快な雰囲気',
      '信頼・誠実': '清潔で明るい光、自然な色',
      'おしゃれ・洗練': '余白のある構図、洗練された色',
      'エモい': '印象的な逆光、少しノスタルジックな色'
    }[state.tone] || '自然な光、統一感のある色';
  }

  /** スロット1枚ぶんの完成プロンプトに仕上げる（句読点の重複も整える） */
  function finishPrompt(state, subject, ratio) {
    const medium = state.type === 'SaaS・アプリ' ? '洗練されたWeb用ビジュアル' : 'LP用の自然な広告写真';
    return subject.replace(/。+$/, '') + '。' + medium + '。' + visualTone(state) +
      '。文字、ロゴ、透かしなし。比率 ' + ratio + '。';
  }

  /**
   * 画像スロット一覧 ― ステップ②と「画像プロンプト集」の共通ソース。
   * 各スロット＝1枚。id はファイル名の元（images/<id>.jpg）。prompt は1枚ごとに固有。
   */
  /** 「実物を反映（写真を崩さない）」にチェックの入ったスロットへ追記する注記 */
  function refLockNote(state, sid) {
    if (!state._refLock || !state._refLock[sid]) return '';
    return '\n※参照画像あり：アップロードする実在の人物・内装・外装の写真を元に加工してください。' +
      '顔立ちや建物の造作・配置・構造など、実物の特徴は変えずに保ったまま、雰囲気やライティングだけ整えること。' +
      '人物や建物を新しく作り変えたり、別人・別の建物にしたりしないこと。';
  }

  /**
   * 'menu' スロットを「ヘアスタイル」「プラン」など別概念の見本カットで使う業種の一覧。
   * これらは実際の商品・メニュー入力とは無関係な固定カットなので、
   * 枚数を menuItems の入力数に合わせない（＝美容室と同じ扱い）。
   */
  const SPECIAL_MENU_SHOTS = {
    'ネイルサロン': [
      { label: 'シンプルネイル', subject: '日本人女性の手元に施した上品なワンカラーまたはグラデーションネイル。指先全体が分かる接写' },
      { label: 'ニュアンスネイル', subject: '日本人女性の手元に施した洗練されたニュアンスネイル。色と質感が分かる斜め上からの接写' },
      { label: 'アートネイル', subject: '日本人女性の手元に施した繊細なアートネイル。細部のデザインが分かる指先の接写' }
    ],
    'SaaS・アプリ': [
      { label: '基本プラン', subject: '個人や小規模チームがノートPCでサービスを使う場面。シンプルなダッシュボード画面を主役にする' },
      { label: '標準プラン', subject: '複数人のチームが大型モニターのダッシュボードを見ながら共同作業する場面' },
      { label: '法人プラン', subject: '大規模なデータ分析と管理機能を表す、複数パネルの洗練されたUIビジュアル' }
    ],
    'セミナー・講座': [
      { label: '基礎編', subject: '講師の説明を聞きながら基礎教材に書き込む受講者の手元' },
      { label: '実践編', subject: '受講者がPCや教材を使って課題に取り組み、講師が助言する場面' },
      { label: '成果・修了', subject: '学びを終え、自信のある表情で成果物を見せる受講者' }
    ],
    'コーポレート': [
      { label: 'サービス1', subject: '企業の中心サービスを象徴する、実際の仕事現場と担当者' },
      { label: 'サービス2', subject: '専門的な技術や設備を使って作業する担当者の場面' },
      { label: 'サービス3', subject: '顧客と担当者が打ち合わせを行い、提案内容を確認する場面' }
    ]
    // '個人・作家' は TYPE_ORDERS のどのボリュームでも 'menu' セクションを使わないため、
    // ここに専用ショットを置いても呼ばれない（重複定義を避けるため削除済み）。
  };

  /**
   * そのスロットを何枚出すか。'menu' 以外は SLOT_DEF の固定枚数のまま。
   * 'menu' は、実際に入力された商品・メニュー数があればその数に合わせる
   * （美容室・ネイルサロンなど、別概念の固定カットを使う業種は対象外）。
   */
  function resolveSlotCount(id, def, state) {
    if (id !== 'menu') return def.count;
    if (state.type === '美容室' || state.type === '美容室・ネイル') return def.count;
    if (SPECIAL_MENU_SHOTS[state.type]) return def.count;

    const filled = (state.menuItems || []).filter(function (item) {
      return item && (item.name || item.price);
    }).length;
    return filled > 0 ? Math.min(filled, 6) : def.count;
  }

  function imageSlots(state) {
    const g = genreOf(state.type);
    const imageType = imageTypeOf(state);
    const shop = state.infoName ? '「' + state.infoName + '」' : '';
    const order = resolveOrder(state);
    const slots = [];

    order.forEach(function (id) {
      const def = SLOT_DEF[id];
      if (!def) return;

      const count = resolveSlotCount(id, def, state);

      for (let k = 0; k < count; k++) {
        const sid = count > 1 ? id + '-' + (k + 1) : id;
        let label = '';
        let subject = '';

        if (id === 'fv') {
          label = def.label;
          subject = shop + (shop ? 'の' : '') + (imageType ? imageType.fv : FV_SUBJ[g]);
        } else if (id === 'empathy') {
          label = def.label;
          subject = EMPATHY_SUBJ[state.type] ||
            (state.reader || '見込み客') + 'が抱える悩みを、暗くしすぎず自然な日常場面で表現';
        } else if (id === 'concept') {
          label = def.label;
          subject = shop + (shop ? 'の' : '') + (imageType ? imageType.concept : CONCEPT_SUBJ[g]);
        } else if (id === 'benefit') {
          label = def.label;
          subject = state.type === '個人・作家'
            ? '完成した作品を主役にした、依頼者の理想が形になった瞬間が伝わるカット'
            : imageType
              ? imageType.people + '。サービスや商品を利用した後の満足感が伝わる明るい場面'
              : '利用後の前向きな変化と満足感が伝わる場面';
        } else if (id === 'feature') {
          label = def.label;
          subject = state.type === 'SaaS・アプリ'
            ? '主要機能が分かるシンプルなダッシュボード画面。情報を整理し、UIを主役にする'
            : (imageType ? imageType.detail : 'サービスの特徴') + 'を主役にした分かりやすい接写';
        } else if (id === 'menu') {
          // 美容室は女性モデルだけに偏らないよう、人物とスタイルを3枠で明示する
          if (state.type === '美容室') {
            const hairShots = [
              { label: '女性モデル｜ショート・ボブ', subject: '日本人女性モデルのショートまたはボブの完成ヘアスタイル。顔まわりとカットラインが分かる斜め前からの上半身写真' },
              { label: '女性モデル｜ミディアム・ロング', subject: '日本人女性モデルのミディアムまたはロングの完成ヘアスタイル。毛流れと艶が分かる斜め後ろからの上半身写真' },
              { label: '男性モデル｜メンズカット', subject: '日本人男性モデルの清潔感ある完成ヘアスタイル。輪郭、前髪、サイドのカットが分かる斜め前からの上半身写真' }
            ];
            const shot = hairShots[k % hairShots.length];
            label = 'ヘアスタイル｜' + shot.label;
            subject = shot.subject;
            slots.push({ id: sid, label: label, ratio: def.ratio, prompt: finishPrompt(state, subject, def.ratio) + refLockNote(state, sid) });
            continue;
          }
          const specialShots = SPECIAL_MENU_SHOTS[state.type];
          if (specialShots) {
            const shot = specialShots[k % specialShots.length];
            label = menuLabel(g) + '｜' + shot.label;
            subject = shot.subject;
            slots.push({ id: sid, label: label, ratio: def.ratio, prompt: finishPrompt(state, subject, def.ratio) + refLockNote(state, sid) });
            continue;
          }

          // 実際に入力された商品・メニューがあれば、そのk番目をそのまま使う
          const menuEntries = (state.menuItems || []).filter(function (m) {
            return m && (m.name || m.price);
          });
          const entry = menuEntries[k];
          const entryName = entry && entry.name ? entry.name : null;
          const ordinalWord = ['一番おすすめの', '二番目の', '三番目の'][k] || (k + 1) + '番目の';

          const item = entryName
            ? '「' + entryName + '」'
            : ordinalWord + (imageType ? imageType.menu : '商品・メニュー');

          label = menuLabel(g) + 'の写真｜' +
            (entryName || (k === 0 ? '1品目・推し' : (k + 1) + '品目')) +
            (entry && entry.price ? '（' + entry.price + '）' : '');

          subject = imageType
            ? item + (entryName ? 'を主役にした写真。' : 'の写真。') + MENU_ANGLE[k % 3]
            : item + MENU_SUBJ[g] + '。' + MENU_ANGLE[k % 3];
          subject = subject.replace(/。。/g, '。');
        } else if (id === 'gallery') {
          const specialGalleries = {
            '美容室': {
              names: ['ショート', 'ロング', 'メンズ', 'バックスタイル'],
              subjects: [
                '日本人女性モデルの抜け感あるショート・ボブ。顔まわりとカットラインが分かる写真',
                '日本人女性モデルの艶のあるロング・レイヤースタイル。毛流れが分かる写真',
                '日本人男性モデルの清潔感あるメンズカット。前髪とサイドが分かる写真',
                '完成したヘアスタイルを斜め後ろから撮影。後頭部の丸みと毛流れが分かる写真'
              ]
            },
            'ネイルサロン': {
              names: ['シンプル', 'ニュアンス', 'アート', '季節デザイン'],
              subjects: [
                '上品なワンカラーまたはグラデーションネイルの手元接写',
                '洗練されたニュアンスネイルの色と質感が分かる手元接写',
                '繊細なアートネイルの細部が分かる指先の接写',
                '季節感のある限定ネイルデザインを見せる手元接写'
              ]
            },
            '個人・作家': {
              names: ['代表作品', '素材・ディテール', '制作風景', 'アトリエ・活動の場'],
              subjects: [
                '代表的な作品を主役にした、質感が伝わる端正なカット',
                '作品の素材やディテールが分かる寄りの接写',
                '作品を制作する本人の手元と道具のクローズアップ。集中する様子',
                'アトリエや活動場所の外観。個性が伝わる佇まい'
              ]
            }
          };
          const specialGallery = specialGalleries[state.type];
          const subs = specialGallery ? specialGallery.subjects : imageType ? [
            imageType.place + 'を広く見せる引きの写真',
            imageType.detail + 'の質感が分かる接写',
            imageType.people + 'の自然な場面',
            imageType.outside + 'が魅力的に見える外観写真'
          ] : gallerySubjects(g);
          const names = specialGallery ? specialGallery.names : ['全体', 'ディテール', '人の様子', '外観'];
          label = def.label + '｜' + names[k % 4];
          subject = subs[k % 4];
        } else if (id === 'proof') {
          const customerLabels = ['女性客・利用者', '男性客・利用者'];
          if (genreOf(state.type) === 'food') customerLabels.splice(0, 2, '男性客', '女性客');
          label = def.label + '｜' + customerLabels[k % 2];
          subject = customerVoiceSubjects(state)[k % 2];
        } else if (id === 'flow') {
          label = def.label;
          subject = state.type === '個人・作家'
            ? '本人が依頼者からの要望を丁寧にヒアリングし、メモを取る打ち合わせの場面'
            : imageType
              ? imageType.people + '。初めての利用者に手順を分かりやすく案内している場面'
              : '申し込みから利用までの流れが伝わる、案内を受ける利用者の場面';
        } else if (id === 'access') {
          label = def.label;
          subject = imageType
            ? imageType.outside + '。入口と周辺が分かる、正面からの明るい外観写真'
            : '建物の入口と周辺が分かる明るい外観写真';
        } else if (id === 'profile') {
          label = def.label;
          subject = state.type === '個人・作家'
            ? '日本人の本人（作家）の上半身ポートレート。アトリエや仕事場を背景に、人柄が伝わる自然な表情'
            : '日本人の運営者・スタッフの上半身ポートレート。仕事場を背景に、親しみと信頼が伝わる自然な表情';
        } else if (id === 'faq') {
          label = def.label;
          subject = state.type === '個人・作家'
            ? '本人が依頼者の質問に丁寧に答えている場面。安心感のある自然な会話'
            : 'スタッフが利用者の質問に丁寧に答えている場面。安心感のある自然な会話';
        } else if (id === 'news') {
          label = def.label;
          subject = imageType
            ? imageType.detail + '。季節限定や新しい魅力が伝わる華やかな写真'
            : '新サービスや期間限定特典の魅力が伝わる明るい写真';
        } else if (id === 'cta') {
          label = def.label;
          subject = imageType
            ? imageType.place + '。余白を広く取り、行動を後押しする明るく印象的な締めの写真'
            : 'ブランドの世界観を表す、余白の広い明るい締めのビジュアル';
        }

        slots.push({ id: sid, label: label, ratio: def.ratio, prompt: finishPrompt(state, subject, def.ratio) + refLockNote(state, sid) });
      }
    });
    return slots;
  }

  /** (C) 必要な画像プロンプト集 ― imageSlots と同じ個別プロンプトを一覧で出す */
  function buildImagePrompts(state) {
    const slots = imageSlots(state);

    const list = slots
      .map(function (s, i) { return (i + 1) + '. ' + s.label + '（' + s.ratio + '）'; })
      .join('\n');

    const prompts = slots
      .map(function (s, i) { return '■ ' + (i + 1) + '. ' + s.label + '（' + s.ratio + '）\n' + s.prompt; })
      .join('\n\n');

    return '【使い方】① 下の各プロンプトをコピー → ② 画像生成AI（Image 2.0 / Midjourney / DALL·E など）に貼る → ③ できた画像を「② 画像を用意する」の同じスロットへセット\n\n' +
      '■ このLPに必要な画像（全' + slots.length + '枚・1枚ずつ内容が違います）\n' + list + '\n\n' +
      prompts + '\n\n' +
      '■ 世界観を揃えるコツ\n' +
      '・被写体は1枚ずつ違いますが、「スタイル:」の行は全カット共通。ここを変えないことで世界観が揃います。\n' +
      '・人物やキャラクターを固定したいときは、参照画像を添えて「この見た目を保ったまま」と指示。\n' +
      '・さらに細かく作り込みたいときは、姉妹ツール「Visual PromptMaker」の Graphic タブへ。';
  }

  /* ======================================================================
   * 5. wireframe() ― 右カラムの見取り図
   * ====================================================================== */
  function wireframe(state) {
    return resolveOrder(state).map(function (id) {
      return { label: labelOf(id, state), kind: KIND[id] || 'band' };
    });
  }

  /* ======================================================================
   * 6. 入力項目（fields）
   * ====================================================================== */
  const FIELDS = [
    {
      key: 'type',
      label: '何を作る？',
      icon: '🏪',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '業種。ここで構成の並びが決まります。',
      options: [
        '飲食店', 'カフェ・ベーカリー', 'バー・居酒屋',
        'サロン・整体', '美容室', 'ネイルサロン', 'クリニック・歯科', 'ジム・教室',
        'SaaS・アプリ', 'EC・物販', 'セミナー・講座', 'コーポレート', '個人・作家'
      ]
    },
    {
      key: 'reader',
      label: '誰に見せる？',
      icon: '👤',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '読み手の状態。強調するセクションが変わります。',
      options: [
        'まだ知らない人（認知）',
        '迷っている人（比較検討）',
        'あと一押しで決める人（購入寸前）',
        '常連・既存のお客さま'
      ]
    },
    {
      key: 'goal',
      label: '何をしてほしい？',
      icon: '🎯',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '最後の行動（CTA）。',
      options: ['予約する', '問い合わせる', '購入する', '申し込む', '資料請求', '来店する', '会員登録', 'フォロー']
    },
    {
      key: 'tone',
      label: 'トーン',
      icon: '🎨',
      group: 'basic',
      type: 'chips',
      allowCustom: true,
      hint: '雰囲気（任意）。',
      options: ['高級感', '親しみやすい', 'ポップ・元気', '信頼・誠実', 'おしゃれ・洗練', 'エモい']
    },
    {
      key: 'volume',
      label: 'ボリューム',
      icon: '📐',
      group: 'basic',
      type: 'chips',
      random: false,
      hint: 'セクション数が変わります。',
      options: ['短め（要点だけ）', '標準', 'しっかり（長め）']
    },
    {
      key: 'output',
      label: '出力タイプ（作りたいものを選ぶ）',
      icon: '📤',
      group: 'basic',
      type: 'chips',
      random: false,
      sticky: true, // プリセット適用でも現在の選択を保つ
      hint: '設計図で考える？ コードにする？ 画像を用意する？',
      options: ['構成の設計図', 'LP制作プロンプト（コードまで）', '必要な画像プロンプト集']
    },

    /* --- 掲載情報（折りたたみ / group:info） --- */
    { key: 'infoName', label: '店名・ブランド名', icon: '🏷️', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）ほぐしラボ' },
    {
      key: 'menuItems',
      label: '商品・メニュー',
      icon: '🍽️',
      group: 'info',
      type: 'repeater',
      random: false,
      addLabel: '＋ 商品・メニューを追加',
      itemFields: [
        { key: 'name', placeholder: '例）初回体験コース', flex: 2 },
        { key: 'price', placeholder: '例）3,980円', flex: 1 }
      ]
    },
    { key: 'infoDate', label: '日時・期間', icon: '🗓️', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）平日10-20時 / 水曜定休' },
    { key: 'infoPlace', label: '場所・アクセス', icon: '📍', group: 'info', type: 'textarea', rows: 1, random: false, placeholder: '例）〇〇駅 徒歩5分' },
    { key: 'infoFeature', label: '特徴・こだわり', icon: '✨', group: 'info', type: 'textarea', rows: 2, random: false, placeholder: '例）国家資格保有・完全個室' },
    {
      key: 'links',
      label: 'リンク（SNS・予約・地図など）',
      icon: '🔗',
      group: 'info',
      type: 'repeater',
      random: false,
      addLabel: '＋ リンクを追加',
      itemFields: [
        { key: 'label', placeholder: '例）Instagram / 予約ページ / Googleマップ', flex: 1 },
        { key: 'url', placeholder: '例）https://instagram.com/xxxx', flex: 2 }
      ]
    },

    /* --- 詳細設定（折りたたみ / group:advanced） --- */
    { key: 'ref', label: '参考にしたいトーン・サイト', icon: '🔎', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）Apple風の余白 / 〇〇のサイトの雰囲気' },
    { key: 'extra', label: '補足・調整したいこと', icon: '📝', group: 'advanced', type: 'textarea', rows: 2, random: false, placeholder: '例）このセクションを足したい／外したい など' }
  ];

  const DEFAULT_STATE = {
    type: '飲食店',
    reader: '迷っている人（比較検討）',
    goal: '予約する',
    tone: '高級感',
    volume: '標準',
    output: '構成の設計図',
    infoName: '', menuItems: [], infoDate: '', infoPlace: '', infoFeature: '', links: [],
    ref: '', extra: ''
  };

  /* ======================================================================
   * 7. プリセット
   * ====================================================================== */
  const PRESETS = [
    {
      id: 'resto', name: '飲食店の予約LP', icon: '🍽️',
      description: '看板メニューと雰囲気で「行ってみたい」を作り、予約につなげる構成。',
      useCases: ['ディナーの新規予約を増やしたい', '記念日利用を狙いたい'],
      values: { type: '飲食店', reader: '迷っている人（比較検討）', goal: '予約する', tone: '高級感', volume: '標準' }
    },
    {
      id: 'cafe', name: 'カフェの集客LP', icon: '☕',
      description: 'まだ知らない人に、居心地とメニューで来店を促す構成。',
      useCases: ['新規オープンの認知を広げたい', 'SNSからの来店を増やしたい'],
      values: { type: 'カフェ・ベーカリー', reader: 'まだ知らない人（認知）', goal: '来店する', tone: '親しみやすい', volume: '標準' }
    },
    {
      id: 'salon', name: '整体の新規集客LP', icon: '💆',
      description: '悩み→解決→実績で信頼を積み、初回予約へ導くしっかり構成。',
      useCases: ['初回体験の予約を増やしたい', '他院と比較されている'],
      values: { type: 'サロン・整体', reader: '迷っている人（比較検討）', goal: '予約する', tone: '信頼・誠実', volume: 'しっかり（長め）' }
    },
    {
      id: 'hair', name: '美容室の指名LP', icon: '💇',
      description: 'スタイルと雰囲気で「この人にお願いしたい」を作る構成。',
      useCases: ['指名予約を増やしたい', '新規のお客さまを獲得したい'],
      values: { type: '美容室', reader: 'まだ知らない人（認知）', goal: '予約する', tone: 'おしゃれ・洗練', volume: '標準' }
    },
    {
      id: 'seminar', name: '講座の申込LP', icon: '🎓',
      description: '得られる未来→カリキュラム→受講者の声→講師で申込へ導く構成。',
      useCases: ['オンライン講座の申込を増やしたい', '受講の不安を解消したい'],
      values: { type: 'セミナー・講座', reader: '迷っている人（比較検討）', goal: '申し込む', tone: '信頼・誠実', volume: 'しっかり（長め）' }
    },
    {
      id: 'saas', name: 'SaaSの無料登録LP', icon: '💻',
      description: '課題→解決→機能→実績→料金で、無料登録へつなぐ構成。',
      useCases: ['無料トライアルの登録を増やしたい'],
      values: { type: 'SaaS・アプリ', reader: '迷っている人（比較検討）', goal: '会員登録', tone: 'おしゃれ・洗練', volume: '標準' }
    },
    {
      id: 'ec', name: 'ECの購入LP', icon: '🛍️',
      description: 'ベネフィット→こだわり→レビューで、そのまま購入へ導く構成。',
      useCases: ['単品商品の購入を増やしたい', '広告の受け皿にしたい'],
      values: { type: 'EC・物販', reader: 'あと一押しで決める人（購入寸前）', goal: '購入する', tone: '親しみやすい', volume: '標準' }
    },
    {
      id: 'personal', name: '個人サービスの問い合わせLP', icon: '🎨',
      description: '提案の核と実績・人柄で、問い合わせにつなぐシンプル構成。',
      useCases: ['個人の仕事依頼を受けたい', 'ポートフォリオから連絡をもらいたい'],
      values: { type: '個人・作家', reader: 'まだ知らない人（認知）', goal: '問い合わせる', tone: 'おしゃれ・洗練', volume: '標準' }
    }
  ];

  /* ======================================================================
   * 8. 登録
   * ====================================================================== */
  global.PromptMaker.registerTemplate({
    id: 'lp',
    name: 'LP構成',
    icon: '🧱',
    enabled: true,
    fields: FIELDS,
    presets: PRESETS,
    defaults: DEFAULT_STATE,
    build: build,
    wireframe: wireframe,
    imageSlots: imageSlots,
    inputLabelOf: inputLabelOf
  });

  /* Node（将来の自動化スクリプト）からは、この template.lp.js を require するだけで
   * 登録済みの 'lp' テンプレートを直接受け取れるようにする。core.js を先に
   * require して global.PromptMaker を用意しておくこと（automation/README.md 参照）。 */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PromptMaker.getTemplate('lp');
  }
})(typeof window !== 'undefined' ? window : global);
