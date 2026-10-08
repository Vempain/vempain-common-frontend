import '@testing-library/jest-dom';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof window !== "undefined" && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
        }),
    });
}

if (typeof ResizeObserver === "undefined") {
    class TestResizeObserver implements ResizeObserver {
        observe(): void {
        }

        unobserve(): void {
        }

        disconnect(): void {
        }
    }

    globalThis.ResizeObserver = TestResizeObserver;
}
