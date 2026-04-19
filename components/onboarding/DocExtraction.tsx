'use client'

import { useEffect, useState } from 'react'

interface ExtractedField {
  label: string
  value: string
  color: string
}

interface DocExtractionProps {
  docType: string
  businessType: string
}

const FIELD_SETS: Record<string, ExtractedField[]> = {
  'Service contract or SOW': [
    { label: 'Client Name', value: 'Greenfield Holdings', color: '#1565C0' },
    { label: 'Service', value: 'Office Cleaning', color: '#2E7D32' },
    { label: 'Start Date', value: '01 May 2026', color: '#6A1B9A' },
    { label: 'Monthly Value', value: 'R 3,500', color: '#BF360C' },
    { label: 'Notice Period', value: '30 days', color: '#00695C' },
  ],
  'Quotation or project scope': [
    { label: 'Project', value: 'Custom Kitchen', color: '#1565C0' },
    { label: 'Client', value: 'Khumalo Residence', color: '#2E7D32' },
    { label: 'Total', value: 'R 28,000', color: '#BF360C' },
    { label: 'Deposit', value: '50% upfront', color: '#6A1B9A' },
    { label: 'Timeline', value: '6 weeks', color: '#00695C' },
  ],
  'Client retainer agreement': [
    { label: 'Client', value: 'Nkosi & Associates', color: '#1565C0' },
    { label: 'Matter', value: 'Property Transfer', color: '#2E7D32' },
    { label: 'Monthly Retainer', value: 'R 8,500', color: '#BF360C' },
    { label: 'Signed Date', value: '15 April 2026', color: '#6A1B9A' },
    { label: 'Jurisdiction', value: 'Gauteng', color: '#00695C' },
  ],
  'Patient intake form or referral letter': [
    { label: 'Patient', value: 'T. Mokoena', color: '#1565C0' },
    { label: 'Medical Aid', value: 'Discovery Health', color: '#2E7D32' },
    { label: 'Date of Birth', value: '12 Jun 1985', color: '#6A1B9A' },
    { label: 'Allergies', value: 'Penicillin', color: '#BF360C' },
    { label: 'Referred By', value: 'Dr. Sithole', color: '#00695C' },
  ],
  'Building contract or BOQ': [
    { label: 'Project', value: 'Room Extension', color: '#1565C0' },
    { label: 'Client', value: 'Molefe Family', color: '#2E7D32' },
    { label: 'Contract Value', value: 'R 85,000', color: '#BF360C' },
    { label: 'Start Date', value: '01 May 2026', color: '#6A1B9A' },
    { label: 'Completion', value: '10 Jul 2026', color: '#00695C' },
  ],
  default: [
    { label: 'Document Type', value: 'Business Contract', color: '#1565C0' },
    { label: 'Party A', value: 'Your Business', color: '#2E7D32' },
    { label: 'Value', value: 'R 5,000', color: '#BF360C' },
    { label: 'Date', value: 'April 2026', color: '#6A1B9A' },
    { label: 'Status', value: 'Active', color: '#00695C' },
  ],
}

export function DocExtraction({ docType }: DocExtractionProps) {
  const [visible, setVisible] = useState(false)
  const [shownFields, setShownFields] = useState(0)

  const fields = FIELD_SETS[docType] ?? FIELD_SETS.default

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    fields.forEach((_, i) => {
      setTimeout(() => setShownFields(i + 1), 300 + i * 200)
    })
  }, [visible, fields.length]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
    >
      <div
        className="mx-auto rounded-2xl overflow-hidden shadow-xl p-4"
        style={{ maxWidth: 340, background: '#fff', border: '2px solid #E8E0C8' }}
      >
        {/* Doc header */}
        <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid #E8E0C8' }}>
          <div
            className="rounded-xl flex items-center justify-center text-2xl"
            style={{ width: 48, height: 48, background: '#F5EFD6', flexShrink: 0 }}
          >
            📄
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: '#0A0F2C' }}>{docType}</div>
            <div className="text-xs" style={{ color: '#6B7280' }}>Doc — extracted fields</div>
          </div>
        </div>

        {/* Extracted fields */}
        <div className="flex flex-wrap gap-2">
          {fields.map((field, i) => {
            if (i >= shownFields) return null
            return (
              <div
                key={i}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background: field.color + '18',
                  border: `1.5px solid ${field.color}40`,
                  color: field.color,
                  animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                }}
              >
                <span className="opacity-60">{field.label}: </span>
                <span className="font-semibold">{field.value}</span>
              </div>
            )
          })}
        </div>

        {shownFields >= fields.length && (
          <div
            className="mt-3 text-xs text-center py-2 rounded-lg"
            style={{
              background: '#E8F5E9',
              color: '#2E7D32',
              animation: 'fadeUp 0.4s ease',
            }}
          >
            ✅ Doc classified & saved to your document library
          </div>
        )}
      </div>

      <style>{`
        @keyframes popIn { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  )
}
