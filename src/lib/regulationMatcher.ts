export interface Regulation {
  id: string
  authority: string
  corridor: string
  title: string
  summary: string
  source_url?: string
  effective_date?: string
  tags: string[]
}

export interface RegulationMatch {
  regulation: Regulation
  reason: string
  severity: 'info' | 'warning' | 'critical'
}

export function matchRegulations(
  shipment: {
    corridor: string
    extractedData: Record<string, any>
    riskCategory?: string
  },
  regulations: Regulation[]
): RegulationMatch[] {
  const { corridor, extractedData, riskCategory } = shipment
  const matchedIds = new Set<string>()
  const results: RegulationMatch[] = []

  const addMatch = (regulation: Regulation, reason: string, baseSeverity: 'info' | 'warning') => {
    if (matchedIds.has(regulation.id)) return
    matchedIds.add(regulation.id)

    let severity: 'info' | 'warning' | 'critical' = baseSeverity
    if (riskCategory === 'problem') {
      severity = 'critical'
    }

    results.push({ regulation, reason, severity })
  }

  for (const regulation of regulations) {
    const corridorMatches = regulation.corridor === corridor
    const isAll = regulation.corridor === 'All'

    if (!corridorMatches && !isAll) continue

    const baseSeverity: 'info' | 'warning' = corridorMatches ? 'warning' : 'info'

    // Step 1: corridor / 'All' match
    if (corridorMatches || isAll) {
      const baseReason = corridorMatches
        ? `Corridor match: regulation applies to '${corridor}'`
        : "Applies to all corridors"

      // Step 2: tag-based refinement — collect tag reasons
      const tagReasons: string[] = []

      if (extractedData.lc_number && regulation.tags.some(t => t === 'LC')) {
        tagReasons.push("LC number present and regulation tagged 'LC'")
      }

      if (
        extractedData.eway_bill_number &&
        regulation.tags.some(t => t === 'eway-bill' || t === 'e-way')
      ) {
        tagReasons.push("E-way bill number present and regulation tagged 'eway-bill'/'e-way'")
      }

      const hsnCodes: unknown =
        extractedData.hsn_codes ??
        extractedData.hsn_code ??
        extractedData.hsnCodes ??
        extractedData.hsnCode
      const hasHsn =
        hsnCodes !== undefined &&
        hsnCodes !== null &&
        (Array.isArray(hsnCodes) ? (hsnCodes as unknown[]).length > 0 : true)

      if (hasHsn && regulation.tags.some(t => t === 'HSN')) {
        tagReasons.push("HSN codes present and regulation tagged 'HSN'")
      }

      if (
        extractedData.freight_payment_term === 'TO_PAY' &&
        regulation.tags.some(t => t === 'freight')
      ) {
        tagReasons.push("Freight payment term is TO_PAY and regulation tagged 'freight'")
      }

      // Decide whether to include this regulation
      const hasTagMatch = tagReasons.length > 0
      const hasTags = regulation.tags.length > 0

      // Include if: no tags on regulation (pure corridor match), OR a tag matched
      if (!hasTags || hasTagMatch) {
        const reason = hasTagMatch
          ? `${baseReason}. ${tagReasons.join('; ')}`
          : baseReason
        addMatch(regulation, reason, baseSeverity)
      }
    }
  }

  const severityOrder: Record<'critical' | 'warning' | 'info', number> = {
    critical: 0,
    warning: 1,
    info: 2,
  }

  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return results
}

export function groupByAuthority(matches: RegulationMatch[]): Record<string, RegulationMatch[]> {
  const groups: Record<string, RegulationMatch[]> = {}

  for (const match of matches) {
    const { authority } = match.regulation
    if (!groups[authority]) {
      groups[authority] = []
    }
    groups[authority].push(match)
  }

  return groups
}
