export function detectCountryCode(name: string): string {
  const n = name.toUpperCase();
  if (n.includes('RU') || n.includes('RUSSIA') || n.includes('МОСКВА') || n.includes('MOSCOW')) return 'RU';
  if (n.includes('US') || n.includes('USA') || n.includes('AMERICA')) return 'US';
  if (n.includes('DE') || n.includes('GERMANY') || n.includes('FRANKFURT')) return 'DE';
  if (n.includes('NL') || n.includes('NETHERLANDS') || n.includes('AMSTERDAM')) return 'NL';
  if (n.includes('FI') || n.includes('FINLAND') || n.includes('HELSINKI')) return 'FI';
  if (n.includes('FR') || n.includes('FRANCE') || n.includes('PARIS')) return 'FR';
  if (n.includes('GB') || n.includes('UK') || n.includes('LONDON')) return 'GB';
  if (n.includes('TR') || n.includes('TURKEY') || n.includes('ISTANBUL')) return 'TR';
  if (n.includes('SG') || n.includes('SINGAPORE')) return 'SG';
  if (n.includes('JP') || n.includes('JAPAN') || n.includes('TOKYO')) return 'JP';
  return 'GLOBE';
}
