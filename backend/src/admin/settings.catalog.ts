/** One credential the admin settings screen can inspect and set. */
export interface CredentialKey {
  key: string;
  service: string;
  label: string;
  hint: string;
}

/**
 * The allow-list for `PATCH /api/admin/settings`. Only backing services the platform
 * actually provisions appear here; an unknown key is rejected rather than persisted.
 */
export const CREDENTIAL_KEYS: CredentialKey[] = [
  {
    key: 'DATABASE_URL',
    service: 'postgresql',
    label: 'Connection URL',
    hint: 'Primary datastore for items, locations, balances and movements.',
  },
  {
    key: 'MINIO_ENDPOINT',
    service: 'minio',
    label: 'Endpoint',
    hint: 'Host and port of the object store, e.g. minio:9000.',
  },
  {
    key: 'MINIO_ACCESS_KEY',
    service: 'minio',
    label: 'Access key',
    hint: 'Access key issued by the object store.',
  },
  {
    key: 'MINIO_SECRET_KEY',
    service: 'minio',
    label: 'Secret key',
    hint: 'Stored encrypted; only ever returned masked.',
  },
  {
    key: 'MINIO_BUCKET',
    service: 'minio',
    label: 'Bucket',
    hint: 'Bucket that receives uploaded documents.',
  },
];

export const CREDENTIAL_KEY_SET = new Set(CREDENTIAL_KEYS.map((entry) => entry.key));
