export function validateGSTIN(gstin: string): {
  valid: boolean;
  error?: string;
  stateCode?: string;
  pan?: string;
} {
  if (gstin.length !== 15) {
    return { valid: false, error: `GSTIN must be 15 characters, got ${gstin.length}` };
  }

  const stateCode = gstin.slice(0, 2);
  const stateNum = parseInt(stateCode, 10);
  if (isNaN(stateNum) || stateNum < 1 || stateNum > 38) {
    return { valid: false, error: `Invalid state code: ${stateCode}. Must be 01-38` };
  }

  const pan = gstin.slice(2, 12);
  const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (!panPattern.test(pan)) {
    return { valid: false, error: `Invalid PAN segment: ${pan}. Must match 5 letters + 4 digits + 1 letter` };
  }

  const entityChar = gstin[12];
  if (!/^[1-9A-Z]$/.test(entityChar)) {
    return { valid: false, error: `Invalid entity character: ${entityChar}` };
  }

  if (gstin[13] !== 'Z') {
    return { valid: false, error: `Character at position 14 must be 'Z', got '${gstin[13]}'` };
  }

  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(gstin[i]);
    if (val === -1) {
      return { valid: false, error: `Invalid character '${gstin[i]}' at position ${i + 1}` };
    }
    const product = val * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checksum = chars[(36 - (sum % 36)) % 36];
  if (gstin[14] !== checksum) {
    return { valid: false, error: `Invalid checksum: expected '${checksum}', got '${gstin[14]}'` };
  }

  return { valid: true, stateCode, pan };
}

export function validateHSN(hsn: string): {
  valid: boolean;
  digits: number;
  error?: string;
} {
  const cleaned = hsn.replace(/[\s.]/g, '');

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, digits: 0, error: 'HSN must contain only digits (dots and spaces are stripped)' };
  }

  const len = cleaned.length;
  if (len !== 4 && len !== 6 && len !== 8) {
    return { valid: false, digits: len, error: `HSN length must be 4, 6, or 8 digits, got ${len}` };
  }

  return { valid: true, digits: len };
}

export function calculateTotals(
  lineItems: Array<{
    quantity: number;
    unitPrice: number;
    grossWeightKg: number;
    netWeightKg: number;
    numberOfPackages: number;
  }>
): {
  totalValue: number;
  totalGrossWeight: number;
  totalNetWeight: number;
  totalPackages: number;
  totalChargedWeight: number;
} {
  let totalValue = 0;
  let totalGrossWeight = 0;
  let totalNetWeight = 0;
  let totalPackages = 0;

  for (const item of lineItems) {
    totalValue += item.quantity * item.unitPrice;
    totalGrossWeight += item.grossWeightKg;
    totalNetWeight += item.netWeightKg;
    totalPackages += item.numberOfPackages;
  }

  return {
    totalValue,
    totalGrossWeight,
    totalNetWeight,
    totalPackages,
    totalChargedWeight: totalGrossWeight,
  };
}

export function applyPatch(
  original: Record<string, any>,
  patch: Record<string, any>
): {
  updated: Record<string, any>;
  diff: Array<{ field: string; old: any; new: any }>;
} {
  const updated = { ...original };
  const diff: Array<{ field: string; old: any; new: any }> = [];

  for (const key of Object.keys(patch)) {
    const oldVal = original[key];
    const newVal = patch[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff.push({ field: key, old: oldVal, new: newVal });
    }
    updated[key] = newVal;
  }

  return { updated, diff };
}

export function editLorryReceipt(
  original: Record<string, any>,
  patch: Record<string, any>,
  reason: string
): {
  diff: Array<{ field: string; old: any; new: any; reason: string }>;
  updated: Record<string, any>;
} {
  const { updated, diff: rawDiff } = applyPatch(original, patch);
  const diff = rawDiff.map((entry) => ({ ...entry, reason }));
  return { diff, updated };
}

export function extractCorridor(data: {
  originState?: string;
  destinationCity?: string;
  customsPort?: string;
}): 'India-Nepal' | 'India-Bhutan' | 'India-Bangladesh' | 'unknown' {
  const nepalKeywords = [
    'birgunj', 'biratnagar', 'bhairahawa', 'nepalgunj', 'raxaul',
    'jogbani', 'sunauli', 'rupedia', 'npr',
  ];
  const bangladeshKeywords = [
    'dhaka', 'chittagong', 'benapole', 'petrapole', 'bdt',
  ];
  const bhutanKeywords = [
    'phuentsholing', 'jaigaon', 'thimphu', 'btn',
  ];

  const haystack = [
    data.originState ?? '',
    data.destinationCity ?? '',
    data.customsPort ?? '',
  ]
    .join(' ')
    .toLowerCase();

  if (nepalKeywords.some((kw) => haystack.includes(kw))) {
    return 'India-Nepal';
  }
  if (bangladeshKeywords.some((kw) => haystack.includes(kw))) {
    return 'India-Bangladesh';
  }
  if (bhutanKeywords.some((kw) => haystack.includes(kw))) {
    return 'India-Bhutan';
  }

  return 'unknown';
}
