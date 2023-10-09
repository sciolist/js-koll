import type { ExportItem } from '../configure.js';
import type { AnyValue, InstrumentationScope, Resource, Span } from '../protocol.js';
import { parseStackTrace } from '../utils/stacktrace.js';

/**
 * Options for the faro exporter
 */
export interface FaroExporterOptions {
    /** URL to the grafana collector agent (or something similar.) */
    destination: string;
    /** Meta information to pass to Faro. */
    meta(): FaroMeta;
}

/**
 * The faro exporter passes messages on to the Grafana app agent, or something similar.
 *
 * @param options Configuration options
 * @returns The configured exporter function
 */
export function faroExporter(options: FaroExporterOptions) {
    return async function faroExporter(...batch: Array<ExportItem>) {
        const meta = options.meta();
        const resource: Resource = {
            attributes: [{ key: 'service.name', value: { stringValue: meta.app.name } }],
        };

        const [traces, logs, measurements, exceptions, events] = collect(batch);
        const result: Partial<FaroPayload> = { meta };
        if (events.length) result.events = events;
        if (exceptions.length) result.exceptions = exceptions;
        if (measurements.length) result.measurements = measurements;
        if (logs.length) result.logs = logs;
        if (traces.length) {
            result.traces = {
                resourceSpans: [
                    {
                        scopeSpans: traces,
                        resource,
                    },
                ],
            };
        }

        const body = JSON.stringify(result);

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            if (navigator.sendBeacon(options.destination, body)) {
                return;
            }
        }

        await fetch(options.destination, { method: 'POST', body }).then(
            (_st) => {},
            (ex) => {
                console.error(`failed to reach logging backend: ${ex.stack}`);
            },
        );
    };
}

function collect(
    batch: Array<ExportItem>,
): [Array<FaroSpans>, Array<FaroLog>, Array<FaroMeasurement>, Array<FaroException>, Array<FaroEvent>] {
    const logsBatch: Array<FaroLog> = [];
    const eventsBatch: Array<FaroEvent> = [];
    const exceptionBatch: Array<FaroException> = [];
    const measurementsBatch: { [key: string]: FaroMeasurement } = {};
    const tracesBatch: { [key: string]: FaroSpans } = {};
    for (const item of batch) {
        // is this a trace span?
        if (item.span) {
            // group all traces together
            const scope = (tracesBatch[makeScope(item.scope).name] ??= {
                scope: makeScope(item.scope),
                spans: [],
            });
            // then add the trace span
            scope.spans.push(item.span);
            continue;
        }

        // if this a log message?
        if (item.log) {
            const context: any = Object.fromEntries(
                (item.log.attributes?.map((attr) => [attr.key, getStringValue(attr.value)]) as any) ?? [],
            );
            const timestamp = new Date(Number(BigInt(item.log.timeUnixNano) / BigInt(1000)) / 1000).toISOString();
            const trace = item.log.traceId ? { trace_id: item.log.traceId, span_id: item.log.spanId } : undefined;

            // check if we have an exception
            if (context.kind === 'exception') {
                exceptionBatch.push({
                    timestamp,
                    type: context.type,
                    value: item.log.body.stringValue,
                    trace,
                    stacktrace: parseStackTrace(context.stacktrace ?? item.log.body.stringValue ?? ''),
                });
                continue;
            }

            // check if we have an event
            if (context.kind === 'event') {
                eventsBatch.push({
                    timestamp,
                    name: getStringValue(item.log.body),
                    attributes: context,
                    domain: makeScope(item.scope).name,
                    trace,
                });
                continue;
            }

            // otherwise record a plain log message
            logsBatch.push({
                timestamp,
                message: item.log.body.stringValue,
                level: getFaroLogLevel(item.log.severityNumber ?? 0),
                context: context,
                trace,
            });
        }

        // otherwise we have a metric, we only support gauge values here
        if (item.metric && item.metric.data.gauge) {
            // look up the measurement scope
            const scope = (measurementsBatch[makeScope(item.scope).name] ??= {
                type: makeScope(item.scope).name,
                values: {},
            });
            // and extract the key / value of the measurement
            const key = item.metric.name;
            const value = item.metric.data.gauge.dataPoints[0]?.value;
            // if both are set, add it to the measurement and continue
            if (key !== undefined && value !== undefined) {
                scope.values[key] = Number(value.asDouble ?? value.asInt);
            }
        }
    }
    return [Object.values(tracesBatch), logsBatch, Object.values(measurementsBatch), exceptionBatch, eventsBatch];
}

