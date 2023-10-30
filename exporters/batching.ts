import type { ExportFunction, ExportItem } from '../configure.js';

/**
 * Options for the batching exporter
 */
export interface BatchingExportOptions {
    /**
     * Interval in millisecond between sending batches.
     * Default 1000
     */
    interval?: number;
    /**
     * Interval in millisecond between sending a second batch, if there are still pending items after sending a batch.
     * Defaults to same as `interval`
     */
    batchingInterval?: number;
    /**
     * Maximum number of items to send in a single batch.
     * Default 35
     */
    maxBatchSize?: number;
    /**
     * Maximum items in the pending queue, if more items than this are in queue old messages will start getting dropped.
     * Default 100000
     */
    maxQueueSize?: number;
}

/**
 * The batching exporter collects items together for a period of time before passing them on.
 * This allows more messages to be passed to the backend logger at once, which is hopefully more efficent.
 *
 * @param exporter Inner exporter to pass the messages on to
 * @param options Configuration
 * @returns The configured exporter function
 */
export function batchingExporter(exporter: ExportFunction, options?: BatchingExportOptions) {
    let timer: any = null;
    const pending: Array<ExportItem> = [];
    function processBatch() {
        clearTimeout(timer);
        timer = null;
        const batch = pending.splice(0, options?.maxBatchSize ?? 35);
        if (pending.length) {
            timer = setTimeout(processBatch, options?.batchingInterval ?? options?.interval ?? 1000);
        }
        if (batch.length) {
            exporter(...batch);
        }
    }
    if (typeof window !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                processBatch();
            }
        });
        document.addEventListener('pagehide', () => {
            processBatch();
        });
    } else if (typeof process !== 'undefined' && process.on) {
        process.on('exit', processBatch);
    }
    return function batchingExporter(...events: Array<ExportItem>) {
        pending.push(...events);
        if (pending.length > (options?.maxQueueSize ?? 100000)) {
            pending.splice(0, pending.length - (options?.maxQueueSize ?? 1000));
        }
        if (null === timer) {
            timer = setTimeout(processBatch, options?.interval ?? 1000);
        }
    };
}
