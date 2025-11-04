[pages](https://toyohisa2nakada.github.io/make2learn-code-editor/index_with_monaco.html)

## JavaScript Step Executor

`libs/stepExecutor.js` exposes a `StepExecutor` class that turns arbitrary JavaScript source text into an async generator. Each `next()` call advances execution to the next statement and yields metadata such as the excerpt of code being run, line/column information, and a captured `evaluate` helper that can inspect variables at that point in time.

```js
import { StepExecutor } from './libs/stepExecutor.js';

const code = `
let total = 0;
for (let i = 0; i < 3; i++) {
  total += i;
}
`;

const executor = new StepExecutor(code, { watch: ['total', 'i'] });

(async () => {
  while (true) {
    const { value, done } = await executor.next();
    if (done) break;

    console.log(value.code, value.watch);
    console.log('current total:', await executor.evaluate('total'));
  }
})();
```

Supply `watch` expressions to observe values automatically at each step. When the program finishes (or throws), the final event includes the last known values so you can display results or debug state transitions.

