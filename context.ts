import type { InstrumentationScope, KeyValue, LogRecord, ParentSpan, Span } from './protocol.js';
import { type ExportFunction } from './configure.js';
import { id, now } from './utils/data.js';

/**
 * Tracing utility functions
 */
export interface Tracer {
    /**
     * Record an error
     *
     * @param scope Which scope the error took place in
     * @param error Error object to record
     */
    error(scope: InstrumentationScope, ex: Error): Promise<void>;

    /**
     * Write a log message
     *
     * Log levels:
     *      0 = unspecified
     *   1- 4 = trace
     *   5- 8 = debug
     *   9-12 = info
     *  13-16 = warn
     *  17-20 = error
     *  21-24 = fatal
     *
     * @param scope Which scope to log as
     * @param severity Severity level
     * @param message The message to log
     * @param log An optional customization object for the log record
     */
    log(scope: InstrumentationScope, severity: number, message: string, record?: Partial<LogRecord>): Promise<void>;
    
    /**
     * Record a measurement
     *
     * @param scope Which scope the instrument took place in
     * @param name The name of the measurement
     * @param unit Unit of measure (https://unitsofmeasure.org/ucum)
     * @param value Current value of the measurement
     */
    measurement(
        scope: InstrumentationScope,
        name: string,
        unit: string,
        value: number,
        context?: any,
    ): Promise<void>;

    /**
     * Record a trace span
     *
     * @param scope Which scope the trace occured in
     * @param details Specifics of the span to record
     */
    span(scope: InstrumentationScope, details?: Partial<Span>): Promise<void>;
    

    /**
     * Creates a new span recording an async action.
     *
     * @param scope Which scope the trace occured in
     * @param fn Function to invoke with the span, and a context object
     * @returns The return value of `fn`
     */
    run<T>(scope: InstrumentationScope, fn: (span: RunningSpan) => Promise<T>): Promise<T>;
}

/**
 * Span with some helpful utilities
 */
export interface RunningSpan extends Span, Tracer {
    /**
     * Gets a standard string that can be sent to a service to ask them to use this trace as their parent.
     */
    traceparent(): string;
    /**
     * Adds an event at the current time.
     *
     * @param name Event name
     * @param attributes Any key value attributes to associate with the event
     */
    mark(name: string, attributes?: KeyValue[]): void;

    /**
     * If cancel is called, this span will not be automatically sent to the global exporter.
     *
     * You can still pass it to the exporter yourself.
     */
    cancel(): void;
}

/**
 * Creates a new span recording an async action.
 *
 * @param exporter A function that the span will be passed to when it is complete, or null to not export
 * @param scope Which scope the trace occured in
 * @param parent An optional trace context to connect the span to
 * @param fn Function to invoke with the span, and a context object
 * @returns The return value of `fn`
 */
export async function runSpan<T>(
    exporter: ExportFunction | undefined | null,
    scope: InstrumentationScope,
    parent: ParentSpan,
    fn: (span: RunningSpan) => Promise<T>,
): Promise<T> {
    const newSpan: RunningSpan = {
        ...makeSpan(parent),
        cancel() {
            newSpan.sample = false;
        },
        traceparent() {
            return `00-${newSpan.traceId}-${newSpan.spanId}-${Number(newSpan.sample).toString(16)}`;
        },
        mark(name: string, attributes?: KeyValue[]) {
            newSpan.events.push({
                name,
                timeUnixNano: now(),
                attributes,
            });
        },
        error: (scope: InstrumentationScope, ex: Error) => error(exporter, scope, newSpan, ex),
        log: (scope: InstrumentationScope, severity: number, message: string, record?: Partial<LogRecord>) =>
            log(exporter, scope, severity, message, newSpan, record),
        measurement: (scope: InstrumentationScope, name: string, unit: string, value: number, context?: any) =>
            measurement(exporter, scope, name, unit, value, context),
        span: (scope: InstrumentationScope, details?: Partial<Span>) => span(exporter, scope, newSpan, details),
        run: <T>(scope: InstrumentationScope, fn: (span: RunningSpan) => Promise<T>) =>
            runSpan(exporter, scope, newSpan, fn),
    };

    try {
        return await fn(newSpan);
    } catch (ex: any) {
        newSpan.status = { code: 2, message: 'ERROR' };
        newSpan.mark('error', errorAttributes(ex));
        throw ex;
    } finally {
        newSpan.endTimeUnixNano = now();
        if (exporter && newSpan.sample) {
            await exporter({
                scope,
                span: newSpan,
            });
        }
    }
}

/**
 * Create and returns a new span
 *
 * @param parent An optional trace context to connect the span to
 * @param details Specifics of the span
 * @returns A new span object
 */
