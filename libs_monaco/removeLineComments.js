/**
 * jsの文字列から // のコメント部分を削除する。
 */
export function removeLineComments(code) {
    let result = '';
    let i = 0;

    while (i < code.length) {
        const char = code[i];

        // 文字列リテラルの処理（シングル、ダブル、バッククォート）
        if (char === "'" || char === '"' || char === '`') {
            const quote = char; // 開始クォートを記憶
            let j = i + 1;
            result += char;

            // 同じクォートが見つかるまでループ
            while (j < code.length) {
                result += code[j];
                if (code[j] === quote && code[j - 1] !== '\\') {
                    break;
                }
                j++;
            }
            i = j + 1;
            continue;
        }

        // //コメントの検出と削除
        if (char === '/' && code[i + 1] === '/') {
            // 行末まで読み飛ばす
            let j = i + 2;
            while (j < code.length && code[j] !== '\n') {
                j++;
            }
            // 改行は保持
            if (j < code.length && code[j] === '\n') {
                result += '\n';
                i = j + 1;
            } else {
                i = j;
            }
            continue;
        }

        result += char;
        i++;
    }

    return result;
}

function test() {
    // テストケース
    const tests = [
        '// a',
        "'// a'",
        `const str = "// not a comment";
        // this is a comment
        const value = 42; // inline comment
        const url = 'https://example.com';`,
        '`// ${value}`',
        '`1`"2"// ${value}',
    ];
    tests.forEach(str => {
        console.log("----------------------")
        console.log('入力:', str);
        console.log('出力:', removeLineComments(str));
    })
}
// test();
