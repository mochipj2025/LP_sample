/* =========================================================================
 * imageWorkflow.js
 * 画像アップロード〜WebP変換〜ZIP書き出しの共通ロジック。
 * -------------------------------------------------------------------------
 * もともと js/app.js（ふつう版）だけが持っていたロジックを、
 * v2（作り直し中の情報設計）からも同じものを呼べるように切り出したもの。
 * core.js と同じ考え方：DOM の組み立て方や見た目は呼び出し側に任せ、
 * ここには「画像そのものをどう変換・圧縮するか」だけを置く。
 *
 * 依存ゼロ（ライブラリを読み込まない）。Blob / Canvas など
 * ブラウザAPIに依存する関数は Node からは実行できないが、
 * crc32 / dataUrlToBytes / makeZip はテスト用に Node からも呼べる。
 * ========================================================================= */

(function (global) {
  'use strict';

  /**
   * スロットIDと画像の dataURL から、ZIP内でのファイル名を決める。
   * 拡張子は dataURL の実際の形式から取る（変換に失敗して元形式のままでも
   * 正しい拡張子で保存されるようにするため）。
   */
  function slotFileName(slotId, dataURL) {
    const m = /^data:image\/(png|jpeg|jpg|webp|gif)/.exec(dataURL);
    let ext = m ? m[1] : 'jpg';
    if (ext === 'jpeg') ext = 'jpg';
    return 'images/' + slotId + '.' + ext;
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

  /**
   * imageStore（{id: {file, dataURL}}）から ZIP を組み立ててダウンロードさせる。
   * 画像が1枚も無ければ何もせず false を返す（呼び出し側でトースト表示など）。
   */
  function downloadImagesZip(imageStore, filename) {
    const ids = Object.keys(imageStore);
    if (!ids.length) return false;

    const files = ids.map(function (id) {
      return { name: imageStore[id].file, bytes: dataUrlToBytes(imageStore[id].dataURL) };
    });
    const blob = new Blob([makeZip(files)], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'images.zip';
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * テキストをクリップボードへ書き込む（成否をコールバックで返す）。
   * navigator.clipboard は file:// では使えない環境があるため、
   * 失敗したら execCommand にフォールバックする。
   */
  function writeClipboard(text, done) {
    if (global.navigator.clipboard && global.isSecureContext) {
      global.navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(legacyCopy(text)); }
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

  global.ImageWorkflow = {
    slotFileName: slotFileName,
    toWebpDataURL: toWebpDataURL,
    crc32: crc32,
    dataUrlToBytes: dataUrlToBytes,
    makeZip: makeZip,
    downloadImagesZip: downloadImagesZip,
    writeClipboard: writeClipboard
  };

  /* Node からも zip 生成ロジックだけはテストできるようにしておく
   * （Blob/Canvas はブラウザ専用なので、その2つは対象外）。 */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.ImageWorkflow;
  }
})(typeof window !== 'undefined' ? window : global);
