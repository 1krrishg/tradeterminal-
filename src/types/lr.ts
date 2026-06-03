export type FreightType = "TO_PAY" | "TO_BE_BILLED" | "PAID" | "TBB" | "";

// Line item for goods table - ONE HSN = ONE ROW
export interface GoodsLineItem {
  sr_no: number;
  item_code: string; // Product/Item code from invoice
  description: string;
  hsn_code: string; // MUST be single HSN, never comma-separated
  quantity: string;
  unit: string; // Unit of measurement: ltr, kg, pcs, etc.
  packing_type: string;
  number_of_packages: string;
  net_weight_kg: string; // Per unit
  gross_weight_kg: string; // Per unit
  item_gross_weight: string; // quantity × gross_weight_kg
  item_net_weight: string; // quantity × net_weight_kg  
  charged_weight: string; // MUST equal item_gross_weight
  value: string;
}

// Summary totals - DERIVED from line items, never OCR extracted
export interface GoodsSummary {
  total_packages: string;
  total_net_weight: string;
  total_gross_weight: string;
  total_charged_weight: string; // MUST equal total_gross_weight
  total_value: string;
}

export interface LorryReceiptData {
  // Header - Transporter
  transporter_name: string;
  transporter_address: string;
  transporter_gstin: string;
  lr_number: string;
  lr_date: string;
  issuing_branch: string;
  // Party Details - Consignor (Exporter)
  consignor_name: string;
  consignor_address: string;
  consignor_gstin: string;
  consignor_iec: string;
  consignor_pan: string;
  // Party Details - Consignee (Bank if LC exists, else Buyer)
  consignee_name: string;
  consignee_address: string;
  consignee_gstin: string;
  consignee_iec: string;
  consignee_pan: string;
  consignee_exim_code: string;
  // Notify Party (Importer - for LC-backed shipments)
  notify_party_name: string;
  notify_party_address: string;
  notify_party_gstin: string;
  notify_party_iec: string;
  notify_party_pan: string;
  // Transport Info
  origin_city: string;
  destination_city: string;
  customs_port: string;
  via_location: string;
  vehicle_number: string;
  vehicle_type: string; // Truck, Lorry, Container, Van, Rail Wagon, Air Cargo, Ship, etc.
  driver_name: string;
  driver_phone: string;
  transport_mode: "ROAD" | "RAIL" | "AIR" | "SEA" | "";
  // Goods - Line Items (ONE HSN = ONE ROW)
  line_items: GoodsLineItem[];
  // Goods - Summary (DERIVED from line items)
  summary: GoodsSummary;
  // Legacy single-line goods fields (kept for backward compatibility)
  goods_description: string;
  hsn_code: string;
  number_of_packages: string;
  packing_type: string;
  actual_weight: string;
  charged_weight: string;
  declared_value: string;
  gross_weight_kg: string;
  net_weight_kg: string;
  // LC Details
  lc_number: string;
  lc_date: string;
  lc_issuing_bank: string;
  lc_advising_bank: string;
  // Compliance
  eway_bill_number: string;
  eway_bill_date: string;
  eway_bill_valid_upto: string;
  lut_arn: string;
  lut_arn_valid: boolean; // Preserved for compatibility with existing report logic
  // Freight
  freight_amount: string;
  freight_terms: string; // Freight terms exactly from LC
  freight_payment_term: FreightType;
  billing_party: string;
  freight_basis: string;
  // Invoice
  invoice_number: string;
  invoice_date: string;
  // Delivery terms
  delivery_terms: string;
  country_of_origin: string;
  // Signatures
  transporter_signature_present: boolean;
  consignor_signature_present: boolean;
  // Legacy fields for compatibility
  from_location: string;
  to_location: string;
  package_type: string;
  freight_type: FreightType;
  remarks: string;
  declaration_text: string;
}

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  status: "pending" | "processing" | "done" | "error";
  type?: "Invoice" | "Packing List" | "LC" | "Unknown";
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: "error" | "warning";
}

// Mandatory KYC fields for each party
export const mandatoryConsignorFields: (keyof LorryReceiptData)[] = [
  "consignor_name",
  "consignor_address",
  "consignor_gstin",
  "consignor_iec",
  "consignor_pan",
];

export const mandatoryNotifyPartyFields: (keyof LorryReceiptData)[] = [
  "notify_party_name",
  "notify_party_address",
  "notify_party_iec",
  "notify_party_pan",
];

export const mandatoryFields: (keyof LorryReceiptData)[] = [
  "consignor_name",
  "consignor_gstin",
  "consignor_iec",
  "consignor_pan",
  "consignee_name",
  "origin_city",
  "destination_city",
  "invoice_number",
  "invoice_date",
];

export const mandatoryLineItemFields: (keyof GoodsLineItem)[] = [
  "description",
  "hsn_code",
  "quantity",
  "number_of_packages",
  "gross_weight_kg",
  "charged_weight",
];

