import { tracer } from 'koll/index.js';
import { pausableExporter } from 'koll/exporters/pausable.js';
import { batchingExporter } from 'koll/exporters/batching.js';
import { faroExporter } from 'koll/exporters/faro.js';
import { instrumentResourceTiming } from 'koll/instrument/resource-timing.js';
import { instrumentUnhandledErrors } from 'koll/instrument/unhandled-errors.js';
import { instrumentWebVitals } from 'koll/instrument/web-vitals.js';

const faro = faroExporter({
    destination: '/collect',
    meta: () => ({
        app: {
            name: 'web',
            version: '0.0.1',
        },
    }),
});

const batching = batchingExporter(faro);

const pausable = pausableExporter(batching);

instrumentResourceTiming(pausable.exporter);
instrumentUnhandledErrors(pausable.exporter);
instrumentWebVitals(pausable.exporter);

tracer(pausable.exporter).run('test', async (span) => {
    span.name = 'test';
});
