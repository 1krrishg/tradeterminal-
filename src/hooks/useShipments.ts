import { useState, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { extractCorridor } from "@/lib/agentTools"

export interface SaveShipmentInput {
  conversationId: string
  extractedData: Record<string, any>
  riskScore: number
  riskCategory: string
  corridor?: string
}

export interface Shipment {
  id: string
  user_id: string
  conversation_id: string | null
  title: string | null
  corridor: string | null
  status: string | null
  extracted_data: Record<string, any> | null
  risk_score: number | null
  risk_category: string | null
  invoice_number: string | null
  invoice_date: string | null
  created_at: string
  updated_at: string
}

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(false)

  const saveShipment = useCallback(async (input: SaveShipmentInput): Promise<string> => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const { extractedData, conversationId, riskScore, riskCategory } = input

      const invoiceNumber = extractedData?.invoice_number ?? null
      const rawDate = extractedData?.invoice_date ?? null
      // Normalize date to YYYY-MM-DD for Postgres (handles DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY)
      let invoiceDate: string | null = null
      if (rawDate) {
        const dotMatch = rawDate.match(/^(\d{2})[.\/\-](\d{2})[.\/\-](\d{4})$/)
        if (dotMatch) {
          invoiceDate = `${dotMatch[3]}-${dotMatch[2]}-${dotMatch[1]}`
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          invoiceDate = rawDate
        }
      }
      const title = invoiceNumber ? `Shipment #${invoiceNumber}` : `Shipment ${conversationId.slice(0, 8)}`

      const corridor =
        input.corridor ??
        extractCorridor({
          originState: extractedData?.origin_state ?? extractedData?.consignor_state,
          destinationCity: extractedData?.destination_city ?? extractedData?.consignee_city,
          customsPort: extractedData?.customs_port,
        }) ??
        null

      const upsertPayload = {
        user_id: user.id,
        conversation_id: conversationId,
        title,
        corridor,
        status: "active",
        extracted_data: extractedData,
        risk_score: riskScore,
        risk_category: riskCategory,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        updated_at: new Date().toISOString(),
      }

      const { data: existing } = await supabase
        .from("shipments")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle()

      let shipmentId: string

      if (existing) {
        const { data, error } = await supabase
          .from("shipments")
          .update(upsertPayload)
          .eq("id", existing.id)
          .select("id")
          .single()
        if (error) throw error
        shipmentId = data.id
      } else {
        const { data, error } = await supabase
          .from("shipments")
          .insert({ ...upsertPayload, created_at: new Date().toISOString() })
          .select("id")
          .single()
        if (error) throw new Error(`Insert failed: ${error.message} (code: ${error.code})`)
        shipmentId = data.id
      }

      await listShipments()
      return shipmentId
    } finally {
      setLoading(false)
    }
  }, [])

  const listShipments = useCallback(async (): Promise<Shipment[]> => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })

      if (error) throw error
      const result = (data ?? []) as Shipment[]
      setShipments(result)
      return result
    } finally {
      setLoading(false)
    }
  }, [])

  const getShipment = useCallback(async (id: string): Promise<Shipment | null> => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("shipments")
        .select("*")
        .eq("id", id)
        .maybeSingle()

      if (error) throw error
      return (data as Shipment) ?? null
    } finally {
      setLoading(false)
    }
  }, [])

  const archiveShipment = useCallback(async (id: string): Promise<void> => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from("shipments")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", id)

      if (error) throw error
      setShipments((prev) => prev.filter((s) => s.id !== id))
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    saveShipment,
    listShipments,
    getShipment,
    archiveShipment,
    shipments,
    loading,
  }
}
