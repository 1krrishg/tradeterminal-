INSERT INTO regulations (authority, corridor, title, summary, source_url, effective_date, tags)
VALUES
  (
    'Nepal Rastra Bank (NRB)',
    'India-Nepal',
    'Letter of Credit Requirement for Imports Exceeding NPR 50,000',
    'All imports from India into Nepal with an invoice value exceeding NPR 50,000 must be settled through a Letter of Credit (LC) opened at a licensed commercial bank in Nepal. Payments outside the LC mechanism for such transactions are non-compliant under NRB Foreign Exchange Management Regulations. Importers must retain LC documentation for a minimum of five years for audit purposes.',
    'https://www.nrb.org.np/forexmgmt/forex-regulations/lc-requirement-imports',
    '2022-07-15',
    ARRAY['LC', 'foreign-exchange', 'imports', 'NRB', 'India-Nepal']
  ),
  (
    'Central Board of Indirect Taxes and Customs (CBIC)',
    'India-Nepal',
    'E-Way Bill Requirement for Cross-Border Road Consignments to Nepal',
    'Goods transported by road from India to Nepal with a taxable value exceeding INR 50,000 require a valid E-Way Bill generated on the GST portal before movement commences. The E-Way Bill must accompany the consignment from the point of origin to the Land Customs Station (LCS) and is verified by customs officers at the border. Failure to carry a valid E-Way Bill attracts penalties under Section 129 of the CGST Act, 2017.',
    'https://www.cbic.gov.in/resources//htdocs-cbec/gst/eway-bill-exports-nepal.pdf',
    '2018-04-01',
    ARRAY['E-way-bill', 'road-transport', 'GST', 'CBIC', 'India-Nepal']
  ),
  (
    'Directorate General of Foreign Trade (DGFT)',
    'India-Nepal',
    'Importer-Exporter Code (IEC) Mandatory for All Export Consignments to Nepal',
    'Every Indian exporter shipping goods to Nepal must possess a valid Importer-Exporter Code (IEC) issued by DGFT before filing a Shipping Bill or Bill of Export at the Land Customs Station. IEC is a 10-digit PAN-based code and must be updated on the DGFT portal whenever there is a change in business particulars. Export consignments without a valid IEC are liable to be detained and the exporter may face penal action under the Foreign Trade (Development and Regulation) Act, 1992.',
    'https://www.dgft.gov.in/CP/iec-requirement-exports',
    '2021-04-01',
    ARRAY['IEC', 'DGFT', 'export-compliance', 'India-Nepal']
  ),
  (
    'Department of Customs, Nepal (DoC Nepal)',
    'India-Nepal',
    'Nepal Customs Duty Rates on Key HSN Chapters (HS 61-62, 84-85)',
    'Nepal levies customs duties ranging from 10% to 40% on garments (HS Chapters 61-62) and 5% to 15% on machinery and electrical equipment (HS Chapters 84-85) imported from India, as per the Nepal Customs Tariff 2079/80. Additionally, a 13% Value Added Tax (VAT) and applicable excise duties apply on top of the customs duty for most categories. Importers must submit a Customs Entry (Bharanpatra) with correct HS classification to avoid mis-declaration penalties.',
    'https://www.customs.gov.np/en/tariff/customs-tariff-2079-80',
    '2023-04-16',
    ARRAY['customs-duty', 'HSN', 'tariff', 'garments', 'machinery', 'India-Nepal']
  ),
  (
    'Nepal Rastra Bank (NRB)',
    'India-Nepal',
    'Foreign Exchange Remittance Rules for Trade Payments to India',
    'Nepali importers must route all trade-related remittances to India through authorized dealer banks and provide supporting documentation including invoice, packing list, and bill of lading or lorry receipt. Advance payment for imports is permissible up to USD 10,000 (or equivalent) without prior NRB approval; amounts above this threshold require prior approval from the NRB Foreign Exchange Management Department. Transactions must be reported in the prescribed format within 15 days of the payment date.',
    'https://www.nrb.org.np/forexmgmt/circulars/forex-remittance-trade-payments-india',
    '2023-01-01',
    ARRAY['remittance', 'foreign-exchange', 'NRB', 'advance-payment', 'India-Nepal']
  ),
  (
    'National Board of Revenue (NBR), Bangladesh',
    'India-Bangladesh',
    'NBR Import Duty Structure for Consumer Goods via Land Customs Stations',
    'Bangladesh levies Customs Duty (CD) of 25%, Regulatory Duty (RD) of 3%-20%, Value Added Tax (VAT) of 15%, and Advance Tax (AT) of 5% on most consumer goods imported from India through land customs stations such as Benapole, Akhaura, and Bhomra. Importers must file a Bill of Entry (B/E) electronically through the ASYCUDA World system and pay duties before release of goods. Misclassification of HS codes is subject to penalty and seizure under the Customs Act, 1969.',
    'https://www.nbr.gov.bd/en/customs-duty-rates-land-port-imports',
    '2023-06-01',
    ARRAY['import-duty', 'VAT', 'NBR', 'land-customs', 'India-Bangladesh']
  ),
  (
    'Bangladesh Customs (NBR)',
    'India-Bangladesh',
    'Land Customs Station (LCS) Procedures at Benapole-Petrapole Border',
    'All commercial imports from India entering through the Benapole LCS must be accompanied by a Commercial Invoice, Packing List, Bill of Lading or Truck Receipt, Certificate of Origin, and Import Registration Certificate (IRC). Goods are subject to physical examination by Bangladesh Customs unless covered by a Risk Management System (RMS) green-channel clearance. Perishable goods and certain industrial raw materials are eligible for priority clearance under the Fast Track lane upon prior intimation to the Superintendent of Customs.',
    'https://www.nbr.gov.bd/en/land-customs/benapole-procedures',
    '2022-03-01',
    ARRAY['LCS', 'Benapole', 'import-documentation', 'customs-clearance', 'India-Bangladesh']
  ),
  (
    'Bangladesh Bank',
    'India-Bangladesh',
    'FEMA-Equivalent Remittance Rules: Foreign Exchange Regulation Act (FERA) Compliance for Trade with India',
    'Bangladeshi importers must open a Letter of Credit (LC) or use Documentary Against Payment (DAP) terms through authorized dealer banks for all import transactions with India exceeding BDT 5 lakh in value, under Bangladesh Bank\'s Foreign Exchange Regulation Act guidelines. All import proceeds must be repatriated and documented within 120 days from the date of shipment. Indian exporters should ensure that export realization is reflected in their Export Data Processing and Monitoring System (EDPMS) account within the stipulated period to remain FEMA-compliant on the Indian side.',
    'https://www.bb.org.bd/en/index.php/regulation/forex/import-remittance-rules',
    '2021-09-01',
    ARRAY['FEMA', 'remittance', 'LC', 'Bangladesh-Bank', 'India-Bangladesh']
  ),
  (
    'Directorate General of Foreign Trade (DGFT)',
    'India-Bangladesh',
    'HS Code Alignment and Export Declaration Requirements for Bangladesh-Bound Shipments',
    'Indian exporters must declare the correct 8-digit HS code on the Shipping Bill filed with Indian Customs, which must align with the Bangladesh Customs Tariff (BCT) HS code to avoid disputes during import clearance at the Bangladeshi LCS. DGFT mandates that the Export Declaration (ED) under FTP 2023 include the correct HS code, quantity, value, and country of final destination. Exporters are advised to obtain a Certificate of Origin (CoO) from the Export Inspection Council (EIC) or FIEO to avail preferential duty benefits under SAFTA.',
    'https://www.dgft.gov.in/CP/export-declaration-hs-code-bangladesh',
    '2023-04-01',
    ARRAY['HS-code', 'export-declaration', 'DGFT', 'SAFTA', 'India-Bangladesh']
  ),
  (
    'Department of Revenue and Customs (DRC), Bhutan',
    'India-Bhutan',
    'DRC Customs Import Procedures at Phuentsholing Integrated Check Post (ICP)',
    'All goods imported into Bhutan from India through the Phuentsholing ICP must be declared using the DRC\'s e-Customs system, and importers must obtain a Trade License issued by the Ministry of Economic Affairs of Bhutan. Commercial imports require a pre-arrival notification filed at least 24 hours before the consignment reaches the ICP. Customs duties, Sales Tax, and Green Tax (where applicable) must be paid through the DRC online payment portal before goods are released.',
    'https://www.drc.gov.bt/customs/import-procedures-phuentsholing',
    '2022-01-01',
    ARRAY['DRC', 'ICP', 'Phuentsholing', 'import-procedures', 'India-Bhutan']
  ),
  (
    'Department of Revenue and Customs (DRC), Bhutan',
    'India-Bhutan',
    'India-Bhutan Trade and Commerce Agreement: Preferential Trade Items and Duty Exemptions',
    'Under the India-Bhutan Trade and Commerce Agreement (renewed 2016), specified goods including agricultural products, handicrafts, and selected manufactured goods traded between the two countries enjoy duty-free or concessional duty treatment. Bhutanese exporters must present a Certificate of Origin issued by the Bhutan Chamber of Commerce and Industry (BCCI) to claim preferential duties in India. Indian exporters can avail of duty-free entry for listed items into Bhutan provided goods meet the Rules of Origin criteria stipulating at least 30% domestic value addition.',
    'https://www.mea.gov.in/bilateral-documents/india-bhutan-trade-commerce-agreement-2016',
    '2016-07-29',
    ARRAY['preferential-trade', 'duty-exemption', 'certificate-of-origin', 'India-Bhutan']
  ),
  (
    'Department of Revenue and Customs (DRC), Bhutan',
    'India-Bhutan',
    'Phuentsholing ICD Rules: Bonded Warehouse and Transit Cargo Procedures',
    'Transit cargo destined for third countries passing through Phuentsholing ICD must be covered by a Transit Declaration and a bank guarantee equivalent to the applicable customs duties, valid until the consignment exits Bhutanese territory. Goods stored in the Phuentsholing bonded warehouse are allowed a maximum dwell time of 30 days, after which demurrage charges apply. All transit movements require a DRC escort from the ICP to the exit point and must be completed within the time specified on the Transit Permit.',
    'https://www.drc.gov.bt/customs/icd-phuentsholing-transit-rules',
    '2020-06-01',
    ARRAY['ICD', 'transit', 'bonded-warehouse', 'Phuentsholing', 'India-Bhutan']
  ),
  (
    'Directorate General of Foreign Trade (DGFT)',
    'General',
    'DGFT Export Declaration Requirements under Foreign Trade Policy 2023',
    'Under the Foreign Trade Policy (FTP) 2023, all Indian exporters are required to file an electronic Shipping Bill or Bill of Export with the correct IEC, HS code, FOB value, quantity, and country of destination before the consignment is handed over to Customs. Exporters of restricted or licensed items must obtain the relevant Export Authorization or License from DGFT prior to export. Non-compliance with export declaration requirements attracts suspension of IEC and penalties under the Foreign Trade (Development and Regulation) Act, 1992.',
    'https://www.dgft.gov.in/CP/ftp2023-export-declaration-requirements',
    '2023-04-01',
    ARRAY['DGFT', 'FTP-2023', 'export-declaration', 'Shipping-Bill', 'general']
  ),
  (
    'Central Board of Indirect Taxes and Customs (CBIC)',
    'General',
    'CBIC Customs Valuation Rules: Transaction Value Method for Cross-Border Trade',
    'Under the Customs Valuation (Determination of Value of Imported Goods) Rules, 2007, the transaction value declared on the commercial invoice is the primary basis for customs duty assessment for goods imported into India. If customs authorities have reason to doubt the declared transaction value (e.g., related-party transactions or significant undervaluation), they may apply alternative valuation methods such as Comparable Transaction Value or Computed Value. Importers must maintain all supporting documentation including invoices, contracts, and bank remittance records for at least five years to facilitate post-clearance audits.',
    'https://www.cbic.gov.in/resources//htdocs-cbec/customs/cs-act/formatted-htmls/customs-valuation-rules-2007.pdf',
    '2007-10-10',
    ARRAY['customs-valuation', 'CBIC', 'transaction-value', 'import-compliance', 'general']
  ),
  (
    'Central Board of Indirect Taxes and Customs (CBIC)',
    'General',
    'GST Zero-Rating for Exports: Refund of Input Tax Credit (ITC) for Cross-Border Supplies',
    'Exports of goods and services from India are treated as zero-rated supplies under Section 16 of the IGST Act, 2017, meaning the exporter pays no GST on the outward supply and is eligible to claim a refund of unutilized Input Tax Credit (ITC) accumulated on inputs used in the exported goods. Exporters may either export under a Letter of Undertaking (LUT) without payment of IGST and claim ITC refund, or export with payment of IGST and claim a refund of the tax paid. Refund applications must be filed electronically on the GST portal within two years from the relevant date of export, with supporting documents including Shipping Bill and GST returns.',
    'https://www.cbic.gov.in/resources//htdocs-cbec/gst/gst-zero-rating-exports-refund.pdf',
    '2017-07-01',
    ARRAY['GST', 'zero-rating', 'ITC-refund', 'LUT', 'exports', 'CBIC', 'general']
  );