export function makeSpan(parent: ParentSpan, details?: Partial<Span>): Span {
    const parentObj = makeParentObj(parent);
    const timestamp = now();
    const span: Span = {
        startTimeUnixNano: timestamp,
        endTimeUnixNano: timestamp,
        parentSpanId: parentObj?.spanId,
        traceId: parentObj?.traceId ?? id(16),
        sample: parentObj?.sample ?? true,
        spanId: id(8),
        kind: 1,
        name: '',
        status: {
            message: 'OK',
            code: 1,
        },
        attributes: [],
        events: [],
        ...details,
    };
    return span;
}

/**
 * Record a trace span
 *
 * @param exporter A function that the resulting export item will be sent to
 * @param scope Which scope the trace occured in
 * @param parent An optional trace context to connect the span to
 * @param details Specifics of the span to record
 */
export async function span(
    exporter: ExportFunction,
    scope: InstrumentationScope,
    parent: ParentSpan,
    details?: Partial<Span>,
) {
    await exporter({
        scope,
        span: makeSpan(parent, details),
    });
}

/**
 * Write a log message
 *
 * Log levels:
 *      0 = unspecified
 *   1- 4 = trace
 *   5- 8 = debug
 *   9-12 = info
 *  13-16 = warn
 *  17-20 = error
 *  21-24 = fatal
 *
 * @param exporter A function that the resulting export item will be sent to
 * @param scope Which scope to log as
 * @param severity Severity level
 * @param message The message to log
 * @param log An optional customization object for the log record
 */
export async function log(
    exporter: ExportFunction,
    scope: InstrumentationScope,
    severity: number,
    message: string,
    parent: ParentSpan,
    log?: Partial<LogRecord>,
) {
    const parentObj = makeParentObj(parent);
    await exporter({
        scope,
        log: {
            severityNumber: severity,
            timeUnixNano: now(),
            body: {
                stringValue: message,
            },
            traceId: parentObj?.traceId,
            spanId: parentObj?.spanId,    
            ...(log ?? {}),
        },
    });
}

/**
 * Record a measurement
 *
 * @param exporter A function that the resulting export item will be sent to
 * @param scope Which scope the instrument took place in
 * @param name The name of the measurement
 * @param unit Unit of measure (https://unitsofmeasure.org/ucum)
 * @param value Current value of the measurement
 */
export async function measurement(
    exporter: ExportFunction,
    scope: InstrumentationScope,
    name: string,
    unit: string,
    value: number,
    context?: any,
) {
    await exporter({
        scope,
        context,
        metric: {
            name,
            unit,
            data: {
                gauge: {
                    dataPoints: [
                        {
                            value: { asDouble: value },
                            timeUnixNano: now(),
                        },
                    ],
                },
            },
        },
    });
}

/**
 * Record an error
 *
 * @param scope Which scope the error took place in
 * @param parent An optional trace context to connect the error to
 * @param error Error object to record
 */
export async function error(exporter: ExportFunction, scope: InstrumentationScope, parent: ParentSpan, error: Error) {
    await log(exporter, scope, 20, String(error.stack), parent, {
        attributes: errorAttributes(error),
    });
}

function errorAttributes(error: Error) {
    return [
        { key: 'kind', value: { stringValue: 'exception' } },
        { key: 'message', value: { stringValue: String(error) } },
        { key: 'type', value: { stringValue: error.name } },
        { key: 'stacktrace', value: { stringValue: String(error.stack ?? error.message ?? error) } },
    ];
}

/**
 * Create a new tracing object that calls a certain exporter.
 * 
 * @param exporter The exporter used to send logs
 * @param parent A parent trace context
 * @returns 
 */
export function tracer(exporter: ExportFunction, parent?: ParentSpan): Tracer {
    return {
        error: (scope: InstrumentationScope, ex: Error) => error(exporter, scope, parent, ex),
        log: (scope: InstrumentationScope, severity: number, message: string, record?: Partial<LogRecord>) =>
            log(exporter, scope, severity, message, record),
        measurement: (scope: InstrumentationScope, name: string, unit: string, value: number, context?: any) =>
            measurement(exporter, scope, name, unit, value, context),
        span: (scope: InstrumentationScope, details?: Partial<Span>) => span(exporter, scope, parent, details),
        run: <T>(scope: InstrumentationScope, fn: (span: RunningSpan) => Promise<T>) =>
            runSpan(exporter, scope, parent, fn),
    };
}

/** A dummy tracer that does not log anything. */
export const dummyTracer = {
    error: () => Promise.resolve(),
    log: () => Promise.resolve(),
    measurement: () => Promise.resolve(),
    span: () => Promise.resolve(),
    run: <T>(scope: InstrumentationScope, fn: (span: RunningSpan) => Promise<T>) => runSpan(null, scope, null, fn),
}

function makeParentObj(span: ParentSpan) {
    if (typeof span === 'string') {
        const parts = span.split('-');
        const flags = parseInt(parts[3] || '0', 16);
        return {
            version: parseInt(parts[0] || '0', 16),
            traceId: parts[1],
            spanId: parts[2],
            sample: !!(flags & 1),
        };
    } else if (span) {
        return {
            version: 0,
            traceId: span.traceId,
            spanId: span.spanId,
            sample: !!span.sample,
        };
    }
}
