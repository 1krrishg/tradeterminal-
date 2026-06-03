// India border → Nepal customs entry point mapping
const INDIA_TO_NEPAL_CUSTOMS: Record<string, string> = {
  "raxaul": "Birgunj Customs Office, Birgunj, Nepal",
  "jogbani": "Biratnagar Customs Office, Biratnagar, Nepal",
  "sunauli": "Bhairahawa Customs Office, Bhairahawa, Nepal",
  "rupaidiha": "Nepalgunj Customs Office, Nepalgunj, Nepal",
  "rupedia": "Nepalgunj Customs Office, Nepalgunj, Nepal",
};

function resolveNepalCustomsPort(raw: string): string {
  if (!raw) return "Not Mentioned";
  const lower = raw.toLowerCase().trim();
  for (const [indiaKey, nepalPort] of Object.entries(INDIA_TO_NEPAL_CUSTOMS)) {
    if (lower.includes(indiaKey)) return nepalPort;
  }
  return raw; // already a Nepal port or unknown
}

export function generateBiltyHTML(data: Record<string, any>, copyType?: string): string {
  const today = new Date().toLocaleDateString("en-IN");
  const lineItems = data.line_items || [];
  const summary = data.summary || {};
  const copy = copyType || data.copy_type || "ACCOUNTS COPY";

  // --- Derived values ---
  const hsnCodes = lineItems.length > 0
    ? lineItems.map((i: any) => i.hsn_code).filter(Boolean).join(", ")
    : data.hsn_code || "Not Mentioned";

  // Declaration — ALWAYS rendered, every field present
  const invNo = data.invoice_number || "Not Mentioned";
  const invDate = data.invoice_date || "Not Mentioned";
  const country = data.country_of_origin || "India";
  const incoterms = `${data.delivery_terms || "Ex-Works"} ${data.origin_city || ""}`.trim() || "Not Mentioned";
  const lcNo = data.lc_number || "Not Mentioned";
  const lcDate = data.lc_date || "Not Mentioned";
  const lcBank = data.lc_issuing_bank || "Not Mentioned";
  const customsPort = resolveNepalCustomsPort(data.customs_port || "");
  const ewayNo = data.eway_bill_number || "Not Mentioned";
  const ewayDate = data.eway_bill_date || "Not Mentioned";
  const ewayValid = data.eway_bill_valid_upto || "Not Mentioned";

  const declLineHTML = data.declaration_text
    ? data.declaration_text.replace(/\n/g, "<br/>")
    : `<b>As Per Proforma Invoice No.</b> ${invNo} dt:${invDate}&nbsp;&nbsp;&nbsp;<b>Harmonic Code No.</b> ${hsnCodes}&nbsp;&nbsp;&nbsp;<b>Country of Origin:</b> ${country}&nbsp;&nbsp;&nbsp;<b>Incoterms:</b> ${incoterms}&nbsp;&nbsp;&nbsp;<b>L/C No.</b> ${lcNo} dt:${lcDate}, Issued By ${lcBank}&nbsp;&nbsp;&nbsp;<b>Customs Entry Point In Nepal:</b> ${customsPort}&nbsp;&nbsp;&nbsp;<b>E-Way Bill No.</b> ${ewayNo} dt:${ewayDate}, Valid dt:${ewayValid}`;

  // Package rows
  let totalPkgs = 0;
  const pkgRows: { pkgs: string; desc: string }[] = [];
  if (lineItems.length > 0) {
    lineItems.forEach((item: any) => {
      const p = parseInt(item.number_of_packages) || 0;
      totalPkgs += p;
      pkgRows.push({
        pkgs: String(p).padStart(2, "0"),
        desc: `${item.packing_type || "Barrels"}. ${item.description || ""}`,
      });
    });
  } else {
    totalPkgs = parseInt(data.number_of_packages) || 0;
    pkgRows.push({
      pkgs: String(totalPkgs).padStart(2, "0"),
      desc: `${data.packing_type || data.package_type || "Barrels"}. ${data.goods_description || ""}`,
    });
  }

  const netWt = summary.total_net_weight || data.net_weight_kg || "";
  const grossWt = summary.total_gross_weight || data.gross_weight_kg || "";
  const totalValue = summary.total_value || data.declared_value || "";
  const freightAmt = data.freight_amount || "";
  const rowCount = pkgRows.length + 1;

  const hasLC = Boolean(data.lc_number);
  const consigneeName = data.consignee_name || "-";
  const notifyName = data.notify_party_name || "";
  const notifyAddr = data.notify_party_address || "";

  const totalInvoiceValue = totalValue || "________________________";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
@media print{
  @page{size:A4 landscape;margin:4mm;}
  body{margin:0;padding:0;}
}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.4;color:#000;background:#fff;}

.lr{border:2px solid #000;width:297mm;margin:0 auto;display:flex;flex-direction:column;}

/* ===== HEADER ===== */
.hdr{display:flex;align-items:stretch;border-bottom:2px solid #000;}
.hdr-logo{width:60px;display:flex;align-items:center;justify-content:center;border-right:2px solid #000;padding:2px;}
.hdr-logo img{width:50px;height:auto;}
.hdr-center{flex:1;text-align:center;padding:1px 4px;}
.hdr-center .hindi{font-size:8px;line-height:1.1;}
.hdr-center h1{font-size:20px;font-weight:bold;letter-spacing:1px;margin:0;line-height:1.1;font-family:'Times New Roman',serif;color:#c00;}
.hdr-center .addr{font-size:8.5px;line-height:1.2;}
.hdr-gstin{width:190px;border-left:2px solid #000;padding:2px 4px;font-size:8.5px;line-height:1.3;}

/* ===== 4-COLUMN MIDDLE ===== */
.mid{display:flex;border-bottom:2px solid #000;}
.c1{width:18%;border-right:2px solid #000;display:flex;flex-direction:column;}
.c2{width:22%;border-right:2px solid #000;display:flex;flex-direction:column;}
.c3{width:30%;border-right:2px solid #000;display:flex;flex-direction:column;}
.c4{width:30%;display:flex;flex-direction:column;}

/* Shared cell */
.bx{padding:3px 5px;border-bottom:1px solid #000;font-size:10px;line-height:1.4;}
.bx:last-child{border-bottom:none;}

/* IEC */
.iec-box{padding:4px 5px;border-bottom:2px solid #000;font-weight:bold;font-size:11px;}

/* Demurrage */
.dem-title{padding:3px 5px;border-bottom:1px solid #000;font-weight:bold;font-size:10px;text-align:center;text-decoration:underline;}

/* Copy label */
.copy-lbl{font-size:15px;font-weight:bold;text-decoration:underline;padding:6px 4px;text-align:center;border-bottom:2px solid #000;color:#c00;letter-spacing:1px;}

/* Risk */
.risk-lbl{padding:3px 4px;border-bottom:1px solid #000;text-align:center;font-weight:bold;font-size:10px;}

/* Insurance */
.ins-section{padding:3px 5px;font-size:10px;line-height:1.4;border-bottom:1px solid #000;}
.ins-section .ins-title{font-size:14px;font-weight:bold;text-align:center;margin:1px 0 2px 0;text-decoration:underline;}
.ins-section .ins-field{margin:1px 0;}

/* IBA */
.iba-box{padding:3px 5px;font-size:10px;line-height:1.4;text-align:center;}
.iba-box b{font-size:11px;}

/* Notice */
.notice{border:2px solid #cc0000;padding:4px 5px;font-size:9px;text-align:justify;margin:2px;line-height:1.4;}
.notice .nt{font-weight:bold;color:#c00;font-size:10px;text-align:center;margin-bottom:2px;text-decoration:underline;}

/* Caution */
.caution-box{padding:3px 5px;border-bottom:1px solid #000;font-size:10px;line-height:1.4;}
.caution-box b{font-size:10.5px;text-decoration:underline;}

/* CN box */
.cn-box{border:2px solid #000;margin:2px 3px;padding:3px 5px;}
.cn-box .cn-title{font-size:12px;font-weight:bold;text-align:center;margin-bottom:2px;text-decoration:underline;}
.cn-box .cn-row{display:flex;justify-content:space-between;font-size:10px;margin:1px 0;align-items:baseline;}
.cn-box .cn-val{font-weight:bold;font-size:11px;}

/* Route */
.route-box{padding:3px 5px;border-bottom:1px solid #000;font-size:10px;line-height:1.4;}
.route-box b{font-size:11px;}
.route-box .br-code{text-align:right;font-size:8px;}

/* ===== PARTY ROWS ===== */
.parties{border-bottom:2px solid #000;}
.pr{padding:4px 6px;font-size:10px;line-height:1.4;border-bottom:1px solid #000;}
.pr:last-child{border-bottom:none;}
.pr b{font-size:10.5px;}

/* ===== GOODS ZONE ===== */
.goods-zone{border-bottom:1px solid #000;}

.goods-main{flex:1;display:flex;flex-direction:column;}
.goods-wrap{display:flex;flex:1;}
.gt-left{flex:1;}
.gt-right{width:150px;border-left:2px solid #000;display:flex;flex-direction:column;}
table.gt{width:100%;border-collapse:collapse;}
table.gt th,table.gt td{border:1px solid #000;padding:2px 4px;font-size:9.5px;vertical-align:top;}
table.gt th{background:#e8e8e8;font-weight:bold;text-align:center;font-size:9px;}
.gt .c-pkg{width:70px;}
.gt .c-desc{min-width:160px;}
.gt .c-wt{width:55px;}
.gt .c-rate{width:52px;}
.gt .c-rs{width:42px;text-align:right;}
.gt .c-p{width:26px;text-align:right;}

/* Right info cells */
.ri{padding:3px 5px;border-bottom:1px solid #000;font-size:9.5px;line-height:1.4;}
.ri:last-child{border-bottom:none;}
.ri b{font-size:10px;}

/* Declaration */
.decl{border-top:1px solid #000;padding:4px 6px;font-size:9px;line-height:1.5;}

/* ===== VALUE + SIGNATURE ===== */
.valsig{display:flex;border-bottom:1px solid #000;}
.val-left{padding:6px 8px;font-size:10px;border-right:2px solid #000;white-space:nowrap;}
.val-mid{flex:1;padding:4px 8px;font-size:9px;text-align:center;}
.val-right{width:150px;border-left:2px solid #000;padding:3px;font-size:8px;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;}
.sig-space{height:22px;}

.footer{padding:1px;text-align:center;font-size:5.5px;color:#999;}
</style></head><body>
<div class="lr">

<!-- ===== HEADER ===== -->
<div class="hdr">
  <div class="hdr-logo"><img src="/ipr-logo.png" alt="IPR Logo"/></div>
  <div class="hdr-center">
    <div class="hindi">" जय श्री श्याम"</div>
    <h1>${data.transporter_name || "I.P. ROADLINES (INDIA) LTD"}</h1>
    <div class="addr">${data.transporter_address || "H.O.: 303, Sharp Bhawan, Azadpur, Commercial Complex, Delhi-110033"}</div>
    <div class="addr">${data.transporter_phone ? "Ph.: " + data.transporter_phone : "Ph. : 47094000, 47421000"}&nbsp;&nbsp;&nbsp;${data.transporter_email ? "E-mail : " + data.transporter_email : "E-mail : iprdelhi07@gmail.com"}</div>
  </div>
  <div class="hdr-gstin">
    <div style="font-weight:bold;font-size:10.5px;margin-bottom:2px;">GSTIN : 07AABCI9478C1ZF</div>
    <div style="font-size:8px;">Address of Issuing Office or<br/>Name and Address of Agent</div>
    <div style="margin-top:2px;font-size:8.5px;"><b>I.P. ROADLINES (INDIA) LTD.</b><br/>P-17, New C.I.T Road<br/>Kolkata-73</div>
  </div>
</div>

<!-- ===== 4-COLUMN MIDDLE ===== -->
<div class="mid">

  <!-- COL 1: IEC / Demurrage / NOTICE -->
  <div class="c1">
    <div class="iec-box">IEC NUMBER : ${data.consignor_iec || data.iec_number || "AABCI9478C"}</div>
    <div class="dem-title">SCHEDULE OF DEMURRAGE CHARGES</div>
    <div class="bx">Demurrage Chargeable after ________ days from today @ ₹ ________ per day per Qtl. on weight charged.</div>
    <div class="bx" style="border-bottom:none;padding:2px;">
      <div class="notice">
        <div class="nt">NOTICE</div>
        The Consignment covered by this Lorry Receipt shall be stored at the destination under the control of the Transport Operator and shall be delivered to or to the order of the Consignee Bank whose name is mentioned in the Lorry Receipt. It will under no circumstances be delivered to anyone without the written authority from the Consignee Bank or its order, endorsed on the Consignee Copy.
      </div>
    </div>
  </div>

  <!-- COL 2: Copy Label / Risk / Insurance / IBA -->
  <div class="c2">
    <div class="copy-lbl">${copy}</div>
    <div class="risk-lbl">AT CARRIER'S RISK / OWNERS RISK</div>
    <div class="ins-section">
      <div class="ins-title">INSURANCE</div>
      <div>The consignor has stated that :</div>
      <div>He has insured the consignment</div>
      <div class="ins-field">Company ________________________</div>
      <div class="ins-field">Policy No. __________ Date __________</div>
      <div class="ins-field">Amount __________ Risk __________</div>
      <div class="ins-field"><b>Code Number</b> ________________________</div>
    </div>
    <div class="iba-box">
      <b>IBA CODE NO. DLI - 2574</b><br/>
      VALID UPTO 30.04.2028
    </div>
  </div>

  <!-- COL 3: Caution / Delivery / CN / From-To -->
  <div class="c3">
    <div class="caution-box">
      <b>Caution</b><br/>
      This consignment will not be detained, diverted, re-routed or re-booked without Consignee Bank's written permission.
    </div>
    <div class="bx">Will be delivered at the destination</div>
    <div class="bx">
      Address of Delivery Office : ${data.delivery_office_address || "________________________"}<br/>
      State : ${data.delivery_state || "________"}&nbsp;&nbsp;&nbsp;Tel. No.: ${data.delivery_tel || "________"}
    </div>
    <div class="bx" style="padding:0;border-bottom:1px solid #000;">
      <div class="cn-box">
        <div class="cn-title">CONSIGNMENT NOTE</div>
        <div class="cn-row"><span>No. : &nbsp;&nbsp;011</span> <span class="cn-val">${data.lr_number || data.consignment_note_number || ""}</span></div>
        <div class="cn-row"><span>Date :</span> <span class="cn-val">${data.lr_date || today}</span></div>
      </div>
    </div>
    <div class="route-box">
      From <b>${data.from_location || data.origin_city || "________"}${data.origin_state ? ", " + data.origin_state : ""}, India</b>
      <div class="br-code">Br. Code: ${data.branch_code || "________"}</div>
    </div>
    <div class="route-box" style="border-bottom:none;">
      To <b>${data.destination_city || data.to_location || "________"}${data.border_crossing ? " (Via " + data.border_crossing + ")" : ""}</b>
      <div class="br-code">Br. Code: ________</div>
    </div>
  </div>

  <!-- COL 4: Truck / Additional Info -->
  <div class="c4">
    <div class="bx" style="font-size:9.5px;">Truck No. <b style="font-size:10.5px;">${data.vehicle_number || "________________________"}</b></div>
    <div class="bx" style="border-bottom:none;">
      <b style="text-decoration:underline;font-size:9.5px;">Additional Information</b><br/>
      Private Marks : ${data.private_marks || "________________________"}
    </div>
  </div>

</div>

<!-- ===== PARTY DETAILS (full width) ===== -->
<div class="parties">
  <div class="pr">
    <b>Consignor's Name and Address</b> &nbsp;&nbsp;
    <b>${data.consignor_name || ""}</b> ${data.consignor_address || "________________________"}
  </div>
  <div class="pr">
    <b>Consignee Bank's Name and Address</b> &nbsp;&nbsp;
    ${hasLC ? `To The Order Of <b>${consigneeName}</b>` : (consigneeName || "")} ${data.consignee_address || "________________________"}
    ${notifyName ? `<br/>Notify Applicant: <b>${notifyName}</b>, ${notifyAddr}` : ""}
    ${data.notify_party_pan ? `<br/>PAN No. <b>${data.notify_party_pan}</b>&nbsp;&nbsp;&nbsp;` : ""}${data.notify_party_iec ? `Exim Code No. <b>${data.notify_party_iec}</b>` : ""}
  </div>
</div>

<!-- ===== GOODS TABLE ===== -->
<div class="goods-zone">
  <div class="goods-main">
    <div class="goods-wrap">
      <div class="gt-left">
        <table class="gt">
          <thead>
            <tr>
              <th rowspan="2" class="c-pkg">Packages</th>
              <th rowspan="2" class="c-desc">Description : Particular furnished by Shipper -<br/>Not Checked by Carrier (Said to contain)</th>
              <th colspan="2">Weight</th>
              <th rowspan="2" class="c-rate">Rate</th>
              <th colspan="2">Amount To Pay/Paid</th>
            </tr>
            <tr>
              <th class="c-wt">Actual</th>
              <th class="c-wt">Charged</th>
              <th class="c-rs">Rs.</th>
              <th class="c-p">P.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="c-pkg">${pkgRows[0]?.pkgs || ""} ${pkgRows[0]?.desc || ""}</td>
              <td rowspan="${rowCount + 1}" class="c-desc" style="vertical-align:top;padding:2px 3px;font-size:8.5px;">
                ${lineItems.length > 0
                  ? lineItems.map((item: any) => item.description || "").filter(Boolean).join("<br/>")
                  : data.goods_description || ""}
              </td>
              <td rowspan="${rowCount + 1}" class="c-wt" style="vertical-align:top;padding:2px 3px;font-size:8.5px;">
                Nett. Weight<br/><br/>
                <b>${netWt ? netWt + " Kgs" : ""}</b><br/><br/>
                Gross. Weight<br/><br/>
                <b>${grossWt ? grossWt + " Kgs" : ""}</b>
              </td>
              <td rowspan="${rowCount + 1}" class="c-wt" style="vertical-align:top;padding:2px 3px;font-size:8.5px;">
                <b>${data.freight_terms || ""}</b>
              </td>
              <td rowspan="${rowCount + 1}" class="c-rate" style="vertical-align:top;padding:2px 3px;font-size:8.5px;line-height:1.5;">
                Freight<br/>
                Mazdoor Charges<br/>
                Risk Charges<br/>
                ST Charges<br/>
                SGST<br/>
                CGST<br/>
                IGST<br/>
                Any Other Charges<br/><br/>
                <b>TOTAL</b>
              </td>
              <td rowspan="${rowCount + 1}" class="c-rs" style="vertical-align:top;padding:2px 4px;font-size:9.5px;line-height:1.5;">
                &nbsp;<br/>&nbsp;<br/>&nbsp;<br/>&nbsp;<br/>&nbsp;<br/>&nbsp;<br/>&nbsp;<br/>&nbsp;<br/><br/>&nbsp;
              </td>
              <td rowspan="${rowCount + 1}" class="c-p">&nbsp;</td>
            </tr>
            ${pkgRows.slice(1).map((r) => `<tr><td class="c-pkg">${r.pkgs} ${r.desc}</td></tr>`).join("\n            ")}
            <tr>
              <td class="c-pkg"><b>${totalPkgs} ${lineItems[0]?.packing_type || data.packing_type || "Barrels"}.</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- RIGHT INFO COLUMN -->
      <div class="gt-right">
        <div class="ri"><b>Classification of Goods :</b><br/>${data.goods_classification || lineItems.map((i: any) => i.hsn_code).filter(Boolean).join(", ") || ""}</div>
        <div class="ri"><b>Method of Packing :</b><br/>${data.method_of_packing || lineItems[0]?.packing_type || data.packing_type || ""}</div>
        <div class="ri"><b>Invoice No. :</b> ${data.invoice_number || ""}<br/>DT: ${data.invoice_date || "  /  /"}</div>
        <div class="ri"><b>IEC Code :</b> ${data.consignor_iec || data.iec_number || "________________________"}</div>
        <div class="ri"><b>License No. of Transport Operator</b><br/>${data.transport_license || "________________________"}</div>
        <div class="ri"><b>GSTIN/ Unique ID Reg. No. of<br/>Person liable to pay</b><br/>${data.consignor_gstin || "________________________"}</div>
        <div class="ri" style="border-bottom:none;line-height:1.5;">
          ☐ Consignor :<br/>
          ☐ Consignee :<br/>
          ☐ Transporter :
        </div>
      </div>
    </div>
    <!-- Declaration line -->
    <div class="decl">
      ${declLineHTML}
    </div>
  </div>
</div>

<!-- ===== VALUE + SIGNATURE ===== -->
<div class="valsig">
  <div class="val-left">
    Value &nbsp;&nbsp;<b>INR. ${totalInvoiceValue}</b>
  </div>
  <div class="val-mid">
    Signature of the Transport Operator ________________
    <div class="sig-space"></div>
    For <b>I.P. ROADLINES (INDIA) LTD.</b><br/>
    As Carriers
  </div>
  <div class="val-right">&nbsp;</div>
</div>

<div class="footer">Generated on ${today} | ${data.remarks || "Computer-generated Lorry Receipt"}</div>

</div>
</body></html>`;
}
