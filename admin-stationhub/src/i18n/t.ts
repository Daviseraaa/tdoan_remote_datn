import { vi } from './vi';

type Primitive = string | number | boolean | null | undefined;

type Join<K extends string, P extends string> = P extends '' ? K : `${K}.${P}`;

type Paths<T, D extends number = 8> = [D] extends [never]
  ? never
  : T extends Primitive
    ? never
    : {
        [K in keyof T & string]: T[K] extends Primitive
          ? K
          : K | Join<K, Paths<T[K], Prev[D]>>;
      }[keyof T & string];

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8];

export type TranslationKey = Paths<typeof vi>;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const raw = getNested(vi as unknown as Record<string, unknown>, key);
  let value = typeof raw === 'string' ? raw : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return value;
}
