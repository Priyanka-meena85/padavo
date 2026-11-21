// ==============================================================================
// PADAVO ENTERPRISE ERROR TELEMETRY & APM OBSERVABILITY
// Real-time error capture, crash diagnostic buffering, Sentry DSN forwarding & Audit logging
// ==============================================================================

const https = require('node:https');
const http = require('node:http');

class ErrorTelemetry {
  constructor() {
    this.errorBuffer = [];
    this.maxBufferSize = 100;
    this.sentryDsn = process.env.SENTRY_DSN || null;
    this.environment = process.env.NODE_ENV || 'production';
    this.db = null;
  }

  setDatabase(databaseInstance) {
    this.db = databaseInstance;
  }

  /**
   * Captures an exception with runtime context, records it in memory,
   * persists to DB audit_logs, and forwards to Sentry if configured.
   */
  captureError(err, req = null, extraContext = {}) {
    const timestamp = new Date().toISOString();
    const errorRecord = {
      id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: err?.name || 'Error',
      message: err?.message || String(err),
      stack: err?.stack || '',
      path: req ? (req.url || req.path) : (extraContext.path || null),
      method: req ? req.method : (extraContext.method || null),
      ip: req ? (req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1') : '127.0.0.1',
      exporter_id: extraContext.exporter_id || null,
      order_id: extraContext.order_id || null,
      environment: this.environment,
      timestamp
    };

    // Keep bounded in-memory buffer for instant diagnostic retrieval
    this.errorBuffer.unshift(errorRecord);
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer.pop();
    }

    // Persist to audit_logs if DB is available
    if (this.db) {
      try {
        const details = JSON.stringify({
          name: errorRecord.name,
          message: errorRecord.message,
          path: errorRecord.path,
          method: errorRecord.method,
          stack: errorRecord.stack ? errorRecord.stack.split('\n').slice(0, 4).join('\n') : ''
        });
        this.db.prepare(`
          INSERT INTO audit_logs (order_id, exporter_id, action, details, ip_address)
          VALUES (?, ?, 'SERVER_ERROR', ?, ?)
        `).run(
          errorRecord.order_id,
          errorRecord.exporter_id,
          details,
          errorRecord.ip
        );
      } catch (dbErr) {
        // Safe fallback - avoid recursive errors
        console.error('Notice: ErrorTelemetry DB write failed:', dbErr.message);
      }
    }

    // Optional remote Sentry dispatch if SENTRY_DSN is configured
    if (this.sentryDsn) {
      this.dispatchToSentry(errorRecord);
    }

    return errorRecord;
  }

  /**
   * Lightweight Sentry DSN HTTP POST (Zero npm dependency)
   */
  dispatchToSentry(record) {
    try {
      const url = new URL(this.sentryDsn);
      const projectId = url.pathname.replace('/', '');
      const key = url.username;
      const host = url.hostname;

      const payload = JSON.stringify({
        event_id: record.id.replace('err-', '').padEnd(32, '0').slice(0, 32),
        timestamp: record.timestamp,
        level: 'error',
        platform: 'node',
        server_name: 'padavo-core-engine',
        environment: this.environment,
        message: `${record.name}: ${record.message}`,
        extra: {
          path: record.path,
          method: record.method,
          stack: record.stack,
          ip: record.ip
        }
      });

      const options = {
        hostname: host,
        port: url.port || 443,
        path: `/api/${projectId}/store/`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=padavo-agent/1.0`
        },
        timeout: 2000
      };

      const client = url.protocol === 'http:' ? http : https;
      const postReq = client.request(options, () => {});
      postReq.on('error', () => {}); // Silent swallow for telemetry errors
      postReq.write(payload);
      postReq.end();
    } catch (e) {
      // Ignore Sentry forwarding failures
    }
  }

  /**
   * Retrieves recent error logs for diagnostic admin console
   */
  getRecentErrors(limit = 20) {
    return {
      success: true,
      service: 'padavo-error-telemetry',
      environment: this.environment,
      sentry_configured: Boolean(this.sentryDsn),
      total_buffered_errors: this.errorBuffer.length,
      errors: this.errorBuffer.slice(0, limit)
    };
  }

  clear() {
    this.errorBuffer = [];
  }
}

module.exports = new ErrorTelemetry();
