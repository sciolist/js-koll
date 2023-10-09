// based on https://github.com/open-telemetry/opentelemetry-proto/tree/main/opentelemetry/proto

/**
 * AnyValue is used to represent any type of attribute value. AnyValue may contain a
 * primitive value such as a string or integer or it may contain an arbitrary nested
 * object containing arrays, key-value lists and primitives.
 *
 * It is valid for all values to be unspecified in which case this AnyValue is considered to be "empty".
 */
export type AnyValue = {
    stringValue?: string;
    boolValue?: boolean;
    intValue?: string | number;
    doubleValue?: string | number;
    arrayValue?: Array<AnyValue>;
    kvlistValue?: Array<KeyValue>;
    bytesValue?: string;
};

/**
 * KeyValue is a key-value pair that is used to store attributes.
 */
export interface KeyValue {
    key: string;
    value: AnyValue;
}

/**
 * InstrumentationScope is a message representing the instrumentation scope information
 * such as the fully qualified name and version.
 */
export type InstrumentationScope =
    | string
    | {
          /** An empty instrumentation scope name means the name is unknown. */
          name: string;
          version?: string;
          attributes?: Array<KeyValue>;
          droppedAttributesCount?: number;
      };

/** Resource information. */
export interface Resource {
    /**
     * Set of attributes that describe the resource.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes: Array<KeyValue>;
    /**
     * dropped_attributes_count is the number of dropped attributes. If the value is 0, then
     * no attributes were dropped.
     */
    droppedAttributesCount?: number;
}

/**
 * MetricsData represents the metrics data that can be stored
 */
export interface MetricsData {
    /** An array of ResourceMetrics. */
    resourceMetrics: Array<ResourceMetrics>;
}

/** A collection of ScopeMetrics from a Resource. */
export interface ResourceMetrics {
    /**
     * The resource for the metrics in this message.
     * If this field is not set then no resource info is known.
     */
    resource: Resource;
    /** A list of metrics that originate from a resource. */
    scopeMetrics: Array<ScopeMetrics>;
    /**
     * This schema_url applies to the data in the "resource" field. It does not apply
     * to the data in the "scope_metrics" field which have their own schema_url field.
     */
    schemaUrl?: string;
}

/** A collection of Metrics produced by an Scope. */
export interface ScopeMetrics {
    /**
     * The instrumentation scope information for the metrics in this message.
     * Semantically when InstrumentationScope isn't set, it is equivalent with
     * an empty instrumentation scope name (unknown).
     */
    scope: InstrumentationScope;
    /** A list of metrics that originate from an instrumentation library. */
    metrics: Array<Metric>;
    /** This schema_url applies to all metrics in the "metrics" field. */
    schemaUrl?: string;
}

/**
 * Defines a Metric which has one or more timeseries. For more details, see:
 *
 * https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/data-model.md
 */
export interface Metric {
    /** name of the metric, including its DNS name prefix. It must be unique. */
    name: string;
    /** description of the metric, which can be used in documentation. */
    description?: string;
    /**
     * unit in which the metric value is reported. Follows the format
     * described by http://unitsofmeasure.org/ucum.html.
     */
    unit?: string;
    /**
     * Data determines the aggregation type (if any) of the metric, what is the
     * reported value type for the data points, as well as the relationship to
     * the time interval over which they are reported.
     */
    data: {
        gauge?: GaugeMetricData;
        sum?: SumMetricData;
        histogram?: HistogramMetricData;
        exponentialHistogram?: ExponentialHistogramMetricData;
        summary?: SummaryMetricData;
    };
}

/**
 * Gauge represents the type of a scalar metric that always exports the
 * "current value" for every data point. It should be used for an "unknown"
 * aggregation.
 *
 * A Gauge does not support different aggregation temporalities. Given the
 * aggregation is unknown, points cannot be combined using the same
 * aggregation, regardless of aggregation temporalities. Therefore,
 * AggregationTemporality is not included. Consequently, this also mea
 */
export interface GaugeMetricData {
    dataPoints: Array<NumberDataPoint>;
}

/**
 * Sum represents the type of a scalar metric that is calculated as a sum of all
 * reported measurements over a time interval.
 */
