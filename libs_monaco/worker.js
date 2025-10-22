// Worker内でモジュールをインポートすることも可能（今回の例では使用しない）
// import { someFunction } from './utils.js';

const createMockGlobals = () => {
    const element_mockFn = new Set([
        'createElement', 'appendChild', 'removeChild',
        'querySelector', 'querySelectorAll',
        'insertBefore', 'replaceChild',
        'addEventListener','removeEventListener',
        'add', 'remove', 'toggle', 'contains', 'replace', 'item', // classList
        'getPropertyValue','setProperty','removeProperty', // style
    ]);
    const mockElement = new Proxy({}, {
        get(target, prop) {
            if (element_mockFn.has(prop)) {
                return (...args) => mockElement;
            }
            return mockElement;
        },
        set: () => true
    });
    const document = new Proxy({}, {
        get(target, prop) {
            if (prop.includes('Element') || prop.includes('querySelector') ||
                prop === 'createElement') {
                return () => mockElement;
            }
            return mockElement;
        },
        set: () => true
    });

    const console = new Proxy({}, {
        get(target, prop) {
            return (...args) => {
                if (self.console[prop]) {
                    self.console[prop](...args);
                } else {
                    self.console.log(...args); // fallback
                }
            };
        }
    });

    const mockFn = () => { };
    const globals = {
        document,
        console,
        window: new Proxy({}, {
            get: (t, p) => p === 'document' ? document : p === 'console' ? console : mockFn,
            set: () => true
        }),
        navigator: mockFn,
        location: mockFn,
        history: mockFn,
        screen: mockFn,
        localStorage: mockFn,
        sessionStorage: mockFn,
        alert: mockFn,
        confirm: mockFn,
        prompt: mockFn,
        fetch: mockFn,
        XMLHttpRequest: mockFn
    };

    return globals;
};

self.addEventListener('message', (event) => {
    const { code } = event.data;
    try {
        const mocks = createMockGlobals();
        (new Function(...Object.keys(mocks), code))(...Object.values(mocks));
        self.postMessage({ status: 'success' });
    } catch (e) {
        self.postMessage({ status: 'error', message: e.message });
    }
});

