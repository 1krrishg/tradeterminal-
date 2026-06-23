export interface FixRequestDetection {
  isFixRequest: boolean
  fixType: 'hsn_split' | 'freight_terms' | 'consignee_bank' | 'weight_correction' | 'invoice_number' | 'general_fix' | null
  confidence: number
  relevantFields: string[]
}

const PATTERNS: Array<{
  fixType: FixRequestDetection['fixType']
  keywords: string[]
  relevantFields: string[]
}> = [
  {
    fixType: 'hsn_split',
    keywords: ['split hsn', 'separate hsn', 'multiple hsn', 'hsn codes'],
    relevantFields: ['line_items'],
  },
  {
    fixType: 'freight_terms',
    keywords: ['freight', 'to pay', 'paid', 'freight terms', 'tbb'],
    relevantFields: ['freight_terms', 'freight_payment_term', 'freight_amount'],
  },
  {
    fixType: 'consignee_bank',
    keywords: ['bank', 'lc', 'letter of credit', 'consignee', 'to the order'],
    relevantFields: ['consignee_name', 'consignee_address', 'notify_party_name', 'lc_number', 'lc_issuing_bank'],
  },
  {
    fixType: 'weight_correction',
    keywords: ['weight', 'gross weight', 'net weight', 'charged weight'],
    relevantFields: ['line_items', 'summary'],
  },
  {
    fixType: 'invoice_number',
    keywords: ['invoice number', 'invoice no', 'inv no'],
    relevantFields: ['invoice_number', 'invoice_date'],
  },
]

// Must have an action verb to be a real fix request, not just a question
const ACTION_VERBS = ['please fix', 'please correct', 'please update', 'please change', 'can you fix', 'can you correct', 'can you update', 'can you change', 'update the', 'change the', 'fix the', 'correct the', 'edit the']

export function detectFixRequest(message: string, hasExtractedData: boolean): FixRequestDetection {
  const lower = message.toLowerCase()

  // Must start with or contain an action verb to be a fix request
  const hasActionVerb = ACTION_VERBS.some(v => lower.includes(v))
  if (!hasActionVerb) {
    return { isFixRequest: false, fixType: null, confidence: 0, relevantFields: [] }
  }

  for (const pattern of PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword)) {
        return {
          isFixRequest: true,
          fixType: pattern.fixType,
          confidence: 0.9,
          relevantFields: pattern.relevantFields,
        }
      }
    }
  }

  if (hasExtractedData) {
    return {
      isFixRequest: true,
      fixType: 'general_fix',
      confidence: 0.6,
      relevantFields: [],
    }
  }

  return { isFixRequest: false, fixType: null, confidence: 0, relevantFields: [] }
}