export interface SumMetricData {
    dataPoints: Array<NumberDataPoint>;
    /**
     * aggregation_temporality describes if the aggregator reports delta changes
     * since last report time, or cumulative changes since a fixed start time.
     */
    aggregationTemporality?: number;
    /** If "true" means that the sum is monotonic. */
    isMonotonic?: boolean;
}

/**
 * Histogram represents the type of a metric that is calculated by aggregating
 * as a Histogram of all reported measurements over a time interval.
 */
export interface HistogramMetricData {
    dataPoints: Array<HistogramDataPoint>;
    /**
     * aggregation_temporality describes if the aggregator reports delta changes
     * since last report time, or cumulative changes since a fixed start time.
     */
    aggregationTemporality?: number;
}

export interface ExponentialHistogramMetricData {
    dataPoints: Array<ExponentialHistogramDataPoint>;
    /**
     * aggregation_temporality describes if the aggregator reports delta changes
     * since last report time, or cumulative changes since a fixed start time.
     */
    aggregationTemporality?: number;
}

export interface SummaryMetricData {
    dataPoints: Array<SummaryDataPoint>;
}

/**
 * NumberDataPoint is a single data point in a timeseries that describes the
 * time-varying scalar value of a metric.
 */
export interface NumberDataPoint {
    /**
     * The set of key/value pairs that uniquely identify the timeseries from
     * where this point belongs. The list may be empty (may contain 0 elements).
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes?: Array<KeyValue>;
    /** StartTimeUnixNano is optional but strongly encouraged. */
    startTimeUnixNano?: string;
    /** TimeUnixNano is required */
    timeUnixNano: string;
    /**
     * The value itself.  A point is considered invalid when one of the recognized
     * value fields is not present inside this oneof.
     */
    value: {
        asDouble?: string | number;
        asInt?: string | number;
    };
    /**
     * List of exemplars collected from
     * measurements that were used to form the data point
     */
    exemplars?: Array<Exemplar>;
    /**
     * Flags that apply to this specific data point.
     */
    flags?: number;
}

/**
 * HistogramDataPoint is a single data point in a timeseries that describes the
 * time-varying values of a Histogram. A Histogram contains summary statistics
 * for a population of values, it may optionally contain the distribution of
 * those values across a set of buckets.
 *
 * If the histogram contains the distribution of values, then both
 * "explicit_bounds" and "bucket counts" fields must be defined.
 * If the histogram does not contain the distribution of values, then both
 * "explicit_bounds" and "bucket_counts" must be omitted and only "count" and
 * "sum" are known.
 */
export interface HistogramDataPoint {
    /**
     * Set of attributes that describe the data point.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes: Array<KeyValue>;
    /** StartTimeUnixNano is optional but strongly encouraged. */
    startTimeUnixNano?: string;
    /** TimeUnixNano is required */
    timeUnixNano: string;
    /**
     * count is the number of values in the population. Must be non-negative. This
     * value must be equal to the sum of the "count" fields in buckets if a
     * histogram is provided.
     */
    count: number | string;
    /**
     * sum of the values in the population. If count is zero then this field
     * must be zero.
     *
     * Note: Sum should only be filled out when measuring non-negative discrete
     * events, and is assumed to be monotonic over the values of these events.
     * Negative events *can* be recorded, but sum should not be filled out when
     * doing so.  This is specifically to enforce compatibility w/ OpenMetrics,
     * see: https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md#histogram
     */
    sum?: number | string;
    /**
     * bucket_counts is an optional field contains the count values of histogram
     * for each bucket.
     *
     * The sum of the bucket_counts must equal the value in the count field.
     *
     * The number of elements in bucket_counts array must be by one greater than
     * the number of elements in explicit_bounds array.
     */
    bucket_counts: Array<number | string>;
    /**
     * explicit_bounds specifies buckets with explicitly defined bounds for values.
     *
     * The boundaries for bucket at index i are:
     *
     * (-infinity, explicit_bounds[i]] for i == 0
     * (explicit_bounds[i-1], explicit_bounds[i]] for 0 < i < size(explicit_bounds)
     * (explicit_bounds[i-1], +infinity) for i == size(explicit_bounds)
     *
     * The values in the explicit_bounds array must be strictly increasing.
     *
     * Histogram buckets are inclusive of their upper boundary, except the last
     * bucket where the boundary is at infinity. This format is intentionally
     * compatible with the OpenMetrics histogram definition.
     */
    explicit_bounds: Array<number>;
    /** List of exemplars collected from measurements that were used to form the data point */
    exemplars?: Array<Exemplar>;
    /** Flags that apply to this specific data point. */
    flags: number;
    /** min is the minimum value over (start_time, end_time]. */
    min?: number | string;
    /** max is the maximum value over (start_time, end_time]. */
    max?: number | string;
}

