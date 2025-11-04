/**
 * JavaScript Step Execution Library
 * ---------------------------------
 *
 * This module provides a small utility for instrumenting arbitrary JavaScript
 * source text so it can be executed step by step. The core idea is to compile
 * the supplied source into an async generator function where each statement (or
 * structural boundary) yields execution metadata. Consumers can iterate the
 * generator to advance execution one step at a time, inspect variables via a
 * captured `evaluate` function, and observe watched expressions.
 *
 * The implementation intentionally avoids external dependencies so it can run
 * directly in the browser (or any modern JavaScript environment). The
 * instrumenter performs a lightweight lexical walk over the source in order to
 * inject `yield` checkpoints without requiring a full AST.
 */

const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {})
  .constructor;

/**
 * Instrument raw JavaScript source into the body of an async generator
 * function. The generated code yields an object for each detected execution
 * step.
 *
 * @param {string} source - Original user supplied JavaScript source text.
 * @returns {string} Instrumented generator body.
 */
function instrumentSource(source) {
  const watchersExpression =
    '(__watchExpressions.length ? __watchExpressions.map((expression) => { try { return { expression, value: eval(expression) }; } catch (error) { return { expression, error: __normalizeError(error) }; } }) : [])';
  const header = `"use strict";
const __normalizeError = (error) => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: error };
};
let __evaluate;
let __watchExpressions = [];
let __stepIndex = 0;
try {
  __evaluate = (expression) => eval(expression);
  __watchExpressions = Array.isArray(__options?.watch) ? __options.watch : [];
  yield { type: "start", index: __stepIndex, line: 1, column: 1, code: "", evaluate: __evaluate, watch: ${watchersExpression} };
`;

  const footer = `
  const __finalWatch = ${watchersExpression};
  return { type: "end", index: __stepIndex, evaluate: __evaluate, watch: __finalWatch };
} catch (__error) {
  const __errorPayload = __normalizeError(__error);
  const __errorWatch = ${watchersExpression};
  return { type: "error", index: ++__stepIndex, error: __errorPayload, evaluate: __evaluate, watch: __errorWatch };
}`;

  let output = header;
  let statementBuffer = "";
  let statementStarted = false;
  let statementStartLine = 1;
  let statementStartColumn = 1;

  let line = 1;
  let column = 1;

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let templateEscape = false;
  let templateExprDepth = 0;
  let stringEscape = false;
  let inLineComment = false;
  let inBlockComment = false;
  let parenDepth = 0;
  const forStack = [];
  let pendingForHeader = false;

  const len = source.length;

  const isWhitespace = (ch) => ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";

  const normalizeSnippet = (snippet) => {
    const trimmed = snippet.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed.replace(/\s+/g, " ");
  };

  const emitStatement = () => {
    const snippet = normalizeSnippet(statementBuffer);
    if (!snippet) {
      statementBuffer = "";
      statementStarted = false;
      return;
    }
    output += `\nyield { type: "statement", index: ++__stepIndex, line: ${statementStartLine}, column: ${statementStartColumn}, code: ${JSON.stringify(snippet)}, evaluate: __evaluate, watch: ${watchersExpression} };\n`;
    statementBuffer = "";
    statementStarted = false;
  };

  const isIdentifierChar = (char) => {
    if (!char) return false;
    return (
      (char >= "a" && char <= "z") ||
      (char >= "A" && char <= "Z") ||
      (char >= "0" && char <= "9") ||
      char === "_" ||
      char === "$"
    );
  };

  let identifierBuffer = "";

  for (let i = 0; i < len; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      output += ch;
      statementBuffer += ch;
      if (ch === "\n") {
        line += 1;
        column = 1;
        inLineComment = false;
        statementStarted = false;
        statementBuffer = "";
      } else {
        column += 1;
      }
      continue;
    }

    if (inBlockComment) {
      output += ch;
      statementBuffer += ch;
      if (ch === "*" && next === "/") {
        output += next;
        statementBuffer += next;
        i += 1;
        column += 2;
        inBlockComment = false;
      } else if (ch === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (ch === "/" && next === "/") {
        output += ch;
        output += next;
        statementBuffer += ch;
        statementBuffer += next;
        i += 1;
        column += 2;
        inLineComment = true;
        continue;
      }
      if (ch === "/" && next === "*") {
        output += ch;
        output += next;
        statementBuffer += ch;
        statementBuffer += next;
        i += 1;
        column += 2;
        inBlockComment = true;
        continue;
      }
    }

    // Handle quote entry/exit.
    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (ch === "'") {
        inSingleQuote = true;
        stringEscape = false;
      } else if (ch === '"') {
        inDoubleQuote = true;
        stringEscape = false;
      } else if (ch === "`") {
        inTemplate = true;
        templateEscape = false;
        templateExprDepth = 0;
      }
    } else if (inSingleQuote) {
      if (stringEscape) {
        stringEscape = false;
      } else if (ch === "\\") {
        stringEscape = true;
      } else if (ch === "'") {
        inSingleQuote = false;
      }
    } else if (inDoubleQuote) {
      if (stringEscape) {
        stringEscape = false;
      } else if (ch === "\\") {
        stringEscape = true;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
    } else if (inTemplate) {
      if (templateEscape) {
        templateEscape = false;
      } else if (ch === "\\") {
        templateEscape = true;
      } else if (ch === "`" && templateExprDepth === 0) {
        inTemplate = false;
      } else if (ch === "$" && next === "{" && templateExprDepth >= 0) {
        templateExprDepth += 1;
      } else if (ch === "}" && templateExprDepth > 0) {
        templateExprDepth -= 1;
      }
    }

    // Track parentheses depth outside of string/template/comment contexts.
    const currentlyProtected = inSingleQuote || inDoubleQuote || inTemplate || inLineComment || inBlockComment;

    if (!currentlyProtected) {
      if (isIdentifierChar(ch)) {
        identifierBuffer += ch;
      } else {
        if (identifierBuffer === "for") {
          pendingForHeader = true;
        }
        identifierBuffer = "";
      }
    }

    if (!currentlyProtected) {
      if (ch === "(") {
        if (pendingForHeader) {
          forStack.push({ depth: parenDepth });
          pendingForHeader = false;
        }
        parenDepth += 1;
      } else if (ch === ")") {
        parenDepth = Math.max(parenDepth - 1, 0);
        if (forStack.length && forStack[forStack.length - 1].depth === parenDepth) {
          forStack.pop();
        }
        pendingForHeader = false;
      } else if (!isWhitespace(ch)) {
        pendingForHeader = false;
      }
    }

    // For statement tracking: record first non-whitespace character position.
    if (!statementStarted && !isWhitespace(ch)) {
      statementStarted = true;
      statementStartLine = line;
      statementStartColumn = column;
    }

    output += ch;
    statementBuffer += ch;

    const insideForHeader =
      !currentlyProtected &&
      forStack.length > 0 &&
      parenDepth > forStack[forStack.length - 1].depth;

    if (!currentlyProtected && ch === ";" && !insideForHeader) {
      emitStatement();
    }

    if (ch === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  emitStatement();

  output += footer;
  return output;
}

/**
 * Compile instrumented source into an async generator factory.
 *
 * @param {string} source
 * @returns {Function}
 */
function compileSource(source) {
  const body = instrumentSource(source);
  try {
    return new AsyncGeneratorFunction("__options", body);
  } catch (error) {
    const normalized = error instanceof Error ? error.message : String(error);
    throw new SyntaxError(`Failed to compile instrumented source: ${normalized}`);
  }
}

/**
 * Default error normalizer used in public APIs.
 * @param {unknown} error
 */
function normalizeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: error };
}

