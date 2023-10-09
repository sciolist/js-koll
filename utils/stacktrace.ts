export interface ErrorFrame {
    function?: string;
    filename?: string;
    module?: string;
    lineno?: number;
    colno?: number;
}

export interface ErrorStack {
    frames: ErrorFrame[];
}

export interface ErrorDetails {
    type: string;
    value: string;
    stacktrace?: ErrorStack;
}

/**
 * Parse an error, either with V8 style exception details or Firefox/Safari style.
 *
 * @param error An error object
 * @returns Extracted error details
 */
export function parseError(error: any): ErrorDetails {
    const result = {
        type: error.name,
        value: error.message,
        stacktrace: parseStackTrace(error),
    };
    return result;
}

/**
 * Parse a stack trace, either with V8 style exception details or Firefox/Safari style.
 *
 * @param stack The stacktrace string
 * @returns A stacktrace object representation
 */
export function parseStackTrace(stack: string): ErrorStack | undefined {
    // this is mostly copied from https://github.com/stacktracejs/error-stack-parser

    // if we don't have a stack property there's nothing more we can do
    if (!stack) return undefined;

    // check if we're blink-y
    if (/^\s*at .*(\S+:\d+|\(native\))/m.test(stack)) {
        const lines = stack.split('\n').filter((l) => /^\s*at .*(\S+:\d+|\(native\))/m.test(l));

        const frames = lines.map(function (inLine) {
            let l = inLine;
            if (l.indexOf('(eval ') > -1) {
                l = l.replace(/eval code/g, 'eval').replace(/(\(eval at [^()]*)|(,.*$)/g, '');
            }

            const sanitizedLine = l
                .replace(/^\s+/, '')
                .replace(/\(eval code/g, '(')
                .replace(/^.*?\s+/, '');
            const functionName = sanitizedLine.endsWith(')') ? sanitizedLine.replace(/\s.+/, '') : undefined;
            const locationParts = sanitizedLine.match(/(?:^|\b)(https?:.+?)(?::(\d+):(\d+))?(?:\)|$)/) ?? [
                null,
                sanitizedLine,
                -1,
                -1,
            ];

            return {
                fileName: locationParts[1],
                function: functionName ?? '<anonymous>',
                colno: locationParts[2] ? Number(locationParts[2]) : undefined,
                lineno: locationParts[3] ? Number(locationParts[3]) : undefined,
            };
        });

        return { frames };
    } else {
        // otherwise we'll assume firefox/safari style errors
        const lines = stack.split(/\n/).filter((l) => !/^([a-zA-Z]+@)?(\[native code\])?$/.test(l));

        const frames = lines
            .map((l) => {
                // don't fail on eval functions in safari
                if (l.indexOf('@') === -1 && l.indexOf(':') === -1) {
                    return { function: l };
                }

                const functionNameRegex = /((.*".+"[^@]*)?[^@]*)(?:@)/;
                const matches = l.match(functionNameRegex);
                const functionName = (matches && matches[1] ? matches[1] : undefined) ?? '<anonymous>';
                const locationBase = l.replace(functionNameRegex, '');

                // exit fast for functions like "(native)"
                if (locationBase.indexOf(':') === -1) {
                    return {
                        fileName: locationBase,
                        function: functionName,
                    };
                }

                // extract file and location information
                const locationParts = locationBase.replace(/[()]/g, '').match(/(.+?)(?::(\d+))?(?::(\d+))?$/) as any;
                return {
                    fileName: locationParts[1],
                    function: functionName,
                    colno: locationParts[2] ? Number(locationParts[2]) : undefined,
                    lineno: locationParts[3] ? Number(locationParts[3]) : undefined,
                };
            })
            .filter((v) => v);

        return { frames };
    }
}
