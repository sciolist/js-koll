# Koll

This is a very basic logging library mainly for communicating with grafana's faro backend.

It massively cuts back on functionality compared to opentelemetry + faro-web-sdk, and you should definitely just use those.  
This is just the bare minimum that was enough for me.

## Installation

`npm install koll`

## Usage

To get started you need to set up an exporter, there is one included for communicating with faro, and a couple of utility exporters.

Here's an example:

```js
import { lightBrowserDetect, measurement } from "koll"
import { faroExporter } from "koll/exporters/faro"
import { batchingExporter } from "koll/exporters/batching"

// the faroexporter attempts to mimic grafana faro's web-sdk.
const faro = faroExporter({
    // destination url where any messages will be sent
    destination: 'http://localhost:12345/collect',
    // the meta object describes the application sending the messages
    meta: () => ({
        // the 'app' is what will show up when looking for messages in loki / tempo
        app: {
            name: 'web',
            version: '0.0.1',
        },
        // you can also pass along routing information
        page: {
            url: location.href,
        },
        // you can add some browser info with this function, but if you really care
        // about browser stats you should use a real useragent parser.
        // or try to convince grafana to do it in the agent. :)
        browser: lightBrowserDetect()
    })
});

// it's a good idea to batch up the messages before sending them to a collector
// otherwise you get a whole lot of ongoing requests.
const batching = batchingExporter(faro, {
    // interval: 1000;         // how often to trigger sends
    // batchingInterval: 1000; // if a send is triggered, and there are more items left to send, this lets you use a shorter interval
    // maxBatchSize: 35;       // how many items to batch. you can max send 65kb per batch, otherwise sendbeacon will fail. so be careful.
    // maxQueueSize: 100000;   // if we get more messages than this in the queue we'll just start dropping old messages.
});

// an exporter is just a function that takes takes some items and processes them.
// you can add exporters to do things like add context to log items, set a sample rate, or anything really.
// it can be async or not.
const myExporter = async (...messages: ExportItem[]) => await batching(...messages);
```

When you have an exporter set up you're ready to send messages.

There are a few default instrumentations that can be enabled, these are just functions that will call the global exporter with logs and measurements. Let's look at those first:

```js
import { instrumentResourceTiming } from "koll/instrument/resource-timing"
import { instrumentWebVitals } from "koll/instrument/web-vitals"
import { instrumentUnhandledErrors } from "koll/instrument/unhandled-errors"

// the resource timing instrumentation sends a timeline of resources that were loaded in from when the page started up until the window load event.
// this will give a nice timeline view in tempo.
instrumentResourceTiming(myExporter);

// web vitals is a cutdown version of the google web-vitals library reported as measurements to faro.
// it will track domload time, content layout shift, largest contentful paint and first contentful paint.
instrumentWebVitals(myExporter);

// the error instrumentation sends any errors to faro. it does the bare minimum needed to report errors correctly.
// if you call the return value the instrumenter will be shut down if needed. after shutting down instrumentErrors needs to be called again to re-enable it.
const stop = instrumentUnhandledErrors(myExporter, {
    // ignore: err => false   // you can pass in an ignore function to determine if an error should not be sent.
});
```

On top of that you can of course create your own traces and messages:

```js
import {tracer} from "koll";

// the tracer function creates a Tracer object for carrying a parent context around.
// that can be helpful when you want to create nested traces.
const trace = tracer(myExporter, request.headers['traceparent']);

// run will execute an async function with a 'span' as an argument.
// that span will get timestamps based on when the function starts and stops.
// after completion it will send this data to the exporter.
const result = await trace.run('some-scope-name', async (span) => {
    // each span should at least have a name for context.
    span.name = 'getting some things';
    
    // you can also add attributes to it
    span.attributes.push({
        key: 'http.response_status',
        value: { intValue: 200 }
    });

    // or cancel it to prevent the span and any children of it from getting logged.
    span.cancel();

    // the span is also a Tracer object, so you can pass it around to let other functions
    // create logs or child spans referencing it.
    const result = await span.run('some-other-scope', (childSpan) => {
        // and finally there's a function to create a traceparent context that can be passed
        // along to other services.
        return await fetch('/', { headers: { traceparent: childSpan.traceparent() }});
    )});

    // whatever value you return will be returned from `trace.run`
    return result;
});

// you can also create measurements, which are just log messages.
trace.measurement('my-scope', 'http.response_time', 'ms', 200);

// and log messages. the second value is an opentelemetry severity.
//     0 = unspecified - do not use
//  1- 4 = trace
//  5- 8 = debug
//  9-12 = info
// 13-16 = warn
// 17-20 = error
// 21-24 = fatal
trace.log('my-scope', 20, 'error log message');

// there is also an exception function to log an error message.
trace.exception('my-scope', new Error('error message'));

// you can also create a span without the async function, which is useful if you
// want to describe events that have already happened and don't need to care about timing.
trace.span('my-scope', {
    name: 'my span',
    startTimeUnixNano: millitime(Date.now() - 10000),
    endTimeUnixNano: millitime(Date.now()),
});
```

## Miscellaneous

There are a few little extras that can be useful.

### web vitals

The web vitals instrumenter logs a few core web vitals, LCP, CLS, TTFB..

```js
import { instrumentWebVitals } from "koll/instrument/web-vitals"

instrumentWebVitals(myExporter);
```

### reporting navigation resource timing segments

The dom load performance instrumenter can be used for things like instrumenting loads during routing.

```js
import {
    instrumentResourceTiming,
    reportResourceTimingSegment
} from "koll/instrument/resource-timing"

// you can instrument the entire documents loaded resources in one go
instrumentResourceTiming(myExporter);

// or report whatever segments you wants
const path = '/';
const start = performance.now();
await doRoutingStuff(path);
const end = performance.now();

reportResourceTimingSegment(`loaded ${path}`, start, end);
```

### unhandled errors

The unhandled errors instrumentation does about what you'd expect.

It listens to error or promise rejection messages and logs them to an exporter.

```js
import { instrumentUnhandledErrors } from "koll/instrument/unhandled-errors"

const stop = instrumentUnhandledErrors(myExporter, {
    // you can optionally ignore some errors
    ignore: err => false
});

// and if you get tired of logging the errors, you can stop!
stop();
```


## Size

The size of the library will vary a bit based on your usage, there are a couple of files in examples that configure koll differently.

In `v0.1.5`:  
`bundle-minimal-test.js is 5.7kb, 2.5kb gzipped.`  
`bundle-large-test.js   is 8.9kb, 3.6kb gzipped.`  

