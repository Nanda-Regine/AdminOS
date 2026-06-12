-- Phase 3.4 — Foundation Level Academy Content
-- 6 modules × 5 lessons = 30 lessons
-- Uses fixed UUIDs so triggers can reference lesson IDs

-- ─── Module UUIDs ────────────────────────────────────────────────────────────
-- M1: a0000001-0000-0000-0000-000000000001  (Your Business Identity)
-- M2: a0000001-0000-0000-0000-000000000002  (Money That Makes Sense)
-- M3: a0000001-0000-0000-0000-000000000003  (Your First Customer)
-- M4: a0000001-0000-0000-0000-000000000004  (Tax for Beginners)
-- M5: a0000001-0000-0000-0000-000000000005  (Your First Employee)
-- M6: a0000001-0000-0000-0000-000000000006  (Protecting What You Built)

-- ─── Modules ─────────────────────────────────────────────────────────────────

INSERT INTO academy_modules (id, level, module_number, title, description, min_plan, estimated_minutes) VALUES
('a0000001-0000-0000-0000-000000000001', 'foundation', 1,
 'Your Business Identity',
 'Understand what your business legally is, how to register it, and why formalisation protects you.',
 'solo', 45),
('a0000001-0000-0000-0000-000000000002', 'foundation', 2,
 'Money That Makes Sense',
 'Revenue, profit, and cash are three different things. This module explains why that difference can save — or destroy — your business.',
 'solo', 50),
('a0000001-0000-0000-0000-000000000003', 'foundation', 3,
 'Your First Customer',
 'From identifying your ideal client to sending your first invoice and getting paid on time.',
 'solo', 45),
('a0000001-0000-0000-0000-000000000004', 'foundation', 4,
 'Tax for Beginners',
 'The South African tax landscape simplified: income tax, provisional tax, VAT, PAYE, and UIF.',
 'solo', 55),
('a0000001-0000-0000-0000-000000000005', 'foundation', 5,
 'Your First Employee',
 'The legal, ethical, and practical steps to hiring your first staff member correctly in South Africa.',
 'solo', 50),
('a0000001-0000-0000-0000-000000000006', 'foundation', 6,
 'Protecting What You Built',
 'POPIA, insurance, intellectual property, and the contracts every business needs.',
 'solo', 45)
ON CONFLICT (level, module_number) DO NOTHING;

-- ─── Module 1 Lessons — Your Business Identity ───────────────────────────────

INSERT INTO academy_lessons (module_id, lesson_number, title, content_type, content, estimated_minutes, trigger_events) VALUES

('a0000001-0000-0000-0000-000000000001', 1,
 'Why Formal Registration Matters',
 'text',
 '{
   "intro": "More than 60% of SA businesses operate informally. Most do so out of fear — fear of tax, fear of complexity, fear of cost. This lesson dismantles those fears.",
   "sections": [
     {"heading": "What informal really means", "body": "An informal business has no legal identity separate from its owner. If it is sued, you are sued. If it owes debt, you owe the debt — even against your personal home and savings."},
     {"heading": "What registration gives you", "body": "A registered business can open a business bank account, apply for tenders, access funding, sign contracts in the business name, and pay you a salary. Banks and funders will not touch an unregistered entity."},
     {"heading": "The 3 most common fears — answered", "body": "Fear 1: SARS will find me. Truth: SARS already knows informal traders exist. Registering actually gives you access to deductions you are missing. Fear 2: It is expensive. Truth: CIPC registration costs R175. Fear 3: It is complicated. Truth: AdminOS walks you through every step."}
   ],
   "key_takeaways": [
     "Your business and you are legally separate once registered — this protects your personal assets.",
     "Registration is the first step to accessing funding, tenders, and business banking.",
     "The cost of not registering is far higher than the R175 CIPC fee."
   ],
   "quiz": [
     {"question": "What is the primary benefit of formal registration?", "options": ["Lower taxes", "Legal separation between you and your business", "Free banking", "Access to loans"], "correct": 1}
   ]
 }',
 10, ARRAY['business.year_one']),

('a0000001-0000-0000-0000-000000000001', 2,
 'Business Structures: Sole Prop, CC, (Pty) Ltd, NPO',
 'text',
 '{
   "intro": "Choosing the wrong structure costs money to fix later. Here is what you need to know before you decide.",
   "sections": [
     {"heading": "Sole Proprietorship", "body": "No registration required. You and the business are one legal entity. Simple but dangerous — unlimited personal liability. Good only for: testing a side income before committing, or freelancers with very low risk."},
     {"heading": "Close Corporation (CC)", "body": "Still exists but CIPC no longer registers new CCs. If you have one, you can keep it. It offers limited liability for up to 10 members. Converting to (Pty) Ltd is straightforward."},
     {"heading": "Private Company (Pty) Ltd", "body": "The gold standard for SA SMEs. Limited liability — shareholders can only lose what they invested. Requires at least 1 director. Annual Return filing with CIPC. Required by most funders, banks, and tender portals."},
     {"heading": "Non-Profit Organisation (NPO)", "body": "For social enterprises, community organisations, and charities. Tax-exempt on qualifying income. Requires NPO registration with the DSD, not CIPC. Board governance is mandatory."}
   ],
   "key_takeaways": [
     "For most entrepreneurs: start with (Pty) Ltd. The R175 CIPC fee is the best R175 you will spend.",
     "Sole proprietorships offer zero liability protection.",
     "NPOs are for mission-driven organisations, not profit-seeking businesses."
   ],
   "quiz": [
     {"question": "Which structure gives you limited personal liability AND is preferred by funders?", "options": ["Sole Proprietor", "Close Corporation", "Private Company (Pty) Ltd", "NPO"], "correct": 2}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000001', 3,
 'How to Register with CIPC',
 'exercise',
 '{
   "intro": "This lesson walks you through the exact steps to register your (Pty) Ltd with CIPC online.",
   "tasks": [
     {"title": "Step 1: Create your CIPC account", "description": "Go to bizportal.gov.za. Click Register. Use your ID number. Verify your email. Cost: free."},
     {"title": "Step 2: Reserve your company name", "description": "On BizPortal, go to Name Reservation. Enter up to 4 name choices. Choose something unique — CIPC checks for similarities. Cost: R50. Takes 1–5 business days."},
     {"title": "Step 3: Incorporate your company", "description": "Select Incorporate Company. Choose Private Company. Fill in: directors (minimum 1), registered address, financial year end (recommend Feb — aligns with tax year), initial shares (1000 at R0.0001 par). Cost: R125. Takes 1–3 business days."},
     {"title": "Step 4: Download your CoR14.3", "description": "Once approved, download and save your Certificate of Incorporation (CoR14.3). This is your proof of registration. AdminOS Document Vault is a good place to store it."},
     {"title": "Step 5: Get your Tax Reference Number", "description": "SARS automatically assigns a tax number to new companies. Check your SARS eFiling profile within 21 days of incorporation. If not there, call 0800 00 7277."}
   ],
   "reflection_prompts": [
     "What name have you chosen for your company and why?",
     "Who else (if anyone) will be a director?",
     "What financial year end month makes the most sense for your business cycle?"
   ]
 }',
 15, null),

