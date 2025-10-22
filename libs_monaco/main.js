

// safeモードで実行したときに呼ばれる関数
function init_safeviewer(code) {
    const iframe = document.createElement('iframe');

    const space = 40;
    Object.assign(iframe.style, {
        position: 'fixed',
        top: `${space}px`,
        left: `${space}px`,
        width: `calc(100vw - ${space * 2}px)`,
        height: `calc(100vh - ${space * 2}px)`,
        border: '2px solid #333',
        zIndex: '10',
        backgroundColor: 'white',
    });
    iframe.srcdoc = code;
    document.body.appendChild(iframe)
}

// メイン関数
async function main() {
    const params = {
        localStorage_key: "neko_editor",
        safemode_urlparam_key: "safe",
        enable_physics: false,
        safe_mode: false,
    };
    //     const editor = window.editor;
    const editor_output = document.getElementById("editor_output");
    const console_elem = document.getElementById("error_console");

    // htmlの上下左右のパネルがあるframe処理のロード
    await import('./frame.js');

    // 新しい設定時に前のタイマーを自動で止めて作り直すタイマー
    function build_timer(cb, msec) {
        let timer_id = undefined;
        return {
            set: function () {
                clearTimeout(timer_id);
                timer_id = setTimeout(cb, msec);
            }
        }
    }

    // localStorageのファイル情報を管理する
    const { storage } = await import('./localStorage.js');
    storage.init(params.localStorage_key);

    // ファイル管理
    async function init_combobox() {
        const { combobox } = await import("../libs/Combobox.js");
        combobox.inject(document.getElementById('filelist_panel'));
        combobox.addEventListener('added', e => {
            // comboboxを無選択状態にする
            // そうすると最初にエディタの保存が処理されるとき、
            // comboboxに新規ファイルが作成されて選択される
            combobox.set_item({ id: undefined });
            // storageは選択を解除する
            storage.change(undefined);
            editor.setValue("");
        });
        combobox.addEventListener('renamed', e => {
            // storageの名前を変更する
            storage.rename(e.id, e.name);
        });
        combobox.addEventListener('deleted', e => {
            if (e.id === storage.get().id) {
                combobox.set_item({ id: undefined });
                editor.setValue("");
            }
            storage.delete(e.id);
        });
        combobox.addEventListener('selected', e => {
            storage.change(e.id);
            editor.setValue(storage.get().codes[0] ?? "");
        });
        combobox.addEventListener('entrypoint', e => {
            storage.set_entrypoint(e.id, e.status);
        })
        return { combobox };
    }
    const { combobox } = await init_combobox();
    storage.list().forEach(e => combobox.add_item(e));
    combobox.set_item(storage.get())

    const { inlineHTML } = await import("./inlineHTML.js");

    // ブラウザの異常終了（例えば無限ループしてブラウザを落とす）に対する対策としてsafeモードを作る
    function init_safemode() {
        function check_safemode() {
            console.log(`check_safemode ${storage.get().safemode ?? false}`)
            return storage.get().safemode ?? false;
        }
        if (html_params[params.safemode_urlparam_key] !== undefined || check_safemode()) {
            params.safe_mode = true;
        } else {
            window.addEventListener("beforeunload", e => {
                storage.uninit();
            });
        }

        function init_title_safe(elem) {
            const fileinfo = storage.get();
            console.log("safe mode ", fileinfo)
            const span = document.createElement('span');
            span.textContent = ' === Safe mode === ';
            elem.appendChild(span);
            const check_btn = document.createElement('button');
            check_btn.textContent = "実行して確認する"
            check_btn.addEventListener('click', e => {
                storage.save(editor.getValue());
                const fileinfo = storage.get();
                const a = document.createElement("a");
                a.href = location.pathname + `?check_code=${encodeURIComponent(fileinfo.codes[0])}`;
                a.target = "_blank";
                a.click();
            })
            elem.appendChild(check_btn);
            const to_normal_btn = document.createElement('button');
            to_normal_btn.textContent = 'ノーマルモードに戻す';
            to_normal_btn.addEventListener('click', e => {
                storage.uninit();
                // save_session("normal");
                location.href = location.pathname + "?" +
                    Object.entries(html_params).filter(([k, v]) => k !== params.safemode_urlparam_key).map(([k, v]) => `${k}=${v}`).join('&');
            })
            elem.appendChild(to_normal_btn)
        }
        return { init_title_safe }
    }
    const { init_title_safe } = init_safemode();

    function init_title_message(elem) {
        elem.textContent = 'Ctrl+↑, Ctrl+↓ キーで文字サイズが変わります。';
    }
    if (params.safe_mode) {
        init_title_safe(document.getElementById("message"));
    } else {
        init_title_message(document.getElementById("message"));
    }

    // monaco editor のセットアップ
    async function init_editor() {
        const { monaco, registerDocumentFormattingEditProvider_html } = await import("../build/monaco/monaco/app.js");
        const editor_container_elem = document.getElementById("editor_container");
        const fontSize0 = 11;
        const editor = monaco.editor.create(editor_container_elem, {
            language: 'html',
            scrollBeyondLastLine: false,
            fontSize: fontSize0,
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.UpArrow, () => {
            const current = editor.getOption(monaco.editor.EditorOption.fontSize);
            editor.updateOptions({ fontSize: current + 1 });
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.DownArrow, () => {
            const current = editor.getOption(monaco.editor.EditorOption.fontSize);
            editor.updateOptions({ fontSize: Math.max(6, current - 1) });
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Digit0, () => {
            editor.updateOptions({ fontSize: fontSize0 });
        });
        registerDocumentFormattingEditProvider_html();

        (new ResizeObserver(() => {
            editor_resized_timer.set();
        })).observe(editor_container_elem);
        const editor_resized_timer = build_timer(() => {
            const rect = editor_container_elem.getBoundingClientRect();
            const [width, height] = [Math.floor(rect.width), Math.floor(rect.height)]
            editor.layout({ width, height });
        }, 0);

        function set_error_in_iframe({ lineno, message }) {
            console_elem.textContent = `L${lineno} ${message}`;
        }

        // iframeからのエラーの受信
        window.addEventListener('message', e => {
            if (e.data && e.data.type === 'iframe-error') {
                const info = e.data;
                const lineno = info.lineno - iframeErrorHandlerScript.split('\n').length + 1;
                set_error_in_iframe({ lineno, message: info.message })
            }
        })
        // iframe側でエラーを送信するコード、これをユーザの作成したものに埋め込む
        const iframeErrorHandlerScript = `
            <script>
                window.onerror = function (message, source, lineno, colno, error) {
                    window.parent.postMessage({
                        type: 'iframe-error',
                        message: message,
                        source: source,
                        lineno: lineno
                    }, '*');
                    return true;
                };
            </script >`;

        function extract_js(html_string) {
            const doc = (new DOMParser()).parseFromString(html_string, 'text/html');
            return Array.from(doc.querySelectorAll('script')).filter(e => e.type !== 'importmap').map(e => e.textContent).join('\n');
        }

        const { removeLineComments } = await import("./removeLineComments.js");
        function build_importmap(files) {
            const imports = Object.entries(files).filter(([k]) => k.endsWith(".js")).
                reduce((a, e) => ({ ...a, [e[0]]: 'data:text/javascript;charset=utf-8,' + encodeURIComponent(e[1]) }), {});
            return Object.keys(imports).length === 0 ? "" :
                `<script type="importmap">${JSON.stringify({ imports })}</script>`;
        }

        let worker = undefined;
        let worker_timer_id = undefined;

        // editor更新時に出力用iframeの更新
        const content_updated_timer = build_timer(async () => {
            if (worker) {
                worker.terminate();
                clearTimeout(worker_timer_id);
            }
            if ((storage.get().codes[0] ?? "") !== editor.getValue()) {
                const saved_storage_info = storage.save(editor.getValue());
                // console.log(combobox.get_item())
                if (combobox.get_item() === undefined) {
                    combobox.add_item(saved_storage_info);
                    combobox.set_item({ id: saved_storage_info.id });
                }
            }

            const html_strings = storage.get_entrypoint()?.codes[0] ?? editor.getValue();
            console_elem.textContent = "";

            worker = new Worker('./libs_monaco/worker.js', { type: 'module' });
            const timeout_target_id = storage.get().id;
            worker_timer_id = setTimeout(() => {
                console.log("TIMEOUT!!!");
                worker.terminate();
                worker = undefined;
                set_error_in_iframe({ lineno: '?', message: "JavaScriptが終了しません" });
                storage.undo(timeout_target_id);
            }, 2000);
            worker.addEventListener('message', e => {
                worker.terminate();
                worker = undefined;
                clearTimeout(worker_timer_id);
                const { status, message } = e.data;
                console.log(`check worker status status=${status}, message=${message}`)
                if (params.safe_mode === false) {
                    const files = storage.list().reduce((a, e) => ({ ...a, [e.name]: removeLineComments(e.codes[0] ?? "") }), {});
                    const with_importmap_html = html_strings.replace(/(<html[^>]*>)/i, `$1${build_importmap(files)}`);
                    // const inlined_html = inlineHTML(with_importmap_html, 'localhost/', files);
                    const inlined_html = inlineHTML(with_importmap_html, files);
console.log(inlined_html)
                    const with_error_handler_html = inlined_html.replace(/(<html[^>]*>)/i, `$1${iframeErrorHandlerScript}`);
                    editor_output.srcdoc = with_error_handler_html;
                }
            })
            const code = extract_js(editor.getValue());
            worker.postMessage({ code });
        }, 2000)
        editor.onDidChangeModelContent(e => {
            content_updated_timer.set();
        })

        // 最初に保存しているコードをeditorに表示する
        if (storage.get().codes.length > 0) {
            editor.setValue(storage.get().codes[0] ?? "");
        }

        // debug
        const { typeTrigger } = await import("./typeTrigger.js");
        typeTrigger({
            callback: () => {
                console.log("ネコフォント");
                editor.updateOptions({ fontFamily: 'Cat_paw', })
            }
        })

        return { editor };
    }
    const { editor } = await init_editor();

    // 物理エンジン部分のセットアップ
    async function init_physics() {
        if (params.enable_physics === false) {
            return { physics: undefined };
        }
        const { physics } = await import("./physics.js");
        document.body.addEventListener("keydown", async e => {
            const rect = document.body.getBoundingClientRect();
            if (e.key === "a") {
                await physics.add_3d_object_model({ p: [rect.width / 2, -10, 0] });
            }
        });
        return { physics };
    }
    const { physics } = await init_physics();

    // 描画処理のセットアップ
    function build_render() {
        let prev_tm = performance.now();
        let frame_counter = 0;
        const render = (tm) => {
            physics?.render();
            requestAnimationFrame(render);
            prev_tm = tm;
            frame_counter += 1;
        }
        requestAnimationFrame(render);
    }
    build_render();
}

// URLparameter
const html_params = [...new URLSearchParams(location.search).entries()].reduce((obj, e) => ({ ...obj, [e[0]]: e[1] }), {});
// console.log(html_params)
if (html_params.check_code) {
    init_safeviewer(decodeURIComponent(html_params.check_code));
} else {
    await main();
}