function getFaroLogLevel(severity: number) {
    if (severity < 5) return 'trace';
    if (severity < 9) return 'debug';
    if (severity < 13) return 'info';
    if (severity < 17) return 'warning';
    if (severity < 21) return 'error';
    return 'fatal';
}

function getStringValue(anyValue: AnyValue): string {
    if (anyValue.arrayValue) return anyValue.arrayValue.map(getStringValue).join(';');
    if (anyValue.kvlistValue)
        return anyValue.kvlistValue.map((kv) => `${kv.key}=${getStringValue(kv.value)}`).join(';');
    return String(
        anyValue.boolValue ??
            anyValue.doubleValue ??
            anyValue.bytesValue ??
            anyValue.intValue ??
            anyValue.stringValue ??
            '',
    );
}

interface FaroMeta {
    /** Describe the application, shows up in grafana */
    app?: {
        /** Application name */
        name?: string;
        /** Application version string */
        version?: string;
        /** Application release data */
        release?: string;
        /** Running environment, development / production for example */
        environment?: string;
        /* misc */
        [key: string]: string;
    };
    /** Information about the current user session. Useful to link traces together. */
    session?: {
        /** Unique identifier of the session */
        id?: string;
        /** Any extra information about the session to track */
        attributes?: { [key: string]: string };
    };
    /** Information about a logged in user */
    user?: {
        /** Users email address */
        email?: string;
        /** User ID */
        id?: string;
        /** Username */
        username?: string;
        /** Any extra information about the user to track */
        attributes?: { [key: string]: string };
    };
    /** Information about the current URL / Page */
    page?: {
        /** A unique identifier of the page */
        id?: string;
        /** The current URL */
        url?: string;
        /** Any extra information about the page to track */
        attributes?: { [key: string]: string };
    };
    /** Describe the collector being used, used mostly for debugging */
    sdk?: {
        name?: string;
        version?: string;
        integrations?: Array<{
            name?: string;
            version?: string;
        }>;
    };
    /** Describe the browser user-agent */
    browser?: {
        /** Browser brand name. "Google Chrome" for example */
        name?: string;
        /** Browser version string */
        version?: string;
        /** true for mobile browser, otherwise false */
        mobile?: boolean;
        /** Operating System */
        os?: string;
    };
    /** Any other information you may want to pass on */
    [key: string]: any;
}

interface FaroPayload {
    meta: FaroMeta;
    logs?: Array<FaroLog>;
    measurements?: Array<FaroMeasurement>;
    events?: Array<FaroEvent>;
    exceptions?: Array<FaroException>;
    traces?: FaroTrace;
}

interface FaroException {
    type?: string;
    value?: string;
    stacktrace?: {
        frames: Array<FaroStackFrame>;
    };
    timestamp: string;
    trace?: { trace_id: string; span_id: string };
}

interface FaroStackFrame {
    function?: string;
    module?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
}

interface FaroInstrumentationLibrary {
    name: string;
    version: string;
}

interface FaroSpans {
    scope: FaroInstrumentationLibrary;
    spans: Array<Span>;
}

interface FaroMeasurement {
    type: string;
    values: { [key: string]: string | number };
}

interface FaroTrace {
    resourceSpans: Array<{
        resource: Resource;
        scopeSpans: Array<FaroSpans>;
    }>;
}

interface FaroEvent {
    name: string;
    domain?: string;
    attributes?: { [key: string]: string };
    timestamp?: string;
    trace?: { trace_id: string; span_id: string };
}

interface FaroLog {
    message?: string;
    level?: 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';
    context?: { [key: string]: string };
    timestamp: string | number;
    trace?: { trace_id: string; span_id: string };
}

function makeScope(scope: InstrumentationScope) {
    return typeof scope === 'string'
        ? { name: scope, version: '1.0.0' }
        : { name: scope.name, version: scope.version || '1.0.0' };
}
