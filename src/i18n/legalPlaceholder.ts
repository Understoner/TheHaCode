const PLACEHOLDER_MARKER = '[[TODO';

export function hasLegalPlaceholder(values: string[]): boolean {
  return values.some((value) => value.includes(PLACEHOLDER_MARKER));
}
