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
        const line = lines[i];
        let searchIndex = 0;

        while (true) {
            const column = line.indexOf(tagStart, searchIndex);
            if (column === -1) {
                break;
            }
            searchIndex = column + tagStart.length;

            const startLine = i;
            let openTagEnd = -1;
            let closeTagEnd = -1;
            let tagContent = '';
            let trailingTextAfterOpen = '';

            for (let j = i; j < lines.length; j++) {
                const segment = j === i ? lines[j].slice(column) : lines[j];
                tagContent += segment;

                const closeIndexInSegment = segment.indexOf('>');
                if (closeIndexInSegment !== -1) {
                    openTagEnd = j;
                    trailingTextAfterOpen = segment.slice(closeIndexInSegment + 1);
                    break;
                }
            }

            if (openTagEnd === -1) {
                continue;
            }

            const openTagContent = extractOpenTag(tagContent);
            if (!openTagContent || !hasAttributeValue(openTagContent, type, searchAttr)) {
                continue;
            }

            const indentSource = lines[startLine].slice(0, column);
            const indentMatch = indentSource.match(/\s*$/);
            const indent = indentMatch ? indentMatch[0] : '';
            const prefixText = indentSource.slice(0, indentSource.length - indent.length);

            if (type === 'link') {
                    return {
                        startLine,
                        endLine: openTagEnd,
                        lineCount: openTagEnd - startLine + 1,
                        indent,
                        prefixText,
                        trailingText: trailingTextAfterOpen,
                        startColumn: column,
                    };
            }

            if (type === 'script') {
                const openTagLineSegment = lines[openTagEnd].slice(openTagEnd === startLine ? column : 0);
                if (openTagLineSegment.toLowerCase().includes('</script>')) {
                    closeTagEnd = openTagEnd;
                } else {
                    for (let j = openTagEnd + 1; j < lines.length; j++) {
                        if (lines[j].toLowerCase().includes('</script>')) {
                            closeTagEnd = j;
                            break;
                        }
                    }
                }

                if (closeTagEnd !== -1) {
                    const closingLineSegment = closeTagEnd === startLine
                        ? lines[closeTagEnd].slice(column)
                        : lines[closeTagEnd];
                    const lowerClosingSegment = closingLineSegment.toLowerCase();
                    const closingToken = '</script>';
                    const closeIndex = lowerClosingSegment.indexOf(closingToken);
                    const trailingText = closeIndex !== -1 && closeIndex + closingToken.length < closingLineSegment.length
                        ? closingLineSegment.slice(closeIndex + closingToken.length)
                        : '';
                    return {
                        startLine,
                        endLine: closeTagEnd,
                        lineCount: closeTagEnd - startLine + 1,
                        indent,
                        prefixText,
                        trailingText,
                        startColumn: column,
                    };
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
    const { startLine, lineCount, indent, trailingText = '', startColumn = 0, prefixText = '' } = tagInfo;
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

    if (prefixText) {
        newLines[0] = `${prefixText}${newLines[0]}`;
    }

    if (trailingText) {
        const lastIndex = newLines.length - 1;
        newLines[lastIndex] = `${newLines[lastIndex]}${trailingText}`;
    }

    lines.splice(startLine, lineCount, ...newLines);

    return {
        lines,
        record: {
            startLine: tagInfo.startLine,
            startColumn,
            originalLineCount: tagInfo.lineCount,
            newLineCount: newLines.length,
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