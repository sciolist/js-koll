import type { InstrumentationScope } from '../protocol.js';
import { measurement } from '../context.js';
import type { ExportFunction } from 'koll.js';

const scope: InstrumentationScope = {
    name: 'koll/web-vitals',
    version: '0.0.1',
};

/**
 * Adds instrumentation for web vitals, like CLS, LCP..
 *
 * @returns true if the instrumentation was enabled
 */
export function instrumentWebVitals(exporter: ExportFunction) {
    const supported = new Set(PerformanceObserver.supportedEntryTypes);
    const navEvent = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navEvent) return false;
    const loading = document.readyState !== 'complete';
    const start = navEvent.connectStart;
    const hasCLS = supported.has('layout-shift');
    const hasLCP = supported.has('largest-contentful-paint');

    let cls = 0;
    const clsObserver = new PerformanceObserver((l) => {
        clsObserver.disconnect();
        const newCls = l.getEntries() as any[];
        cls = newCls[newCls.length - 1].value;
    });

    clsObserver.observe({
        buffered: true,
        type: 'layout-shift',
    });

    let lcp = 0;
    const lcpObserver = new PerformanceObserver((l) => {
        const newLcp = l.getEntries() as any[];
        lcp = newLcp[newLcp.length - 1].startTime - start;
    });

    lcpObserver.observe({
        buffered: true,
        type: 'largest-contentful-paint',
    });

    function handleLoad() {
        // give it a little more time, in case the load event triggers a new LCP
        setTimeout(() => {
            lcpObserver.disconnect();
            clsObserver.disconnect();
            if (hasCLS) {
                measurement(exporter, scope, 'cls', '%', cls);
            }
            if (hasLCP) {
                measurement(exporter, scope, 'lcp', 'ms', lcp);
            }
        }, 100);
        measurement(exporter, scope, 'load', 'ms', navEvent.loadEventStart - start);
    }

    if (loading) window.addEventListener('load', handleLoad);
    else handleLoad();

    if (supported.has('paint')) {
        const handleFCP = (l: PerformanceEntryList): boolean => {
            const fcp = l.filter((n) => n.name === 'first-contentful-paint')[0];
            if (!fcp) return false;
            measurement(exporter, scope, 'fcp', 'ms', fcp.startTime - start);
            return true;
        };

        const observer = new PerformanceObserver((l) => {
            if (handleFCP(l.getEntries())) {
                observer.disconnect();
            }
        });

        if (!handleFCP(performance.getEntriesByType('paint'))) {
            observer.observe({ buffered: true, type: 'paint' });
        }
    }

    measurement(exporter, scope, 'ttfb', 'ms', navEvent.responseStart);
    measurement(exporter, scope, 'size', 'b', navEvent.encodedBodySize);
    return true;
}
