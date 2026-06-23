import React, { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface RegulationImpactBannerProps {
  matches: Array<{
    regulation: { title: string; authority: string; summary: string; source_url?: string; corridor: string }
    reason: string
    severity: 'info' | 'warning' | 'critical'
  }>
  corridor: string
  onDismiss: () => void
}

const severityConfig = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: '⚠️',
    badgeVariant: 'destructive' as const,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: '⚡',
    badgeVariant: 'outline' as const,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: 'ℹ️',
    badgeVariant: 'secondary' as const,
  },
}

const severityOrder: Array<'critical' | 'warning' | 'info'> = ['critical', 'warning', 'info']

export function RegulationImpactBanner({ matches, corridor, onDismiss }: RegulationImpactBannerProps) {
  const [expanded, setExpanded] = useState(false)

  const grouped = severityOrder.reduce<Record<string, typeof matches>>(
    (acc, severity) => {
      acc[severity] = matches.filter((m) => m.severity === severity)
      return acc
    },
    { critical: [], warning: [], info: [] }
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm w-full">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:text-gray-600 focus:outline-none"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          <span>📋</span>
          <span>
            {matches.length} regulation{matches.length !== 1 ? 's' : ''} apply to this shipment
          </span>
          <span className="ml-1 text-gray-500">{expanded ? '▲' : '▼'}</span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ×
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-2">
          <ScrollArea className="max-h-[300px]">
            <div className="flex flex-col gap-3 pr-2">
              {severityOrder.map((severity) => {
                const items = grouped[severity]
                if (items.length === 0) return null
                return (
                  <div key={severity} className="flex flex-col gap-2">
                    {items.map((match, idx) => {
                      const config = severityConfig[severity]
                      return (
                        <div
                          key={idx}
                          className={`rounded-md border p-3 ${config.bg} ${config.border}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-base leading-none">{config.icon}</span>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={config.badgeVariant} className="shrink-0 text-xs">
                                  {match.regulation.authority}
                                </Badge>
                                <span className="text-sm font-medium text-gray-800">
                                  {match.regulation.title}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600">{match.reason}</p>
                              {match.regulation.source_url && (
                                <a
                                  href={match.regulation.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 underline hover:text-blue-800"
                                >
                                  View source
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