('a0000001-0000-0000-0000-000000000001', 4,
 'Opening a Business Bank Account',
 'text',
 '{
   "intro": "Never mix personal and business money. This single habit will save you from tax disasters, cash flow confusion, and disputes with SARS.",
   "sections": [
     {"heading": "Why a dedicated business account is non-negotiable", "body": "When you mix funds: SARS cannot verify your business expenses (losing your deductions), you cannot see your real cash position, and in an audit you must justify every single personal transaction. One bank account per business entity is the rule."},
     {"heading": "What you need to open one", "body": "Your CoR14.3 (certificate of incorporation), your company tax reference number, your personal ID, proof of your registered business address, and a director resolution (some banks require this — it is a one-page document)."},
     {"heading": "SA business banking options", "body": "FNB Business: strong digital tools, good for online businesses. Nedbank Business: good relationship banking for retail/service. Standard Bank Business: solid for trade and international payments. Capitec Business: lowest fees for startups with simple needs. African Bank Business: good entry-level option. Tip: compare monthly fees and transaction costs before choosing."},
     {"heading": "AdminOS integration", "body": "AdminOS can connect to your bank account via our banking integration. Once connected, transactions automatically reconcile against your invoices — saving hours of admin every month."}
   ],
   "key_takeaways": [
     "One bank account per business. No exceptions.",
     "You need your CoR14.3 and tax number before most banks will open your account.",
     "Lower fees are worth the switch — compare before you commit."
   ],
   "quiz": [
     {"question": "What is the most important reason to have a separate business bank account?", "options": ["Better interest rates", "SARS audit protection and accurate bookkeeping", "Free transactions", "Higher credit limits"], "correct": 1}
   ]
 }',
 10, null),

('a0000001-0000-0000-0000-000000000001', 5,
 'Your Business Identity Checklist',
 'exercise',
 '{
   "intro": "Before you move to Module 2, complete this checklist. Every item is a foundation stone — without them, everything you build on top is unstable.",
   "tasks": [
     {"title": "Company registered with CIPC", "description": "You have a CoR14.3. It is stored in your AdminOS Document Vault."},
     {"title": "Tax reference number obtained", "description": "You have registered with SARS eFiling and have your income tax reference number."},
     {"title": "Business bank account open", "description": "Your company has its own bank account, separate from your personal account."},
     {"title": "Registered address confirmed", "description": "Your business has a physical or postal address registered with CIPC. This can be your home address."},
     {"title": "AdminOS profile complete", "description": "Your business type, registration number, industry, and financial year end are set in AdminOS settings."}
   ],
   "reflection_prompts": [
     "What is your business registration number?",
     "What is your financial year end month?",
     "Which bank did you choose and why?"
   ]
 }',
 8, null);

-- ─── Module 2 Lessons — Money That Makes Sense ───────────────────────────────

INSERT INTO academy_lessons (module_id, lesson_number, title, content_type, content, estimated_minutes, trigger_events) VALUES

('a0000001-0000-0000-0000-000000000002', 1,
 'Revenue vs Profit vs Cash: Three Different Things',
 'text',
 '{
   "intro": "Most business failures are not caused by a lack of revenue. They are caused by confusing revenue with cash. This lesson explains the three numbers every owner must understand.",
   "sections": [
     {"heading": "Revenue (Turnover)", "body": "The total amount invoiced or charged to customers in a period, before any deductions. If you invoiced R100,000 in January, your January revenue is R100,000 — even if none of it has been paid yet."},
     {"heading": "Profit", "body": "What is left after subtracting all costs from revenue. Gross Profit = Revenue minus Cost of Sales. Net Profit = Gross Profit minus all overheads (rent, salaries, etc.). A business can be profitable on paper and bankrupt in reality."},
     {"heading": "Cash", "body": "The actual money in your bank account right now. Cash is reality. It pays the rent, the staff, and the suppliers. An invoice is not cash. A promise to pay is not cash. Profit is not cash."},
     {"heading": "The dangerous gap", "body": "Imagine you invoice R500,000 in December. Revenue: R500,000. Your expenses for December: R120,000. Net profit: R380,000. But your clients are 60-day payers — they pay in February. Your rent is due January 1. You are profitable and broke. This is why cash flow kills profitable businesses."}
   ],
   "key_takeaways": [
     "Revenue is what you invoice. Cash is what arrives. The gap between them is your risk.",
     "A profitable business can go bankrupt — it happens every day.",
     "Manage cash, not just profit."
   ],
   "quiz": [
     {"question": "A business invoices R200,000 in March but none is paid until April. In March, their cash position from these invoices is:", "options": ["R200,000", "R0", "Depends on expenses", "Negative"], "correct": 1}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000002', 2,
 'Reading Your First P&L Statement',
 'text',
 '{
   "intro": "A Profit and Loss statement (Income Statement) tells you the financial story of your business over a period. Once you can read one, you stop flying blind.",
   "sections": [
     {"heading": "The P&L structure", "body": "Revenue (Sales)\n- Cost of Goods Sold (COGS) / Cost of Sales\n= Gross Profit\n- Operating Expenses (Overheads)\n= Operating Profit (EBIT)\n- Interest and Finance Charges\n= Net Profit Before Tax\n- Income Tax\n= Net Profit After Tax"},
     {"heading": "Cost of Sales vs Overheads", "body": "Cost of Sales (COGS) are costs that directly produce your revenue — raw materials, contractor fees, packaging, delivery. They rise and fall with your sales volume. Overheads (operating expenses) are fixed or semi-fixed: rent, salaries, insurance, software. They exist whether or not you make a sale."},
     {"heading": "Gross Margin — the most important ratio", "body": "Gross Margin = (Gross Profit ÷ Revenue) × 100. Example: Revenue R100,000, COGS R60,000, Gross Profit R40,000. Gross Margin = 40%. This tells you: for every rand of revenue, 40 cents is available to cover overheads and profit. Most SA service businesses target 50–70% gross margin. Retail: 20–40%."},
     {"heading": "How AdminOS builds your P&L", "body": "Every invoice you send adds to revenue. Every expense you log is categorised as COGS or overhead. AdminOS generates your P&L automatically — you just need to keep your data current."}
   ],
   "key_takeaways": [
     "Gross Margin tells you how efficiently your business generates profit from its core activity.",
     "Your P&L is only as accurate as the data you put in.",
     "A P&L shows the period. A Balance Sheet shows a single date. A Cash Flow Statement shows movement."
   ],
   "quiz": [
     {"question": "Revenue R500,000, COGS R200,000. What is the gross margin?", "options": ["40%", "60%", "25%", "75%"], "correct": 1}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000002', 3,
 'Understanding Gross vs Net Margin',
 'text',
 '{
   "intro": "Knowing your margins is the difference between pricing with confidence and guessing. This lesson teaches you to use margin as a management tool.",
   "sections": [
     {"heading": "Gross Margin vs Markup — the confusion that costs money", "body": "Most business owners confuse markup with margin. Markup is the percentage added to cost to get to price. Margin is the percentage of the selling price that is profit. If you add 50% markup to a R100 cost, your price is R150 and your gross margin is 33%, not 50%. This mistake can make you think you are more profitable than you are."},
     {"heading": "Net Margin — the bottom line", "body": "Net Margin = Net Profit After Tax ÷ Revenue × 100. A net margin of 10% means you keep R10 for every R100 of revenue. SA SME benchmark by sector: Retail 3–8%, Services 15–25%, Construction 5–10%, Professional services 20–35%, Technology 25–45%."},
     {"heading": "Using margin to price", "body": "To achieve a 40% gross margin, divide your cost by 0.6 (not multiply by 1.4). Example: cost R600, target 40% margin, price = R600 ÷ 0.6 = R1,000. Check: Gross Profit R400 ÷ Revenue R1,000 = 40%. Your margin is correct."},
     {"heading": "Margin pressure warning signs", "body": "Margin dropping 5+ points: your costs rose but your prices did not. Time to review supplier contracts and pricing. Margin varying by client: some clients are unprofitable. Identify and reprice or exit them."}
   ],
   "key_takeaways": [
     "Markup ≠ Margin. Confusing them leads to underpricing.",
     "Know your target net margin for your sector and manage toward it.",
     "Divide cost by (1 - target margin) to calculate price from desired margin."
   ],
   "quiz": [
     {"question": "To achieve a 50% gross margin on a R400 cost item, what must the selling price be?", "options": ["R600", "R800", "R700", "R1,000"], "correct": 1}
   ]
 }',
 10, ARRAY['financial.margin_drop']),

('a0000001-0000-0000-0000-000000000002', 4,
 'Cash Flow: Why Profitable Businesses Fail',
 'text',
 '{
   "intro": "More businesses die of thirst than of starvation. Thirst = running out of cash. Starvation = running at a loss. You can survive low profit. You cannot survive zero cash.",
   "sections": [
     {"heading": "The cash conversion cycle", "body": "The gap between when you spend money and when you collect it is called the cash conversion cycle (CCC). Example: You buy stock (cash out Day 0). You sell it on 60-day credit terms (payment arrives Day 90). Your CCC is 90 days. During those 90 days, you still pay rent, salaries, and suppliers. Every day of CCC that you can reduce frees up cash."},
     {"heading": "Three ways to shrink your CCC", "body": "1. Shorten payment terms: Move from 60-day to 30-day terms. 2. Offer early payment discounts: 2% discount for payment within 7 days often costs less than the interest on an overdraft. 3. Extend supplier terms: Negotiate 30–60 day terms with your suppliers while collecting faster from clients."},
     {"heading": "Seasonal cash flow planning", "body": "Know your cash flow seasons. If December is always slow (retail) or always busy (events), plan 3 months ahead. AdminOS Cash Flow Forecast (Phase 5) will predict your 90-day position based on your pipeline and historical patterns."},
     {"heading": "The minimum cash reserve rule", "body": "Keep at minimum 3 months of fixed overhead expenses in cash at all times. If your monthly fixed costs are R50,000, maintain R150,000 as a minimum reserve. This is your survival buffer."}
   ],
   "key_takeaways": [
     "The cash conversion cycle is the key metric for cash health.",
     "Shorter collection + longer payment terms = healthier cash position.",
     "3 months of fixed costs as a cash reserve is your survival target."
   ],
   "quiz": [
     {"question": "Your fixed monthly costs are R80,000. What is your minimum recommended cash reserve?", "options": ["R80,000", "R160,000", "R240,000", "R400,000"], "correct": 2}
   ]
 }',
 12, ARRAY['financial.cash_negative', 'financial.debtor_days_45']),

