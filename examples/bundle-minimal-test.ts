import { batchingExporter } from 'koll/exporters/batching.js';
import { faroExporter } from 'koll/exporters/faro.js';
import { tracer } from 'koll/context.js';

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

tracer(batching).run('test', async (span) => {
    span.name = 'test';
});
