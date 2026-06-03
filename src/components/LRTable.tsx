import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { LorryReceiptData, ValidationWarning } from "@/types/lr";
import { fieldLabels, mandatoryFields } from "@/types/lr";

interface LRTableProps {
  data: LorryReceiptData;
  warnings: ValidationWarning[];
  onDataChange: (field: keyof LorryReceiptData, value: string | boolean) => void;
}

const booleanFields: (keyof LorryReceiptData)[] = [
  "transporter_signature_present",
  "consignor_signature_present",
  "lut_arn_valid",
];

export function LRTable({ data, warnings, onDataChange }: LRTableProps) {
  const warningsByField = warnings.reduce((acc, w) => {
    acc[w.field] = w;
    return acc;
  }, {} as Record<string, ValidationWarning>);

  const groupedFields: Record<string, (keyof LorryReceiptData)[]> = {
    identification: ["lr_number", "lr_date", "invoice_number", "invoice_date"],
    transporter: ["transporter_name", "transporter_address", "transporter_gstin", "issuing_branch"],
    eway_bill: ["eway_bill_number", "eway_bill_date", "eway_bill_valid_upto"],
    consignor: ["consignor_name", "consignor_address", "consignor_gstin", "consignor_iec", "consignor_pan"],
    consignee: ["consignee_name", "consignee_address", "consignee_gstin", "consignee_iec", "consignee_pan", "consignee_exim_code"],
    notify_party: ["notify_party_name", "notify_party_address", "notify_party_gstin", "notify_party_iec", "notify_party_pan"],
    lc_details: ["lc_number", "lc_date", "lc_issuing_bank", "lc_advising_bank"],
    location: ["origin_city", "destination_city", "customs_port", "via_location", "from_location", "to_location"],
    transport: ["vehicle_type", "vehicle_number", "driver_name", "driver_phone", "transport_mode"],
    cargo: ["goods_description", "hsn_code", "number_of_packages", "packing_type", "package_type", "gross_weight_kg", "net_weight_kg", "actual_weight", "charged_weight", "declared_value"],
    compliance: ["lut_arn", "lut_arn_valid", "delivery_terms", "country_of_origin"],
    freight: ["freight_terms", "freight_amount", "freight_payment_term", "freight_type", "billing_party", "freight_basis"],
    signatures: ["transporter_signature_present", "consignor_signature_present"],
    other: ["declaration_text", "remarks"],
  };

  const groupLabels: Record<string, string> = {
    identification: "Document Details",
    transporter: "Transporter",
    eway_bill: "E-Way Bill",
    consignor: "Consignor (Exporter)",
    consignee: "Consignee (Bank / Receiver)",
    notify_party: "Notify Party (Importer)",
    lc_details: "Letter of Credit",
    location: "Route & Locations",
    transport: "Vehicle & Driver",
    cargo: "Cargo / Goods",
    compliance: "Export Compliance",
    freight: "Freight & Billing",
    signatures: "Signatures",
    other: "Additional Info",
  };

  const groupIcons: Record<string, string> = {
    identification: "📄",
    transporter: "🚛",
    eway_bill: "📋",
    consignor: "🏭",
    consignee: "🏦",
    notify_party: "👤",
    lc_details: "💳",
    location: "📍",
    transport: "🚗",
    cargo: "📦",
    compliance: "✅",
    freight: "💰",
    signatures: "✍️",
    other: "📝",
  };

  const getDefaultOpenGroups = () => {
    const openGroups: string[] = [];
    for (const [groupKey, fields] of Object.entries(groupedFields)) {
      const hasDataOrError = fields.some((field) => {
        const value = data[field];
        const hasValue = typeof value === "boolean" ? value : Boolean(value);
        const hasError = warningsByField[field]?.severity === "error";
        return hasValue || hasError;
      });
      if (hasDataOrError) openGroups.push(groupKey);
    }
    return [...new Set([...openGroups, "identification", "consignor", "consignee", "cargo"])];
  };

  const [openGroups, setOpenGroups] = useState<string[]>(getDefaultOpenGroups);
  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) =>
      prev.includes(groupKey) ? prev.filter((g) => g !== groupKey) : [...prev, groupKey]
    );
  };

  // Determine if a field spans full width (addresses, descriptions, remarks)
  const isWideField = (field: string) =>
    field.includes("address") || field.includes("description") || field === "remarks" || field === "delivery_terms" || field === "freight_terms" || field === "declaration_text";

  const isTextareaField = (field: string) => field === "declaration_text" || field === "remarks";

  return (
    <div className="space-y-2">
      {Object.entries(groupedFields).map(([groupKey, groupFields]) => {
        const isOpen = openGroups.includes(groupKey);
        const groupHasErrors = groupFields.some((f) => warningsByField[f]?.severity === "error");
        const filledCount = groupFields.filter((f) => {
          const val = data[f];
          return typeof val === "boolean" ? val : Boolean(val);
        }).length;

        return (
          <Collapsible key={groupKey} open={isOpen} onOpenChange={() => toggleGroup(groupKey)}>
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-base">{groupIcons[groupKey]}</span>
                  <h3 className="text-sm font-semibold text-foreground">{groupLabels[groupKey]}</h3>
                  {groupHasErrors && (
                    <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className="text-xs text-muted-foreground ml-1">
                    {filledCount}/{groupFields.length}
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 border-t border-border">
                  {groupFields.map((key) => {
                    const isMandatory = mandatoryFields.includes(key);
                    const isBoolean = booleanFields.includes(key);
                    const warning = warningsByField[key];
                    const value = data[key];
                    const hasValue = typeof value === "boolean" ? value : Boolean(value);
                    const wide = isWideField(key);

                    return (
                      <div
                        key={key}
                        className={`${wide ? "sm:col-span-2" : ""}`}
                      >
                        <Label
                          htmlFor={key}
                          className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"
                        >
                          {fieldLabels[key]}
                          {isMandatory && <span className="text-destructive">*</span>}
                          {warning && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4 ml-1">
                              Missing
                            </Badge>
                          )}
                          {!warning && hasValue && (
                            <CheckCircle2 className="h-3 w-3 text-success ml-1" />
                          )}
                        </Label>
                        {isBoolean ? (
                          <div className="flex items-center gap-2 h-8">
                            <Switch
                              id={key}
                              checked={Boolean(value)}
                              onCheckedChange={(checked) => onDataChange(key, checked)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {value ? "Yes" : "No"}
                            </span>
                          </div>
                        ) : isTextareaField(key) ? (
                          <Textarea
                            id={key}
                            value={String(value || "")}
                            onChange={(e) => onDataChange(key, e.target.value)}
                            placeholder="—"
                            rows={3}
                            className={`text-sm font-mono ${
                              warning
                                ? "border-destructive/50 focus-visible:ring-destructive/30"
                                : hasValue
                                ? "border-success/40"
                                : ""
                            }`}
                          />
                        ) : (
                          <Input
                            id={key}
                            value={String(value || "")}
                            onChange={(e) => onDataChange(key, e.target.value)}
                            placeholder="—"
                            className={`h-8 text-sm font-mono ${
                              warning
                                ? "border-destructive/50 focus-visible:ring-destructive/30"
                                : hasValue
                                ? "border-success/40"
                                : ""
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