('a0000001-0000-0000-0000-000000000002', 5,
 'Profit First: Pay Yourself First',
 'book_in_action',
 '{
   "book_slug": "profit-first",
   "book_title": "Profit First",
   "author": "Mike Michalowicz",
   "exercise_title": "Set Up Your 5 Accounts",
   "intro": "Mike Michalowicz discovered that most business owners use Sales - Expenses = Profit. He flipped it: Sales - Profit = Expenses. By removing profit first, you force efficiency in everything else. This exercise sets up the system.",
   "core_insight": "Your bank account balance drives your spending behaviour. Create the right accounts and your behaviour changes automatically.",
   "steps": [
     {"step": 1, "title": "Open 5 bank accounts", "instructions": "Income (all revenue lands here), Profit (your reward — never touch except quarterly distributions), Owner Pay (your salary — transfer on set days), Tax (set aside 15–20% of revenue for SARS), Operating Expenses (what runs the business). Most SA banks allow free savings accounts linked to your business current account."},
     {"step": 2, "title": "Set your allocation percentages", "instructions": "Use Michalowicz starter percentages based on revenue: Under R500k/yr: Profit 1%, Owner Pay 50%, Tax 15%, OpEx 34%. R500k–R2M: Profit 5%, Owner Pay 35%, Tax 15%, OpEx 45%. Over R2M: Profit 10%, Owner Pay 20%, Tax 20%, OpEx 50%. These are starting points — adjust over 12 months."},
     {"step": 3, "title": "Set a transfer rhythm", "instructions": "On the 10th and 25th of every month, transfer from Income into the 4 other accounts using your percentages. Spend only what is in OpEx for business expenses. Never dip into Profit or Tax."},
     {"step": 4, "title": "Take your first Profit distribution", "instructions": "At the end of your first quarter, take 50% of the Profit account as a distribution. Leave 50% as a reserve. Celebrate. You earned it."}
   ],
   "completion_check": "You have opened all 5 accounts and made your first allocation transfer."
 }',
 15, ARRAY['financial.cash_negative']);

-- ─── Module 3 Lessons — Your First Customer ──────────────────────────────────

INSERT INTO academy_lessons (module_id, lesson_number, title, content_type, content, estimated_minutes, trigger_events) VALUES