export interface ExponentialHistogramDataPoint {
    /**
     * Set of attributes that describe the data point.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes: Array<KeyValue>;
    /** StartTimeUnixNano is optional but strongly encouraged. */
    startTimeUnixNano?: string;
    /** TimeUnixNano is required */
    timeUnixNano: string;
    /**
     * count is the number of values in the population. Must be non-negative. This
     * value must be equal to the sum of the "count" fields in buckets if a
     * histogram is provided.
     */
    count: number | string;
    /**
     * sum of the values in the population. If count is zero then this field
     * must be zero.
     *
     * Note: Sum should only be filled out when measuring non-negative discrete
     * events, and is assumed to be monotonic over the values of these events.
     * Negative events *can* be recorded, but sum should not be filled out when
     * doing so.  This is specifically to enforce compatibility w/ OpenMetrics,
     * see: https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md#histogram
     */
    sum?: number | string;
    /**
     * scale describes the resolution of the histogram.  Boundaries are
     * located at powers of the base, where:
     *
     *   base = (2^(2^-scale))
     *
     * The histogram bucket identified by `index`, a signed integer,
     * contains values that are greater than (base^index) and
     * less than or equal to (base^(index+1)).
     *
     * The positive and negative ranges of the histogram are expressed
     * separately.  Negative values are mapped by their absolute value
     * into the negative range using the same scale as the positive range.
     *
     * scale is not restricted by the protocol, as the permissible
     * values depend on the range of the data.
     */
    scale: number | string;
    /**
     * zero_count is the count of values that are either exactly zero or
     * within the region considered zero by the instrumentation at the
     * tolerated degree of precision.  This bucket stores values that
     * cannot be expressed using the standard exponential formula as
     * well as values that have been rounded to zero.
     *
     * Implementations MAY consider the zero bucket to have probability
     * mass equal to (zero_count / count).
     */
    zero_count: number | string;
    /** positive carries the positive range of exponential bucket counts. */
    positive: Array<Buckets>;
    /** negative carries the negative range of exponential bucket counts. */
    negative: Array<Buckets>;
    /** Flags that apply to this specific data point. */
    flags: number;
    /** List of exemplars collected from measurements that were used to form the data point */
    exemplars?: Array<Exemplar>;
    /** min is the minimum value over (start_time, end_time]. */
    min?: number | string;
    /** max is the maximum value over (start_time, end_time]. */
    max?: number | string;
}

/**
 * Buckets are a set of bucket counts, encoded in a contiguous array
 * of counts.
 */
export interface Buckets {
    /**
     * Offset is the bucket index of the first entry in the bucket_counts array.
     */
    offset: number | string;
    /**
     * Count is an array of counts, where count[i] carries the count
     * of the bucket at index (offset+i).  count[i] is the count of
     * values greater than base^(offset+i) and less or equal to than
     * base^(offset+i+1).
     *
     * Note: By contrast, the explicit HistogramDataPoint uses
     * fixed64.  This field is expected to have many buckets,
     * especially zeros, so uint64 has been selected to ensure
     * varint encoding.
     */
    bucket_counts: Array<number | string>;
}

/**
 * SummaryDataPoint is a single data point in a timeseries that describes the
 * time-varying values of a Summary metric.
 */
