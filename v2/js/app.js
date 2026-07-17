/* =========================================================================
 * v2/js/app.js
 * まだスケルトン。今できているのは「入口の分岐」で画面を切り替えるところまで。
 * template.lp.js / template.visual.js / template.icon.js / core.js は
 * ../js/ からそのまま読み込んでいて、ここでは一切コピーしない
 * （ロジックの二重管理を避けるため）。
 *
 * 次に作るもの（NOTES.md 参照）：
 *   - プリセット一覧（説明文を常時表示、クリックでは即上書きしない）
 *   - 内容確認・コピー画面
 *   - 基本設定を3項目（業種・読み手・ゴール）に絞ったステップ
 * ========================================================================= */

(function () {
  'use strict';

  // v2 はまだ「LP作成」1テンプレートだけ対応。タブ切替は後で足す。
  var template = window.PromptMaker.getTemplate('lp');

  // 「自分で決める」ルートで選んだ3項目だけの状態。プリセット側の state とは別に持つ。
  var manualState = null;

  // 手動ルートの画像ステップ用（v1 の imageStore / refLockStore と同じ役割）。
  var manualImages = {};
  var manualRefLock = {};

  // 内容確認画面（confirmStep）が今どちらのルートから来たか・何を build() するか。
  var confirmState = null;
  var confirmReturnTo = 'presetStep';

  // フォルダ準備（旧ステップ0）を任意画面にしたので、開いた元の画面へ戻れるよう覚えておく。
  var folderReturnTo = 'entryStep';

  // v2/ から見た assets の相対パス（../js/app.js の ASSET_DIR と同じ考え方）。
  var ASSET_DIR = '../assets/presets';
  var IMAGE_EXTS = ['png', 'webp', 'jpg', 'jpeg'];

  /**
   * プリセットの見本画像を読み込む。拡張子を順に試すフォールバック付き。
   * 画像が無い/読めない場合でも card 側の見た目・クリック挙動は変えない
   * （旧版は「画像が読めた時だけ拡大ボタンが出る」という一貫性の無さが
   * 分かりにくさの原因だったので、v2 では読み込み結果に関係なく
   * 「アイコン＋名前＋説明文」は常に同じ形で見えるようにする）。
   */
  function loadPresetImage(preset, img, onLoad, onFail) {
    if (!preset.id) {
      onFail();
      return;
    }
    var basePath = ASSET_DIR + '/' + template.id + '/' + preset.id;
    var candidates = IMAGE_EXTS.map(function (ext) { return basePath + '.' + ext; });
    var index = 0;

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

  /** defaults と preset.values を、配列参照を共有しないよう複製しながら合成する。
   *  js/app.js の createState() と同じ考え方（同じ問題を再発明しない）。 */
  function createState() {
    var merged = {};
    Array.prototype.forEach.call(arguments, function (source) {
      if (!source) return;
      Object.assign(merged, JSON.parse(JSON.stringify(source)));
    });
    return merged;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function show(id) {
    ['folderStep', 'entryStep', 'presetStep', 'confirmStep', 'basicStep', 'imageStep', 'infoStep', 'advancedStep']
      .forEach(function (sectionId) {
        var section = document.getElementById(sectionId);
        if (section) section.hidden = sectionId !== id;
      });
  }

  /** いま表示中のステップIDを返す（フォルダ準備から元の画面へ戻るため）。 */
  function currentStep() {
    var ids = ['folderStep', 'entryStep', 'presetStep', 'confirmStep', 'basicStep', 'imageStep', 'infoStep', 'advancedStep'];
    for (var i = 0; i < ids.length; i++) {
      var s = document.getElementById(ids[i]);
      if (s && !s.hidden) return ids[i];
    }
    return 'entryStep';
  }

  /* ------------------------------------------------------------------
   * プリセット一覧
   * ------------------------------------------------------------------
   * app.js（1画面版）と違い、クリックしても即・適用＋コピーはしない。
   * ここでは「選ぶ」だけで、内容確認画面（confirmStep）に進むだけにする。
   * サムネイル画像には依存しない：アイコン・名前・説明文だけで
   * どのカードも同じ見た目になるようにする（一発でわかる、を優先）。
   * ------------------------------------------------------------------ */

  function renderPresetCard(preset) {
    var card = el('button', 'v2-preset-card');
    card.type = 'button';

    // サムネイル領域：読めるまでは絵文字＋ウォッシュの土台。読めたら差し替わる。
    // 読み込みに成功しても失敗しても、カードの見た目の骨組みとクリック挙動は変えない。
    var thumb = el('div', 'v2-preset-card__thumb');
    thumb.appendChild(el('span', 'v2-preset-card__thumb-icon', preset.icon || ''));
    var img = el('img', 'v2-preset-card__thumb-img');
    img.alt = preset.name + ' の仕上がり例';
    thumb.appendChild(img);
    card.appendChild(thumb);

    loadPresetImage(
      preset,
      img,
      function (src) {
        thumb.classList.add('has-image');
        preset._loadedSrc = src;
      },
      function () {
        img.remove();
      }
    );

    var head = el('div', 'v2-preset-card__head');
    head.appendChild(el('span', 'v2-preset-card__name', preset.name));
    card.appendChild(head);

    if (preset.description) {
      card.appendChild(el('p', 'v2-preset-card__desc', preset.description));
    }

    card.addEventListener('click', function () {
      showConfirmForPreset(preset);
    });

    return card;
  }

  function renderPresets() {
    var list = document.getElementById('presetList');
    if (!list || !template) return;
    list.innerHTML = '';
    template.presets.forEach(function (preset) {
      list.appendChild(renderPresetCard(preset));
    });
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：①基本設定（3項目だけ）
   * ------------------------------------------------------------------
   * トーン・ボリューム・出力タイプは、素人が一発でわかる基準からあえて外し、
   * 別の場所（詳細設定）に回す前提。ここでは業種・読み手・ゴールだけ。
   * ------------------------------------------------------------------ */

  var MANUAL_FIELD_KEYS = ['type', 'reader', 'goal'];

  function normalizeOption(option) {
    return typeof option === 'string' ? { value: option, label: option } : option;
  }

  function renderBasicField(field) {
    var wrap = el('div', 'v2-field');
    wrap.appendChild(el('p', 'v2-field__label', (field.icon ? field.icon + ' ' : '') + field.label));

    var chips = el('div', 'chips');
    field.options.map(normalizeOption).forEach(function (option) {
      var chip = el('button', 'chip', option.label);
      chip.type = 'button';
      if (manualState[field.key] === option.value) chip.classList.add('is-active');
      chip.addEventListener('click', function () {
        manualState[field.key] = option.value;
        renderBasicFields();
      });
      chips.appendChild(chip);
    });

    wrap.appendChild(chips);
    return wrap;
  }

  function renderBasicFields() {
    if (!manualState) manualState = createState(template.defaults);
    var container = document.getElementById('basicFields');
    if (!container) return;
    container.innerHTML = '';
    MANUAL_FIELD_KEYS.forEach(function (key) {
      var field = template.fields.filter(function (f) { return f.key === key; })[0];
      if (field) container.appendChild(renderBasicField(field));
    });
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：②画像（任意）
   * ------------------------------------------------------------------
   * ロジック（WebP変換・ZIP書き出し・クリップボード）は imageWorkflow.js を
   * そのまま呼ぶ。ここに書くのは DOM の組み立てだけ（v1 の renderImageSlots と
   * 同じ役割分担）。
   * ------------------------------------------------------------------ */

  function syncManualImagesToState() {
    manualState._images = Object.keys(manualImages).map(function (id) {
      return { id: id, file: manualImages[id].file };
    });
  }

  function syncManualRefLockToState() {
    manualState._refLock = Object.assign({}, manualRefLock);
  }

  function renderImageSlotRow(slot) {
    var row = el('div', 'imgslot');

    var head = el('div', 'imgslot__head');
    head.appendChild(el('span', 'imgslot__label', slot.label));
    head.appendChild(el('span', 'imgslot__ratio', slot.ratio));

    var refLockLabel = el('label', 'imgslot__reflock');
    var refCheckbox = document.createElement('input');
    refCheckbox.type = 'checkbox';
    refCheckbox.checked = !!manualRefLock[slot.id];
    refCheckbox.addEventListener('change', function () {
      if (refCheckbox.checked) manualRefLock[slot.id] = true; else delete manualRefLock[slot.id];
      syncManualRefLockToState();
      renderImageStep(); // 参照ロックの注記が prompt に付く/消えるので作り直す
    });
    refLockLabel.appendChild(refCheckbox);
    refLockLabel.appendChild(el('span', null, '実物を反映（写真を崩さない）'));
    head.appendChild(refLockLabel);

    row.appendChild(head);

    var acts = el('div', 'imgslot__acts');

    var copyBtn = el('button', 'imgslot__btn', '📋 プロンプト');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      ImageWorkflow.writeClipboard(slot.prompt, function (ok) {
        copyBtn.textContent = ok ? '✅ コピー済み' : 'コピー失敗';
        setTimeout(function () { copyBtn.textContent = '📋 プロンプト'; }, 1500);
      });
    });
    acts.appendChild(copyBtn);

    var pickLabel = el('label', 'imgslot__btn');
    pickLabel.appendChild(el('span', null, '🖼 画像を選ぶ'));
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        ImageWorkflow.toWebpDataURL(file, reader.result, function (finalDataURL) {
          manualImages[slot.id] = { file: ImageWorkflow.slotFileName(slot.id, finalDataURL), dataURL: finalDataURL };
          syncManualImagesToState();
          renderImageStep();
        });
      };
      reader.readAsDataURL(file);
    });
    pickLabel.appendChild(fileInput);
    acts.appendChild(pickLabel);

    row.appendChild(acts);

    var thumb = el('div', 'imgslot__thumb');
    if (manualImages[slot.id]) {
      var img = el('img');
      img.src = manualImages[slot.id].dataURL;
      img.alt = slot.label;
      thumb.appendChild(img);
      thumb.classList.add('has');
      var rm = el('button', 'imgslot__rm', '×');
      rm.type = 'button';
      rm.addEventListener('click', function () {
        delete manualImages[slot.id];
        syncManualImagesToState();
        renderImageStep();
      });
      thumb.appendChild(rm);
    }
    row.appendChild(thumb);

    return row;
  }

  function renderImageStep() {
    if (!manualState) manualState = createState(template.defaults);
    syncManualRefLockToState();

    var hasSlots = typeof template.imageSlots === 'function';
    var slots = hasSlots ? template.imageSlots(manualState) : [];

    var container = document.getElementById('v2ImageSlots');
    container.innerHTML = '';
    slots.forEach(function (slot) {
      container.appendChild(renderImageSlotRow(slot));
    });

    var total = slots.length;
    var done = slots.filter(function (s) { return manualImages[s.id]; }).length;
    var countEl = document.getElementById('v2ImageCount');
    if (countEl) countEl.textContent = total ? done + ' / ' + total + ' 枚セット済み' : '';

    var zipBtn = document.getElementById('v2ImageZip');
    if (zipBtn) zipBtn.disabled = done === 0;
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：③掲載情報（任意）
   * ------------------------------------------------------------------
   * ラベル文言は業種で変わることがある（例：メニュー欄は「看板メニュー」
   * 「料金プラン」など業種ごとの言葉に、特徴欄も同様）。この判断は
   * template.inputLabelOf() に任せ、ここでは「動的ラベルがあれば使う、
   * なければ FIELDS の既定ラベル」というルールだけを持つ
   * （app.js 側は業種の知識を一切持たない、という設計方針を踏襲）。
   * repeater（商品・メニュー／リンク）の行management は v1 の
   * renderRepeaterField と同じ考え方だが、state は manualState を直接使う。
   * ------------------------------------------------------------------ */

  var INFO_FIELD_KEYS = ['infoName', 'menuItems', 'infoDate', 'infoPlace', 'infoMapUrl', 'infoFeature', 'mascot', 'links'];

  function resolveFieldLabel(field) {
    var dynamicLabel = typeof template.inputLabelOf === 'function'
      ? template.inputLabelOf(field.key, manualState)
      : null;
    return dynamicLabel || field.label;
  }

  function renderInfoFieldHeader(field) {
    var header = el('div', 'field-header');
    var label = el('span', 'field-label');
    label.appendChild(el('span', 'field-icon', field.icon || ''));
    label.appendChild(el('span', null, resolveFieldLabel(field)));
    header.appendChild(label);
    if (field.hint) header.appendChild(el('span', 'field-hint', field.hint));
    return header;
  }

  function renderInfoTextareaField(field) {
    var wrap = el('div', 'field');
    wrap.appendChild(renderInfoFieldHeader(field));

    var area = el('textarea', 'textarea');
    area.rows = field.rows || 2;
    area.placeholder = field.placeholder || '';
    area.value = manualState[field.key] || '';
    area.addEventListener('input', function () {
      manualState[field.key] = area.value;
    });

    wrap.appendChild(area);
    return wrap;
  }

  /** 1件も入っていなければ、空の1行を見せる（v1 の repeaterItems と同じ考え方） */
  function infoRepeaterItems(field) {
    var list = manualState[field.key];
    return Array.isArray(list) && list.length ? list : [{}];
  }

  function setInfoRepeaterItemValue(fieldKey, index, subKey, value) {
    var items = Array.isArray(manualState[fieldKey])
      ? manualState[fieldKey].map(function (item) { return Object.assign({}, item); })
      : [];
    if (!items[index]) items[index] = {};
    items[index][subKey] = value;
    manualState[fieldKey] = items;
  }

  function renderInfoRepeaterRows(field, rowsContainer) {
    var items = infoRepeaterItems(field);
    rowsContainer.innerHTML = '';

    items.forEach(function (item, index) {
      var row = el('div', 'repeater__row');

      field.itemFields.forEach(function (sub) {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'repeater__input';
        input.placeholder = sub.placeholder || '';
        input.value = item[sub.key] || '';
        if (sub.flex) input.style.flexGrow = String(sub.flex);

        input.addEventListener('input', function () {
          setInfoRepeaterItemValue(field.key, index, sub.key, input.value);
        });

        row.appendChild(input);
      });

      var remove = el('button', 'repeater__remove', '×');
      remove.type = 'button';
      remove.title = 'この行を削除';
      remove.disabled = items.length <= 1;
      if (items.length <= 1) remove.classList.add('is-disabled');

      remove.addEventListener('click', function () {
        var arr = Array.isArray(manualState[field.key]) ? manualState[field.key].slice() : [];
        arr.splice(index, 1);
        manualState[field.key] = arr;
        renderInfoRepeaterRows(field, rowsContainer);
      });

      row.appendChild(remove);
      rowsContainer.appendChild(row);
    });
  }

  function renderInfoRepeaterField(field) {
    var wrap = el('div', 'field');
    wrap.appendChild(renderInfoFieldHeader(field));

    var rowsContainer = el('div', 'repeater__rows');
    wrap.appendChild(rowsContainer);
    renderInfoRepeaterRows(field, rowsContainer);

    var addBtn = el('button', 'repeater__add', field.addLabel || '＋ 追加');
    addBtn.type = 'button';
    addBtn.addEventListener('click', function () {
      var arr = Array.isArray(manualState[field.key]) ? manualState[field.key].slice() : [];
      arr.push({});
      manualState[field.key] = arr;
      renderInfoRepeaterRows(field, rowsContainer);

      var rows = rowsContainer.querySelectorAll('.repeater__row');
      var lastRow = rows[rows.length - 1];
      var firstInput = lastRow && lastRow.querySelector('input');
      if (firstInput) firstInput.focus();
    });
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderInfoField(field) {
    if (field.type === 'textarea') return renderInfoTextareaField(field);
    if (field.type === 'repeater') return renderInfoRepeaterField(field);
    return null;
  }

  function renderInfoFields() {
    if (!manualState) manualState = createState(template.defaults);
    var container = document.getElementById('infoFields');
    if (!container) return;
    container.innerHTML = '';
    INFO_FIELD_KEYS.forEach(function (key) {
      var field = template.fields.filter(function (f) { return f.key === key; })[0];
      if (!field) return;
      var node = renderInfoField(field);
      if (node) container.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：④詳細設定（任意）
   * ------------------------------------------------------------------
   * トーン・ボリューム・出力タイプ（chips）と、参考・補足（textarea）。
   * ①〜③ではあえて出さなかった項目をここにまとめる。
   * chips は renderBasicField と同じ考え方（.v2-field / .v2-field__label /
   * chips / chip を流用）、textarea は③と同じ renderInfoTextareaField を
   * そのまま使う（ref・extra は inputLabelOf の対象外なので既定ラベルに
   * フォールバックするだけで、③専用のロジックではない）。
   * ------------------------------------------------------------------ */

  var ADVANCED_FIELD_KEYS = ['tone', 'volume', 'output', 'ref', 'extra'];

  function renderAdvancedChipsField(field) {
    var wrap = el('div', 'v2-field');
    wrap.appendChild(el('p', 'v2-field__label', (field.icon ? field.icon + ' ' : '') + field.label));

    var chips = el('div', 'chips');
    field.options.map(normalizeOption).forEach(function (option) {
      var chip = el('button', 'chip', option.label);
      chip.type = 'button';
      if (manualState[field.key] === option.value) chip.classList.add('is-active');
      chip.addEventListener('click', function () {
        manualState[field.key] = option.value;
        renderAdvancedFields();
      });
      chips.appendChild(chip);
    });

    wrap.appendChild(chips);
    return wrap;
  }

  function renderAdvancedField(field) {
    if (field.type === 'chips') return renderAdvancedChipsField(field);
    if (field.type === 'textarea') return renderInfoTextareaField(field);
    return null;
  }

  function renderAdvancedFields() {
    if (!manualState) manualState = createState(template.defaults);
    var container = document.getElementById('advancedFields');
    if (!container) return;
    container.innerHTML = '';
    ADVANCED_FIELD_KEYS.forEach(function (key) {
      var field = template.fields.filter(function (f) { return f.key === key; })[0];
      if (!field) return;
      var node = renderAdvancedField(field);
      if (node) container.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------
   * 内容確認・コピー画面
   * ------------------------------------------------------------------
   * プリセット経由・自分で決める経由のどちらから来ても、
   * 同じ画面（confirmState を build するだけ）で受け止める。
   * confirmReturnTo だけがルートごとの「戻る先」を覚えている。
   * ------------------------------------------------------------------ */

  function buildSpecPairsFromState(state) {
    return template.fields
      .filter(function (field) { return field.group === 'basic'; })
      .map(function (field) { return { label: field.label, value: state[field.key] }; })
      .filter(function (pair) { return pair.value && pair.value !== 'なし'; });
  }

  /** サムネイル領域の中身を差し替える。preset が無い（＝自分で決めるルート）ときは
   *  画像を試さず、絵文字だけのプレースホルダのままにする。 */
  function applyConfirmThumb(preset) {
    var thumb = document.getElementById('confirmThumb');
    var thumbIcon = document.getElementById('confirmThumbIcon');
    var thumbImg = document.getElementById('confirmThumbImg');

    thumbIcon.textContent = (preset && preset.icon) || '📝';
    thumb.classList.remove('has-image');
    thumbImg.removeAttribute('src');

    if (!preset) return;

    if (preset._loadedSrc) {
      thumbImg.src = preset._loadedSrc;
      thumbImg.alt = preset.name + ' の仕上がり例';
      thumb.classList.add('has-image');
    } else {
      loadPresetImage(preset, thumbImg, function (src) {
        preset._loadedSrc = src;
        thumb.classList.add('has-image');
      }, function () {
        thumbImg.removeAttribute('src');
      });
    }
  }

  function renderConfirmSpecs(state) {
    var specs = document.getElementById('confirmSpecs');
    specs.innerHTML = '';
    buildSpecPairsFromState(state).forEach(function (pair) {
      specs.appendChild(el('dt', null, pair.label));
      specs.appendChild(el('dd', null, pair.value));
    });
  }

  function showConfirmForPreset(preset) {
    confirmState = createState(template.defaults, preset.values);
    confirmReturnTo = 'presetStep';

    document.getElementById('confirmName').textContent =
      preset.icon ? preset.icon + ' ' + preset.name : preset.name;
    document.getElementById('confirmDesc').textContent = preset.description || '';
    applyConfirmThumb(preset);
    renderConfirmSpecs(confirmState);

    show('confirmStep');
  }

  function showConfirmForManualState(state) {
    confirmState = state;
    confirmReturnTo = 'advancedStep';

    document.getElementById('confirmName').textContent = '自分で決めた設定';
    document.getElementById('confirmDesc').textContent = '';
    applyConfirmThumb(null);
    renderConfirmSpecs(confirmState);

    show('confirmStep');
  }

  function copyConfirmState(button) {
    if (!confirmState || !template) return;
    var text = template.build(confirmState);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        button.textContent = 'コピーしました';
        setTimeout(function () {
          button.textContent = 'この内容でコピーする';
        }, 1500);
      });
    }
  }

  function init() {
    var presetBtn = document.getElementById('choicePreset');
    var manualBtn = document.getElementById('choiceManual');
    var folderCopyBtn = document.getElementById('folderCopy');
    var folderDoneBtn = document.getElementById('folderDone');
    var confirmCopyBtn = document.getElementById('confirmCopy');
    var confirmBackBtn = document.getElementById('confirmBack');
    var basicNextBtn = document.getElementById('basicNext');
    var basicBackBtn = document.getElementById('basicBack');
    var imageNextBtn = document.getElementById('imageNext');
    var imageBackBtn = document.getElementById('imageBack');
    var imageZipBtn = document.getElementById('v2ImageZip');
    var infoNextBtn = document.getElementById('infoNext');
    var infoBackBtn = document.getElementById('infoBack');
    var advancedNextBtn = document.getElementById('advancedNext');
    var advancedBackBtn = document.getElementById('advancedBack');

    if (presetBtn) {
      presetBtn.addEventListener('click', function () {
        renderPresets();
        show('presetStep');
      });
    }
    if (manualBtn) {
      manualBtn.addEventListener('click', function () {
        renderBasicFields();
        show('basicStep');
      });
    }
    if (confirmCopyBtn) {
      confirmCopyBtn.addEventListener('click', function () {
        copyConfirmState(confirmCopyBtn);
      });
    }
    if (confirmBackBtn) {
      confirmBackBtn.addEventListener('click', function () {
        show(confirmReturnTo);
      });
    }
    if (basicNextBtn) {
      basicNextBtn.addEventListener('click', function () {
        // template が画像スロットを持つときだけ②へ。持たなければ③掲載情報へ直接進む。
        if (typeof template.imageSlots === 'function') {
          renderImageStep();
          show('imageStep');
        } else {
          renderInfoFields();
          show('infoStep');
        }
      });
    }
    if (basicBackBtn) {
      basicBackBtn.addEventListener('click', function () {
        show('entryStep');
      });
    }
    if (imageNextBtn) {
      imageNextBtn.addEventListener('click', function () {
        renderInfoFields();
        show('infoStep');
      });
    }
    if (imageBackBtn) {
      imageBackBtn.addEventListener('click', function () {
        show('basicStep');
      });
    }
    if (infoNextBtn) {
      infoNextBtn.addEventListener('click', function () {
        renderAdvancedFields();
        show('advancedStep');
      });
    }
    if (infoBackBtn) {
      infoBackBtn.addEventListener('click', function () {
        show(typeof template.imageSlots === 'function' ? 'imageStep' : 'basicStep');
      });
    }
    if (advancedNextBtn) {
      advancedNextBtn.addEventListener('click', function () {
        showConfirmForManualState(createState(manualState));
      });
    }
    if (advancedBackBtn) {
      advancedBackBtn.addEventListener('click', function () {
        show('infoStep');
      });
    }
    if (imageZipBtn) {
      imageZipBtn.addEventListener('click', function () {
        var ok = ImageWorkflow.downloadImagesZip(manualImages, 'lp-images.zip');
        imageZipBtn.textContent = ok ? '✅ 書き出しました' : '先に画像をセットしてね';
        setTimeout(function () { imageZipBtn.textContent = '🗂 画像を書き出す（zip）'; }, 1800);
      });
    }

    // ステップ0：フォルダ準備。コピーは失敗しても致命的ではないので、
    // クリップボードAPIが使えない環境でも次へ進めることだけは保証する。
    if (folderCopyBtn) {
      folderCopyBtn.addEventListener('click', function () {
        var text = document.getElementById('folderPrompt').textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            folderCopyBtn.textContent = 'コピーしました';
            setTimeout(function () {
              folderCopyBtn.textContent = 'コピーする';
            }, 1500);
          });
        }
      });
    }
    if (folderDoneBtn) {
      folderDoneBtn.addEventListener('click', function () {
        show(folderReturnTo);
      });
    }

    // フッターの「公開用の準備（任意）」から、いつでもフォルダ準備画面を開ける。
    var openFolderBtn = document.getElementById('openFolderStep');
    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', function (e) {
        e.preventDefault();
        folderReturnTo = currentStep();
        show('folderStep');
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