('a0000001-0000-0000-0000-000000000003', 1,
 'Who Is Your Ideal Customer?',
 'exercise',
 '{
   "intro": "Most businesses try to serve everyone. The most successful businesses serve someone specifically. This exercise builds your Ideal Customer Profile (ICP).",
   "tasks": [
     {"title": "Describe your best client in detail", "description": "Think of your best current (or imagined) client. Write: Industry/sector, Company size (if B2B) or demographics (if B2C), Their biggest recurring pain related to what you solve, Where they look for solutions (referrals, Google, LinkedIn, WhatsApp groups), What makes them choose one provider over another, What they cannot afford to get wrong."},
     {"title": "Identify their Jobs to Be Done", "description": "Clayton Christensen: customers hire products to do a job. Your client does not want a cleaning service. They want to walk into a spotless office every morning without thinking about it. What job does your business actually do for your best client?"},
     {"title": "Find where 3 of them already are", "description": "List 3 places (physical or digital) where your ideal clients already gather. These are your marketing channels."}
   ],
   "reflection_prompts": [
     "Can you describe your ideal customer in one sentence without using the word everyone?",
     "What is the single biggest pain your ideal customer has that you solve better than anyone else?"
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000003', 2,
 'Pricing Your Product or Service',
 'text',
 '{
   "intro": "Underpricing is the most common and most damaging mistake SA entrepreneurs make. It is not humility — it is slow business suicide.",
   "sections": [
     {"heading": "Cost-plus pricing (the floor)", "body": "Start with your total cost to deliver: direct labour + materials + overheads allocated to this service. Add your target gross margin. This gives you your floor price — below this, you are subsidising your customer."},
     {"heading": "Value-based pricing (the ceiling)", "body": "What is it worth to the client? If your bookkeeping saves a business owner 20 hours per month and their time is worth R1,000/hour, you are saving them R20,000/month. Charging R3,000/month is cheap for them even if it feels expensive to you."},
     {"heading": "Competitor reference pricing (the market)", "body": "Know what others charge but do not be enslaved by it. Competing on price is a race to zero. Compete on value, reliability, and speed instead."},
     {"heading": "Price anchoring", "body": "Present 3 packages: Good, Better, Best. Most buyers choose the middle. The high tier makes the middle seem reasonable. The low tier shows you have an entry point. This is the single pricing change that most increases average contract value for SA service businesses."},
     {"heading": "The South African discount trap", "body": "Never discount without getting something in return: faster payment, a referral, a case study, a longer contract. Give a discount for a reason, not because someone asked. Once you discount, you set a new price expectation."}
   ],
   "key_takeaways": [
     "Cost + desired margin = your floor price. Never go below it.",
     "Value to the client, not cost to you, should determine your ceiling price.",
     "3-tier packaging increases average contract value with no extra sales effort."
   ],
   "quiz": [
     {"question": "Which pricing strategy is most aligned with charging for the outcome you deliver rather than your cost?", "options": ["Cost-plus", "Competitor reference", "Value-based", "Cost recovery"], "correct": 2}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000003', 3,
 'Creating Your First Invoice',
 'exercise',
 '{
   "intro": "An invoice is a legal demand for payment. In South Africa, it must contain specific fields to be legally enforceable and VAT-compliant (if registered).",
   "tasks": [
     {"title": "Know what a valid invoice must contain", "description": "Required on every SA invoice: Your business name and registration number, Your physical or postal address, Invoice number (sequential, never repeat), Invoice date, Client name and address, Description of goods/services, Quantity, unit price, and total per line item, Subtotal, Any VAT (if VAT registered — show VAT number and 15%), Total amount due, Payment terms (e.g. NET 30 — due 30 days from invoice date), Your banking details (bank name, account number, branch code, account type)."},
     {"title": "Create your first invoice in AdminOS", "description": "Go to Invoices → New Invoice. Select or create your client. Add your line items. Set payment terms. Preview and send. AdminOS generates a PDF and sends it via email. The invoice status updates automatically when payment is received."},
     {"title": "Set a late payment policy", "description": "Decide now: Will you charge interest on late payments? (Legal under the National Credit Act — maximum rate 2% per month.) Will you stop work when payment is >30 days overdue? Communicate this in your proposal before the work starts."}
   ],
   "reflection_prompts": [
     "What are your payment terms going to be — NET 7, NET 14, NET 30?",
     "Have you added your banking details to your AdminOS profile so they appear on every invoice?"
   ]
 }',
 10, ARRAY['invoice.first_sent']),

('a0000001-0000-0000-0000-000000000003', 4,
 'Payment Terms and Getting Paid',
 'text',
 '{
   "intro": "Sending the invoice is the easy part. Getting paid is where most SA businesses bleed. Here is how to change that.",
   "sections": [
     {"heading": "Set terms upfront — not after the invoice", "body": "Your payment terms must be agreed before work starts, ideally in writing (proposal or contract). Trying to enforce NET 30 on a client who expected NET 60 is a relationship problem, not a finance problem."},
     {"heading": "The 3-touch follow-up sequence", "body": "Day 0: Invoice sent. Day 7 (if unpaid): Polite reminder — AdminOS sends this automatically. Day 14 (if unpaid): Firm reminder with late payment clause reminder. Day 21 (if unpaid): Phone call — this single action has the highest payment conversion rate of any follow-up method. Day 30 (if unpaid): Formal demand letter + stop further work."},
     {"heading": "Deposit model", "body": "For project work: require 50% upfront before starting. This filters serious clients from time-wasters and protects you for work done. Most serious clients will pay a deposit if your service is credible."},
     {"heading": "AdminOS automated chase", "body": "AdminOS Debt Recovery sends payment reminders automatically at your configured intervals, in the right tone for the number of days overdue. It escalates from friendly to firm to formal without you having to manage it."}
   ],
   "key_takeaways": [
     "Agree payment terms before work starts, in writing.",
     "A phone call on day 21 converts more late payers than any email sequence.",
     "Require a deposit for all project work — it is standard professional practice."
   ],
   "quiz": [
     {"question": "What is the most effective follow-up action for a client who has not paid by day 21?", "options": ["Send another email", "Cancel their invoice", "Call them directly", "Offer a discount"], "correct": 2}
   ]
 }',
 10, ARRAY['invoice.overdue_7d']),

('a0000001-0000-0000-0000-000000000003', 5,
 'Your Value Proposition — StoryBrand Basics',
 'book_in_action',
 '{
   "book_slug": "storybrand",
   "book_title": "Building a StoryBrand",
   "author": "Donald Miller",
   "exercise_title": "Build Your One-Sentence Value Proposition",
   "intro": "Donald Miller''s StoryBrand framework flips traditional marketing: you are NOT the hero of the story — your customer is. You are the guide. This exercise gives you your one-sentence value proposition using the SB7 framework.",
   "core_insight": "Customers do not buy the best product or service. They buy the one they can understand most clearly. Clarity beats cleverness.",
   "steps": [
     {"step": 1, "title": "Identify the CHARACTER (your customer)", "instructions": "Who is your ideal customer? Be specific. Not ''small business owners'' — ''retail shop owners in SA with 2–5 employees who cannot afford a full-time bookkeeper''."},
     {"step": 2, "title": "Name their PROBLEM", "instructions": "Every customer has 3 levels of problem: External (the practical issue — ''I can''t keep up with my invoicing''), Internal (how it makes them feel — ''I feel embarrassed when clients call about overdue invoices''), Philosophical (why it is wrong — ''A hardworking business owner shouldn''t be buried in paperwork''). Address all 3."},
     {"step": 3, "title": "Position yourself as the GUIDE", "instructions": "The guide (you) has two things: Empathy (I understand your problem) + Authority (and I have helped people solve it). Show both in your messaging."},
     {"step": 4, "title": "Write the ONE-SENTENCE VALUE PROP", "instructions": "Formula: We help [CHARACTER] [solve PROBLEM] so they can [achieve SUCCESS]. Example: ''We help township retail shop owners stop losing money to unpaid invoices so they can focus on growing their business instead of chasing debtors.''"}
   ],
   "completion_check": "You have written a one-sentence value proposition using the character-problem-guide-success structure."
 }',
 15, null);

-- ─── Module 4 Lessons — Tax for Beginners ────────────────────────────────────

INSERT INTO academy_lessons (module_id, lesson_number, title, content_type, content, estimated_minutes, trigger_events) VALUES

