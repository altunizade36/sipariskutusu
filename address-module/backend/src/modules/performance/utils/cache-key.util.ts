type Primitive = string | number | boolean | null | undefined;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue(record[key]);
        return acc;
      }, {});
  }

  return value as Primitive;
}

export function buildCacheKey(prefix: string, payload: unknown) {
  const keyPrefix = process.env.REDIS_KEY_PREFIX ?? 'sipariskutusu';
  const serialized = JSON.stringify(stableValue(payload));
  return `${keyPrefix}:${prefix}:${serialized}`;
}
