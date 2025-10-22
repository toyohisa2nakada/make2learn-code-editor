/**
 * HTML文字列処理：コンテンツインライン化と行数維持（改善版）
 * 
 * localhostで始まるlink/scriptタグを、対応するコンテンツで置換し、
 * 元の行数を維持するために空行を追加します。
 */

export function inlineHTML(htmlString, /*key,*/ contentMap0) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const contentMap1 = Object.entries(contentMap0).reduce((a, [k, v]) => ({ ...a, [k]: v.replace(/(\r\n|\n|\r)/g, '') }), {});

    // 処理対象のタグ情報を収集
    const replacements = [];

    // <link>タグを検索
    // const links = doc.querySelectorAll(`link[href^="${key}"]`);
    const links = doc.querySelectorAll(`link[href]`);
    links.forEach(link => {
        // const href = link.getAttribute('href');
        // const path = href.replace(new RegExp(`^${key}`), '');
        const href = link.getAttribute('href');
console.log(href);

        if (!/[\/\\:?#]/.test(href) && href in contentMap1) {
            replacements.push({
                element: link,
                content: contentMap1[href],
                type: 'link',
                href: href,
                outerHTML: link.outerHTML
            });
        }
    });

    // <script>タグを検索
    // const scripts = doc.querySelectorAll(`script[src^="${key}"]`);
    const scripts = doc.querySelectorAll(`script[src]`);
    scripts.forEach(script => {
        const src = script.getAttribute('src');
        // const path = src.replace(new RegExp(`^${key}`), '');
        // const content = contentMap1[path];
console.log(src)

        // if (content !== undefined) {
        if(!/[\/\\:?#]/.test(src) && src in contentMap1) {
            replacements.push({
                element: script,
                content: contentMap1[src],
                type: 'script',
                src: src,
                outerHTML: script.outerHTML
            });
        }
    });

    // 元のHTML文字列で各タグの位置と行数を特定して置換
    let lines = htmlString.split('\n');

    // 各置換対象について処理
    replacements.forEach(replacement => {
        const tagInfo = findTagInHTML(lines, replacement);

        if (tagInfo) {
            lines = replaceTagWithContent(lines, tagInfo, replacement);
        }
    });

    return lines.join('\n');
}

/**
 * HTML文字列内でタグの位置と行数を特定
 */
function findTagInHTML(lines, replacement) {
    const { type, href, src } = replacement;
    const searchAttr = type === 'link' ? href : src;
    const tagStart = type === 'link' ? '<link' : '<script';

    for (let i = 0; i < lines.length; i++) {
        // タグの開始を検出
        if (lines[i].includes(tagStart)) {
            let startLine = i;
            let openTagEnd = -1;
            let closeTagEnd = -1;
            let tagContent = '';

            // 開始タグの終了を探す
            for (let j = i; j < lines.length; j++) {
                tagContent += lines[j];

                if (lines[j].includes('>')) {
                    openTagEnd = j;
                    break;
                }
            }

            // このタグに目的の属性が含まれているか確認
            if (openTagEnd !== -1 && tagContent.includes(searchAttr)) {
                const indent = lines[startLine].match(/^(\s*)/)[1];

                // linkタグの場合は自己閉じタグなので開始タグの終了まで
                if (type === 'link') {
                    return {
                        startLine: startLine,
                        endLine: openTagEnd,
                        lineCount: openTagEnd - startLine + 1,
                        indent: indent
                    };
                }

                // scriptタグの場合は</script>まで探す
                if (type === 'script') {
                    // 開始タグと同じ行に</script>がある場合
                    if (lines[openTagEnd].includes('</script>')) {
                        closeTagEnd = openTagEnd;
                    } else {
                        // </script>を探す
                        for (let j = openTagEnd + 1; j < lines.length; j++) {
                            if (lines[j].includes('</script>')) {
                                closeTagEnd = j;
                                break;
                            }
                        }
                    }

                    if (closeTagEnd !== -1) {
                        return {
                            startLine: startLine,
                            endLine: closeTagEnd,
                            lineCount: closeTagEnd - startLine + 1,
                            indent: indent
                        };
                    }
                }
            }
        }
    }

    return null;
}

/**
 * タグをコンテンツで置換し、行数を維持
 */
function replaceTagWithContent(lines, tagInfo, replacement) {
    const { startLine, endLine, lineCount, indent } = tagInfo;
    const { content, type } = replacement;

    // 新しいタグを生成
    const newTag = type === 'link'
        ? `${indent}<style>${content}</style>`
        : `${indent}<script>${content}</script>`;

    // 置換後の行を生成
    const newLines = [newTag];

    // 行数を維持するために空行を追加
    const emptyLinesToAdd = lineCount - 1;
    for (let i = 0; i < emptyLinesToAdd; i++) {
        newLines.push('');
    }

    // 元の行を置換
    lines.splice(startLine, lineCount, ...newLines);

    return lines;
}

// debug用
export function test() {
    // 使用例
    const htmlString = `<!DOCTYPE html>
        <html>
            <head>
                <link
                    rel="stylesheet"
                    href="localhost/styles/main.css"
                >
                <script 
                    src="localhost/scripts/utils.js"
                    type="text/javascript">
            
                </script>
            </head>
            <body>
                <h1>Hello World</h1>
                <script src="localhost/scripts/app.js"></script>
            </body>
        </html>`;

    const contentMap = {
        'styles/main.css': 'body{margin:0;padding:0}h1{color:blue}',
        'scripts/app.js': 'console.log("app loaded");',
        'scripts/utils.js': 'function helper(){return true}'
    };

    const result = inlineHTML(htmlString, 'localhost/', contentMap);
    console.log(result);
    console.log('\n--- 行数比較 ---');
    console.log('元の行数:', htmlString.split('\n').length);
    console.log('処理後の行数:', result.split('\n').length);
}