('a0000001-0000-0000-0000-000000000004', 1,
 'The SA Tax Landscape for Business Owners',
 'text',
 '{
   "intro": "South African tax has a reputation for complexity. In reality, for an SME, there are only 5 taxes you need to understand. This lesson maps them all.",
   "sections": [
     {"heading": "Corporate Income Tax (CIT)", "body": "All registered companies pay CIT on their annual taxable income. Standard rate: 27%. Small Business Corporation (SBC) rate: 0% on first R95,750, 7% on next R365,000, 21% thereafter — if you qualify (net annual turnover under R20M, you are the only company you own, no investment income). Apply for SBC status on SARS eFiling."},
     {"heading": "Provisional Tax", "body": "Companies do not wait until year-end to pay CIT. SARS wants two provisional payments during the year. First: 6 months into your financial year. Second: at year-end. Based on your estimated annual taxable income. If you underpay by more than 20%, SARS charges penalties plus interest."},
     {"heading": "VAT (Value Added Tax)", "body": "15% tax on most goods and services in SA. You only register for VAT when your annual taxable supplies exceed R1 million (mandatory) or R50,000 (voluntary). Once registered: you add 15% to all invoices, you claim back VAT on qualifying business expenses, the difference goes to SARS every 2 months."},
     {"heading": "PAYE (Pay As You Earn)", "body": "If you employ anyone (including yourself via salary), you must register as an employer with SARS. PAYE is deducted from employee salaries and paid to SARS by the 7th of the following month. Calculated using SARS tax tables. AdminOS Payroll calculates this automatically."},
     {"heading": "UIF and SDL", "body": "UIF: 1% from employee, 1% from employer, on first R17,712/month of earnings. SDL: 1% of total payroll — funds sector training. Both paid monthly with PAYE via EMP201 declaration."}
   ],
   "key_takeaways": [
     "5 taxes: CIT, Provisional, VAT, PAYE, UIF+SDL. Know which apply to your current stage.",
     "SBC status saves significant tax — apply if you qualify.",
     "Late payments attract 10% monthly interest from SARS. Never miss a deadline."
   ],
   "quiz": [
     {"question": "At what annual turnover does VAT registration become mandatory in South Africa?", "options": ["R500,000", "R750,000", "R1,000,000", "R2,000,000"], "correct": 2}
   ]
 }',
 15, null),

('a0000001-0000-0000-0000-000000000004', 2,
 'Provisional Tax: What It Is and When',
 'text',
 '{
   "intro": "Provisional tax is the single most expensive surprise for new business owners. Here is how to never be caught off guard.",
   "sections": [
     {"heading": "How provisional tax works", "body": "SARS collects CIT in two instalments during the year rather than one lump sum at year end. Period 1 (6 months in): Pay at least 50% of your estimated annual tax liability. Period 2 (year end): Pay the remaining amount based on your actual or estimated figures. Third payment (optional): Top up within 6 months of year end if you were short."},
     {"heading": "Calculating your estimate", "body": "Estimate your annual taxable income (revenue minus deductible expenses). Apply the CIT rate. If your taxable income is R500,000 and you do not qualify for SBC, tax = R500,000 × 27% = R135,000. First provisional: R67,500. Second provisional: R67,500. If actual profit comes in higher, you pay the difference plus potential penalties."},
     {"heading": "The safe harbour rule", "body": "If your taxable income is under R1M: your estimate must be at least 90% of actual liability to avoid penalties. If over R1M: your estimate must be at least 80% of actual liability. Conservative estimates are your friend."},
     {"heading": "When to pay", "body": "Check your financial year end in AdminOS settings. Period 1 due = 6 months after your year start. Period 2 due = last day of your financial year. AdminOS Compliance Calendar reminds you 30 days and 7 days before each deadline."}
   ],
   "key_takeaways": [
     "Under-estimate provisional tax and you pay a 20% underestimation penalty plus interest.",
     "Set aside approximately 27% of profit monthly into your Tax account (Profit First step 3).",
     "Your financial year end determines your provisional tax payment dates — know yours."
   ],
   "quiz": [
     {"question": "For a company with taxable income under R1M, your provisional tax estimate must be at least what percentage of actual tax liability to avoid penalties?", "options": ["80%", "85%", "90%", "100%"], "correct": 2}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000004', 3,
 'VAT: When to Register and How It Works',
 'text',
 '{
   "intro": "Becoming a VAT vendor changes how you price, invoice, and track every transaction. Here is everything you need to know before you cross the threshold.",
   "sections": [
     {"heading": "Mandatory vs voluntary registration", "body": "Mandatory: Your taxable supplies (excluding exempt supplies) exceeded R1,000,000 in any consecutive 12-month period — you must register within 21 business days or SARS registers you and you are liable from the day you crossed the threshold. Voluntary: Taxable supplies exceed R50,000 in 12 months. Voluntary registration can be beneficial: you start claiming input VAT on business purchases."},
     {"heading": "How VAT works", "body": "You charge 15% VAT on all standard-rated supplies (added to your invoice price). Your customers pay it. You collect it on behalf of SARS. You can deduct input VAT (VAT you paid on qualifying business expenses). Net VAT payable = Output VAT collected minus Input VAT paid. If input > output, SARS owes you a refund."},
     {"heading": "VAT periods and filing", "body": "Most businesses: file every 2 months (Category A or B). High turnover businesses (>R30M/yr): file monthly. VAT return due: 25th of the month after period end (or last business day if online via eFiling). Payment due: same day as return. Late payment: 10% penalty + interest."},
     {"heading": "Zero-rated and exempt supplies", "body": "Zero-rated (0% VAT, but you still claim input VAT): exports, most basic foodstuffs, petrol, public transport. Exempt (no VAT at all, no input VAT claimed): financial services, residential rental, educational services."}
   ],
   "key_takeaways": [
     "R1M threshold crossed = 21 business days to register or you face backdated liability.",
     "VAT is cash-flow neutral at scale but adds admin burden.",
     "AdminOS tracks VAT automatically on all invoices and expenses — your VAT201 is pre-populated."
   ],
   "quiz": [
     {"question": "When is VAT registration in South Africa mandatory?", "options": ["Revenue exceeds R500,000/year", "Revenue exceeds R1,000,000 in any 12-month period", "Revenue exceeds R2,000,000/year", "When you hire your first employee"], "correct": 1}
   ]
 }',
 12, ARRAY['financial.vat_threshold', 'financial.revenue_1m']),

('a0000001-0000-0000-0000-000000000004', 4,
 'PAYE, UIF, and SDL: Employer Obligations',
 'text',
 '{
   "intro": "The moment you pay a salary — including your own — you become an employer in the eyes of SARS and the Department of Employment and Labour.",
   "sections": [
     {"heading": "PAYE obligations", "body": "Register as an employer on SARS eFiling before you pay your first salary. Each month: deduct employees income tax using SARS tax tables, pay it to SARS by the 7th of the following month via EMP201 declaration. Failure to pay attracts 10% penalty per month. This is one of the most common sources of SARS debt for SA SMEs."},
     {"heading": "UIF obligations", "body": "Unemployment Insurance Fund. Employee contributes 1% of their monthly remuneration (deducted from salary). Employer contributes a further 1% (on top of salary cost). Both paid monthly with PAYE. Cap: first R17,712 of monthly earnings. Domestic workers: also now required to be registered. Register on the Department of Employment website or via AdminOS."},
     {"heading": "SDL obligations", "body": "Skills Development Levy. 1% of total monthly payroll. Only payable if your total annual payroll exceeds R500,000. Paid monthly with PAYE. The SDL you pay funds your SETA levies — you can claim back training grants from your SETA for registered training spend."},
     {"heading": "The EMP201 declaration", "body": "This single monthly declaration to SARS covers PAYE + UIF + SDL in one submission. Due: 7th of each month for the prior month. AdminOS Payroll generates the EMP201 figures — you submit via eFiling. File even if R0 is due."}
   ],
   "key_takeaways": [
     "Register as an employer before paying your first salary.",
     "PAYE + UIF + SDL all due by the 7th of the following month, every month.",
     "Your SDL payments can be partially recovered as SETA training grants — this is money most owners leave on the table."
   ],
   "quiz": [
     {"question": "By what date must PAYE, UIF, and SDL be paid to SARS each month?", "options": ["Last day of the month", "7th of the following month", "25th of the month", "15th of the following month"], "correct": 1}
   ]
 }',
 12, ARRAY['payroll.first_run']),