export interface SummaryDataPoint {
    /**
     * Set of attributes that describe the data point.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes: Array<KeyValue>;
    /** StartTimeUnixNano is optional but strongly encouraged. */
    startTimeUnixNano?: string;
    /** TimeUnixNano is required */
    timeUnixNano: string;
    /** count is the number of values in the population. Must be non-negative. */
    count: number | string;
    /**
     * sum of the values in the population. If count is zero then this field
     * must be zero.
     *
     * Note: Sum should only be filled out when measuring non-negative discrete
     * events, and is assumed to be monotonic over the values of these events.
     * Negative events *can* be recorded, but sum should not be filled out when
     * doing so.  This is specifically to enforce compatibility w/ OpenMetrics,
     * see: https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md#summary
     */
    sum: number | string;
    /**
     * list of values at different quantiles of the distribution calculated
     * from the current snapshot. The quantiles must be strictly increasing.
     */
    quantileValues: Array<ValueAtQuantile>;
    /** Flags that apply to this specific data point. */
    flags: number;
}

/**
 * Represents the value at a given quantile of a distribution.
 *
 * To record Min and Max values following conventions are used:
 * - The 1.0 quantile is equivalent to the maximum value observed.
 * - The 0.0 quantile is equivalent to the minimum value observed.
 *
 * See the following issue for more context:
 * https://github.com/open-telemetry/opentelemetry-proto/issues/125
 */
export interface ValueAtQuantile {
    /** The quantile of a distribution. Must be in the interval [0.0, 1.0]. */
    quantile: number | string;
    /**
     * The value at the given quantile of a distribution.
     *
     * Quantile values must NOT be negative.
     */
    value: number | string;
}

/**
 * A representation of an exemplar, which is a sample input measurement.
 * Exemplars also hold information about the environment when the measurement
 * was recorded, for example the span and trace ID of the active span when the
 * exemplar was recorded.
 */
export interface Exemplar {
    /**
     * Set of attributes that describe the exemplar.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    filteredAttributes: Array<KeyValue>;
    /** TimeUnixNano is required */
    timeUnixNano: string;
    /**
     * The value of the measurement that was recorded. An exemplar is
     * considered invalid when one of the recognized value fields is not present
     * inside this oneof.
     */
    value: {
        asDouble: number | string;
        asInt: number | string;
    };
    /**
     * Span ID of the exemplar trace.
     * span_id may be missing if the measurement is not recorded inside a trace
     * or if the trace is not sampled.
     */
    spanId?: string;
    /* Trace ID of the exemplar trace.
     * trace_id may be missing if the measurement is not recorded inside a trace
     * or if the trace is not sampled.
     */
    traceId?: string;
}

/** LogsData represents the logs data that can be stored in a persistent storage. */
export interface LogsData {
    /**
     * An array of ResourceLogs.
     * For data coming from a single resource this array will typically contain
     * one element. Intermediary nodes that receive data from multiple origins
     * typically batch the data before forwarding further and in that case this
     * array will contain multiple elements.
     */
    resourceLogs: Array<ResourceLogs>;
}

/** A collection of ScopeLogs from a Resource. */
export interface ResourceLogs {
    /**
     * The resource for the logs in this message.
     * If this field is not set then resource info is unknown.
     */
    resource: Resource;
    /** A list of ScopeLogs that originate from a resource. */
    scopeLogs: Array<ScopeLogs>;
    /**
     * This schema_url applies to the data in the "resource" field. It does not apply
     * to the data in the "scope_logs" field which have their own schema_url field.
     */
    schemaUrl?: string;
}

/** A collection of Logs produced by a Scope. */
export interface ScopeLogs {
    /**
     * The instrumentation scope information for the logs in this message.
     * Semantically when InstrumentationScope isn't set, it is equivalent with
     * an empty instrumentation scope name (unknown).
     */
    scope: InstrumentationScope;
    /** A list of log records. */
    logRecords: Array<LogRecord>;
    /** This schema_url applies to all logs in the "logs" field. */
    schemaUrl?: string;
}

/**
 * A log record according to OpenTelemetry Log Data Model:
 * https://github.com/open-telemetry/oteps/blob/main/text/logs/0097-log-data-model.md
 */
