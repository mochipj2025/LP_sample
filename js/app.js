/* =========================================================================
 * app.js
 * UI レイヤー
 * -------------------------------------------------------------------------
 * ここにはLPや画像作成など、個別テンプレート固有の知識を書かない。
 * 「登録されたテンプレートの fields を読んで UI を描き、
 *   state を更新し、build() を呼んで右カラムに流し込む」だけを担当する。
 *
 * → 新テンプレートを足しても、このファイルは 1 行も変更不要。
 * ========================================================================= */

(function (global) {
  'use strict';

  const { pickRandom } = global.PromptMaker.utils;
  const storage = global.PromptMaker.storage;

  /* ------------------------------------------------------------------
   * サンプル画像の設定
   * ------------------------------------------------------------------
   * 画像の置き場所は  assets/presets/<templateId>/<presetId>.<ext>
   *   例) assets/presets/lp/cafe.png
   *
   * テンプレートごとにフォルダを分けているので、
   * 別テンプレートを追加しても同名プリセットが衝突しない。
   *
   * 拡張子は下の順に試し、最初に読めたものを採用する。
   * 全部失敗したら「画像なし」として絵文字のプレースホルダに切り替える。
   * → 画像を1枚も置いていない状態でも UI は破綻しない。
   * ------------------------------------------------------------------ */

  const ASSET_DIR = 'assets/presets';
  // 現在同梱しているLPプリセットは png。実在する形式から試して
  // ページを開くたびに不要な404を発生させない。
  const IMAGE_EXTS = ['png', 'webp', 'jpg', 'jpeg'];

  /** プリセットのサンプル画像のベースパス（拡張子なし）を返す */
  function imageBasePath(preset) {
    return ASSET_DIR + '/' + template.id + '/' + preset.id;
  }

  /**
   * img に画像を読み込む。拡張子を順に試すフォールバック付き。
   *
   * @param {Preset} preset
   * @param {HTMLImageElement} img
   * @param {function(string)} onLoad - 読めた URL を渡して呼ばれる
   * @param {function} onFail         - 全滅したときに呼ばれる
   */
  function loadPresetImage(preset, img, onLoad, onFail) {
    // ユーザー保存プリセットには id が無いので、最初から「画像なし」扱いにする
    if (!preset.id && !preset.image) {
      onFail();
      return;
    }

    // image を明示していれば、そのパスだけを試す
    const candidates = preset.image
      ? [preset.image]
      : IMAGE_EXTS.map(function (ext) {
          return imageBasePath(preset) + '.' + ext;
        });

    let index = 0;

    img.addEventListener('load', function () {
      onLoad(img.currentSrc || img.src);
    });

    img.addEventListener('error', function () {
      index += 1;
      if (index < candidates.length) {
        img.src = candidates[index];
      } else {
        onFail();
      }
    });

    img.src = candidates[0];
  }

  /** 現在適用中のプリセット（「仕上がり例」の表示判定に使う。プロンプトには含めない） */
  let activePreset = null;

  /* ------------------------------------------------------------------
   * アプリの状態
   * ------------------------------------------------------------------ */

  /** @type {Template} 現在選択中のテンプレート */
  let template = null;

  /** @type {Object} 現在の入力値（key -> value） */
  let state = {};

  /** DOM 参照をまとめて持つ（毎回 querySelector しないため） */
  const dom = {};

  /**
   * state は文字列・配列・プレーンオブジェクトだけで構成する。
   * Object.assign だけでは配列が defaults / preset と参照共有されるため、
   * state を作る入口で必ず複製する。
   * 旧版の infoProduct / infoPrice も現行の menuItems へ移行する。
   */
  function createState() {
    const merged = {};
    Array.prototype.forEach.call(arguments, function (source) {
      if (!source) return;
      Object.assign(merged, JSON.parse(JSON.stringify(source)));
    });

    if ((!Array.isArray(merged.menuItems) || merged.menuItems.length === 0) &&
        (merged.infoProduct || merged.infoPrice)) {
      merged.menuItems = [{ name: merged.infoProduct || '', price: merged.infoPrice || '' }];
    }
    delete merged.infoProduct;
    delete merged.infoPrice;

    return merged;
  }

  /* ------------------------------------------------------------------
   * 小さなヘルパ
   * ------------------------------------------------------------------ */

  /** 要素を作って属性とテキストを流し込む簡易ファクトリ */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /**
   * chips の options は文字列でも {value,label} でも書けるようにしてある。
   * ここで必ず {value,label} 形に正規化する。
   */
  function normalizeOption(option) {
    if (typeof option === 'string') return { value: option, label: option };
    return option;
  }

  /* ------------------------------------------------------------------
   * 描画：入力フィールド
   * ------------------------------------------------------------------ */

  /**
   * chips 型フィールドを描画する。
   * allowCustom が true の場合は自由入力欄も併設し、
   * 「入力欄の値こそが state の値」という単純なルールで統一する。
   */
  function renderChipsField(field) {
    const wrap = el('div', 'field');
    wrap.appendChild(renderFieldHeader(field));

    const chips = el('div', 'chips');

    field.options.map(normalizeOption).forEach(function (option) {
      const chip = el('button', 'chip', option.label);
      chip.type = 'button';
      chip.dataset.value = option.value;

      chip.addEventListener('click', function () {
        setValue(field.key, option.value);
      });

      chips.appendChild(chip);
    });

    wrap.appendChild(chips);

    // 自由入力欄（プリセットに無い値を入れたとき、ここに表示される）
    if (field.allowCustom) {
      const input = el('input', 'custom-input');
      input.type = 'text';
      input.placeholder = 'または自由に入力…';
      input.dataset.customFor = field.key;

      // input イベントで即 state 反映 → 右カラムがリアルタイム更新される
      input.addEventListener('input', function () {
        setValue(field.key, input.value, { skipInputSync: true });
      });

      wrap.appendChild(input);
    }

    return wrap;
  }

  /* ------------------------------------------------------------------
   * 描画：くり返し入力（repeater）フィールド
   * ------------------------------------------------------------------
   * 「商品名＋価格」のように、行を増減できる入力群。
   * state[field.key] は [{name, price}, ...] のような配列で持つ。
   * ここでもテンプレ固有の知識は持たない（sub フィールドの key/placeholder は
   * すべて template 側の field 定義から読むだけ）。
   * ------------------------------------------------------------------ */

  /** 1件も入っていなければ、空の1行を見せる（0行だと「＋」しか出ず迷子になるため） */
  function repeaterItems(field) {
    const list = state[field.key];
    return Array.isArray(list) && list.length ? list : [{}];
  }

  /** 行を1件更新する。DOM は再構築しない（入力中にフォーカスが飛ばないよう） */
  function setRepeaterItemValue(fieldKey, index, subKey, value) {
    const items = Array.isArray(state[fieldKey])
      ? state[fieldKey].map(function (item) { return Object.assign({}, item); })
      : [];
    if (!items[index]) items[index] = {};
    items[index][subKey] = value;
    state[fieldKey] = items;

    if (activePreset) {
      activePreset = null;
      updateSample();
    }
    updatePrompt();
  }

  /** rowsContainer の中身を、現在の state から作り直す（行の増減時だけ呼ぶ） */
  function renderRepeaterRows(field, rowsContainer) {
    const items = repeaterItems(field);
    rowsContainer.innerHTML = '';

    items.forEach(function (item, index) {
      const row = el('div', 'repeater__row');

      field.itemFields.forEach(function (sub) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'repeater__input';
        input.placeholder = sub.placeholder || '';
        input.value = item[sub.key] || '';
        if (sub.flex) input.style.flexGrow = String(sub.flex);

        input.addEventListener('input', function () {
          setRepeaterItemValue(field.key, index, sub.key, input.value);
        });

        row.appendChild(input);
      });

      const remove = el('button', 'repeater__remove', '×');
      remove.type = 'button';
      remove.title = 'この行を削除';
      remove.disabled = items.length <= 1;
      if (items.length <= 1) remove.classList.add('is-disabled');

      remove.addEventListener('click', function () {
        const arr = Array.isArray(state[field.key]) ? state[field.key].slice() : [];
        arr.splice(index, 1);
        state[field.key] = arr;
        if (activePreset) { activePreset = null; updateSample(); }
        renderRepeaterRows(field, rowsContainer);
        updatePrompt();
      });

      row.appendChild(remove);
      rowsContainer.appendChild(row);
    });
  }

  /** repeater 型フィールドを描画する */
  function renderRepeaterField(field) {
    const wrap = el('div', 'field');
    wrap.appendChild(renderFieldHeader(field));

    const rowsContainer = el('div', 'repeater__rows');
    wrap.appendChild(rowsContainer);
    renderRepeaterRows(field, rowsContainer);

    const addBtn = el('button', 'repeater__add', field.addLabel || '＋ 追加');
    addBtn.type = 'button';
    addBtn.addEventListener('click', function () {
      const arr = Array.isArray(state[field.key]) ? state[field.key].slice() : [];
      arr.push({});
      state[field.key] = arr;
      if (activePreset) { activePreset = null; updateSample(); }
      renderRepeaterRows(field, rowsContainer);
      updatePrompt();

      const rows = rowsContainer.querySelectorAll('.repeater__row');
      const lastRow = rows[rows.length - 1];
      const firstInput = lastRow && lastRow.querySelector('input');
      if (firstInput) firstInput.focus();
    });
    wrap.appendChild(addBtn);

    return wrap;
  }

  /** textarea 型フィールドを描画する */
  function renderTextareaField(field) {
    const wrap = el('div', 'field');
    wrap.appendChild(renderFieldHeader(field));

    const area = el('textarea', 'textarea');
    area.rows = field.rows || 2;
    area.placeholder = field.placeholder || '';
    area.dataset.areaFor = field.key;

    area.addEventListener('input', function () {
      setValue(field.key, area.value, { skipInputSync: true });
    });

    wrap.appendChild(area);
    return wrap;
  }

  /** ラベル + ヒント文の見出し部分 */
  function renderFieldHeader(field) {
    const header = el('div', 'field-header');

    const label = el('span', 'field-label');
    label.appendChild(el('span', 'field-icon', field.icon || ''));
    label.appendChild(el('span', null, field.label));
    header.appendChild(label);

    if (field.hint) {
      header.appendChild(el('span', 'field-hint', field.hint));
    }
    return header;
  }

  /** 1 フィールドを型に応じて描画する */
  function renderField(field) {
    if (field.type === 'textarea') return renderTextareaField(field);
    if (field.type === 'repeater') return renderRepeaterField(field);
    return renderChipsField(field);
  }

  /* ------------------------------------------------------------------
   * 描画：画面全体
   * ------------------------------------------------------------------ */

  /** 上部のテンプレートタブ（シリーズ切り替え） */
  function renderTabs() {
    dom.tabs.innerHTML = '';

    global.PromptMaker.getTemplates().forEach(function (item) {
      const tab = el('button', 'tab');
      tab.type = 'button';
      tab.appendChild(el('span', 'tab-icon', item.icon));
      tab.appendChild(el('span', null, item.name));

      if (!item.enabled) {
        tab.classList.add('is-disabled');
        tab.disabled = true;
        tab.appendChild(el('span', 'tab-badge', '準備中'));
      } else {
        tab.addEventListener('click', function () {
          switchTemplate(item.id);
        });
      }
      if (item.id === template.id) {
        tab.classList.add('is-active');
      }
      dom.tabs.appendChild(tab);
    });
  }

  /**
   * タブを切り替えて、別の PromptMaker テンプレートに丸ごと入れ替える。
   * 画面の骨格（カードやid）は共通なので、中身（プリセット・fields・state）だけ
   * 作り直す。画像まわりの一時状態（imageStore 等）はテンプレート固有の
   * 概念なので、切り替え時にリセットする。
   */
  /* ------------------------------------------------------------------
   * タブ切替時の状態引き継ぎ
   * ------------------------------------------------------------------
   * switchTemplate() は基本的に state を作り直すが、キーが完全に同じ意味で
   * 存在する項目（トーン・参考・補足など）まで消してしまうと、「LP作成で
   * トーンを決めた→画像作成に切り替えたら世界観が振り出しに戻る」という
   * 体験になる。ここに列挙したキーだけは、切替後の新テンプレートにその
   * 名前（または対応表の行き先の名前）のフィールドがある場合に限り引き継ぐ。
   *
   * ここに書くのは「キー名の対応表」というデータだけで、業種知識のような
   * ロジックは書かない（app.js がテンプレ非依存である原則は変えない）。
   * ------------------------------------------------------------------ */
  const CARRY_SAME_KEY = ['tone', 'ref', 'extra', 'brandName', 'brandColor'];
  const CARRY_KEY_MAP = { infoName: 'brandName', brandName: 'infoName' };

  function carryStateAcrossTemplates(prevState, nextTemplate) {
    const carry = {};
    const nextKeys = nextTemplate.fields.map(function (f) { return f.key; });

    CARRY_SAME_KEY.forEach(function (key) {
      if (nextKeys.indexOf(key) >= 0 && prevState[key]) carry[key] = prevState[key];
    });

    Object.keys(CARRY_KEY_MAP).forEach(function (fromKey) {
      const toKey = CARRY_KEY_MAP[fromKey];
      if (nextKeys.indexOf(toKey) >= 0 && prevState[fromKey] && !carry[toKey]) {
        carry[toKey] = prevState[fromKey];
      }
    });

    return carry;
  }

  /**
   * タブ（テンプレート）ごとのテーマ色を反映する。
   * css/style.css 側で `.shell[data-active-template="visual"]` のように
   * --rose 系トークンを上書きしているだけなので、ここでは属性を張るだけでよい
   * （色の中身は一切知らない＝app.js がテンプレ非依存という原則を保つ）。
   */
  function applyTemplateTheme() {
    if (dom.shell) dom.shell.dataset.activeTemplate = template.id;
  }

  function switchTemplate(id) {
    if (!id || (template && template.id === id)) return;
    const next = global.PromptMaker.getTemplate(id);
    if (!next) return;

    const carry = template ? carryStateAcrossTemplates(state, next) : {};

    template = next;
    state = createState(template.defaults, carry);
    activePreset = null;
    applyTemplateTheme();

    // 画像まわりの一時状態はテンプレートごとに意味が変わるため丸ごとリセット
    Object.keys(imageStore).forEach(function (k) { delete imageStore[k]; });
    Object.keys(refLockStore).forEach(function (k) { delete refLockStore[k]; });
    Object.keys(copiedStore).forEach(function (k) { delete copiedStore[k]; });
    imageSlotSig = '';

    renderTabs();
    renderPresets();
    renderFields();
    tagFieldKeys();
    renderUserPresets();
    syncAllFields();
    updatePrompt();
    updateSample();
  }

  /**
   * 内蔵プリセットをサムネイル付きカードで描画する。
   *
   * カード本体クリック  → プリセット適用
   * 虫めがねクリック    → 拡大プレビュー（画像が読めたときだけ表示）
   */
  function renderPresets() {
    dom.presets.innerHTML = '';

    template.presets.forEach(function (preset) {
      dom.presets.appendChild(renderPresetCard(preset));
    });
  }

  /** プリセット 1 枚分のカードを組み立てる */
  function renderPresetCard(preset) {
    const card = el('div', 'preset-card');

    /* --- サムネイル領域 ------------------------------------------- */
    const thumb = el('div', 'preset-card__thumb');

    // 画像が読めるまで（＝読めなかったとき）に見えている土台
    const fallback = el('div', 'preset-card__fallback');
    fallback.appendChild(el('span', 'preset-card__emoji', preset.icon));
    thumb.appendChild(fallback);

    const img = el('img', 'preset-card__img');
    img.alt = preset.name + ' の仕上がり例';
    // lazy にはしない。画面外だと読み込みが起きず、
    // 「画像あり/なし」の判定（拡大ボタンの表示）がスクロールするまで確定しないため。
    thumb.appendChild(img);

    // 拡大ボタン。画像が読めるまでは出さない
    const zoom = el('button', 'preset-card__zoom', '🔍');
    zoom.type = 'button';
    zoom.title = '拡大して見る';
    zoom.hidden = true;
    thumb.appendChild(zoom);

    loadPresetImage(
      preset,
      img,
      function (src) {
        thumb.classList.add('has-image');
        zoom.hidden = false;
        // 保存しておくと、詳細モーダルを開くとき再読み込みせずに済む
        preset._loadedSrc = src;
        zoom.title = '詳しく見る';
        zoom.addEventListener('click', function (event) {
          // カード本体の「プリセット適用」が同時に発火しないよう止める
          event.stopPropagation();
          openDetail(preset, src);
        });
      },
      function () {
        // 画像なし：img を捨てて、絵文字プレースホルダのままにする
        img.remove();
      }
    );

    /* --- 本体（クリックで適用＋自動コピー） ------------------------ */
    const apply = el('button', 'preset-card__apply');
    apply.type = 'button';
    apply.appendChild(el('span', 'preset-card__name', preset.name));
    apply.addEventListener('click', function () {
      applyPresetAndCopy(preset);
    });

    card.appendChild(thumb);
    card.appendChild(apply);
    return card;
  }

  /* ------------------------------------------------------------------
   * プリセット詳細モーダル
   * ------------------------------------------------------------------
   * 大きな見本＋説明＋用途＋埋まる設定の要約を1画面に出す。
   * ここから「この設定でコピー（適用＋コピー）」も「適用だけ」もできる。
   * ------------------------------------------------------------------ */

  /** 詳細モーダルで参照中のプリセット（CTAボタンが使う） */
  let detailPreset = null;

  /**
   * プリセットの主要な設定を「ラベル：値」の一覧にする。
   * app.js はテンプレート非依存なので、基本グループのフィールドを機械的に拾う。
   * 空・'なし' は出さない。
   */
  function buildSpecPairs(preset) {
    const merged = createState(template.defaults, preset.values);
    return template.fields
      .filter(function (field) {
        return field.group === 'basic';
      })
      .map(function (field) {
        return { label: field.label, value: merged[field.key] };
      })
      .filter(function (pair) {
        return pair.value && pair.value !== 'なし';
      });
  }

  /** プリセット詳細モーダルを開く。src は読み込み済み画像URL（無ければ省略可） */
  function openDetail(preset, src) {
    detailPreset = preset;

    const imgSrc = src || preset._loadedSrc || '';
    dom.detailImage.src = imgSrc;
    dom.detailImage.alt = preset.name + ' の仕上がり例';

    dom.detailTitle.textContent = preset.icon ? preset.icon + ' ' + preset.name : preset.name;
    dom.detailDesc.textContent = preset.description || '';

    // 用途（無ければブロックごと隠す）
    dom.detailUses.innerHTML = '';
    const uses = preset.useCases || [];
    dom.detailUsesBlock.hidden = uses.length === 0;
    uses.forEach(function (use) {
      dom.detailUses.appendChild(el('li', null, use));
    });

    // 埋まる主な設定
    dom.detailSpecs.innerHTML = '';
    buildSpecPairs(preset).forEach(function (pair) {
      dom.detailSpecs.appendChild(el('dt', null, pair.label));
      dom.detailSpecs.appendChild(el('dd', null, pair.value));
    });

    dom.detail.hidden = false;
    dom.detailApplyCopy.focus();
  }

  function closeDetail() {
    dom.detail.hidden = true;
    detailPreset = null;
    // メモリ上に大きな画像を抱えたままにしない
    dom.detailImage.removeAttribute('src');
  }

  /* ------------------------------------------------------------------
   * 出力カードの「仕上がり例」
   * ------------------------------------------------------------------
   * プリセット適用中だけ、そのサンプル画像を右カラムにも出す。
   * 画像が無ければ黙って隠す（何も置いていない初期状態では存在しない）。
   * ------------------------------------------------------------------ */

  function updateSample() {
    dom.sample.hidden = true;

    if (!activePreset) return;

    // 読み込みごとに新しい img を使う（前回の error リスナを引きずらないため）
    const img = el('img', 'sample__img');
    img.alt = activePreset.name + ' の仕上がり例';

    loadPresetImage(
      activePreset,
      img,
      function (src) {
        dom.sampleImage.src = src;
        dom.sampleImage.alt = img.alt;
        dom.sampleCaption.textContent = '「' + activePreset.name + '」の仕上がり例';
        dom.sample.hidden = false;
      },
      function () {
        dom.sample.hidden = true;
      }
    );
  }

  /** 基本 / 文言 / 掲載情報 / 詳細 の 4 グループにフィールドを振り分けて描画する */
  function renderFields() {
    const targets = {
      basic: dom.basicFields,
      copy: dom.copyFields,
      info: dom.infoFields,
      advanced: dom.advancedFields
    };

    Object.keys(targets).forEach(function (group) {
      if (targets[group]) targets[group].innerHTML = '';
    });

    template.fields.forEach(function (field) {
      const container = targets[field.group];
      if (container) container.appendChild(renderField(field));
    });
  }

  /* ------------------------------------------------------------------
   * 状態の反映
   * ------------------------------------------------------------------ */

  /**
   * state を 1 件更新し、UI とプロンプトを同期する。
   *
   * @param {string} key
   * @param {string} value
   * @param {Object} [options]
   * @param {boolean} [options.skipInputSync] - 入力中の欄を書き戻さない
   *        （テキスト入力のたびに value を代入し直すとカーソルが飛ぶため）
   */
  function setValue(key, value, options) {
    state[key] = value;

    // 手で1項目でも変えたら、もはやプリセットそのままではない。
    // 実際の設定と食い違うサンプルを出し続けないよう、仕上がり例は引っ込める。
    if (activePreset) {
      activePreset = null;
      updateSample();
    }

    syncField(key, (options && options.skipInputSync) || false);
    updatePrompt();
  }

  /** 特定フィールドの見た目（chip の選択状態・入力欄の値）を state に合わせる */
  function syncField(key, skipInputSync) {
    const value = state[key] || '';

    // chips の選択状態
    const chips = dom.form.querySelectorAll('.chip');
    chips.forEach(function (chip) {
      const field = chip.closest('.field');
      if (!field) return;
      // この chip がどのフィールドのものかは、同じ .field 内の入力欄で判定する
      if (fieldKeyOf(field) !== key) return;
      chip.classList.toggle('is-active', chip.dataset.value === value);
    });

    // repeater：プリセット適用・リセットで配列ごと入れ替わるので、行を作り直す
    const repeaterField = template.fields.find(function (f) {
      return f.key === key && f.type === 'repeater';
    });
    if (repeaterField) {
      const fieldEl = dom.form.querySelector('.field[data-key="' + key + '"]');
      const rowsEl = fieldEl && fieldEl.querySelector('.repeater__rows');
      if (rowsEl) renderRepeaterRows(repeaterField, rowsEl);
    }

    if (skipInputSync) return;

    const input = dom.form.querySelector('[data-custom-for="' + key + '"]');
    if (input) input.value = value;

    const area = dom.form.querySelector('[data-area-for="' + key + '"]');
    if (area) area.value = value;
  }

  /**
   * .field 要素から、それがどの key のフィールドかを引く。
   * 描画時に data 属性を張っておくことで DOM 走査を単純化している。
   */
  function fieldKeyOf(fieldEl) {
    return fieldEl.dataset.key;
  }

  /** すべてのフィールドを state に同期する（プリセット適用後などに使う） */
  function syncAllFields() {
    template.fields.forEach(function (field) {
      syncField(field.key, false);
    });
  }

  /** 右カラムの完成プロンプトを再生成する（リアルタイム更新の本体） */
  function updatePrompt() {
    // プリセット適用・リセット等で state が作り直されても、画像は imageStore が正
    syncImagesToState();
    // 同様に「実物を反映」チェックも refLockStore が正なので、ここで必ず復元する
    syncRefLockToState();
    const text = template.build(state);
    dom.output.textContent = text;
    dom.charCount.textContent = text.length + ' 文字';
    renderWireframe();
    renderImageSlots();
  }

  /**
   * 見取り図（積み木ワイヤーフレーム）を描く。
   * template.wireframe(state) が {label, kind}[] を返すときだけ有効。
   * app.js はLPの知識を持たない ―― ブロックを積むだけ。
   */
  function renderWireframe() {
    if (!dom.wireframe) return;

    const hasWireframe = typeof template.wireframe === 'function';
    if (dom.wfWrap) dom.wfWrap.hidden = !hasWireframe;
    if (!hasWireframe) { dom.wireframe.innerHTML = ''; return; }

    const blocks = template.wireframe(state) || [];
    dom.wireframe.innerHTML = '';
    blocks.forEach(function (b, i) {
      const node = el('button', 'wf__block wf__block--' + (b.kind || 'band'));
      node.type = 'button';
      node.title = '設計図の該当箇所を見る';
      node.appendChild(el('span', 'wf__no', String(i + 1)));
      node.appendChild(el('span', 'wf__label', b.label));

      // 見取り図 → 設計図の該当行へスクロール＆ハイライト
      node.addEventListener('click', function () {
        dom.wireframe.querySelectorAll('.wf__block').forEach(function (sib) {
          sib.classList.remove('is-active');
        });
        node.classList.add('is-active');
        highlightInOutput(b.label);
      });

      dom.wireframe.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------
   * ステップ②：画像スロット
   * ------------------------------------------------------------------
   * template.imageSlots(state) が [{id,label,ratio,prompt}] を返すときだけ
   * 画像カードを描画する。画像はメモリ上（imageStore）に保持し、
   * state._images に {id,file} の一覧を同期して build() から参照させる。
   * ------------------------------------------------------------------ */

  /** @type {Object.<string,{file:string,dataURL:string}>} スロットid -> 画像 */
  const imageStore = {};
  let imageSlotSig = '';

  /** @type {Object.<string,boolean>} スロットid -> 「実物を反映（写真を崩さない）」チェック状態 */
  const refLockStore = {};

  /** @type {Object.<string,boolean>} スロットid -> 「プロンプトをコピー済み」状態（進捗の可視化用） */
  const copiedStore = {};

  function syncRefLockToState() {
    state._refLock = Object.assign({}, refLockStore);
  }

  function slotFileName(slotId, dataURL) {
    const m = /^data:image\/(png|jpeg|jpg|webp|gif)/.exec(dataURL);
    let ext = m ? m[1] : 'jpg';
    if (ext === 'jpeg') ext = 'jpg';
    return 'images/' + slotId + '.' + ext;
  }

  function syncImagesToState() {
    state._images = Object.keys(imageStore).map(function (id) {
      return { id: id, file: imageStore[id].file };
    });
  }

  function setSlotImage(slot, dataURL) {
    imageStore[slot.id] = { file: slotFileName(slot.id, dataURL), dataURL: dataURL };
    syncImagesToState();
    imageSlotSig = ''; // サムネイル反映のため再描画
    updatePrompt();
    toast('画像をセット：' + imageStore[slot.id].file);
  }

  function clearSlotImage(slot) {
    delete imageStore[slot.id];
    syncImagesToState();
    imageSlotSig = '';
    updatePrompt();
    toast('画像を外しました');
  }

  /**
   * アップロードした画像を WebP に変換する（Canvas 経由・依存ゼロ）。
   * アニメーションが消えてしまう GIF は変換しない。
   * 変換に対応していないブラウザや失敗時は、元の画像をそのまま使う
   * （＝ UI が壊れることはない）。
   *
   * @param {File} file
   * @param {string} dataURL - file を読み込んだ元の dataURL
   * @param {function(string)} done - 使うべき dataURL（変換後 or 元のまま）を渡して呼ばれる
   */
  function toWebpDataURL(file, dataURL, done) {
    if (file && file.type === 'image/gif') { done(dataURL); return; }

    const img = new Image();
    img.onload = function () {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        const webpURL = canvas.toDataURL('image/webp', 0.85);
        // 非対応ブラウザは png 等に黙ってフォールバックすることがあるため、
        // 実際に webp が返ってきたときだけ採用する
        done(webpURL.indexOf('data:image/webp') === 0 ? webpURL : dataURL);
      } catch (e) {
        done(dataURL);
      }
    };
    img.onerror = function () { done(dataURL); };
    img.src = dataURL;
  }

  /** 画像カードの再描画（スロット構成・文面が変わったときだけ） */
  function renderImageSlots() {
    if (!dom.imageCard) return;
    if (typeof template.imageSlots !== 'function') { dom.imageCard.hidden = true; return; }

    const slots = template.imageSlots(state);
    const validIds = {};
    slots.forEach(function (slot) { validIds[slot.id] = true; });

    // 商品数を減らしたときなど、画面から消えたスロットの画像をZIPへ残さない。
    let removedImage = false;
    [imageStore, refLockStore, copiedStore].forEach(function (store) {
      Object.keys(store).forEach(function (id) {
        if (validIds[id]) return;
        if (store === imageStore) removedImage = true;
        delete store[id];
      });
    });
    if (removedImage) syncImagesToState();

    // 枚数だけでなく文面も署名に含め、商品名・被写体・トーンを変えたときに
    // 古い画像プロンプトが画面へ残らないようにする。
    const sig = template.id + '|' + JSON.stringify(slots.map(function (slot) {
      return [slot.id, slot.label, slot.ratio, slot.prompt];
    }));
    if (sig === imageSlotSig) { updateImageMeta(slots); return; }
    imageSlotSig = sig;

    dom.imageCard.hidden = false;
    dom.imageSlots.innerHTML = '';

    slots.forEach(function (slot) {
      const row = el('div', 'imgslot');

      const head = el('div', 'imgslot__head');
      head.appendChild(el('span', 'imgslot__label', slot.label));
      head.appendChild(el('span', 'imgslot__ratio', slot.ratio));

      const refLock = el('label', 'imgslot__reflock');
      const refCheckbox = document.createElement('input');
      refCheckbox.type = 'checkbox';
      refCheckbox.checked = !!refLockStore[slot.id];
      refCheckbox.addEventListener('change', function () {
        if (refCheckbox.checked) refLockStore[slot.id] = true; else delete refLockStore[slot.id];
        syncRefLockToState();
        imageSlotSig = ''; // プロンプトに注記が付く/消えるので再構築する
        renderImageSlots();
        updatePrompt();
      });
      refLock.appendChild(refCheckbox);
      refLock.appendChild(el('span', null, '実物を反映（写真を崩さない）'));
      head.appendChild(refLock);

      row.appendChild(head);

      const acts = el('div', 'imgslot__acts');

      const copy = el('button', 'imgslot__btn', '📋 プロンプト');
      copy.type = 'button';
      copy.title = 'この画像の生成プロンプトをコピー';
      if (copiedStore[slot.id]) copy.classList.add('is-copied');
      copy.addEventListener('click', function () {
        writeClipboard(slot.prompt, function (ok) {
          if (ok) {
            copiedStore[slot.id] = true;
            copy.classList.add('is-copied');
            copy.textContent = '✅ コピー済み';
          }
          toast(ok ? '「' + slot.label + '」のプロンプトをコピーしました' : 'コピーできませんでした');
        });
      });
      if (copiedStore[slot.id]) copy.textContent = '✅ コピー済み';
      acts.appendChild(copy);

      const pick = el('label', 'imgslot__btn');
      pick.appendChild(el('span', null, '🖼 画像を選ぶ'));
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.hidden = true;
      input.addEventListener('change', function () {
        const f = input.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function () {
          toWebpDataURL(f, reader.result, function (finalDataURL) {
            setSlotImage(slot, finalDataURL);
          });
        };
        reader.readAsDataURL(f);
      });
      pick.appendChild(input);
      acts.appendChild(pick);

      row.appendChild(acts);

      const thumb = el('div', 'imgslot__thumb');
      if (imageStore[slot.id]) {
        const img = el('img');
        img.src = imageStore[slot.id].dataURL;
        img.alt = slot.label;
        thumb.appendChild(img);
        thumb.classList.add('has');
        const rm = el('button', 'imgslot__rm', '×');
        rm.type = 'button';
        rm.title = '画像を外す';
        rm.addEventListener('click', function () { clearSlotImage(slot); });
        thumb.appendChild(rm);
      }
      row.appendChild(thumb);

      dom.imageSlots.appendChild(row);
    });

    updateImageMeta(slots);
  }

  function updateImageMeta(slots) {
    const total = slots.length;
    const done = slots.filter(function (s) { return imageStore[s.id]; }).length;
    dom.imageCount.textContent = done + ' / ' + total + ' 枚セット済み';
    dom.imageZip.disabled = done === 0;
    dom.imageZip.style.opacity = done === 0 ? '.45' : '1';
  }

  /* --- zip 書き出し（依存ゼロ・無圧縮STORE方式） ----------------------- */

  function crc32(bytes) {
    if (!crc32.table) {
      const t = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      crc32.table = t;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) crc = crc32.table[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dataUrlToBytes(dataURL) {
    const bin = atob(dataURL.split(',')[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /** files: [{name, bytes}] -> zip の Uint8Array */
  function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;

    files.forEach(function (f) {
      const name = enc.encode(f.name);
      const crc = crc32(f.bytes);
      const size = f.bytes.length;

      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, size, true);
      lh.setUint32(22, size, true);
      lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, f.bytes);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, size, true);
      cd.setUint32(24, size, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + size;
    });

    let cdSize = 0;
    central.forEach(function (c) { cdSize += c.length; });

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);

    const all = parts.concat(central, [new Uint8Array(end.buffer)]);
    let total = 0;
    all.forEach(function (c) { total += c.length; });
    const out = new Uint8Array(total);
    let p = 0;
    all.forEach(function (c) { out.set(c, p); p += c.length; });
    return out;
  }

  function exportImagesZip() {
    const ids = Object.keys(imageStore);
    if (!ids.length) { toast('先に画像をセットしてね'); return; }
    const files = ids.map(function (id) {
      return { name: imageStore[id].file, bytes: dataUrlToBytes(imageStore[id].dataURL) };
    });
    const blob = new Blob([makeZip(files)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lp-images.zip';
    a.click();
    URL.revokeObjectURL(url);
    toast('画像を書き出しました（展開して index.html と同じ場所へ）');
  }

  /** HTMLエスケープ（出力ハイライト用） */
  function escapeHtml(text) {
    return text.replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /**
   * 出力テキスト内のラベル文字列を <mark> で強調し、最初の位置へスクロールする。
   * textContent は変わらないので、コピーには影響しない。
   */
  function highlightInOutput(label) {
    const text = dom.output.textContent;
    const safe = escapeHtml(text);
    const safeLabel = escapeHtml(label);
    if (safe.indexOf(safeLabel) < 0) return;

    dom.output.innerHTML = safe.split(safeLabel).join('<mark class="output-mark">' + safeLabel + '</mark>');

    const mark = dom.output.querySelector('.output-mark');
    if (!mark) return;
    const outputRect = dom.output.getBoundingClientRect();
    const markRect = mark.getBoundingClientRect();
    dom.output.scrollTop += markRect.top - outputRect.top - outputRect.height / 2 + markRect.height / 2;
  }

  /* ------------------------------------------------------------------
   * アクション（ボタン群）
   * ------------------------------------------------------------------ */

  /** プリセットを state に流し込む。未定義キーは初期値で埋める */
  function applyPreset(preset) {
    // sticky:true のフィールドは、プリセットが明示しない限り現在の値を保つ
    // （例：出力タイプ。制作モードで作業中にプリセットを押しても戻さない）
    const sticky = {};
    template.fields.forEach(function (field) {
      if (field.sticky && !(field.key in preset.values) && state[field.key] !== undefined) {
        sticky[field.key] = state[field.key];
      }
    });
    state = createState(template.defaults, preset.values, sticky);
    activePreset = preset;
    syncAllFields();
    updatePrompt();
    updateSample();
  }

  /** 初期状態に戻す */
  function reset() {
    state = createState(template.defaults);
    activePreset = null;
    syncAllFields();
    updatePrompt();
    updateSample();
    toast('リセットしました');
  }

  /**
   * 「おまかせ」：内蔵プリセットから 1 つ選ぶ。
   * 相性の取れた組み合わせが必ず出るので、失敗しない。
   */
  function omakase() {
    const preset = pickRandom(template.presets);
    applyPreset(preset);
    toast('おまかせ：' + preset.name);
  }

  /**
   * 「ランダム」：各項目を独立にシャッフルする。
   * 予想外の組み合わせが出るぶん、当たり外れがある（おまかせとの違い）。
   * random:false のフィールド（ネガティブ・追加指定）は触らない。
   */
  function randomize() {
    template.fields.forEach(function (field) {
      if (field.random === false || field.type !== 'chips') return;
      const option = normalizeOption(pickRandom(field.options));
      state[field.key] = option.value;
    });
    activePreset = null; // どのプリセットとも一致しない組み合わせになる
    syncAllFields();
    updatePrompt();
    updateSample();
    toast('ランダム生成しました');
  }

  /**
   * テキストをクリップボードへ書き込む（成否をコールバックで返す）。
   * navigator.clipboard は file:// では使えない環境があるため、
   * 失敗したら execCommand にフォールバックする。
   */
  function writeClipboard(text, done) {
    if (global.navigator.clipboard && global.isSecureContext) {
      global.navigator.clipboard.writeText(text).then(
        function () {
          done(true);
        },
        function () {
          done(legacyCopy(text));
        }
      );
    } else {
      done(legacyCopy(text));
    }
  }

  /** 旧APIによるコピー（file:// 対策）。成否を返す */
  function legacyCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  /** 「コピーする」ボタン：現在の完成プロンプトをコピーする */
  function copyPrompt() {
    writeClipboard(dom.output.textContent, function (ok) {
      toast(ok ? 'コピーしました' : 'コピーに失敗しました');
    });
  }

  /**
   * プリセットを適用し、そのまま完成プロンプトをコピーする。
   * 「プリセットを押す＝1操作で完成＆コピー」を実現し、コピー忘れを無くす。
   */
  function applyPresetAndCopy(preset) {
    applyPreset(preset);
    writeClipboard(dom.output.textContent, function (ok) {
      toast(
        ok
          ? '「' + preset.name + '」を適用してコピーしました📋'
          : '「' + preset.name + '」を適用しました（コピーは失敗）'
      );
    });
  }

  /* ------------------------------------------------------------------
   * ユーザープリセット（localStorage）
   * ------------------------------------------------------------------ */

  /** 今の入力内容に名前を付けて保存する */
  function savePreset() {
    const name = global.prompt('保存する名前を入力してください', state.theme || '無題');
    if (!name) return;

    const saved = storage.load(template.id);

    // 同名があれば上書きする（増殖を防ぐ）
    const index = saved.findIndex(function (item) {
      return item.name === name;
    });
    const values = createState(state);
    delete values._images; // 画像はブラウザ内メモリ管理。保存プリセットには含めない
    const entry = { name: name, icon: '⭐', values: values };

    if (index >= 0) saved[index] = entry;
    else saved.push(entry);

    if (storage.save(template.id, saved)) {
      renderUserPresets();
      toast('「' + name + '」を保存しました');
    } else {
      toast('保存できませんでした（ブラウザの設定を確認してください）');
    }
  }

  /** 保存済みプリセットを一覧描画する。0 件なら見出しごと隠す */
  function renderUserPresets() {
    const saved = storage.load(template.id);
    dom.userPresets.innerHTML = '';
    dom.userPresetSection.hidden = saved.length === 0;

    saved.forEach(function (preset, index) {
      const chip = el('div', 'preset preset--user');

      const load = el('button', 'preset-load');
      load.type = 'button';
      load.appendChild(el('span', 'preset-icon', preset.icon || '⭐'));
      load.appendChild(el('span', null, preset.name));
      load.addEventListener('click', function () {
        applyPresetAndCopy(preset);
      });

      const remove = el('button', 'preset-delete', '×');
      remove.type = 'button';
      remove.title = '削除';
      remove.addEventListener('click', function () {
        const list = storage.load(template.id);
        list.splice(index, 1);
        storage.save(template.id, list);
        renderUserPresets();
        toast('削除しました');
      });

      chip.appendChild(load);
      chip.appendChild(remove);
      dom.userPresets.appendChild(chip);
    });
  }

  /** 「プリセット読込」ボタン：保存欄までスクロールして注意を引く */
  function loadPresetSection() {
    const saved = storage.load(template.id);
    if (saved.length === 0) {
      toast('保存されたプリセットがありません');
      return;
    }
    renderUserPresets();
    dom.userPresetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dom.userPresetSection.classList.remove('is-flash');
    // リフローを挟まないとアニメーションが再生されない
    void dom.userPresetSection.offsetWidth;
    dom.userPresetSection.classList.add('is-flash');
  }

  /* ------------------------------------------------------------------
   * トースト通知
   * ------------------------------------------------------------------ */

  let toastTimer = null;

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('is-visible');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      dom.toast.classList.remove('is-visible');
    }, 1800);
  }

  /* ------------------------------------------------------------------
   * 起動
   * ------------------------------------------------------------------ */

  function cacheDom() {
    dom.shell = document.querySelector('.shell');
    dom.tabs = document.getElementById('tabs');
    dom.form = document.getElementById('form');
    dom.presets = document.getElementById('presets');
    dom.userPresets = document.getElementById('userPresets');
    dom.userPresetSection = document.getElementById('userPresetSection');
    dom.basicFields = document.getElementById('basicFields');
    dom.copyFields = document.getElementById('copyFields');
    dom.infoFields = document.getElementById('infoFields');
    dom.advancedFields = document.getElementById('advancedFields');
    dom.output = document.getElementById('output');
    dom.charCount = document.getElementById('charCount');
    dom.wireframe = document.getElementById('wireframe');
    dom.wfWrap = document.getElementById('wfWrap');
    dom.imageCard = document.getElementById('imageCard');
    dom.imageSlots = document.getElementById('imageSlots');
    dom.imageZip = document.getElementById('imageZip');
    dom.imageCount = document.getElementById('imageCount');
    dom.toast = document.getElementById('toast');

    dom.sample = document.getElementById('sample');
    dom.sampleImage = document.getElementById('sampleImage');
    dom.sampleCaption = document.getElementById('sampleCaption');

    dom.detail = document.getElementById('detail');
    dom.detailImage = document.getElementById('detailImage');
    dom.detailTitle = document.getElementById('detailTitle');
    dom.detailDesc = document.getElementById('detailDesc');
    dom.detailUses = document.getElementById('detailUses');
    dom.detailUsesBlock = document.getElementById('detailUsesBlock');
    dom.detailSpecs = document.getElementById('detailSpecs');
    dom.detailApplyCopy = document.getElementById('detailApplyCopy');
    dom.detailApply = document.getElementById('detailApply');
    dom.detailClose = document.getElementById('detailClose');
  }

  function bindActions() {
    document.getElementById('btnCopy').addEventListener('click', copyPrompt);
    document.getElementById('btnReset').addEventListener('click', reset);
    document.getElementById('btnOmakase').addEventListener('click', omakase);
    document.getElementById('btnRandom').addEventListener('click', randomize);
    document.getElementById('btnSave').addEventListener('click', savePreset);
    document.getElementById('btnLoad').addEventListener('click', loadPresetSection);
    if (dom.imageZip) dom.imageZip.addEventListener('click', exportImagesZip);

    // 右カラムの仕上がり例からも詳細モーダルを開ける
    dom.sampleImage.addEventListener('click', function () {
      if (activePreset) openDetail(activePreset, dom.sampleImage.src);
    });

    // 詳細モーダルの CTA
    dom.detailApplyCopy.addEventListener('click', function () {
      if (detailPreset) {
        applyPresetAndCopy(detailPreset);
        closeDetail();
      }
    });
    dom.detailApply.addEventListener('click', function () {
      if (detailPreset) {
        applyPreset(detailPreset);
        toast('「' + detailPreset.name + '」を適用しました');
        closeDetail();
      }
    });

    // 詳細モーダル：閉じるボタン・背景クリック・Esc の3経路で閉じる
    dom.detailClose.addEventListener('click', closeDetail);
    dom.detail.addEventListener('click', function (event) {
      if (event.target === dom.detail) closeDetail();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !dom.detail.hidden) closeDetail();
    });
  }

  /**
   * 描画後に .field へ data-key を張る。
   * renderField の中で張ってもよいが、
   * 「fields の定義順 = DOM の順」であることを利用して一括で付けたほうが単純。
   */
  function tagFieldKeys() {
    const groups = ['basic', 'copy', 'info', 'advanced'];
    groups.forEach(function (group) {
      const container = dom[group + 'Fields'];
      if (!container) return;
      const fields = template.fields.filter(function (field) {
        return field.group === group;
      });
      container.querySelectorAll(':scope > .field').forEach(function (node, index) {
        node.dataset.key = fields[index].key;
      });
    });
  }

  function init() {
    cacheDom();

    // 有効なテンプレートの先頭を初期表示にする
    template = global.PromptMaker.getTemplates().filter(function (item) {
      return item.enabled;
    })[0];

    state = createState(template.defaults);
    applyTemplateTheme();

    renderTabs();
    renderPresets();
    renderFields();
    tagFieldKeys();
    renderUserPresets();
    syncAllFields();
    updatePrompt();
    bindActions();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
