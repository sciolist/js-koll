import type { ExportFunction } from '../.js';
import { error as sendError } from '../context.js';
import type { InstrumentationScope } from '../protocol.js';

const scope: InstrumentationScope = {
    name: 'koll/unhandled-errors',
    version: '0.0.1',
};

/**
 * Options for the unhandled errors instrumentation
 */
interface InstrumentUnhandledErrorsOptions {
    /**
     * A function that filters out any errors that pass.
     */
    ignore?: (error: Error) => boolean;
}

/**
 * Log any unhandled errors.
 *
 * @params exporter exporter to send the errors to
 * @param options configuration options
 * @returns a function that disabled the instrumentation
 */
export function instrumentUnhandledErrors(exporter: ExportFunction, options?: InstrumentUnhandledErrorsOptions) {
    const original = window.onerror;

    function handleError(error: Error) {
        if (options?.ignore?.(error) !== false) {
            sendError(exporter, scope, null, error);
        }
    }

    function onError(event: Event | string, source?: string, lineno?: number, colno?: number, error?: Error) {
        try {
            if (!error) return;
            handleError(error ?? (event instanceof Error ? event : new Error(String(event))));
        } finally {
            original?.call(window, event, source, lineno, colno, error);
        }
    }

    function onReject(evt: any) {
        if (evt.reason instanceof Error) {
            handleError(evt.reason);
        }
    }

    window.addEventListener('unhandledrejection', onReject);
    window.onerror = onError;

    return function () {
        if (window.onerror === onError) {
            window.onerror = original;
        }
        window.removeEventListener('unhandledrejection', onReject);
    };
}