export const fieldLabels: Record<keyof LorryReceiptData | keyof GoodsLineItem | keyof GoodsSummary, string> = {
  // LorryReceiptData fields
  transporter_name: "Transporter Name",
  transporter_address: "Transporter Address",
  transporter_gstin: "Transporter GSTIN",
  lr_number: "LR Number",
  lr_date: "LR Date",
  issuing_branch: "Issuing Branch",
  consignor_name: "Consignor Name",
  consignor_address: "Consignor Address",
  consignor_gstin: "Consignor GSTIN",
  consignor_iec: "Consignor IEC",
  consignor_pan: "Consignor PAN",
  consignee_name: "Consignee Name",
  consignee_address: "Consignee Address",
  consignee_gstin: "Consignee GSTIN",
  consignee_iec: "Consignee IEC",
  consignee_pan: "Consignee PAN",
  consignee_exim_code: "Consignee EXIM Code",
  notify_party_name: "Notify Party Name",
  notify_party_address: "Notify Party Address",
  notify_party_gstin: "Notify Party GSTIN",
  notify_party_iec: "Notify Party Exim Code",
  notify_party_pan: "Notify Party PAN",
  origin_city: "Origin City",
  destination_city: "Destination City",
  customs_port: "Customs Port",
  via_location: "Via Location",
  vehicle_number: "Vehicle Number",
  vehicle_type: "Vehicle Type",
  driver_name: "Driver Name",
  driver_phone: "Driver Phone",
  transport_mode: "Mode of Transport",
  line_items: "Line Items",
  summary: "Summary",
  goods_description: "Goods Description",
  hsn_code: "HSN Code",
  number_of_packages: "Number of Packages",
  packing_type: "Packing Type",
  actual_weight: "Actual Weight",
  charged_weight: "Charged Weight",
  declared_value: "Declared Value",
  gross_weight_kg: "Gross Weight (kg)",
  net_weight_kg: "Net Weight (kg)",
  lc_number: "LC Number",
  lc_date: "LC Date",
  lc_issuing_bank: "LC Issuing Bank",
  lc_advising_bank: "LC Advising Bank",
  eway_bill_number: "E-Way Bill Number",
  eway_bill_date: "E-Way Bill Date",
  eway_bill_valid_upto: "E-Way Bill Valid Upto",
  lut_arn: "LUT ARN",
  lut_arn_valid: "LUT ARN Valid",
  freight_amount: "Freight Amount",
  freight_terms: "Freight Terms",
  freight_payment_term: "Freight Payment Term",
  billing_party: "Billing Party",
  freight_basis: "Freight Basis",
  invoice_number: "Invoice Number",
  invoice_date: "Invoice Date",
  delivery_terms: "Delivery Terms",
  country_of_origin: "Country of Origin",
  transporter_signature_present: "Transporter Signature",
  consignor_signature_present: "Consignor Signature",
  from_location: "From Location",
  to_location: "To Location",
  package_type: "Package Type",
  freight_type: "Freight Type",
  remarks: "Remarks",
  declaration_text: "Declaration / Description Line",
  // GoodsLineItem fields
  sr_no: "Sr. No.",
  item_code: "Item Code",
  description: "Description of Goods",
  quantity: "Quantity",
  unit: "Unit",
  item_gross_weight: "Item Gross Wt (KGS)",
  item_net_weight: "Item Net Wt (KGS)",
  value: "Value",
  // GoodsSummary fields
  total_packages: "Total Packages",
  total_net_weight: "Total Net Weight",
  total_gross_weight: "Total Gross Weight",
  total_charged_weight: "Total Charged Weight",
  total_value: "Total Value",
};

export const emptyLineItem: GoodsLineItem = {
  sr_no: 1,
  item_code: "",
  description: "",
  hsn_code: "",
  quantity: "",
  unit: "",
  packing_type: "",
  number_of_packages: "",
  net_weight_kg: "",
  gross_weight_kg: "",
  item_gross_weight: "",
  item_net_weight: "",
  charged_weight: "",
  value: "",
};

export const emptySummary: GoodsSummary = {
  total_packages: "",
  total_net_weight: "",
  total_gross_weight: "",
  total_charged_weight: "",
  total_value: "",
};

