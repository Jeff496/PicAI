/**
 * OpenTelemetry tracing for the chat handler Lambda.
 *
 * Uses SimpleSpanProcessor (not Batch) because Lambda can freeze
 * before a batch processor has a chance to export.
 *
 * If OTEL_EXPORTER_OTLP_ENDPOINT is not set, tracing is a no-op:
 * spans are created but never exported.
 */
import { trace, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const provider = new NodeTracerProvider({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'picai-chat-handler',
  }),
});

if (endpoint) {
  const exporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  });
  provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
}

provider.register();

export const tracer: Tracer = trace.getTracer('picai-chat-handler');

/**
 * Flush all pending spans. Call in Lambda handler's finally block
 * to ensure spans are exported before the runtime freezes.
 */
export async function forceFlush(): Promise<void> {
  if (endpoint) {
    await provider.forceFlush();
  }
}