export interface LogRecord {
    /**
     * time_unix_nano is the time when the event occurred.
     * Value is UNIX Epoch time in nanoseconds since 00:00:00 UTC on 1 January 1970.
     * Value of 0 indicates unknown or missing timestamp.
     */
    timeUnixNano: string;
    /**
     * Time when the event was observed by the collection system.
     * For events that originate in OpenTelemetry (e.g. using OpenTelemetry Logging SDK)
     * this timestamp is typically set at the generation time and is equal to Timestamp.
     * For events originating externally and collected by OpenTelemetry (e.g. using
     * Collector) this is the time when OpenTelemetry's code observed the event measured
     * by the clock of the OpenTelemetry code. This field MUST be set once the event is
     * observed by OpenTelemetry.
     *
     * For converting OpenTelemetry log data to formats that support only one timestamp or
     * when receiving OpenTelemetry log data by recipients that support only one timestamp
     * internally the following logic is recommended:
     *   - Use time_unix_nano if it is present, otherwise use observed_time_unix_nano.
     *
     * Value is UNIX Epoch time in nanoseconds since 00:00:00 UTC on 1 January 1970.
     * Value of 0 indicates unknown or missing timestamp.
     */
    observedTimeUnixNano?: string;
    /**
     * Numerical value of the severity, normalized to values described in Log Data Model.
     */
    severityNumber?: number;
    /**
     * The severity text (also known as log level). The original string representation as
     * it is known at the source.
     */
    severityText?: string;
    /**
     * A value containing the body of the log record. Can be for example a human-readable
     * string message (including multi-line) describing the event in a free form or it can
     * be a structured data composed of arrays and maps of other values.
     */
    body?: AnyValue;
    /**
     * Set of attributes that describe the log record.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes?: Array<KeyValue>;
    /**
     * dropped_attributes_count is the number of dropped attributes. If the value is 0, then
     * no attributes were dropped.
     */
    droppedAttributesCount?: number;
    /**
     * Flags, a bit field. 8 least significant bits are the trace flags as
     * defined in W3C Trace Context specification. 24 most significant bits are reserved
     * and must be set to 0. Readers must not assume that 24 most significant bits
     * will be zero and must correctly mask the bits when reading 8-bit trace flag (use
     * flags & TRACE_FLAGS_MASK).
     */
    flags?: number;
    /**
     * A unique identifier for a trace. All logs from the same trace share
     * the same `trace_id`. The ID is a 16-byte array. An ID with all zeroes
     * is considered invalid. Can be set for logs that are part of request processing
     * and have an assigned trace id.
     */
    traceId?: string;
    /**
     * A unique identifier for a span within a trace, assigned when the span
     * is created. The ID is an 8-byte array. An ID with all zeroes is considered
     * invalid. Can be set for logs that are part of a particular processing span.
     * If span_id is present trace_id SHOULD be also present.
     */
    spanId?: string;
}

/**
 * TracesData represents the traces data that can be stored in a persistent storage,
 * OR can be embedded by other protocols that transfer OTLP traces data but do
 * not implement the OTLP protocol.
 */
export interface TracesData {
    /**
     * An array of ResourceSpans.
     * For data coming from a single resource this array will typically contain
     * one element. Intermediary nodes that receive data from multiple origins
     * typically batch the data before forwarding further and in that case this
     * array will contain multiple elements.
     */
    resourceSpans: Array<ResourceSpans>;
}

/** A collection of ScopeSpans from a Resource. */
export interface ResourceSpans {
    /**
     * The resource for the spans in this message.
     * If this field is not set then no resource info is known.
     */
    resource: Resource;
    /** A list of ScopeSpans that originate from a resource. */
    scopeSpans: Array<ScopeSpans>;
    /**
     * This schema_url applies to the data in the "resource" field. It does not apply
     * to the data in the "scope_spans" field which have their own schema_url field.
     */
    schemaUrl?: string;
}

/** A collection of Spans produced by an InstrumentationScope. */
export interface ScopeSpans {
    /**
     * The instrumentation scope information for the spans in this message.
     * Semantically when InstrumentationScope isn't set, it is equivalent with
     * an empty instrumentation scope name (unknown).
     */
    scope: InstrumentationScope;
    /** A list of Spans that originate from an instrumentation scope. */
    spans: Array<Span>;
    /** This schema_url applies to all spans and span events in the "spans" field. */
    schemaUrl?: string;
}

