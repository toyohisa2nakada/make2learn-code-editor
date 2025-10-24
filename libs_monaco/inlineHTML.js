/**
 * HTML文字列処理：コンテンツインライン化と行数維持（改善版）
 * 
 * localhostで始まるlink/scriptタグを、対応するコンテンツで置換し、
 * 元の行数を維持するために空行を追加します。
 */

export function inlineHTML(htmlString, contentMap0) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const contentMap1 = Object.entries(contentMap0).reduce((a, [k, v]) => ({ ...a, [k]: normalizeLineBreaks(v) }), {});

    // 処理対象のタグ情報を収集
    const replacements = [];

    // <link>タグを検索
    const links = doc.querySelectorAll(`link[href]`);
    links.forEach(link => {
        const href = link.getAttribute('href');

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
    const scripts = doc.querySelectorAll(`script[src]`);
    scripts.forEach(script => {
        const src = script.getAttribute('src');

        if (!/[\/\\:?#]/.test(src) && src in contentMap1) {
            replacements.push({
                element: script,
                content: contentMap1[src],
                type: 'script',
                src: src,
                outerHTML: script.outerHTML
            });
        }
    });

    // 元のHTML文字列の行情報を保持しつつ置換を適用
    const originalLines = htmlString.split('\n');
    const replacementsWithInfo = replacements
        .map(replacement => {
            const tagInfo = findTagInHTML(originalLines, replacement);
            if (!tagInfo) {
                return null;
            }

            return { ...replacement, tagInfo };
        })
        .filter(Boolean);

    let lines = originalLines.slice();

    const sortedReplacements = [...replacementsWithInfo].sort((a, b) => b.tagInfo.startLine - a.tagInfo.startLine);
    sortedReplacements.forEach(replacement => {
        const result = replaceTagWithContent(lines, replacement.tagInfo, replacement);
        if (result.record) {
            replacement.record = result.record;
        }
    });

    const insertionRecords = [];
    replacementsWithInfo.forEach(replacement => {
        if (replacement.record) {
            insertionRecords.push(replacement.record);
        }
    });

    return { html: lines.join('\n'), insertions: insertionRecords };
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
            if (openTagEnd !== -1) {
                const openTagContent = extractOpenTag(tagContent);
                if (!openTagContent || !hasAttributeValue(openTagContent, type, searchAttr)) {
                    continue;
                }
                const indent = lines[startLine].match(/^(\s*)/)[1];

                // linkタグの場合は自己閉じタグなので開始タグの終了まで
                if (type === 'link') {
                    const closingLine = lines[openTagEnd];
                    const tagCloseIndex = closingLine.indexOf('>');
                    const trailingText = tagCloseIndex !== -1 && tagCloseIndex + 1 < closingLine.length
                        ? closingLine.slice(tagCloseIndex + 1)
                        : '';
                    return {
                        startLine: startLine,
                        endLine: openTagEnd,
                        lineCount: openTagEnd - startLine + 1,
                        indent: indent,
                        trailingText
                    };
                }

                // scriptタグの場合は</script>まで探す
                if (type === 'script') {
                    // 開始タグと同じ行に</script>がある場合␊
                    if (lines[openTagEnd].includes('</script>')) {
                        closeTagEnd = openTagEnd;
                    } else {
                        // </script>を探す␊
                        for (let j = openTagEnd + 1; j < lines.length; j++) {
                            if (lines[j].includes('</script>')) {
                                closeTagEnd = j;
                                break;
                            }
                        }
                    }

                    if (closeTagEnd !== -1) {
                        const closingLine = lines[closeTagEnd];
                        const lowerClosingLine = closingLine.toLowerCase();
                        const closingToken = '</script>';
                        const closeIndex = lowerClosingLine.indexOf(closingToken);
                        const trailingText = closeIndex !== -1 && closeIndex + closingToken.length < closingLine.length
                            ? closingLine.slice(closeIndex + closingToken.length)
                            : '';
                        return {
                            startLine: startLine,
                            endLine: closeTagEnd,
                            lineCount: closeTagEnd - startLine + 1,
                            indent: indent,
                            trailingText
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
    const { startLine, lineCount, indent, trailingText = '' } = tagInfo;
    const { content, type } = replacement;

    const tagName = type === 'link' ? 'style' : 'script';
    const contentIndent = indent + '    ';
    const normalizedContent = normalizeLineBreaks(content);
    let contentLines = normalizedContent.split('\n');
    if (contentLines.length === 1 && contentLines[0] === '') {
        contentLines = [];
    }

    const newLines = [`${indent}<${tagName}>`];
    contentLines.forEach(line => {
        if (line === '') {
            newLines.push('');
        } else {
            newLines.push(`${contentIndent}${line}`);
        }
    });
    newLines.push(`${indent}</${tagName}>`);

    if (trailingText) {
        const lastIndex = newLines.length - 1;
        newLines[lastIndex] = `${newLines[lastIndex]}${trailingText}`;
    }

    lines.splice(startLine, lineCount, ...newLines);

    const newLineCount = newLines.length;
    const addedLineCount = Math.max(0, newLineCount - lineCount);

    return {
        lines,
        record: {
            startLine: tagInfo.startLine + 1,
            originalLineCount: tagInfo.lineCount,
            addedLineCount,
        }
    };
}

function normalizeLineBreaks(text) {
    return text.replace(/\r\n?|\n/g, '\n');
}

function extractOpenTag(tagContent) {
    const closeIndex = tagContent.indexOf('>');
    if (closeIndex === -1) {
        return null;
    }

    return tagContent.slice(0, closeIndex + 1);
}

function hasAttributeValue(openTagContent, type, searchAttr) {
    const attrName = type === 'link' ? 'href' : 'src';
    const pattern = new RegExp(`${attrName}\\s*=\\s*(["'])${escapeRegExp(searchAttr)}\\1`, 'i');
    return pattern.test(openTagContent);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    const { html, insertions } = inlineHTML(htmlString, contentMap);
    console.log(html);
    console.log('\n--- 行数比較 ---');
    console.log('元の行数:', htmlString.split('\n').length);
    console.log('処理後の行数:', html.split('\n').length);
    console.log('挿入記録:', insertions);
}