export const emptyLorryReceipt: LorryReceiptData = {
  transporter_name: "",
  transporter_address: "",
  transporter_gstin: "",
  lr_number: "",
  lr_date: "",
  issuing_branch: "",
  consignor_name: "",
  consignor_address: "",
  consignor_gstin: "",
  consignor_iec: "",
  consignor_pan: "",
  consignee_name: "",
  consignee_address: "",
  consignee_gstin: "",
  consignee_iec: "",
  consignee_pan: "",
  consignee_exim_code: "",
  notify_party_name: "",
  notify_party_address: "",
  notify_party_gstin: "",
  notify_party_iec: "",
  notify_party_pan: "",
  origin_city: "",
  destination_city: "",
  customs_port: "",
  via_location: "",
  vehicle_number: "",
  vehicle_type: "",
  driver_name: "",
  driver_phone: "",
  transport_mode: "",
  line_items: [],
  summary: { ...emptySummary },
  goods_description: "",
  hsn_code: "",
  number_of_packages: "",
  packing_type: "",
  actual_weight: "",
  charged_weight: "",
  declared_value: "",
  gross_weight_kg: "",
  net_weight_kg: "",
  lc_number: "",
  lc_date: "",
  lc_issuing_bank: "",
  lc_advising_bank: "",
  eway_bill_number: "",
  eway_bill_date: "",
  eway_bill_valid_upto: "",
  lut_arn: "",
  lut_arn_valid: true,
  freight_amount: "",
  freight_terms: "",
  freight_payment_term: "",
  billing_party: "",
  freight_basis: "",
  invoice_number: "",
  invoice_date: "",
  delivery_terms: "",
  country_of_origin: "India",
  transporter_signature_present: false,
  consignor_signature_present: false,
  from_location: "",
  to_location: "",
  package_type: "",
  freight_type: "",
  remarks: "",
  declaration_text: "",
};

// Helper functions for calculations
export function calculateLineItemWeights(item: GoodsLineItem): GoodsLineItem {
  const qty = parseFloat(item.quantity) || 0;
  const grossPerUnit = parseFloat(item.gross_weight_kg) || 0;
  const netPerUnit = parseFloat(item.net_weight_kg) || 0;
  
  const itemGross = qty * grossPerUnit;
  const itemNet = qty * netPerUnit;
  
  return {
    ...item,
    item_gross_weight: itemGross ? itemGross.toFixed(2) : "",
    item_net_weight: itemNet ? itemNet.toFixed(2) : "",
    charged_weight: itemGross ? itemGross.toFixed(2) : "", // MUST equal item_gross_weight
  };
}

export function calculateSummary(items: GoodsLineItem[]): GoodsSummary {
  let totalPackages = 0;
  let totalNetWeight = 0;
  let totalGrossWeight = 0;
  let totalValue = 0;
  
  for (const item of items) {
    totalPackages += parseFloat(item.number_of_packages) || 0;
    totalNetWeight += parseFloat(item.item_net_weight) || 0;
    totalGrossWeight += parseFloat(item.item_gross_weight) || 0;
    totalValue += parseFloat(item.value) || 0;
  }
  
  return {
    total_packages: totalPackages ? String(totalPackages) : "",
    total_net_weight: totalNetWeight ? totalNetWeight.toFixed(2) : "",
    total_gross_weight: totalGrossWeight ? totalGrossWeight.toFixed(2) : "",
    total_charged_weight: totalGrossWeight ? totalGrossWeight.toFixed(2) : "", // MUST equal total_gross_weight
    total_value: totalValue ? totalValue.toFixed(2) : "",
  };
}

// HSN validation - must be single HSN, no commas
export function validateHSN(hsn: string): { valid: boolean; error?: string } {
  if (!hsn || hsn.trim() === "") {
    return { valid: false, error: "HSN Code is required" };
  }
  
  // Check for comma-separated HSNs
  if (hsn.includes(",") || hsn.includes("/") || hsn.includes(";")) {
    return { valid: false, error: "Multiple HSN codes detected - split into separate rows" };
  }
  
  // Check format - HSN should be 4-8 digit number
  const cleanHSN = hsn.replace(/\s/g, "");
  if (!/^\d{4,8}$/.test(cleanHSN)) {
    return { valid: false, error: "Invalid HSN format - should be 4-8 digits" };
  }
  
  return { valid: true };
}

// Generate short declaration paragraph
export function generateDeclaration(data: LorryReceiptData): string {
  const parts: string[] = [];
  
  if (data.invoice_number || data.invoice_date) {
    parts.push(`Goods transported as per Proforma Invoice No. ${data.invoice_number || "______"} dated ${data.invoice_date || "______"}.`);
  }
  
  if (data.hsn_code || (data.line_items.length > 0 && data.line_items[0].hsn_code)) {
    const hsnCodes = data.line_items.length > 0 
      ? data.line_items.map(i => i.hsn_code).filter(Boolean).join(", ")
      : data.hsn_code;
    parts.push(`Harmonic Code No. ${hsnCodes || "______"}.`);
  }
  
  parts.push(`Country of Origin: ${data.country_of_origin || "India"}.`);
  
  if (data.delivery_terms || data.origin_city) {
    parts.push(`Delivery Terms: ${data.delivery_terms || "Ex-Works"} ${data.origin_city || "______"}, India.`);
  }
  
  if (data.lc_number) {
    parts.push(`Letter of Credit No. ${data.lc_number} dated ${data.lc_date || "______"}, issued by ${data.lc_issuing_bank || "______"}.`);
  }
  
  if (data.customs_port) {
    parts.push(`Nepal Customs Entry Point: ${data.customs_port}.`);
  }
  
  if (data.eway_bill_number) {
    parts.push(`E-Way Bill No. ${data.eway_bill_number}.`);
  }
  
  return parts.join(" ");
}
