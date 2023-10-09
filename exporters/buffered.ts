import type { ExportFunction, ExportItem } from '../configure.js';

/**
 * Options for the buffered exporter
 */
export interface BufferedExportOptions {
    /**
     * Maximum number of items to send in a single batch.
     * Default 35
     */
    maxBatchSize?: number;
}

/**
 * The batching exporter collects items together for a period of time before passing them on.
 * This allows more messages to be passed to the backend logger at once, which is hopefully more efficent.
 *
 * @param exporter Inner exporter to pass the messages on to
 * @param options Configuration
 * @returns The configured exporter function
 */
export function bufferedExporter(exporter: ExportFunction, options?: BufferedExportOptions) {
    const pending: Array<ExportItem> = [];
    const obj = {
        exporter: bufferedExporter,
        send,
        used: false,
    };
    async function bufferedExporter(...events: Array<ExportItem>) {
        obj.used = true;
        pending.push(...events);
        if (pending.length > (options?.maxBatchSize ?? 35)) {
            return await send();
        }
    }
    async function send() {
        if (!obj.used) return;
        while (pending.length) {
            const batch = pending.splice(0, options?.maxBatchSize ?? 35);
            await exporter(...batch);
        }
    }
    return obj;
}
