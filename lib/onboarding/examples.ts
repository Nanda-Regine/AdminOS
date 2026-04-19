export const BUSINESS_TYPES = [
  'Cleaning Services',
  'Carpentry & Joinery',
  'Legal Services',
  'Healthcare / Medical Practice',
  'Education / School',
  'Retail',
  'Construction',
  'Consulting',
  'Logistics & Transport',
  'NGO / Non-profit',
  'Accounting & Finance',
  'Property & Real Estate',
  'Other',
] as const

export type BusinessType = (typeof BUSINESS_TYPES)[number]

interface BusinessExample {
  invoice_example: string
  invoice_amount: string
  faq_examples: Array<{ question: string; answer: string }>
  staff_role_example: string
  document_example: string
}

export const BUSINESS_EXAMPLES: Record<string, BusinessExample> = {
  'Cleaning Services': {
    invoice_example: 'Office cleaning — Greenfield Holdings (March)',
    invoice_amount: '3500',
    faq_examples: [
      {
        question: 'What areas do you cover?',
        answer:
          'We cover Johannesburg, Sandton, Midrand, and Centurion. We can travel further for regular contracts. Call us for a quote.',
      },
      {
        question: 'Do you supply your own equipment and products?',
        answer:
          'Yes, we bring all our own equipment and eco-friendly cleaning products. You just need to let us in!',
      },
      {
        question: 'How do I book a regular weekly slot?',
        answer:
          'Reply with your preferred day and time and we will lock it in. We offer Monday–Saturday, 7am–5pm.',
      },
    ],
    staff_role_example: 'Lead Cleaner',
    document_example: 'Service contract or SOW',
  },
  'Carpentry & Joinery': {
    invoice_example: 'Custom kitchen cabinets — Khumalo residence',
    invoice_amount: '28000',
    faq_examples: [
      {
        question: 'How long does a custom kitchen take?',
        answer:
          'A full custom kitchen typically takes 3–6 weeks from deposit to installation, depending on complexity. We will give you a detailed timeline after your free quote.',
      },
      {
        question: 'Do you do repairs or only custom work?',
        answer:
          'We do both. Repairs start from R800. Custom work starts from R5,000. WhatsApp us a photo for a quick quote.',
      },
      {
        question: 'What areas do you install in?',
        answer:
          'We are based in Johannesburg but travel across Gauteng. Travel fee applies for areas more than 50km from our workshop.',
      },
    ],
    staff_role_example: 'Workshop Lead',
    document_example: 'Quotation or project scope',
  },
  'Legal Services': {
    invoice_example: 'Conveyancing services — Nkosi property transfer',
    invoice_amount: '12500',
    faq_examples: [
      {
        question: 'Do you offer a free initial consultation?',
        answer:
          'Yes, we offer a free 30-minute consultation for new clients. Book via WhatsApp or our website.',
      },
      {
        question: 'How long does a property transfer take?',
        answer:
          'A standard property transfer takes 6–12 weeks from date of signing. We keep you updated at every milestone.',
      },
      {
        question: 'What documents do I need to bring?',
        answer:
          'Please bring your ID, proof of address (not older than 3 months), and any relevant contracts or agreements. We will advise on additional documents at your consultation.',
      },
    ],
    staff_role_example: 'Paralegal',
    document_example: 'Client retainer agreement',
  },
  'Healthcare / Medical Practice': {
    invoice_example: 'Consultation & treatment — Patient Mokoena',
    invoice_amount: '950',
    faq_examples: [
      {
        question: 'Do you accept medical aid?',
        answer:
          'We accept most major medical aids including Discovery, Bonitas, Medihelp, and Momentum. For cash patients, we offer affordable consultation packages.',
      },
      {
        question: 'How do I book an appointment?',
        answer:
          'Reply with your preferred date and time and we will confirm availability. Walk-ins are welcome but appointments get priority.',
      },
      {
        question: 'What are your consultation hours?',
        answer:
          'Monday to Friday 8am–5pm, Saturday 8am–12pm. We offer telehealth appointments outside these hours for existing patients.',
      },
    ],
    staff_role_example: 'Practice Nurse',
    document_example: 'Patient intake form or referral letter',
  },
  'Education / School': {
    invoice_example: 'Term 2 school fees — Dlamini family',
    invoice_amount: '4800',
    faq_examples: [
      {
        question: 'What is the admissions process?',
        answer:
          'Send us your child\'s birth certificate, previous school report, and immunisation records via WhatsApp. We will schedule a placement assessment within 5 school days.',
      },
      {
        question: 'Do you offer after-school care?',
        answer:
          'Yes, our after-school programme runs until 5pm weekdays. It includes supervised homework time, a snack, and supervised play.',
      },
      {
        question: 'What is the fee payment policy?',
        answer:
          'Fees are due by the 7th of each month. We accept EFT, credit card, and PayFast. Payment plans are available — please speak to our finance office.',
      },
    ],
    staff_role_example: 'Class Teacher',
    document_example: 'Enrolment form or report card',
  },
  Retail: {
    invoice_example: 'Bulk order — Ngwenya Spaza Shop',
    invoice_amount: '6200',
    faq_examples: [
      {
        question: 'Do you offer delivery?',
        answer:
          'Yes! We offer same-day delivery within 15km for orders over R500. Delivery is R80 for smaller orders.',
      },
      {
        question: 'Can I return or exchange items?',
        answer:
          'Yes, within 14 days with proof of purchase. Items must be unused and in original packaging. Perishables cannot be returned.',
      },
      {
        question: 'Do you offer bulk discounts?',
        answer:
          'Absolutely. Orders over R2,000 get 10% off, over R5,000 get 15% off. WhatsApp us your list for a custom quote.',
      },
    ],
    staff_role_example: 'Store Assistant',
    document_example: 'Purchase order or supplier invoice',
  },
  Construction: {
    invoice_example: 'Phase 1 payment — Molefe site extension',
    invoice_amount: '85000',
    faq_examples: [
      {
        question: 'Do you handle permits and approvals?',
        answer:
          'Yes, we manage all NHBRC registration, municipal plan approvals, and council inspections as part of our full-build service.',
      },
      {
        question: 'How long does a house extension take?',
        answer:
          'A typical room addition takes 6–10 weeks from approved plans to completion. We give you a week-by-week schedule at project kickoff.',
      },
      {
        question: 'What is included in your quote?',
        answer:
          'Our quotes include all materials, labour, and project management. We only exclude electrical and plumbing if you have existing contractors for those.',
      },
    ],
    staff_role_example: 'Site Foreman',
    document_example: 'Building contract or BOQ',
  },
  Consulting: {
    invoice_example: 'Strategy workshop delivery — Masedi Holdings',
    invoice_amount: '18000',
    faq_examples: [
      {
        question: 'What industries do you specialise in?',
        answer:
          'We specialise in financial services, retail, and public sector. We have 12+ years of experience delivering results in South African businesses.',
      },
      {
        question: 'How do you charge — retainer or project?',
        answer:
          'We offer both. Retainer arrangements start at R8,500/month. Project-based work is quoted per scope. Book a free discovery call to discuss.',
      },
      {
        question: 'How quickly can you start?',
        answer:
          'We can usually start within 2 weeks of signed agreement. Urgent engagements can sometimes begin sooner.',
      },
    ],
    staff_role_example: 'Senior Consultant',
    document_example: 'Proposal or SOW',
  },
  'Logistics & Transport': {
    invoice_example: 'Monthly delivery contract — Picks n Pay warehouse',
    invoice_amount: '42000',
    faq_examples: [
      {
        question: 'What areas do you cover?',
        answer:
          'We operate nationally with depots in Johannesburg, Cape Town, and Durban. Same-day delivery available within city limits for loads under 5 tons.',
      },
      {
        question: 'Do you provide tracking?',
        answer:
          'Yes, every shipment gets a live tracking link via WhatsApp as soon as it is collected. You can share this with your customers.',
      },
      {
        question: 'Can you handle refrigerated goods?',
        answer:
          'Yes, we have temperature-controlled vehicles for pharmaceuticals, food, and other cold-chain requirements. Quote available on request.',
      },
    ],
    staff_role_example: 'Driver',
    document_example: 'Waybill or delivery contract',
  },
  'NGO / Non-profit': {
    invoice_example: 'Grant disbursement — Q2 programme budget',
    invoice_amount: '75000',
    faq_examples: [
      {
        question: 'How do I apply for your programme?',
        answer:
          'Applications open quarterly. Send your ID, motivation letter, and supporting documents via WhatsApp. We will confirm receipt and guide you through the next steps.',
      },
      {
        question: 'Are your services free?',
        answer:
          'Yes, all our direct beneficiary services are free. We are funded through grants and partnerships. Donations are welcome to help us reach more people.',
      },
      {
        question: 'How can businesses partner with you?',
        answer:
          'We welcome corporate partnerships — learnerships, skills development, BBBEE partnerships, and in-kind donations. Email us to discuss.',
      },
    ],
    staff_role_example: 'Programme Coordinator',
    document_example: 'Grant agreement or M&E report',
  },
  'Accounting & Finance': {
    invoice_example: 'Monthly bookkeeping — Zulu Traders CC',
    invoice_amount: '3800',
    faq_examples: [
      {
        question: 'Do you do SARS submissions?',
        answer:
          'Yes — VAT returns, provisional tax, income tax, and company registrations. We are registered tax practitioners.',
      },
      {
        question: 'What do you charge for monthly bookkeeping?',
        answer:
          'Our monthly packages start from R1,500 for sole proprietors up to R8,500 for medium-sized businesses. Fixed monthly fee — no surprises.',
      },
      {
        question: 'Can you help me register a company?',
        answer:
          'Yes, CIPC company registration starts from R650 all-in, including tax number and VAT registration if needed. Usually done within 5 business days.',
      },
    ],
    staff_role_example: 'Bookkeeper',
    document_example: 'Financial statement or tax return',
  },
  'Property & Real Estate': {
    invoice_example: 'Commission — Mthembu property sale',
    invoice_amount: '45000',
    faq_examples: [
      {
        question: 'What is your commission rate?',
        answer:
          'Our standard commission is 5–7.5% depending on property value. This is fully negotiable — let\'s chat about your situation.',
      },
      {
        question: 'How long does it take to sell a property?',
        answer:
          'On average, properties sell within 6–12 weeks with us. Premium properties sometimes sell faster. We use professional photography, video, and digital marketing on every listing.',
      },
      {
        question: 'Do you do rentals too?',
        answer:
          'Yes — we manage both short and long-term rentals. Our property management service includes tenant vetting, lease management, and monthly statements.',
      },
    ],
    staff_role_example: 'Property Agent',
    document_example: 'Offer to purchase or lease agreement',
  },
  Other: {
    invoice_example: 'Services rendered — Client project',
    invoice_amount: '5000',
    faq_examples: [
      {
        question: 'What services do you offer?',
        answer: 'We offer a range of professional services tailored to your needs. Contact us to discuss your requirements.',
      },
      {
        question: 'How do I get a quote?',
        answer: 'Send us a message with your requirements and we will get back to you with a detailed quote within 24 hours.',
      },
      {
        question: 'What are your payment terms?',
        answer: 'We require a 50% deposit to start, with the balance due on completion. We accept EFT and all major payment methods.',
      },
    ],
    staff_role_example: 'Team Member',
    document_example: 'Contract or agreement',
  },
}

export function getExamples(businessType: string): BusinessExample {
  return BUSINESS_EXAMPLES[businessType] ?? BUSINESS_EXAMPLES['Other']
}