('a0000001-0000-0000-0000-000000000004', 5,
 'How to Work With an Accountant',
 'text',
 '{
   "intro": "A good accountant is not a cost. They are an investment that typically returns 3–5× their fee in tax savings and penalty avoidance. Here is how to get the most from the relationship.",
   "sections": [
     {"heading": "What an accountant does vs what they do not do", "body": "Does: prepare annual financial statements, file tax returns, advise on tax efficiency, represent you in SARS disputes. Does not do (unless specified): manage your day-to-day bookkeeping, remind you of deadlines, attend to all your SARS correspondence. AdminOS handles the bookkeeping and compliance calendar so your accountant focuses on high-value advisory work."},
     {"heading": "What to look for", "body": "Registered with SAICA (CA), SAIPA (Professional Accountant), or SAIT (Tax Practitioner). Experience with businesses in your sector and revenue range. Proactive communicator — should advise you before deadlines, not after. References from clients you can speak to. Fixed-fee engagement — hourly billing creates perverse incentives."},
     {"heading": "What to give your accountant", "body": "Monthly reconciled bookkeeping from AdminOS. Bank statements for all accounts. All supplier invoices and receipts. Payroll records. A list of any unusual transactions. The cleaner your records, the cheaper your accounting bill."},
     {"heading": "Your annual accounting calendar", "body": "Month 1–2 after year end: Trial Balance from AdminOS → draft financials. Month 2–3: Review and approve Annual Financial Statements. Month 3–4: File IT14 (company income tax return). Before period 1: Review provisional tax estimate with accountant. Before period 2: Review year-end estimate."}
   ],
   "key_takeaways": [
     "Accountants are most valuable when you give them clean, timely data.",
     "AdminOS does the bookkeeping. Your accountant does the strategy and filing.",
     "Always verify your accountant is registered with SAICA, SAIPA, or SAIT."
   ],
   "quiz": [
     {"question": "Which professional body registers Chartered Accountants in South Africa?", "options": ["SAIPA", "SAIT", "SAICA", "IRBA"], "correct": 2}
   ]
 }',
 10, null);

-- ─── Module 5 Lessons — Your First Employee ──────────────────────────────────

INSERT INTO academy_lessons (module_id, lesson_number, title, content_type, content, estimated_minutes, trigger_events) VALUES

('a0000001-0000-0000-0000-000000000005', 1,
 'Types of Employment Contracts',
 'text',
 '{
   "intro": "The contract you sign with an employee defines your entire legal relationship. Getting this wrong costs time, money, and your reputation.",
   "sections": [
     {"heading": "Permanent employment", "body": "No end date. All BCEA rights in full. Can only be terminated for valid reason following a fair process. Required notice: 1 week (<6 months service), 2 weeks (6 months–1 year), 4 weeks (1+ year). Most appropriate for: ongoing operational roles, your core team."},
     {"heading": "Fixed-term contracts", "body": "Has a specific end date or condition. Must be for a justifiable reason (project work, maternity cover, seasonal demand). Warning: if you keep renewing fixed-term contracts indefinitely for work that is ongoing, the CCMA will deem the person permanently employed. Maximum 3 months' fixed-term for employees earning under the threshold (R241,110/yr) without justification."},
     {"heading": "Part-time employment", "body": "Works fewer hours than full-time. All BCEA protections apply on a pro-rata basis. Must receive the same rate of pay per hour as comparable full-time employees. Entitled to proportional leave."},
     {"heading": "Independent contractor", "body": "Not an employee. Works for multiple clients. Uses own tools and methods. No obligation to do the work personally. No UIF, no PAYE, no leave — but the relationship must genuinely be independent. SARS and the CCMA regularly reclassify sham independent contractors as employees. If it walks like an employee and works like an employee, it is an employee."}
   ],
   "key_takeaways": [
     "Permanent employees have the strongest protections under South African law.",
     "Fixed-term contracts used for ongoing work will be reclassified as permanent by the CCMA.",
     "Independent contractor arrangements that are actually employment create huge liability."
   ],
   "quiz": [
     {"question": "An employee with 2 years of service is entitled to how many weeks'' notice of termination under the BCEA?", "options": ["1 week", "2 weeks", "4 weeks", "6 weeks"], "correct": 2}
   ]
 }',
 12, ARRAY['staff.first_added']),

('a0000001-0000-0000-0000-000000000005', 2,
 'BCEA Basics: Minimum Rights Every Employee Has',
 'text',
 '{
   "intro": "The Basic Conditions of Employment Act sets the floor. You can offer more — you cannot offer less. Ignorance is not a defence at the CCMA.",
   "sections": [
     {"heading": "Working hours", "body": "Maximum ordinary hours: 45 per week (9 per day if 5-day week, 8 per day if 6-day week). Overtime: maximum 10 hours per week. Overtime rate: 1.5× the employee''s hourly rate (or time off). Compressed work week arrangement possible by written agreement."},
     {"heading": "Leave entitlements", "body": "Annual leave: 21 consecutive days (15 working days on 5-day week) per annual leave cycle. Sick leave: 30 days over 3-year cycle (6 days in first 6 months). Family responsibility leave: 3 days per year (child illness, birth, death of close family). Maternity leave: 4 months (unpaid under BCEA, but can claim from UIF). Parental leave: 10 consecutive days."},
     {"heading": "Pay", "body": "National Minimum Wage (2025): R28.79 per hour (general workers). Domestic workers: R27.58/hour. Farm workers: R28.79/hour. No pay deductions without written consent except legally required deductions (PAYE, UIF)."},
     {"heading": "Termination requirements", "body": "No one may be dismissed without: a valid and fair reason (misconduct, poor performance, operational requirements), a fair procedure (right to be heard, right to representation). Section 189 retrenchment requires consultation. Always take legal advice before dismissing."}
   ],
   "key_takeaways": [
     "BCEA sets minimums. Never offer less, but offer more when you want to attract and retain talent.",
     "The CCMA processes disputes for free — employees know this. You must too.",
     "Never deduct from an employee''s salary without their written consent."
   ],
   "quiz": [
     {"question": "How many annual leave days (on a 5-day work week) is an employee entitled to under the BCEA?", "options": ["10", "12", "15", "21"], "correct": 2}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000005', 3,
 'Probation Periods: What Is Legal',
 'text',
 '{
   "intro": "Probation is a tool for performance management — not a free pass to dismiss without process. Many employers use it incorrectly and lose at the CCMA.",
   "sections": [
     {"heading": "What probation is and is not", "body": "Probation is a period during which you evaluate whether a new employee meets the required performance standard. It does NOT suspend the employee''s right to a fair dismissal process. You CANNOT simply dismiss at the end of probation without following a fair procedure."},
     {"heading": "How long should probation be?", "body": "CCMA guidelines: probation should be for a reason, relevant to the job, and no longer than necessary to evaluate performance. Standard: 1–3 months for most roles. 6 months for senior or technical roles. Longer probation is defensible only for complex roles. Never extend probation indefinitely — that is disguised dismissal."},
     {"heading": "What you must do during probation", "body": "Set clear performance standards at the start (in writing). Provide regular feedback. Give the employee an opportunity to improve if they are not meeting standards. If performance is unacceptable at probation end: inform them, give an opportunity to respond, before making a decision. AdminOS IR module has a probation review template."},
     {"heading": "Ending probation successfully", "body": "At probation end: conduct a formal probation review, confirm in writing that they have passed (this converts them to permanent status), document any areas for development. This 15-minute process protects you and motivates the employee."}
   ],
   "key_takeaways": [
     "Probation does not suspend employment rights — a fair process is still required to dismiss.",
     "Clear written performance standards at the start of probation are non-negotiable.",
     "Document every interaction during probation. If it is not written, it did not happen."
   ],
   "quiz": [
     {"question": "Can an employer dismiss an employee simply because their probation period has ended?", "options": ["Yes, that is the purpose of probation", "No, a fair procedure is still required", "Only if stated in the contract", "Only for misconduct, not performance"], "correct": 1}
   ]
 }',
 10, null),

