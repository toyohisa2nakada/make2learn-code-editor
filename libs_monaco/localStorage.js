/*
  --- LocalStorageを利用したファイル管理モジュール ---

  ■ 概要
  複数のファイル情報を localStorage で管理する。
  各ファイルの内容や状態は、指定された localStorage のキーの下に保存される。

  ■ 主な機能
  - init(key):
      指定された localStorage のキーを使って初期化する。
      localStorage に保存されているすべてのファイル情報をロードする。

  - get():
      現在選択されているファイルのコンテンツを取得する。

  - save(content):
      現在選択されているファイルに内容を保存する。

  - change(filename):
      操作対象のファイルを指定した名前のファイルに切り替える。

  - delete(filename):
      指定したファイルを削除する。

  - rename(oldName, newName):
      ファイル名を変更する。

  - list():
      登録されているすべてのファイル名の一覧を取得する。

  - uninit():
      終了処理を行う。状態を安全に保存して終了する。

  ■ セーフモードについて
  uninit() が呼ばれる前にアプリが異常終了（または強制終了）した場合、
  次回起動時には「セーフモード」で開始する。
  これは、前回の状態が不完全に保存されている可能性があるためである。
*/
export const storage = {
    _localStorage_key: undefined,
    _selected_file_id: undefined,
    _fileinfo_header: {},
    _fileinfo_array: [],

    _get_fileinf_template: function (id, name) {
        return { id, name, codes: [], session: '', entrypoint: false, last_updated_ms: Date.now() };
    },
    _id2name: function (id) {
        return this._get_file(id)?.name;
    },
    _get_file: function (id) {
        if (id === undefined) {
            return this._get_fileinf_template();
        }
        return this._fileinfo_array.filter(e => e.id === id)[0];
    },
    _load_from_ls: function () {
        this._fileinfo_array = JSON.parse(localStorage.getItem(this._localStorage_key))?.fileinfo ?? [];
        this._fileinfo_array.sort((e0, e1) => e1.last_updated_ms - e0.last_updated_ms);
    },
    _save_to_ls: function () {
        localStorage.setItem(this._localStorage_key, JSON.stringify(
            { header: this._fileinfo_header, fileinfo: this._fileinfo_array, }
        ));
    },
    _update: function (id, info1) {
        let info0 = this.get(id);
        Object.assign(info0, info1);
        return info0;
    },
    _add_code: function (id, code) {
        const info0 = this.get(id);
        info0.codes.unshift(code);
        info0.codes.splice(3);
    },
    _remove_code: function (id) {
        const info0 = this.get(id);
        info0.codes.shift();
    },
    _check_safemode: function (id) {
        const info = this.get(id);
        this._update(id, { safemode: info.session !== 'normal', session: '' });
    },
    _create_uuid: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    _create_filename: () => {
        const d = new Date();
        return [d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()].
            map((e, i) => i > 0 ? String(e).padStart(2, '0') : e).
            reduce((a, e, i) => i === 2 ? `${a} ${e}` : `${a}${e}`);
    },

    get: function (id) {
        id ??= this._selected_file_id;
        if (id === undefined) {
            return this._get_fileinf_template();
        }
        return this._fileinfo_array.filter(e => e.id === id)[0];
    },
    list: function () {
        return this._fileinfo_array;
    },
    init: function (localStorage_key) {
        this._localStorage_key = localStorage_key;
        this._load_from_ls();
        this._selected_file_id = this._fileinfo_array[0]?.id;
        if (this._selected_file_id !== undefined) {
            this._check_safemode(this._selected_file_id);
            this._save_to_ls();
        }
        return this.get();
    },
    uninit: function () {
        this._load_from_ls();
        if (this._selected_file_id !== undefined) {
            this._update(this._selected_file_id, { session: 'normal' });
        }
        this._save_to_ls();
    },
    save: function (code) {
        this._load_from_ls();
        if (this._selected_file_id === undefined) {
            const info = this._get_fileinf_template();
            info.id = this._create_uuid();
            info.name = this._create_filename();
            info.last_updated_ms = Date.now();
            this._fileinfo_array.push(info);
            this._selected_file_id = info.id;
        }
        this._add_code(this._selected_file_id, code);
        this._update(this._selected_file_id, { last_updated_ms: Date.now() })
        this._save_to_ls();
        return this._get_file(this._selected_file_id);
    },
    undo: function (id) {
        this._load_from_ls();
        this._remove_code(id);
        this._save_to_ls();
    },
    change: function (id) {
        this.uninit();
        this._selected_file_id = id;
        if (this._selected_file_id !== undefined) {
            this._check_safemode(this._selected_file_id);
            this._save_to_ls();
        }
        return this.get();
    },
    rename: function (id, name) {
        this._load_from_ls();
        this._update(id, { name });
        this._save_to_ls();
        return this._get_file(id);
    },
    delete: function (id) {
        this._load_from_ls();
        if (this._selected_file_id === id) {
            this._selected_file_id = undefined;
        }
        this._fileinfo_array = this._fileinfo_array.filter(e => e.id !== id);
        this._save_to_ls();
        return this._get_file(this._selected_file_id);
    },
    set_entrypoint: function (id, status) {
        this._load_from_ls();
        this._update(id, { entrypoint: status });
        this._save_to_ls();
        return this._get_file(id);
    },
    get_entrypoint: function () {
        return this._fileinfo_array.filter(e => e.entrypoint === true)[0];
    },
}