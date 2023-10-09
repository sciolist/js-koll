import type { ExportFunction, ExportItem } from '../configure.js';

/**
 * Options for the pausable exporter
 */
export interface PausableExporterOptions {
    /**
     * If true, the exporter will start in the paused state.
     */
    startPaused?: boolean;
    /**
     * How many items to allow in the queue while paused before old items start getting dropped.
     */
    maxQueueSize?: number;
}

/**
 * The pausable exporter can be turned on and off as needed, items will be placed on a queue while paused.
 *
 * @param exporter Inner function that items get passed on to
 * @param options Configuration
 * @returns An object with the exporter function and a toggle function to enable/disable the exporter
 */
export function pausableExporter(exporter: ExportFunction, options?: PausableExporterOptions) {
    let paused = options?.startPaused === true;
    const pending: Array<ExportItem> = [];
    function pausableExporter(...events: Array<ExportItem>) {
        if (paused) {
            pending.push(...events);
            if (pending.length > (options?.maxQueueSize ?? 100000)) {
                pending.splice(0, pending.length - (options?.maxQueueSize ?? 100000));
            }
        } else {
            exporter(...events);
        }
    }
    function toggle(on?: boolean) {
        paused = on ?? !paused;
        if (!paused && pending.length) {
            const copy = Array.from(pending);
            pending.length = 0;
            exporter(...copy);
        }
        return paused;
    }
    return {
        exporter: pausableExporter,
        toggle,
    };
}