('a0000001-0000-0000-0000-000000000005', 4,
 'Registering for UIF as an Employer',
 'text',
 '{
   "intro": "Every employer is legally required to register for UIF within 7 days of hiring their first employee. Here is the exact process.",
   "sections": [
     {"heading": "Step 1: Register on uFiling", "body": "Go to ufiling.labour.gov.za. Create an employer account using your company registration number and tax reference number. Add your company details: trading name, physical address, payroll frequency."},
     {"heading": "Step 2: Add all employees", "body": "For each employee: ID number, full name, employment date, salary, bank details. Domestic workers: use their full ID and the address where they work."},
     {"heading": "Step 3: Monthly declarations", "body": "Every month (by the 7th): log in to uFiling, declare your payroll (each employee''s remuneration for the month), submit your UIF payment (2% of remuneration up to R17,712 per employee per month). AdminOS Payroll exports a uFiling-compatible CSV."},
     {"heading": "Step 4: Issue UI-19 to leaving employees", "body": "When an employee leaves (for any reason): complete a UI-19 form (available on the Department of Employment website) within 4 days of their last day. This enables them to claim UIF benefits. Failure to submit UI-19 is a criminal offence."}
   ],
   "key_takeaways": [
     "Register for UIF within 7 days of hiring your first employee. No exceptions.",
     "2% of remuneration per employee per month (1% from employer, 1% from employee).",
     "Failure to register exposes you to fines and personal liability."
   ],
   "quiz": [
     {"question": "Within how many days of hiring your first employee must you register for UIF?", "options": ["1 day", "7 days", "30 days", "At first payroll run"], "correct": 1}
   ]
 }',
 10, ARRAY['payroll.first_run']),

('a0000001-0000-0000-0000-000000000005', 5,
 'Disciplinary Procedures: Do It Right',
 'text',
 '{
   "intro": "75% of CCMA disputes that employers lose could have been prevented with a correct disciplinary process. This lesson gives you the process.",
   "sections": [
     {"heading": "The Schedule 8 Code of Good Practice", "body": "Every disciplinary procedure in SA must follow the principles in Schedule 8 of the Labour Relations Act: the employee must know the charges against them, have an opportunity to respond, have the right to union representation or a fellow employee as representative, receive a decision and the reasons for it, have the right to appeal."},
     {"heading": "The disciplinary hearing process", "body": "Step 1: Notice of hearing — minimum 24–48 hours'' notice in writing. Include: nature of the charge, date, time, place of hearing, right to representation. Step 2: The hearing itself — employer presents the case, employee responds, both may call witnesses. Step 3: Deliberation — separate from the hearing. Step 4: Outcome notification — in writing, with reasons. Step 5: Appeal process — employee has the right to appeal to a more senior person."},
     {"heading": "Progressive discipline", "body": "First offence (less serious misconduct): verbal warning. Second offence or more serious: written warning. Third offence or serious misconduct: final written warning. Gross misconduct (theft, violence, fraud): dismissal at first offence, after a fair hearing."},
     {"heading": "AdminOS IR module", "body": "AdminOS IR log tracks every warning, hearing, and outcome. All templates (notice of hearing, outcome letters, appeal forms) are pre-built and legally reviewed. Export to PDF for your records. Required by law to maintain disciplinary records."}
   ],
   "key_takeaways": [
     "A fair process protects you — even if the employee was clearly wrong.",
     "Progressive discipline: verbal → written → final warning → dismissal for repeat/serious offences.",
     "Document everything. The CCMA awards in favour of the employee when records are missing."
   ],
   "quiz": [
     {"question": "What is the minimum notice period an employer must give an employee for a disciplinary hearing?", "options": ["Same day", "24–48 hours", "5 business days", "7 days"], "correct": 1}
   ]
 }',
 12, ARRAY['disciplinary.first_record']);

-- ─── Module 6 Lessons — Protecting What You Built ────────────────────────────

INSERT INTO academy_lessons (module_id, lesson_number, title, content_type, content, estimated_minutes, trigger_events) VALUES

('a0000001-0000-0000-0000-000000000006', 1,
 'POPIA: What It Means for Your Business',
 'text',
 '{
   "intro": "The Protection of Personal Information Act is not optional. Fines reach R10 million or 10 years imprisonment. This lesson makes compliance straightforward.",
   "sections": [
     {"heading": "What POPIA covers", "body": "Any information that can identify a living person: names, ID numbers, emails, phone numbers, physical addresses, financial information, health records, race, religion, political views, biometric data. If you store, process, or share any of this — you are subject to POPIA."},
     {"heading": "The 8 conditions for lawful processing", "body": "1. Accountability — you take responsibility. 2. Processing limitation — collect only what you need. 3. Purpose specification — state why you are collecting. 4. Further processing limitation — use it only for what you said. 5. Information quality — keep it accurate. 6. Openness — be transparent. 7. Security safeguards — protect it. 8. Data subject participation — they have the right to access and correct their data."},
     {"heading": "Your practical obligations", "body": "Appoint an Information Officer (for most SMEs, this is the owner). Register your IO details with the Information Regulator (free, online). Create a POPIA policy and privacy notice for your website and client forms. Get explicit consent before sending marketing. Have a data breach response plan. AdminOS POPIA module walks you through all of this."},
     {"heading": "Consequences of non-compliance", "body": "Administrative fines up to R10 million. Criminal penalties up to 10 years imprisonment for directors. Reputational damage — the Information Regulator publishes breaches publicly. Civil claims from data subjects whose data was misused."}
   ],
   "key_takeaways": [
     "If you collect names, emails, or IDs — you must comply with POPIA. No exceptions.",
     "Register your Information Officer with the Information Regulator. It is free and takes 10 minutes.",
     "Explicit, informed consent is required before any direct marketing."
   ],
   "quiz": [
     {"question": "What is the maximum administrative fine under POPIA?", "options": ["R1 million", "R5 million", "R10 million", "R50 million"], "correct": 2}
   ]
 }',
 12, null),

