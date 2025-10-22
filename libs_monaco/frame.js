const separator = document.getElementById('frame_separator');
const left = document.getElementById('frame_left');
const right = document.getElementById('frame_right');
const middle = document.getElementById('frame_middle');
// const overlay = document.getElementById('frame_right_overlay');
// const iframe = document.querySelector("#frame_right > iframe");

const iframes = Array.from(document.querySelectorAll(".frame_embedded_iframe"));
let isDragging = false;

function pointerUp(e) {
    if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = 'auto';
        separator.releasePointerCapture(e.pointerId);
    }
}
function pointerMove(e) {
    if (!isDragging) return;

    let { clientX } = e;
    const iframe = iframes.find(iframe => iframe.contentDocument === e.currentTarget);
    if (iframe !== undefined) {
        const iframe_rect = iframe.getBoundingClientRect();
        clientX = clientX + iframe_rect.left;
    }

    // middleの左端位置を取得
    const rect = middle.getBoundingClientRect();

    // 左幅を計算（px）
    let leftWidth = clientX - rect.left;

    // 最小幅の制限（50pxずつ）
    const minWidth = 50;
    const maxWidth = rect.width - minWidth;

    if (leftWidth < minWidth) leftWidth = minWidth;
    if (leftWidth > maxWidth) leftWidth = maxWidth;

    // パーセンテージで設定
    const leftPercent = (leftWidth / rect.width) * 100;
    const rightPercent = 100 - leftPercent;

    left.style.width = leftPercent + '%';
    right.style.width = rightPercent + '%';

}
function setup_separator_handler() {
    separator.addEventListener('pointerdown', (e) => {
        isDragging = true;
        document.body.style.userSelect = 'none';
        separator.setPointerCapture(e.pointerId);
    });
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointermove', pointerMove);
}
async function setup_iframe_handler() {
    const loadPromises = iframes.map(iframe => {
        return new Promise((resolve) => {
            iframe.addEventListener('load', resolve, { once: true });
        });
    });
    await Promise.all(loadPromises);
    iframes.forEach(e => {
        e.contentDocument.addEventListener('pointerup', pointerUp);
        e.contentDocument.addEventListener('pointermove', pointerMove);
    });
}
setup_separator_handler();
setup_iframe_handler();

