import fs from 'fs';
import crypto from 'crypto';

const PEM_CERTIFICATE_BLOCK_RE = /-----BEGIN (?:TRUSTED )?CERTIFICATE-----/;

export interface DbCaBundle {
  ca: string;
  /**
   * Subject CN of the pinned certificate, when derivable. SQL Server's
   * auto-generated certificate (CN=SSL_Self_Signed_Fallback) has no SAN and its
   * CN never matches the network hostname ("sqlserver"), so Node's TLS hostname
   * check rejects it even though the exact certificate is trusted. Supplying
   * this as the mssql `options.serverName` makes the hostname check succeed
   * against the pinned identity — certificate validation stays fully on.
   */
  serverName?: string;
}

/**
 * Read the trusted CA certificate used to validate the SQL Server connection.
 *
 * Security contract:
 * - If no CA is configured, `undefined` is returned; this is only valid when the
 *   server certificate chains to a system/public CA. Production ALWAYS keeps
 *   `trustServerCertificate` false — this helper NEVER disables validation.
 * - If configured but unreadable, or the content is not a PEM certificate, this
 *   THROWS so every caller (server runtime, migration CLI, diagnostics) FAILS
 *   CLOSED instead of silently connecting without certificate validation.
 *
 * The returned bundle is used as the ONLY trust anchor via
 * `cryptoCredentialsDetails`, which is how a private/self-signed SQL Server
 * certificate is handled securely (self-signed or internally-signed non-public
 * certificates are pinned to this bundle instead of being ignored).
 */
export function readCaCertificate(caPath: string | undefined | null): DbCaBundle | undefined {
  if (!caPath || caPath.trim() === '') return undefined;

  let pem: string;
  try {
    pem = fs.readFileSync(caPath, 'utf8');
  } catch (error: any) {
    throw new Error(
      `DB_SSL_CA_PATH points to "${caPath}" but the certificate file could not be read ` +
        `(${error?.code ?? 'unknown error'}). Refusing to connect without certificate validation.`,
    );
  }

  if (!PEM_CERTIFICATE_BLOCK_RE.test(pem)) {
    throw new Error(
      `DB_SSL_CA_PATH points to "${caPath}" which does not contain a PEM certificate ` +
        '(expected a "-----BEGIN CERTIFICATE-----" block). Refusing to connect without certificate validation.',
    );
  }

  // Best-effort: parse the pinned certificate's CN so callers can align the TLS
  // hostname check with the pinned identity. A certificate that Node cannot
  // parse here still gets used for validation via `ca` (fail-open only for this
  // convenience field, never for the trust anchor itself).
  let serverName: string | undefined;
  try {
    const cnLine = new crypto.X509Certificate(pem).subject
      .split('\n')
      .find((line) => line.startsWith('CN='));
    if (cnLine) serverName = cnLine.slice(3).trim() || undefined;
  } catch {
    serverName = undefined;
  }

  return { ca: pem, ...(serverName ? { serverName } : {}) };
}