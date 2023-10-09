import type { InstrumentationScope, Span } from '../protocol.js';
import { type ExportFunction } from '../configure.js';
import { makeSpan } from '../context.js';
import { now } from '../utils/data.js';

const scope: InstrumentationScope = {
    name: 'koll/resource-timing',
    version: '0.0.1',
};

function navtime(value: number) {
    return BigInt(Math.floor(value * 1000000));
}

const events = [
    'domainLookupStart',
    'connectStart',
    'requestStart',
    'responseStart',
    'responseEnd',
    'domInteractive',
    'domContentLoadedEventStart',
];

/**
 * Create and report a trace from a segment of loading time.
 *
 * @param exporter Exporter to send the trace to
 * @param name Name of the trace
 * @param startPerfTime High res timer time to read from (use `performance.now()` to get a timestamp.)
 * @param endPerfTime High res timer time to read to (use `performance.now()` to get a timestamp.)
 */
export function reportResourceTimingSegment(
    exporter: ExportFunction,
    name: string,
    startPerfTime: number,
    endPerfTime: number,
) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const entries = performance.getEntriesByType('resource');
    if (!navigation || entries.length === 0) return;
    const start = BigInt(now()) - navtime(startPerfTime);

    const sp = makeSpan(null);
    sp.name = name;
    sp.startTimeUnixNano = start.toString();
    sp.endTimeUnixNano = (start + navtime(endPerfTime)).toString();

    addTimingEvents(sp, navigation, events);
    exporter({ scope, span: sp });

    for (const entry of entries) {
        if (entry.startTime < startPerfTime) continue;
        if (entry.startTime > endPerfTime) break;
        const entryStart = navtime(entry.startTime);

        const entrySpan = makeSpan(sp, {
            name: entry.name,
            startTimeUnixNano: String(start + entryStart),
            endTimeUnixNano: String(start + entryStart + navtime(entry.duration)),
        });

        addTimingEvents(entrySpan, entry, events);
        exporter({ scope, span: entrySpan });
    }

    function addTimingEvents(span: Span, entry: PerformanceEntry, events: Array<string>) {
        for (const event of events) {
            if (!entry[event]) continue;
            span.events.push({
                timeUnixNano: String(start + navtime(entry[event])),
                name: event,
            });
        }
        const attrib = span.attributes;
        attrib.push({
            key: 'size',
            value: { intValue: (entry as any).encodedBodySize },
        });
        attrib.push({
            key: 'type',
            value: { stringValue: entry.entryType },
        });
    }
}

/**
 * Report the dom tree with resource timing up until the load event
 * 
 * @param exporter Exporter to send the instrumentation results to
 */
export function instrumentResourceTiming(exporter: ExportFunction) {
    function report() {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (!navigation) return;
        const start = navigation.startTime;
        const end = navigation.loadEventStart;
        reportResourceTimingSegment(exporter, `load ${navigation.name}`, start, end);
    }

    if (document.readyState === 'complete') {
        report();
    } else {
        window.addEventListener('load', report);
    }
}
