import type { InstrumentationScope, LogRecord, Metric, Span } from './protocol.js';

/**
 * Description of an item that can be sent to the exporters
 */
export interface ExportItem {
    /** Which instrumentation scope the item belongs to */
    scope: InstrumentationScope;
    context?: any;
    span?: Span;
    log?: LogRecord;
    metric?: Metric;
}

/**
 * An export function takes a list of ExportItems and processes them.
 * 
 * It can optionally return a success indicator, in case the caller wants to retry.
 */
export type ExportFunction = (...items: ExportItem[]) => void | boolean | Promise<boolean | void>;