export interface Span {
    /**
     * A unique identifier for a trace. All spans from the same trace share
     * the same `trace_id`. The ID is a 16-byte array. An ID with all zeroes
     * is considered invalid.
     *
     * This field is semantically required. Receiver should generate new
     * random trace_id if empty or invalid trace_id was received.
     *
     * This field is required.
     */
    traceId: string;
    /**
     * A unique identifier for a span within a trace, assigned when the span
     * is created. The ID is an 8-byte array. An ID with all zeroes is considered
     * invalid.
     *
     * This field is semantically required. Receiver should generate new
     * random span_id if empty or invalid span_id was received.
     *
     * This field is required.
     */
    spanId: string;
    /**
     * trace_state conveys information about request position in multiple distributed tracing graphs.
     * It is a trace_state in w3c-trace-context format: https://www.w3.org/TR/trace-context/#tracestate-header
     * See also https://github.com/w3c/distributed-tracing for more details about this field.
     */
    traceState?: string;
    /**
     * The `span_id` of this span's parent span. If this is a root span, then this
     * field must be empty. The ID is an 8-byte array.
     */
    parentSpanId?: string;
    /**
     * A description of the span's operation.
     *
     * For example, the name can be a qualified method name or a file name
     * and a line number where the operation is called. A best practice is to use
     * the same display name at the same call point in an application.
     * This makes it easier to correlate spans in different traces.
     *
     * This field is semantically required to be set to non-empty string.
     * Empty value is equivalent to an unknown span name.
     *
     * This field is required.
     */
    name: string;
    /**
     * Distinguishes between spans generated in a particular context. For example,
     * two spans with the same name may be distinguished using `CLIENT` (caller)
     * and `SERVER` (callee) to identify queueing latency associated with the span.
     */
    kind?: SpanKind;
    /**
     * start_time_unix_nano is the start time of the span. On the client side, this is the time
     * kept by the local machine where the span execution starts. On the server side, this
     * is the time when the server's application handler starts running.
     * Value is UNIX Epoch time in nanoseconds since 00:00:00 UTC on 1 January 1970.
     *
     * This field is semantically required and it is expected that end_time >= start_time.
     */
    startTimeUnixNano?: string;
    /**
     * end_time_unix_nano is the end time of the span. On the client side, this is the time
     * kept by the local machine where the span execution ends. On the server side, this
     * is the time when the server application handler stops running.
     * Value is UNIX Epoch time in nanoseconds since 00:00:00 UTC on 1 January 1970.
     *
     * This field is semantically required and it is expected that end_time >= start_time.
     */
    endTimeUnixNano?: string;
    /**
     * attributes is a collection of key/value pairs. Note, global attributes
     * like server name can be set using the resource API. Examples of attributes:
     *
     *     "/http/user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36"
     *     "/http/server_latency": 300
     *     "abc.com/myattribute": true
     *     "abc.com/score": 10.239
     *
     * The OpenTelemetry API specification further restricts the allowed value types:
     * https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/common/README.md#attribute
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes: Array<KeyValue>;
    /**
     * dropped_attributes_count is the number of attributes that were discarded. Attributes
     * can be discarded because their keys are too long or because there are too many
     * attributes. If this value is 0, then no attributes were dropped.
     */
    droppedAttributesCount?: number;
    /** events is a collection of Event items. */
    events: Array<SpanEvent>;
    /**
     * dropped_events_count is the number of dropped events. If the value is 0, then no
     * events were dropped.
     */
    droppedEventsCount?: number;
    /**
     * links is a collection of Links, which are references from this span to a span
     * in the same or different trace.
     */
    links?: Array<SpanLink>;
    /**
     * dropped_links_count is the number of dropped links after the maximum size was
     * enforced. If this value is 0, then no links were dropped.
     */
    droppedLinksCount?: number;
    /**
     * An optional final status for this span. Semantically when Status isn't set, it means
     * span's status code is unset, i.e. assume STATUS_CODE_UNSET (code = 0).
     */
    status?: SpanStatus;

    sample?: boolean;
}

