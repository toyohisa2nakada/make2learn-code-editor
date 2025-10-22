
export function typeTrigger({ typed_strings, callback, params }) {
    const sequence_interval_ms = params?.sequence_interval_ms ?? 400;
    typed_strings ??= "debug";

    const keys = [];
    let last_press_ms = 0;
    document.addEventListener('keydown', e => {
        const actualTarget = e.composedPath()[0];
        const tagName = actualTarget.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || actualTarget.isContentEditable) {
            return;
        }
        if (e.key.length > 1) return;

        const t = Date.now();
        const key = e.key.toLowerCase();

        if ((t - last_press_ms) > sequence_interval_ms) {
            keys.length = 0;
        }
        keys.push(key);

        if (keys.slice(0, typed_strings.length).join('') === typed_strings) {
            callback?.();
            keys.length = 0;
        }
        last_press_ms = t;
    })
}