('a0000001-0000-0000-0000-000000000006', 2,
 'Business Insurance: What You Actually Need',
 'text',
 '{
   "intro": "You cannot insure against everything. But there are 5 policies every SA business needs. This lesson explains each one.",
   "sections": [
     {"heading": "1. Public Liability Insurance", "body": "Covers you if a client, member of public, or third party is injured or suffers loss because of your business operations. Essential for: any business that visits clients, has clients visit you, or operates in public spaces. Typical coverage: R1M–R10M per incident. Without it: one slip-and-fall can destroy your business."},
     {"heading": "2. Commercial Property Insurance", "body": "Covers your physical assets: office equipment, stock, tools, machinery, fixtures. Also covers fire, flood, theft, and power surges. Required by most commercial landlords. If you work from home: your household policy almost certainly does not cover business equipment."},
     {"heading": "3. Business Interruption Insurance", "body": "Covers lost revenue if your business cannot operate due to a covered event (fire, flood, load shedding damage, etc.). This is the difference between recovering from a disaster and closing permanently. Typically covers: loss of gross profit, fixed costs, wages, during the interruption period."},
     {"heading": "4. Professional Indemnity (E&O)", "body": "Covers you if a client claims your professional advice or service caused them financial loss. Essential for: accountants, lawyers, consultants, engineers, architects, IT professionals, doctors. Without it: a single professional negligence claim can exceed your entire annual revenue."},
     {"heading": "5. Key Person Insurance", "body": "Life insurance on the business owner or a critical employee. If that person dies or becomes disabled, the payout keeps the business operating while it adjusts. Especially important in owner-run businesses where the owner IS the business."}
   ],
   "key_takeaways": [
     "Public liability and commercial property are the minimum baseline for any business.",
     "Professional indemnity is non-negotiable for any service or advisory business.",
     "Business interruption insurance is underrated until you need it."
   ],
   "quiz": [
     {"question": "Which insurance policy protects you if a client claims your professional advice caused them financial loss?", "options": ["Public Liability", "Business Interruption", "Commercial Property", "Professional Indemnity"], "correct": 3}
   ]
 }',
 10, null),

('a0000001-0000-0000-0000-000000000006', 3,
 'Intellectual Property: Trademarks and Copyright',
 'text',
 '{
   "intro": "Your brand name, logo, and original content may be your most valuable business assets. This lesson shows how to protect them under South African law.",
   "sections": [
     {"heading": "Copyright — automatic protection", "body": "Copyright in South Africa is automatic from the moment of creation. No registration required. Protects: written content, software, music, art, photography, architectural plans. Duration: generally life of the author plus 50 years. What it does not protect: ideas, concepts, names, titles, slogans, styles."},
     {"heading": "Trademarks — registered protection", "body": "A registered trademark gives you exclusive right to use a name, logo, or slogan in a specific class of goods/services. Register with the Companies and Intellectual Property Commission (CIPC) — same body that registered your company. Cost: approximately R590 per class per application. Takes: 12–24 months. Duration: 10 years, renewable indefinitely. Without registration: you have no legal claim to your name if someone else registers it."},
     {"heading": "Domain names", "body": "Register your .co.za domain with a ZACR-accredited registrar (e.g., Afrihost, Hetzner, Xneelo). A .co.za registration does not give you trademark rights but is important for your online presence. Register your domain even if you do not yet have a website."},
     {"heading": "Practical steps for SA businesses", "body": "Step 1: Search the CIPC trademark database (iponline.cipc.co.za) before choosing a brand name — check your name is available. Step 2: Register your trademark in Class 35 (business services) and your specific industry class. Step 3: Keep proof of use — dated photos, invoices, marketing materials showing your trademark in use. Step 4: Monitor for infringement — the CIPC trademark journal publishes new applications monthly."}
   ],
   "key_takeaways": [
     "Copyright is automatic. Trademark protection requires registration.",
     "Search the CIPC database before investing in a brand name you cannot protect.",
     "R590 for a trademark registration is the cheapest insurance your brand will ever have."
   ],
   "quiz": [
     {"question": "In South Africa, is copyright registration required to protect an original work?", "options": ["Yes, you must register with CIPC", "No, copyright is automatic from creation", "Yes, you must register with SARS", "Only for digital content"], "correct": 1}
   ]
 }',
 10, null),

('a0000001-0000-0000-0000-000000000006', 4,
 'Essential Business Contracts',
 'text',
 '{
   "intro": "95% of SA business disputes could have been avoided with a clear written contract. Here are the 5 contracts every business needs.",
   "sections": [
     {"heading": "1. Client Service Agreement / MSA", "body": "Every client relationship should be governed by a signed contract. Must include: scope of services (exactly what you will and will not do), payment terms (amount, due date, late payment consequences), IP ownership (do you retain it or does it transfer to client?), confidentiality obligations, termination clauses (how either party can exit), liability limitation (your maximum liability for any claim). AdminOS Document Vault includes contract templates."},
     {"heading": "2. Employment Contracts", "body": "Covered in Module 5. All employees must have a signed employment contract before starting work. The BCEA requires written particulars of employment within 5 days of start."},
     {"heading": "3. Supplier / Vendor Agreements", "body": "Govern: pricing and payment terms, delivery obligations, quality standards, IP ownership of custom deliverables, confidentiality obligations if they access your systems or data. Protects you when a supplier delivers late or below standard."},
     {"heading": "4. Non-Disclosure Agreement (NDA)", "body": "Use before any conversation where you share sensitive business information: investor pitches, potential partnerships, potential acquisitions, new product development with external parties. A mutual NDA protects both parties. Keep it simple — one page is enough for most situations."},
     {"heading": "5. Terms and Conditions (for e-commerce or recurring services)", "body": "Your T&Cs form the legal basis of every transaction on your website or app. Must include: dispute resolution, return/refund policy, limitation of liability, governing law (South Africa), consumer rights under the Consumer Protection Act."}
   ],
   "key_takeaways": [
     "A verbal agreement is legally enforceable in SA but almost impossible to prove. Get it in writing.",
     "AdminOS has contract templates for all 5 types — customise and store in Document Vault.",
     "Review all contracts annually — your pricing and scope change, your contracts should too."
   ],
   "quiz": [
     {"question": "Which document governs the confidentiality of business information shared with potential partners?", "options": ["MSA", "Employment contract", "NDA", "T&Cs"], "correct": 2}
   ]
 }',
 12, ARRAY['contract.no_expiry']),

('a0000001-0000-0000-0000-000000000006', 5,
 'Your Protection Checklist',
 'exercise',
 '{
   "intro": "Complete this checklist to earn your Foundation Level Certificate. Every item is a real protection that most SA entrepreneurs skip until after the disaster.",
   "tasks": [
     {"title": "POPIA: Information Officer registered", "description": "Your IO details are registered with the Information Regulator (inforegulator.org.za). Your AdminOS POPIA checklist shows 100% complete."},
     {"title": "At least public liability insurance obtained", "description": "You have a current public liability policy. The certificate is stored in your AdminOS Document Vault."},
     {"title": "Trademark search completed", "description": "You have searched the CIPC database (iponline.cipc.co.za) for your business name and logo. Either confirmed clear OR filed your trademark application."},
     {"title": "Client agreement template saved", "description": "Your standard client service agreement is saved in AdminOS Document Vault. All new client relationships use it."},
     {"title": "AdminOS Document Vault has your key documents", "description": "CoR14.3 (company registration), tax clearance certificate, POPIA IO registration, insurance certificate, standard contracts — all stored and accessible."}
   ],
   "reflection_prompts": [
     "Which of the 5 protections did you already have in place?",
     "Which one is most urgent for your specific business situation and why?",
     "What is the single biggest legal risk your business currently faces?"
   ]
 }',
 10, null);