/**
 * StepExecutor orchestrates running instrumented JavaScript step by step.
 */
export class StepExecutor {
  /**
   * @param {string} source
   * @param {{ watch?: string[] }} [options]
   */
  constructor(source, options = {}) {
    if (typeof source !== "string") {
      throw new TypeError("StepExecutor requires source to be a string.");
    }
    this._source = source;
    this._options = { ...options };
    this._factory = compileSource(source);
    this._iterator = null;
    this._done = false;
    this._evaluateFn = null;
  }

  /**
   * Replace the current source (and optionally options) and reset execution
   * state.
   *
   * @param {string} source
   * @param {{ watch?: string[] }} [options]
   */
  reset(source, options = undefined) {
    if (typeof source !== "string") {
      throw new TypeError("reset requires the new source to be a string.");
    }
    this._source = source;
    if (options) {
      this._options = { ...options };
    }
    this._factory = compileSource(source);
    this._iterator = null;
    this._done = false;
    this._evaluateFn = null;
  }

  /**
   * Update runtime options (e.g., watch expressions) without recompiling the
   * source.
   *
   * @param {{ watch?: string[] }} options
   */
  configure(options = {}) {
    this._options = { ...this._options, ...options };
    this._iterator = null;
    this._done = false;
    this._evaluateFn = null;
  }

  /**
   * Lazily acquire the async generator iterator for the current program.
   */
  _ensureIterator() {
    if (!this._iterator) {
      this._iterator = this._factory(this._options);
      this._done = false;
      this._evaluateFn = null;
    }
    return this._iterator;
  }

  /**
   * Advance execution to the next step.
   *
   * @returns {Promise<{ value: any, done: boolean }>}
   */
  async next() {
    if (this._done) {
      return { value: undefined, done: true };
    }

      const iterator = this._ensureIterator();
      try {
        const result = await iterator.next();
        if (result.done) {
          this._done = true;
        }
        if (result.value && typeof result.value.evaluate === "function") {
          this._evaluateFn = result.value.evaluate;
        }
        return result;
      } catch (error) {
        this._done = true;
        return { value: { type: "error", error: normalizeError(error) }, done: true };
      }
  }

  /**
   * Evaluate an expression against the most recent execution context.
   *
   * @param {string} expression
   * @returns {Promise<unknown>}
   */
  async evaluate(expression) {
    if (typeof expression !== "string") {
      throw new TypeError("evaluate expects the expression to be a string.");
    }
    if (!this._evaluateFn) {
      throw new Error("No evaluation context is available. Advance the program with next() first.");
    }
    return await this._evaluateFn(expression);
  }

  /**
   * Convenience helper to iterate through the entire program.
   *
   * @param {(step: any) => (void | Promise<void>)} onStep
   * @returns {Promise<void>}
   */
  async run(onStep) {
    if (typeof onStep !== "function") {
      throw new TypeError("run expects a callback function.");
    }
    while (true) {
      const { value, done } = await this.next();
      if (done) {
        if (value !== undefined) {
          await onStep(value);
        }
        break;
      }
      await onStep(value);
    }
  }

  /**
   * Expose the currently compiled (instrumented) source for inspection.
   *
   * @returns {string}
   */
  getInstrumentedSource() {
    return instrumentSource(this._source);
  }

  /**
   * Return the raw (unmodified) source text.
   */
  get source() {
    return this._source;
  }

  /**
   * Return the active runtime options.
   */
  get options() {
    return { ...this._options };
  }
}

export { instrumentSource };
