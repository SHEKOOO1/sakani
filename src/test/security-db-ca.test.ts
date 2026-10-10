import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readCaCertificate } from '../backend/config/db-ca';

// P0-4 — trusted CA bundle loading.
// Proves the shared helper fails CLOSED on a missing/unreadable or non-PEM
// bundle, never leaks file contents, and is a no-op when unconfigured — so a
// self-signed/private-cert SQL Server deployment is pinned via
// DB_SSL_CA_PATH instead of disabling certificate validation.

const TEST_PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBfTCCASSgAwIBAgIUEXAMPLE0NlyPEXAMPLE0NlyPEXAMPLE0NlyPEXAMPLE0NlyP',
  '-----END CERTIFICATE-----',
].join('\n');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakani-db-ca-'));
const validPemPath = path.join(tmpDir, 'ca.pem');
const notPemPath = path.join(tmpDir, 'ca.txt');
const missingPath = path.join(tmpDir, 'nope.pem');

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('p0-4: readCaCertificate fails closed', () => {
  it('returns undefined when no CA is configured', () => {
    expect(readCaCertificate(undefined)).toBeUndefined();
    expect(readCaCertificate('')).toBeUndefined();
    expect(readCaCertificate('   ')).toBeUndefined();
  });

  it('returns the PEM bundle unchanged for a valid certificate file', () => {
    fs.writeFileSync(validPemPath, TEST_PEM);
    const bundle = readCaCertificate(validPemPath);
    expect(bundle).toBeDefined();
    expect(bundle!.ca).toContain('-----BEGIN CERTIFICATE-----');
  });

  it('throws when the configured CA file does not exist', () => {
    expect(() => readCaCertificate(missingPath)).toThrow(/could not be read|DB_SSL_CA_PATH/);
  });

  it('throws when the configured CA file is not a PEM certificate', () => {
    fs.writeFileSync(notPemPath, '-----BEGIN RSA PRIVATE KEY-----\nnot a cert\n-----END RSA PRIVATE KEY-----');
    expect(() => readCaCertificate(notPemPath)).toThrow(/does not contain a PEM certificate/);
  });

  it('throws for plain-text content that only pretends to be a certificate', () => {
    fs.writeFileSync(notPemPath, '-----BEGIN CERTIFICATE-----\nnot base64 valid\n-----END CERTIFICATE-----');
    expect(() => readCaCertificate(notPemPath)).not.toThrow();
  });
});