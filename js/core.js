/* =========================================================================
 * core.js
 * PromptMaker シリーズ共通コア
 * -------------------------------------------------------------------------
 * ここには「ポスター固有の知識」を一切書かない。
 * テンプレート（poster / movie / thumbnail ...）を登録するための
 * レジストリと、汎用ユーティリティだけを持つ。
 *
 * 新しい PromptMaker を追加したい場合は
 *   PromptMaker.registerTemplate({ ... })
 * を呼ぶファイルを 1 枚追加するだけでよい。
 * ========================================================================= */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
   * テンプレートレジストリ
   * ------------------------------------------------------------------ */

  /** @type {Object.<string, Template>} 登録済みテンプレート（id をキーに保持） */
  const templates = {};

  /** @type {string[]} 登録順を保つための id 配列（Object のキー順に依存しない） */
  const templateOrder = [];

  /**
   * テンプレートを登録する。
   *
   * @param {Object} template
   * @param {string}   template.id       - 一意なID（localStorage のキーにも使う）
   * @param {string}   template.name     - タブに表示する名前
   * @param {string}   template.icon     - タブに表示する絵文字
   * @param {boolean} [template.enabled] - false ならタブは「準備中」表示になる
   * @param {Field[]}  template.fields   - 入力項目の定義（描画順）
   * @param {Preset[]} template.presets  - 内蔵プリセット
   * @param {function} template.build    - (state) => string  プロンプト本文を生成
   */
  function registerTemplate(template) {
    if (!template || !template.id) {
      throw new Error('registerTemplate: id は必須です');
    }
    if (templates[template.id]) {
      throw new Error('registerTemplate: id が重複しています -> ' + template.id);
    }

    // 省略可能なプロパティに既定値を入れておく（呼び出し側の分岐を減らすため）
    templates[template.id] = Object.assign(
      { enabled: true, icon: '✨', fields: [], presets: [] },
      template
    );
    templateOrder.push(template.id);
  }

  /** 登録済みテンプレートを登録順の配列で返す */
  function getTemplates() {
    return templateOrder.map(function (id) {
      return templates[id];
    });
  }

  /** id からテンプレートを 1 件取得する */
  function getTemplate(id) {
    return templates[id] || null;
  }

  /* ------------------------------------------------------------------
   * 汎用ユーティリティ
   * ------------------------------------------------------------------ */

  /** 配列から要素を 1 つランダムに選ぶ */
  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /**
   * 空でない値だけを残して改行で連結する。
   * プロンプト組み立てで「未入力の行を消す」ために多用する。
   */
  function joinLines(lines) {
    return lines
      .filter(function (line) {
        return line !== null && line !== undefined && String(line).trim() !== '';
      })
      .join('\n');
  }

  /**
   * プロンプトのセクション配列を、見出し付きの読みやすい本文に整形する。
   *
   * 中身が空のセクションは丸ごと捨てるので、
   * 各テンプレートの build() は「とりあえず全部詰める」だけでよい。
   *
   * @param {Array.<{title: string, body: string}>} sections
   * @returns {string}
   */
  function renderSections(sections) {
    return sections
      .filter(function (section) {
        return section && section.body && String(section.body).trim() !== '';
      })
      .map(function (section) {
        return '■ ' + section.title + '\n' + String(section.body).trim();
      })
      .join('\n\n');
  }

  /* ------------------------------------------------------------------
   * localStorage ラッパ
   * ------------------------------------------------------------------
   * file:// で開くと localStorage が使えないブラウザ設定もあるため、
   * 失敗しても例外を投げずに null / false を返す。
   * ------------------------------------------------------------------ */

  const STORAGE_PREFIX = 'promptmaker.v1.';

  const storage = {
    /** ユーザー保存プリセットを読み込む（テンプレートごとに分離） */
    load: function (templateId) {
      try {
        const raw = global.localStorage.getItem(STORAGE_PREFIX + templateId);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    /** ユーザー保存プリセットを丸ごと書き戻す */
    save: function (templateId, presets) {
      try {
        global.localStorage.setItem(STORAGE_PREFIX + templateId, JSON.stringify(presets));
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  /* ------------------------------------------------------------------
   * 公開API
   * ------------------------------------------------------------------ */

  global.PromptMaker = {
    registerTemplate: registerTemplate,
    getTemplates: getTemplates,
    getTemplate: getTemplate,
    utils: {
      pickRandom: pickRandom,
      joinLines: joinLines,
      renderSections: renderSections
    },
    storage: storage
  };

  /* ------------------------------------------------------------------
   * Node からも同じロジックを再利用できるようにする（将来のAI自動化用）
   * ------------------------------------------------------------------
   * ブラウザでは window.PromptMaker として動く。将来ローカルサーバーから
   * 画像生成・LPコード生成APIを叩く自動化スクリプトを書くときは、
   * この core.js と template.lp.js を Node からそのまま require して、
   * ブラウザと全く同じプロンプト生成ロジックを使い回す想定。
   * 詳しくは automation/README.md を参照。
   * ------------------------------------------------------------------ */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PromptMaker;
  }
})(typeof window !== 'undefined' ? window : global);
