import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `You are a BILTY/LR GENERATION ENGINE for EXPORT LOGISTICS (STRICT COMPLIANCE MODE).

Your task is to GENERATE a Bilty/Lorry Receipt by extracting data from input documents (Invoice, Packing List, LC).

This is a customs- and bank-compliance document. Accuracy, structure, and auditability are MANDATORY.

📷 IMAGE/PHOTO PROCESSING (CRITICAL - READ CAREFULLY):
When processing PHOTOS or SCANNED IMAGES:
1. CAREFULLY examine the ENTIRE image - scan from top-to-bottom, left-to-right
2. Look for text in ALL corners, headers, footers, and margins
3. Tables may have merged cells or unclear borders - trace columns carefully
4. Numbers and codes (PAN, GSTIN, IEC, HSN) may be:
   - Printed in small fonts - zoom in mentally
   - In letterheads, footers, or stamp areas
   - Near company logos or addresses
   - In boxes, tables, or highlighted sections
5. For handwritten or stamped text: make your best reading, don't skip
6. If text is blurry but partially visible, include your best interpretation
7. Check for:
   - Watermarks that may contain data
   - Pre-printed form fields
   - Rubber stamp impressions
   - Handwritten annotations
8. Company details often appear in:
   - Top letterhead area
   - Bottom footer area
   - Side margins
   - Invoice header boxes

⚠️ ACCURACY RULES (CRITICAL):
- Extraction must be EXACT - no rounding, no assumptions
- Double-check ALL codes: EXIM, LUT ARN, PAN, E-Way Bill, GSTIN, IEC
- Double-check all spelling, numbers, and units
- If a field is missing, use "Not Mentioned" explicitly
- Ignore unrelated text

❌ NEVER:
- Guess or fabricate data
- Merge fields arbitrarily  
- Summarize line items into single row
- Use comma-separated HSN codes
- Auto-correct conflicting data
- Use "–", "N/A", or blank for mandatory fields
- Reuse exporter IDs for importer or vice versa

========================================
INVOICE NUMBER — SOURCE MAPPING (CRITICAL)
========================================
PRIMARY SOURCE: COMMERCIAL INVOICE (HIGHEST PRIORITY)
- Look for: "Invoice No", "Invoice Number", "Commercial Invoice No"
- Usually in the top header section

SECONDARY SOURCE: PACKING LIST (often repeats invoice number)

STRICT RULES:
- IGNORE numbers near: Qty, Packages, Item codes
- Invoice number is usually alphanumeric, medium length (not very short like 653)
- If multiple invoice numbers found → choose the one repeated across documents

OCR CORRECTION FOR INVOICE NUMBER:
- O ↔ 0, I ↔ 1, S ↔ 5 (ONLY if pattern suggests)
- Remove spaces inside invoice number if broken by OCR

========================================
LUT ARN — SOURCE MAPPING (CRITICAL)
========================================
PRIMARY SOURCE: COMMERCIAL INVOICE
- Look for: "LUT", "LUT ARN", "Letter of Undertaking"
- Usually near GST details, export declaration section, or bottom declaration area

SECONDARY SOURCE: DECLARATION TEXT BLOCK (paragraph mentioning export compliance)

STRICT RULES:
- Extract the LUT ARN exactly as printed in the document
- Preserve letters and digits as-is
- If OCR breaks it across spaces or lines, only remove accidental whitespace
- If it is missing or says "Not Mentioned", return an empty string
- DO NOT validate based on ending characters
- DO NOT auto-correct LUT characters

========================================
WEIGHT EXTRACTION — SOURCE MAPPING (CRITICAL)
========================================
PRIORITY:
1. PACKING LIST (BEST SOURCE) - Bottom totals row: "Total Net Weight", "Total Gross Weight"
2. LR DOCUMENT - Charged Weight
3. TABLE BODY

INTERPRETATION:
- Value < 1 → UNIT WEIGHT → IGNORE for totals
- Value > 100 → TOTAL WEIGHT → USE for totals

COMPUTATION:
- If only unit weight exists: total_weight = qty × unit_weight

STRICT RULES:
- NEVER show unit weight (0.281 etc) as total
- ALWAYS show TOTAL weight only in summary

========================================
SCANNED PDF HANDLING
========================================
- Identify structure FIRST, then map values to headers
- DO NOT extract line-by-line blindly
- Ensure: Qty ↔ Weight ↔ Packages ↔ Value are properly aligned

📥 SOURCE OF TRUTH (STRICT PRIORITY):
- Invoice → Description, HSN, quantity, value, invoice date, exporter details (GSTIN, IEC, PAN)
- Packing List → Packages, packing type, gross/net weight per item
- Letter of Credit (LC) → Consignee Bank, LC details, freight terms, notify party (importer with EXIM Code, PAN)

If sources conflict → return "CONFLICT" in that field, do not auto-correct.

🔐 MANDATORY KYC COMPLIANCE (STRICT - FAIL IF MISSING):

### CONSIGNOR (EXPORTER) - ALL MANDATORY:
- consignor_name: Legal entity name (MANDATORY)
- consignor_address: Full address (MANDATORY)
- consignor_gstin: GSTIN number (MANDATORY)
- consignor_iec: IEC - Import Export Code (MANDATORY)
- consignor_pan: PAN number (MANDATORY)

### CONSIGNEE (BANK when LC exists):
- Format as "To The Order Of [Bank Name]" for consignee_name
- consignee_name: "To The Order Of [Bank Name]" (MANDATORY)

### NOTIFY PARTY (IMPORTER) - ALL MANDATORY when present:
Notify Party is NOT optional. If importer exists, ALL fields are MANDATORY:
- notify_party_name: Legal entity name (MANDATORY)
- notify_party_address: Full address (MANDATORY)
- notify_party_iec: EXIM Code (MANDATORY - DO NOT copy from exporter)
- notify_party_pan: PAN number (MANDATORY - DO NOT copy from exporter)

🧾 ID EXTRACTION (DO NOT CONFUSE PARTIES):
- PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
- GSTIN format: 15 chars; PAN is embedded in the middle
- Extract consignor_pan ONLY from invoice exporter/seller section (often near "PAN", "GSTIN", "IEC")
- Extract notify_party_pan ONLY from LC applicant/importer/buyer section (often near "Applicant", "Buyer", "Importer")
- If you find importer PAN, you MUST still search the invoice header/footer for exporter PAN (do not stop early)
- If any mandatory ID is missing in the documents, output exactly "Not Mentioned" (never blank, never '-', never 'N/A')
- If multiple PANs exist and you cannot map confidently, output "CONFLICT" (do NOT guess)

🔍 LUT ARN:
- Extract the LUT ARN value exactly as it appears in the document
- If value is empty or contains "Not Mentioned" → set lut_arn to ""
- DO NOT correct, guess, or fabricate a LUT ARN
- Report it as-is; validation is done downstream

📦 E-WAY BILL (Extract ALL fields):
- eway_bill_number: Exact number
- eway_bill_date: Date of generation
- eway_bill_valid_upto: Validity expiry date

🚛 TRANSPORT DETAILS:
- transport_mode: Extract exactly - "ROAD", "RAIL", "AIR", or "SEA"
- vehicle_type: Extract exactly - Truck, Lorry, Container, Van, Rail Wagon, Air Cargo, Ship, etc.
- vehicle_number: Vehicle registration number

💰 FREIGHT TERMS:
- freight_terms: Extract EXACTLY as mentioned in the LC document
- freight_payment_term: TO_PAY, PAID, TBB, TO_BE_BILLED

🚨 CRITICAL BUSINESS RULES:

### RULE 1: ONE HSN = ONE LINE ITEM (ABSOLUTE)
- Each unique HSN code MUST be a separate row in line_items array
- NEVER combine multiple HSNs in one row
- NEVER use comma-separated, slash-separated, or semicolon-separated HSNs

### RULE 2: CONSIGNEE FOR LC-BACKED SHIPMENTS  
- If LC document is present OR LC Number is mentioned:
  - consignee_name = "To The Order Of [Bank Name]" (LC Issuing/Advising Bank)
  - consignee_address = Bank Address
  - Buyer/Importer → notify_party_name, notify_party_address, notify_party_iec, notify_party_pan
  - Importer MUST NOT appear as consignee

### RULE 3: WEIGHT EXTRACTION (STRICT — PACKING LIST ROW TOTALS)
The Packing List shows TOTAL weight per item row (e.g. "Net Weight (Qty): 2600 KGS", "Gross Weight: 2834 KGS").
These are ALREADY the totals for all packages of that item — do NOT multiply by quantity again.

For each line item:
- net_weight_kg = the "Net Weight" or "Net Weight (Qty)" value from that row in the Packing List (this IS the total)
- gross_weight_kg = the "Gross Weight" value from that row in the Packing List (this IS the total)
- item_net_weight = same as net_weight_kg (already total)
- item_gross_weight = same as gross_weight_kg (already total)
- charged_weight = item_gross_weight

Summary:
- total_packages = Σ(number_of_packages from each line item)
- total_net_weight = Σ(item_net_weight from each line item)
- total_gross_weight = Σ(item_gross_weight from each line item)
- total_charged_weight = total_gross_weight

📋 GOODS TABLE COLUMNS (line_items array):
Each line item must have:
{
  "sr_no": <serial number starting from 1>,
  "item_code": "<product/item code from invoice>",
  "description": "<DETAILED product description including brand name, grade, chemical name, weight per unit/bag e.g. '25 Kgs Each'. Example: 'Silcon™ MICROSILICA GR-92 (SILICON DIOXIDE ANHYDROUS) 25 Kgs Each'>",
  "hsn_code": "<SINGLE HSN code with dots e.g. '2811.22.00' NOT '28112200'. Preserve dots as in original document. If original has no dots, add them in standard HS format: XXXX.XX.XX>",
  "quantity": "<number of units>",
  "unit": "<unit of measurement: ltr, kg, pcs, mtr, nos, etc.>",
  "packing_type": "<cartons/boxes/pallets/etc>",
  "number_of_packages": "<package count for this item>",
  "net_weight_kg": "<TOTAL net weight for this item from Packing List — NOT per-unit>",
  "gross_weight_kg": "<TOTAL gross weight for this item from Packing List — NOT per-unit>",
  "item_net_weight": "<same as net_weight_kg — already the total>",
  "item_gross_weight": "<same as gross_weight_kg — already the total>",
  "charged_weight": "<MUST equal item_gross_weight>",
  "value": "<item value>"
}

📋 SUMMARY (calculated from line_items, not OCR):
{
  "total_packages": "<Σ number_of_packages>",
  "total_net_weight": "<Σ item_net_weight>",
  "total_gross_weight": "<Σ item_gross_weight>",
  "total_charged_weight": "<MUST equal total_gross_weight>",
  "total_value": "<Σ value>"
}

🗺️ FIELD MAPPING:

FROM INVOICE:
- Seller/Exporter → consignor_name, consignor_address, consignor_gstin, consignor_iec, consignor_pan
- Exporter LUT ARN → lut_arn (extract exactly as printed)
- If NO LC: Buyer/Importer → consignee_name, consignee_address, consignee_gstin
- If LC EXISTS: Buyer/Importer → notify_party_name, notify_party_address, notify_party_iec (EXIM Code), notify_party_pan
- Seller location → origin_city (city name), origin_state (state name e.g. "West Bengal"), from_location (full location like "Burdwan, West Bengal")
- Buyer location → destination_city (Nepal destination e.g. "Birgunj, Nepal"), to_location
- border_crossing: The INDIAN border town used for crossing (e.g. "Raxaul", "Jogbani", "Sunauli", "Rupedia"). Extract from customs/shipping docs.
- Invoice number → invoice_number (FULL invoice number with prefix e.g. "MIPL/0069/25-26" NOT just "0069")
- Invoice date → invoice_date (MANDATORY)
- Each line item → line_items array (ONE HSN PER ROW) with item_code, unit
- E-Way Bill → eway_bill_number, eway_bill_date, eway_bill_valid_upto
- Delivery terms → delivery_terms (Ex-Works, FOB, CIF, etc.)

FROM PACKING LIST:
- Package count per item → number_of_packages in line_items
- Gross weight per unit → gross_weight_kg in line_items
- Net weight per unit → net_weight_kg in line_items  
- Packing type → packing_type in line_items

FROM LC:
- LC Number → lc_number
- LC Date → lc_date
- Issuing Bank → lc_issuing_bank, AND use as "To The Order Of [Bank]" for consignee_name
- Issuing Bank Address → consignee_address
- Advising Bank → lc_advising_bank
- Applicant (Buyer) → notify_party_name, notify_party_address
- Applicant EXIM Code → notify_party_iec (from LC or Invoice buyer section)
- Applicant PAN → notify_party_pan (from LC or Invoice buyer section)
- Freight Terms → freight_terms (EXACTLY as stated in LC)

🗺️ CUSTOMS PORT — NEPAL ENTRY POINT (CRITICAL):
The "customs_port" field must be the NEPAL-SIDE customs entry point, NOT the Indian border town.
Use this mapping:
- If document says "Raxaul" (India) → customs_port = "Birgunj Customs Office, Birgunj, Nepal"
- If document says "Jogbani" (India) → customs_port = "Biratnagar Customs Office, Biratnagar, Nepal"
- If document says "Sunauli" (India) → customs_port = "Bhairahawa Customs Office, Bhairahawa, Nepal"
- If document says "Rupaidiha" or "Rupedia" (India) → customs_port = "Nepalgunj Customs Office, Nepalgunj, Nepal"
- If document already mentions a Nepal city (Birgunj, Biratnagar, Bhairahawa, Nepalgunj) → use as-is
- If not mentioned → "Not Mentioned"

FROM E-WAY BILL (HIGHEST PRIORITY for these fields):
- E-Way Bill Number → eway_bill_number (MANDATORY from E-Way Bill document)
- E-Way Bill Date → eway_bill_date
- E-Way Bill Valid Upto → eway_bill_valid_upto
- Vehicle Number → vehicle_number (HIGHEST PRIORITY - use E-Way Bill vehicle number over any other source)
- Mode of Transport → transport_mode (ROAD/RAIL/AIR/SEA)
- Vehicle Type → vehicle_type (Truck, Lorry, Container, Van, Rail Wagon, Air Cargo, Ship)

⚠️ VEHICLE NUMBER PRIORITY (CRITICAL):
1. E-WAY BILL → HIGHEST PRIORITY (most reliable source)
2. Invoice → SECONDARY (sometimes mentioned but less reliable)
3. If conflict between E-Way Bill and Invoice → USE E-WAY BILL value

🚛 TRANSPORTER (STATIC - ALWAYS USE THESE VALUES):
- transporter_name: "I.P. ROADLINES (INDIA) LTD"
- transporter_address: "H.O.: 303, Sharp Bhawan, Azadpur, Commercial Complex, Delhi-110033"
- transporter_gstin: "07AABCI9478C1ZF"

OUTPUT: Return ONLY this JSON structure:
{
  "transporter_name": "",
  "transporter_address": "",
  "transporter_gstin": "",
  "lr_number": "",
  "lr_date": "",
  "issuing_branch": "",
  "consignor_name": "",
  "consignor_address": "",
  "consignor_gstin": "",
  "consignor_iec": "",
  "consignor_pan": "",
  "consignee_name": "",
  "consignee_address": "",
  "consignee_gstin": "",
  "consignee_iec": "",
  "consignee_pan": "",
  "consignee_exim_code": "",
  "notify_party_name": "",
  "notify_party_address": "",
  "notify_party_gstin": "",
  "notify_party_iec": "",
  "notify_party_pan": "",
  "origin_city": "",
  "origin_state": "",
  "destination_city": "",
  "customs_port": "",
  "border_crossing": "",
  "via_location": "",
  "vehicle_number": "",
  "vehicle_type": "",
  "driver_name": "",
  "driver_phone": "",
  "transport_mode": "",
  "line_items": [
    {
      "sr_no": 1,
      "item_code": "",
      "description": "",
      "hsn_code": "",
      "quantity": "",
      "unit": "",
      "packing_type": "",
      "number_of_packages": "",
      "net_weight_kg": "",
      "gross_weight_kg": "",
      "item_net_weight": "",
      "item_gross_weight": "",
      "charged_weight": "",
      "value": ""
    }
  ],
  "summary": {
    "total_packages": "",
    "total_net_weight": "",
    "total_gross_weight": "",
    "total_charged_weight": "",
    "total_value": ""
  },
  "lc_number": "",
  "lc_date": "",
  "lc_issuing_bank": "",
  "lc_advising_bank": "",
  "eway_bill_number": "",
  "eway_bill_date": "",
  "eway_bill_valid_upto": "",
  "lut_arn": "",
  "lut_arn_valid": true,
  "freight_amount": "",
  "freight_terms": "",
  "freight_payment_term": "",
  "billing_party": "",
  "freight_basis": "",
  "invoice_number": "",
  "invoice_date": "",
  "delivery_terms": "",
  "country_of_origin": "India",
  "transporter_signature_present": false,
  "consignor_signature_present": false,
  "from_location": "",
  "to_location": "",
  "freight_type": "",
  "remarks": ""
}`;
function generateBiltyHTML(data: Record<string, any>): string {
  const today = new Date().toLocaleDateString("en-IN");
  const hasLC = Boolean(data.lc_number);
  const lineItems = data.line_items || [];
  const summary = data.summary || {};
  
  // Generate short declaration
  const declarationParts: string[] = [];
  if (data.invoice_number || data.invoice_date) {
    declarationParts.push(`Goods transported as per Proforma Invoice No. ${data.invoice_number || "______"} dated ${data.invoice_date || "______"}.`);
  }
  const hsnCodes = lineItems.length > 0 
    ? lineItems.map((i: any) => i.hsn_code).filter(Boolean).join(", ")
    : data.hsn_code || "";
  if (hsnCodes) {
    declarationParts.push(`Harmonic Code No. ${hsnCodes}.`);
  }
  declarationParts.push(`Country of Origin: ${data.country_of_origin || "India"}.`);
  if (data.origin_city) {
    declarationParts.push(`Delivery Terms: ${data.delivery_terms || "Ex-Works"} ${data.origin_city}, India.`);
  }
  if (data.lc_number) {
    declarationParts.push(`Letter of Credit No. ${data.lc_number} dated ${data.lc_date || "______"}, issued by ${data.lc_issuing_bank || "______"}.`);
  }
  if (data.customs_port) {
    declarationParts.push(`Nepal Customs Entry Point: ${data.customs_port}.`);
  }
  if (data.eway_bill_number) {
    declarationParts.push(`E-Way Bill No. ${data.eway_bill_number}.`);
  }
  const declaration = declarationParts.join(" ");

  // Generate line items rows
  let lineItemsHTML = "";
  if (lineItems.length > 0) {
    lineItemsHTML = lineItems.map((item: any) => `
      <tr>
        <td style="text-align:center">${item.sr_no || ""}</td>
        <td style="text-align:center">${item.item_code || "-"}</td>
        <td>${item.description || "-"}</td>
        <td style="text-align:center">${item.hsn_code || "-"}</td>
        <td style="text-align:right">${item.quantity || "-"}</td>
        <td style="text-align:center">${item.unit || "-"}</td>
        <td style="text-align:center">${item.packing_type || "-"}</td>
        <td style="text-align:right">${item.number_of_packages || "-"}</td>
        <td style="text-align:right">${item.net_weight_kg || "-"}</td>
        <td style="text-align:right">${item.gross_weight_kg || "-"}</td>
        <td style="text-align:right">${item.charged_weight || "-"}</td>
        <td style="text-align:right">${item.value || "-"}</td>
      </tr>
    `).join("");
  } else {
    // Fallback to legacy single-row format
    lineItemsHTML = `
      <tr>
        <td style="text-align:center">1</td>
        <td style="text-align:center">-</td>
        <td>${data.goods_description || "-"}</td>
        <td style="text-align:center">${data.hsn_code || "-"}</td>
        <td style="text-align:right">-</td>
        <td style="text-align:center">-</td>
        <td style="text-align:center">${data.packing_type || data.package_type || "-"}</td>
        <td style="text-align:right">${data.number_of_packages || "-"}</td>
        <td style="text-align:right">${data.net_weight_kg || "-"}</td>
        <td style="text-align:right">${data.gross_weight_kg || data.actual_weight || "-"}</td>
        <td style="text-align:right">${data.charged_weight || data.gross_weight_kg || "-"}</td>
        <td style="text-align:right">${data.declared_value || "-"}</td>
      </tr>
    `;
  }
  
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:11px;line-height:1.4}
.bilty{border:2px solid #000;max-width:900px;margin:auto}
.header{background:#1a365d;color:#fff;padding:12px;text-align:center}
.header h1{margin:0;font-size:16px;letter-spacing:1px}
.header p{margin:4px 0 0;font-size:11px}
.row{display:flex;border-bottom:1px solid #000}
.col{flex:1;padding:8px;border-right:1px solid #000}
.col:last-child{border-right:none}
.col-2{flex:2}
.label{font-weight:bold;font-size:9px;color:#555;text-transform:uppercase;letter-spacing:0.5px}
.value{font-size:12px;margin-top:2px}
.goods-table{width:100%;border-collapse:collapse;margin:0}
.goods-table th{background:#e8e8e8;font-size:9px;padding:6px 4px;text-align:center;border:1px solid #000;font-weight:bold}
.goods-table td{border:1px solid #000;padding:5px 4px;font-size:10px}
.summary-row{background:#f5f5f5;font-weight:bold}
.footer{padding:10px;text-align:center;font-size:9px;color:#666;border-top:1px solid #000}
.sig-box{height:50px;border:1px dashed #999;margin-top:8px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;font-size:10px}
.section-title{background:#d0d0d0;padding:6px 10px;font-weight:bold;font-size:10px;border-bottom:1px solid #000;text-transform:uppercase}
.declaration{background:#fff8dc;padding:10px;border-top:1px solid #000;font-size:10px;line-height:1.5}
.declaration-title{font-weight:bold;font-size:10px;margin-bottom:5px;text-transform:uppercase}
</style></head><body>
<div class="bilty">
  <div class="header">
    <h1>${data.transporter_name || "EXPORT TRANSPORT LR / BILTY"}</h1>
    <p>${data.transporter_address || ""}</p>
    ${data.transporter_gstin ? `<p>GSTIN: ${data.transporter_gstin}</p>` : ""}
  </div>
  
  <div class="row">
    <div class="col"><div class="label">LR Number</div><div class="value">${data.lr_number || "-"}</div></div>
    <div class="col"><div class="label">LR Date</div><div class="value">${data.lr_date || today}</div></div>
    <div class="col"><div class="label">Mode of Transport</div><div class="value">${data.transport_mode || "-"}</div></div>
    <div class="col"><div class="label">Branch</div><div class="value">${data.issuing_branch || "-"}</div></div>
  </div>
  
  <div class="section-title">E-Way Bill Details</div>
  <div class="row">
    <div class="col"><div class="label">E-Way Bill No.</div><div class="value">${data.eway_bill_number || "-"}</div></div>
    <div class="col"><div class="label">E-Way Bill Date</div><div class="value">${data.eway_bill_date || "-"}</div></div>
    <div class="col"><div class="label">Valid Upto</div><div class="value">${data.eway_bill_valid_upto || "-"}</div></div>
  </div>
  
  <div class="row">
    <div class="col">
      <div class="label">Consignor (Exporter)</div>
      <div class="value"><strong>${data.consignor_name || "-"}</strong></div>
      <div class="value">${data.consignor_address || ""}</div>
      <div class="value">GSTIN: ${data.consignor_gstin || "Not Mentioned"}</div>
      <div class="value">IEC: ${data.consignor_iec || "Not Mentioned"}</div>
      <div class="value">PAN: ${data.consignor_pan || "Not Mentioned"}</div>
    </div>
    <div class="col">
      <div class="label">Consignee${hasLC ? " (Bank)" : ""}</div>
      <div class="value"><strong>${data.consignee_name || "-"}</strong></div>
      <div class="value">${data.consignee_address || ""}</div>
      ${!hasLC && data.consignee_gstin ? `<div class="value">GSTIN: ${data.consignee_gstin}</div>` : ""}
      ${!hasLC && data.consignee_iec ? `<div class="value">IEC: ${data.consignee_iec}</div>` : ""}
      ${!hasLC && data.consignee_pan ? `<div class="value">PAN: ${data.consignee_pan}</div>` : ""}
    </div>
  </div>
  
  ${hasLC || data.notify_party_name || data.notify_party_address ? `
  <div class="row">
    <div class="col">
      <div class="label">Notify Party (Importer)</div>
      <div class="value"><strong>${data.notify_party_name || "-"}</strong></div>
      <div class="value">${data.notify_party_address || ""}</div>
      <div class="value">Exim Code: ${data.notify_party_iec || "Not Mentioned"}</div>
      <div class="value">PAN: ${data.notify_party_pan || "Not Mentioned"}</div>
    </div>
  </div>` : ""}
  
  ${hasLC ? `
  <div class="section-title">Letter of Credit Details</div>
  <div class="row">
    <div class="col"><div class="label">LC Number</div><div class="value">${data.lc_number || "-"}</div></div>
    <div class="col"><div class="label">LC Date</div><div class="value">${data.lc_date || "-"}</div></div>
    <div class="col"><div class="label">Issuing Bank</div><div class="value">${data.lc_issuing_bank || "-"}</div></div>
    <div class="col"><div class="label">Advising Bank</div><div class="value">${data.lc_advising_bank || "-"}</div></div>
  </div>` : ""}
  
  <div class="row">
    <div class="col"><div class="label">From</div><div class="value">${data.origin_city || data.from_location || "-"}</div></div>
    <div class="col"><div class="label">To</div><div class="value">${data.destination_city || data.to_location || "-"}</div></div>
    <div class="col"><div class="label">Customs Port</div><div class="value">${data.customs_port || "-"}</div></div>
    <div class="col"><div class="label">Via</div><div class="value">${data.via_location || "-"}</div></div>
  </div>
  
  <div class="row">
    <div class="col"><div class="label">Vehicle Type</div><div class="value">${data.vehicle_type || "-"}</div></div>
    <div class="col"><div class="label">Vehicle No.</div><div class="value">${data.vehicle_number || "-"}</div></div>
    <div class="col"><div class="label">Driver</div><div class="value">${data.driver_name || "-"}</div></div>
    <div class="col"><div class="label">Driver Phone</div><div class="value">${data.driver_phone || "-"}</div></div>
  </div>
  
  <div class="row">
    <div class="col"><div class="label">Invoice No.</div><div class="value">${data.invoice_number || "-"}</div></div>
    <div class="col"><div class="label">Invoice Date</div><div class="value">${data.invoice_date || "-"}</div></div>
    <div class="col"><div class="label">LUT ARN</div><div class="value">${data.lut_arn || "-"}</div></div>
  </div>
  
  <div class="row">
    <div class="col"><div class="label">Delivery Terms</div><div class="value">${data.delivery_terms || "-"}</div></div>
    <div class="col"><div class="label">Freight Terms</div><div class="value">${data.freight_terms || "-"}</div></div>
    <div class="col"><div class="label">Country of Origin</div><div class="value">${data.country_of_origin || "India"}</div></div>
  </div>
  
  <div class="section-title">Goods Details</div>
  <table class="goods-table">
    <tr>
      <th style="width:25px">Sr</th>
      <th style="width:50px">Item Code</th>
      <th>Description of Goods</th>
      <th style="width:65px">HSN Code</th>
      <th style="width:40px">Qty</th>
      <th style="width:35px">Unit</th>
      <th style="width:55px">Packing</th>
      <th style="width:45px">Pkgs</th>
      <th style="width:50px">Net Wt</th>
      <th style="width:50px">Gross Wt</th>
      <th style="width:55px">Charged Wt</th>
      <th style="width:60px">Value</th>
    </tr>
    ${lineItemsHTML}
    <tr class="summary-row">
      <td colspan="7" style="text-align:right">TOTAL:</td>
      <td style="text-align:right">${summary.total_packages || data.number_of_packages || "-"}</td>
      <td style="text-align:right">${summary.total_net_weight || data.net_weight_kg || "-"}</td>
      <td style="text-align:right">${summary.total_gross_weight || data.gross_weight_kg || "-"}</td>
      <td style="text-align:right">${summary.total_charged_weight || data.charged_weight || "-"}</td>
      <td style="text-align:right">${summary.total_value || data.declared_value || "-"}</td>
    </tr>
  </table>
  
  <div class="declaration">
    <div class="declaration-title">Short Description / Declaration</div>
    ${declaration || "Goods transported as per attached invoice and packing list."}
  </div>
  
  <div class="row">
    <div class="col"><div class="label">Freight Amount</div><div class="value">₹${data.freight_amount || "-"}</div></div>
    <div class="col"><div class="label">Payment Terms</div><div class="value">${data.freight_payment_term || data.freight_type || "-"}</div></div>
    <div class="col"><div class="label">Billing Party</div><div class="value">${data.billing_party || "-"}</div></div>
  </div>
  
  <div class="row">
    <div class="col">
      <div class="label">Consignor Signature</div>
      <div class="sig-box">${data.consignor_signature_present ? "✓ Present" : ""}</div>
    </div>
    <div class="col">
      <div class="label">Transporter Signature</div>
      <div class="sig-box">${data.transporter_signature_present ? "✓ Present" : ""}</div>
    </div>
  </div>
  
  <div class="footer">
    Generated on ${today} | ${data.remarks || "This is a computer-generated document"}
  </div>
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documents, generatePdf } = await req.json();

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "No documents provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      console.error("MISTRAL_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured. Set MISTRAL_API_KEY in Supabase secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const byCategory: Record<string, number> = {};
    const hasLC = documents.some(doc => doc.category === "LC");
    for (const doc of documents) {
      const cat = doc.category || "UNKNOWN";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    const categoryInfo = Object.entries(byCategory).map(([cat, count]) => `${cat}: ${count}`).join(", ");
    console.log(`Processing: ${categoryInfo}, Has LC: ${hasLC}`);

    // Check if any documents are images
    const hasImages = documents.some(doc => doc.type === "image");

    const userText = `Extract Bilty/LR data in STRICT COMPLIANCE MODE.
Categories: ${categoryInfo}
${hasLC ? "⚠️ LC DOCUMENT PRESENT - Consignee MUST be Bank, Importer goes to Notify Party!" : ""}
${hasImages ? `⚠️ PHOTO/IMAGE INPUT DETECTED - EXTRA CARE REQUIRED:
- Examine EVERY corner of each image carefully
- Look for PAN, GSTIN, IEC in letterheads, footers, stamps
- Read ALL text including small print and margins
- Tables may be misaligned - trace rows/columns carefully
- Check for handwritten notes or stamps
- Company registration details often in header/footer
` : ""}

CRITICAL REMINDERS:
1. ONE HSN = ONE LINE ITEM - split into separate rows if multiple HSNs
2. charged_weight MUST equal item_gross_weight for each line
3. Summary must be calculated from line items, not OCR extracted
4. If LC exists: Consignee = Bank, Notify Party = Importer
5. Extract ALL IDs: PAN (10 chars), GSTIN (15 chars), IEC (10 digits), LUT ARN
6. Search the ENTIRE document surface for each ID - they may be anywhere

Return ONLY valid JSON.`;

    // Upload PDFs to Mistral Files API and get signed URLs; images sent as base64
    const uploadedFileIds: string[] = [];
    const userContent: any[] = [{ type: "text", text: userText }];

    for (const doc of documents) {
      if (doc.type === "image" && doc.data) {
        const base64Match = doc.data.match(/^data:([^;]+);base64,(.+)$/);
        const mimeType = base64Match?.[1] ?? "image/jpeg";
        const isPdf = mimeType === "application/pdf";

        if (isPdf && base64Match) {
          // Upload PDF to Mistral Files API
          try {
            const binaryStr = atob(base64Match[2]);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

            const formData = new FormData();
            formData.append("purpose", "ocr");
            formData.append("file", new Blob([bytes], { type: "application/pdf" }), doc.name || "document.pdf");

            const uploadRes = await fetch("https://api.mistral.ai/v1/files", {
              method: "POST",
              headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` },
              body: formData,
            });

            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              const fileId = uploadData.id;
              uploadedFileIds.push(fileId);

              // Get signed URL
              const signedRes = await fetch(`https://api.mistral.ai/v1/files/${fileId}/url?expiry=1`, {
                headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` },
              });
              if (signedRes.ok) {
                const signedData = await signedRes.json();
                userContent.push({ type: "document_url", document_url: signedData.url });
              }
            } else {
              console.error("PDF upload failed:", await uploadRes.text());
            }
          } catch (uploadErr) {
            console.error("PDF upload error:", uploadErr);
          }
        } else if (!isPdf) {
          // Send image as base64
          userContent.push({ type: "image_url", image_url: { url: doc.data } });
        }
      } else if (doc.type === "text" && doc.content) {
        userContent.push({ type: "text", text: `\n--- ${doc.category || "Doc"}: ${doc.name} ---\n${doc.content}` });
      }
    }

    const mistralBody = {
      model: "pixtral-12b-2409",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    };

    console.log("Calling Mistral Pixtral API...");
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms (attempt ${attempt + 1})`);
        await new Promise(r => setTimeout(r, delay));
      }
      response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${MISTRAL_API_KEY}` },
        body: JSON.stringify(mistralBody),
      });
      if (response.status !== 429) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text() ?? "No response";
      console.error(`Mistral API error: ${response?.status}`, errorText);
      if (response?.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Mistral API error: ${response?.status} - ${errorText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No AI response content:", JSON.stringify(aiResponse));
      throw new Error("No AI response content");
    }

    console.log("Raw AI response:", content.substring(0, 500));

    // Parse JSON from response
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // Clean up common AI response issues
    jsonStr = jsonStr
      .replace(/^\s*[a-zA-Z_]+\s*$/gm, '')
      .replace(/,\s*,/g, ',')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/}\s*{/g, '},{')
      .trim();

    let extractedData;
    try { 
      extractedData = JSON.parse(jsonStr); 
    } catch (parseError) {
      console.error("Parse error, attempting recovery. Raw:", jsonStr.substring(0, 500));
      const objMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try {
          extractedData = JSON.parse(objMatch[0].replace(/^\s*[a-zA-Z_]+\s*$/gm, ''));
        } catch {
          throw new Error("JSON parse failed after recovery attempt");
        }
      } else {
        throw new Error("JSON parse failed - no valid object found");
      }
    }

    console.log("Parsed data:", {
      line_items: extractedData.line_items?.length || 0,
      consignor_pan: extractedData.consignor_pan,
      consignor_gstin: extractedData.consignor_gstin,
      notify_party_pan: extractedData.notify_party_pan,
      notify_party_iec: extractedData.notify_party_iec,
      consignee_name: extractedData.consignee_name,
    });

    // Default data structure
    const defaultData: Record<string, any> = {
      transporter_name: "", transporter_address: "", transporter_gstin: "",
      lr_number: "", lr_date: "", issuing_branch: "",
      consignor_name: "", consignor_address: "", consignor_gstin: "",
      consignor_iec: "", consignor_pan: "",
      consignee_name: "", consignee_address: "", consignee_gstin: "",
      consignee_iec: "", consignee_pan: "", consignee_exim_code: "",
      notify_party_name: "", notify_party_address: "", notify_party_gstin: "", notify_party_iec: "", notify_party_pan: "",
      origin_city: "", destination_city: "", customs_port: "", via_location: "",
      vehicle_number: "", vehicle_type: "", driver_name: "", driver_phone: "", transport_mode: "ROAD",
      line_items: [],
      summary: { total_packages: "", total_net_weight: "", total_gross_weight: "", total_charged_weight: "", total_value: "" },
      goods_description: "", hsn_code: "", number_of_packages: "", packing_type: "",
      actual_weight: "", charged_weight: "", declared_value: "",
      gross_weight_kg: "", net_weight_kg: "",
      lc_number: "", lc_date: "", lc_issuing_bank: "", lc_advising_bank: "",
      eway_bill_number: "", eway_bill_date: "", eway_bill_valid_upto: "", lut_arn: "", lut_arn_valid: true,
      freight_amount: "", freight_terms: "", freight_payment_term: "", billing_party: "", freight_basis: "",
      invoice_number: "", invoice_date: "",
      delivery_terms: "", country_of_origin: "India",
      transporter_signature_present: false, consignor_signature_present: false,
      from_location: "", to_location: "", package_type: "", freight_type: "", remarks: "",
    };

    const result = { ...defaultData };
    
    // Copy string/boolean fields
    for (const key of Object.keys(defaultData)) {
      if (key === "line_items" || key === "summary") continue;
      if (extractedData[key] !== undefined && extractedData[key] !== null) {
        if (typeof defaultData[key] === "boolean") {
          result[key] = Boolean(extractedData[key]);
        } else {
          result[key] = String(extractedData[key]);
        }
      }
    }

    // Process line items
    if (Array.isArray(extractedData.line_items) && extractedData.line_items.length > 0) {
      result.line_items = extractedData.line_items.map((item: any, idx: number) => {
        // Packing list already provides TOTAL weights per row — do NOT multiply by qty
        const netWt = parseFloat(item.item_net_weight) || parseFloat(item.net_weight_kg) || 0;
        const grossWt = parseFloat(item.item_gross_weight) || parseFloat(item.gross_weight_kg) || 0;
        
        return {
          sr_no: item.sr_no || idx + 1,
          item_code: String(item.item_code || ""),
          description: String(item.description || ""),
          hsn_code: String(item.hsn_code || ""),
          quantity: String(item.quantity || ""),
          unit: String(item.unit || ""),
          packing_type: String(item.packing_type || ""),
          number_of_packages: String(item.number_of_packages || ""),
          net_weight_kg: netWt ? netWt.toFixed(2) : "",
          gross_weight_kg: grossWt ? grossWt.toFixed(2) : "",
          item_net_weight: netWt ? netWt.toFixed(2) : "",
          item_gross_weight: grossWt ? grossWt.toFixed(2) : "",
          charged_weight: grossWt ? grossWt.toFixed(2) : "",
          value: String(item.value || ""),
        };
      });
      
      // Calculate summary from line items
      let totalPackages = 0;
      let totalNetWeight = 0;
      let totalGrossWeight = 0;
      let totalValue = 0;
      
      for (const item of result.line_items) {
        totalPackages += parseFloat(item.number_of_packages) || 0;
        totalNetWeight += parseFloat(item.item_net_weight) || 0;
        totalGrossWeight += parseFloat(item.item_gross_weight) || 0;
        totalValue += parseFloat(item.value) || 0;
      }
      
      result.summary = {
        total_packages: totalPackages ? String(totalPackages) : "",
        total_net_weight: totalNetWeight ? totalNetWeight.toFixed(2) : "",
        total_gross_weight: totalGrossWeight ? totalGrossWeight.toFixed(2) : "",
        total_charged_weight: totalGrossWeight ? totalGrossWeight.toFixed(2) : "", // MUST equal total_gross_weight
        total_value: totalValue ? totalValue.toFixed(2) : "",
      };
      
      // Sync legacy fields from summary
      result.number_of_packages = result.summary.total_packages;
      result.gross_weight_kg = result.summary.total_gross_weight;
      result.net_weight_kg = result.summary.total_net_weight;
      result.charged_weight = result.summary.total_charged_weight;
      result.declared_value = result.summary.total_value;
      result.goods_description = result.line_items.map((i: any) => i.description).filter(Boolean).join("; ");
      result.hsn_code = result.line_items.map((i: any) => i.hsn_code).filter(Boolean).join(", ");
      result.packing_type = result.line_items[0]?.packing_type || "";
      
    } else if (extractedData.summary) {
      // Copy summary if provided
      result.summary = {
        total_packages: String(extractedData.summary.total_packages || ""),
        total_net_weight: String(extractedData.summary.total_net_weight || ""),
        total_gross_weight: String(extractedData.summary.total_gross_weight || ""),
        total_charged_weight: String(extractedData.summary.total_gross_weight || ""), // Force to equal gross
        total_value: String(extractedData.summary.total_value || ""),
      };
    }

    // Sync legacy fields
    if (!result.from_location && result.origin_city) result.from_location = result.origin_city;
    if (!result.to_location && result.destination_city) result.to_location = result.destination_city;
    if (!result.freight_type && result.freight_payment_term) result.freight_type = result.freight_payment_term;

    // CRITICAL: Ensure charged weight = gross weight for legacy fields
    if (result.gross_weight_kg && !result.charged_weight) {
      result.charged_weight = result.gross_weight_kg;
    }
    if (!result.actual_weight && result.gross_weight_kg) {
      result.actual_weight = result.gross_weight_kg;
    }

    // Validate freight terms
    const validFreight = ["TO_PAY", "TO_BE_BILLED", "PAID", "TBB", ""];
    if (!validFreight.includes(result.freight_payment_term)) result.freight_payment_term = "";
    if (!validFreight.includes(result.freight_type)) result.freight_type = "";

    result.transport_mode = "ROAD";
    if (!result.country_of_origin) result.country_of_origin = "India";

    // ========== LUT ARN — PASS THROUGH AS-IS ==========
    const ocrCorrections: string[] = [];
    if (result.lut_arn && typeof result.lut_arn === "string") {
      const arn = result.lut_arn.trim().replace(/\s+/g, "");
      if (!arn || arn.toLowerCase().includes("not mentioned") || arn === "-" || arn === "N/A") {
        result.lut_arn = "";
        result.lut_arn_valid = false;
      } else {
        result.lut_arn = arn;
        result.lut_arn_valid = true;
      }
    } else {
      result.lut_arn = "";
      result.lut_arn_valid = false;
    }

    // ========== WEIGHT VALIDATION (STRICT — PACKING LIST GROSS WT ONLY) ==========
    // Weight must come from summing Gross Wt column of Packing List / line items
    // DO NOT use Net Wt, Charged Wt, Totals row, or Invoice values
    let weightSource = "PACKING_LIST_GROSS_WT";

    if (result.line_items.length > 0) {
      let recalcGross = 0;
      for (const item of result.line_items) {
        recalcGross += parseFloat(item.item_gross_weight) || 0;
      }
      // Always force summary from line items — never trust OCR summary
      result.summary.total_gross_weight = recalcGross ? recalcGross.toFixed(2) : "";
      result.summary.total_charged_weight = result.summary.total_gross_weight; // MUST equal
      result.gross_weight_kg = result.summary.total_gross_weight;
      result.charged_weight = result.summary.total_charged_weight;
      result.actual_weight = result.summary.total_gross_weight;
      
      if (recalcGross < 1 && result.line_items.length > 0) {
        ocrCorrections.push("Weight: suspiciously low total — may be unit weights instead of row totals");
        weightSource = "PACKING_LIST_GROSS_WT_SUSPECT";
      }
    }

    // ========== INVOICE NUMBER VALIDATION ==========
    let invoiceSource = "invoice";
    if (!result.invoice_number || result.invoice_number === "Not Mentioned") {
      invoiceSource = "not_found";
    }
    // OCR cleanup: remove accidental spaces in invoice number
    if (result.invoice_number && typeof result.invoice_number === "string") {
      const cleaned = result.invoice_number.replace(/\s+/g, "");
      if (cleaned !== result.invoice_number) {
        ocrCorrections.push(`Invoice number: removed spaces '${result.invoice_number}' → '${cleaned}'`);
        result.invoice_number = cleaned;
      }
    }

    console.log("Final result - line_items:", result.line_items.length, "summary:", result.summary);

    // Compute extraction confidence (0-100) based on field completeness
    const confidenceFields = [
      result.consignor_name, result.consignor_gstin, result.consignor_iec, result.consignor_pan,
      result.consignee_name, result.origin_city, result.destination_city,
      result.invoice_number, result.invoice_date,
      result.summary?.total_gross_weight, result.summary?.total_value,
      result.hsn_code || (result.line_items.length > 0 ? result.line_items[0]?.hsn_code : ""),
    ];
    const filledCount = confidenceFields.filter(
      (v: any) => v && String(v).trim() !== "" && v !== "Not Mentioned" && v !== "CONFLICT" && v !== "-"
    ).length;
    const extraction_confidence = Math.round((filledCount / confidenceFields.length) * 100);

    // ========== ANALYSIS OUTPUT ==========
    const analysis = {
      invoice_source: invoiceSource,
      lut_source: result.lut_arn ? "invoice" : "not_found",
      lut_arn_valid: result.lut_arn_valid,
      weight_source: weightSource,
      ocr_corrections: ocrCorrections,
      confidence_score: extraction_confidence,
    };

    // Generate PDF HTML if requested
    let pdfHtml = null;
    if (generatePdf) {
      pdfHtml = generateBiltyHTML(result);
    }

    // Clean up uploaded files from Mistral storage
    for (const fileId of uploadedFileIds) {
      fetch(`https://api.mistral.ai/v1/files/${fileId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${MISTRAL_API_KEY}` },
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ data: result, pdfHtml, extraction_confidence, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Extraction error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Extraction failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});