/**
 * Event is a time-stamped annotation of the span, consisting of user-supplied
 * text description and key-value pairs.
 */
export interface SpanEvent {
    /** time_unix_nano is the time the event occurred. */
    timeUnixNano: string;
    /**
     * name of the event.
     * This field is semantically required to be set to non-empty string.
     */
    name: string;
    /**
     * attributes is a collection of attribute key/value pairs on the event.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes?: Array<KeyValue>;
    /**
     * dropped_attributes_count is the number of dropped attributes. If the value is 0,
     * then no attributes were dropped.
     */
    droppedAttributesCount?: number;
}

/**
 * A pointer from the current span to another span in the same trace or in a
 * different trace. For example, this can be used in batching operations,
 * where a single batch handler processes multiple requests from different
 * traces or when the handler receives a request from a different project.
 */
export interface SpanLink {
    /**
     * A unique identifier of a trace that this linked span is part of. The ID is a
     * 16-byte array.
     */
    traceId: string;
    /** A unique identifier for the linked span. The ID is an 8-byte array. */
    spanId: string;
    /** The trace_state associated with the link. */
    traceState?: string;
    /**
     * attributes is a collection of attribute key/value pairs on the link.
     * Attribute keys MUST be unique (it is not allowed to have more than one
     * attribute with the same key).
     */
    attributes?: Array<KeyValue>;
    /**
     * dropped_attributes_count is the number of dropped attributes. If the value is 0,
     * then no attributes were dropped.
     */
    droppedAttributesCount?: number;
}

/**
 * The Status type defines a logical error model that is suitable for different
 * programming environments, including REST APIs and RPC APIs.
 */
export interface SpanStatus {
    /** A developer-facing human readable error message. */
    message: string;
    /** The status code. 1 for OK, 2 for Error. */
    code: number;
}

/**
 * Unspecified. Do NOT use as default.
 * Implementations MAY assume SpanKind to be INTERNAL when receiving UNSPECIFIED.
 */
export type SpanKindUnspecified = 0;
/**
 * Indicates that the span represents an internal operation within an application,
 * as opposed to an operation happening at the boundaries. Default value.
 */
export type SpanKindInternal = 1;
/**
 * Indicates that the span covers server-side handling of an RPC or other
 * remote network request.
 */
export type SpanKindServer = 2;
/** Indicates that the span describes a request to some remote service. */
export type SpanKindClient = 3;
/**
 * Indicates that the span describes a producer sending a message to a broker.
 * Unlike CLIENT and SERVER, there is often no direct critical path latency relationship
 * between producer and consumer spans. A PRODUCER span ends when the message was accepted
 * by the broker while the logical processing of the message might span a much longer time.
 */
export type SpanKindProducer = 4;
/**
 * Indicates that the span describes consumer receiving a message from a broker.
 * Like the PRODUCER kind, there is often no direct critical path latency relationship
 * between producer and consumer spans.
 */
export type SpanKindConsumer = 4;
/**
 * SpanKind is the type of span. Can be used to specify additional relationships between spans
 * in addition to a parent/child relationship.
 */
export type SpanKind = SpanKindUnspecified | SpanKindInternal | SpanKindServer | SpanKindClient | SpanKindProducer;

/**
 * Represents a parent trace span that can be used to correlate spans.
 */
export interface ParentSpanObject {
    /**
     * A unique identifier for a trace. All spans from the same trace share
     * the same `trace_id`. The ID is a 16-byte array. An ID with all zeroes
     * is considered invalid.
     *
     * This field is semantically required. Receiver should generate new
     * random trace_id if empty or invalid trace_id was received.
     *
     * This field is required.
     */
    traceId: string;
    /**
     * A unique identifier for a span within a trace, assigned when the span
     * is created. The ID is an 8-byte array. An ID with all zeroes is considered
     * invalid.
     *
     * This field is semantically required. Receiver should generate new
     * random span_id if empty or invalid span_id was received.
     *
     * This field is required.
     */
    spanId: string;
    /**
     * A true or false value indicating if this span is being sampled.
     */
    sample?: boolean;
}

export type ParentSpan = ParentSpanObject | string | null | undefined;
