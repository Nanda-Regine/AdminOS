-- Phase 3.5 — Framework Library Stubs + Contextual Triggers
--
-- Framework stubs: minimal viable entries to satisfy FK constraints on contextual_triggers.
-- Phase 4 will UPDATE these rows with full detailed_content, situation_tags, etc.
-- Triggers: all 30+ business events mapped per MASTER_ROADMAP.

-- ─── Framework Library Stubs ──────────────────────────────────────────────────
-- Phase 4 will UPDATE these with full content, tags, and action routes.

INSERT INTO framework_library (slug, book_title, author, framework_name, core_insight, detailed_content, situation_tags, urgency) VALUES

('profit-first',
 'Profit First', 'Mike Michalowicz',
 'Profit First System',
 'Remove profit from revenue before allocating to expenses. Small plates create small portions. Your bank balance drives your spending behaviour.',
 '{"summary": "5-account allocation system: Income, Profit, Owner Pay, Tax, OpEx. Transfer on 10th and 25th. Take quarterly distributions."}',
 ARRAY['cash-flow','profit-first','financial-management','crisis'],
 'crisis'),

('e-myth',
 'The E-Myth Revisited', 'Michael E. Gerber',
 'The E-Myth Framework',
 'Most businesses are started by technicians having an entrepreneurial seizure. Separate the Technician, Manager, and Entrepreneur roles — then systematise the Technician''s work so the business runs without you.',
 '{"summary": "Franchise prototype model. Build your business so it can be replicated. Every process documented. Every system teachable. Work ON the business, not just IN it."}',
 ARRAY['systems','delegation','e-myth','owner-dependence','sops'],
 'warning'),

('built-to-sell',
 'Built to Sell', 'John Warrillow',
 'Sellable Business Framework',
 'Build a business that can thrive without you. Five attributes of a sellable business: specialise, create a repeatable system, hire people who like to execute, avoid dependence on any one employee or client, build recurring revenue.',
 '{"summary": "The 5 characteristics: teachable product/service, must be needed, specialist not generalist, recurring revenue model, no single client > 15% of revenue."}',
 ARRAY['exit','valuation','built-to-sell','sellable-business'],
 'opportunity'),

('blue-ocean',
 'Blue Ocean Strategy', 'W. Chan Kim & Renée Mauborgne',
 'Blue Ocean ERRC Grid',
 'Stop competing in crowded markets. Create uncontested market space. Use the ERRC grid: Eliminate, Reduce, Raise, Create.',
 '{"summary": "ERRC Grid analysis against industry factors. Value innovation: simultaneously pursue differentiation and low cost. Six paths to reconstruct market boundaries."}',
 ARRAY['strategy','blue-ocean','growth','market-creation'],
 'opportunity'),

('five-dysfunctions',
 'The Five Dysfunctions of a Team', 'Patrick Lencioni',
 'Team Health Pyramid',
 'Five dysfunctions undermine all teams: absence of trust, fear of conflict, lack of commitment, avoidance of accountability, inattention to results. Fix them in order from the base up.',
 '{"summary": "The pyramid: Trust → Conflict → Commitment → Accountability → Results. Team assessment tools. Practical exercises for each level."}',
 ARRAY['team','culture','wellness','burnout','leadership'],
 'warning'),

('work-the-system',
 'Work the System', 'Sam Carpenter',
 'Systems Thinking for Business',
 'Your business is a collection of sequential and independent processes, not a collection of problems. Document every system. Fix the system, not the symptom.',
 '{"summary": "Strategic objective, guiding principles, and working procedures. Document the 5 most important business processes first. Update when something breaks."}',
 ARRAY['systems','sops','documentation','operations'],
 'warning'),

('who-method',
 'Who: The A Method for Hiring', 'Geoff Smart & Randy Street',
 'A Method for Hiring',
 'The #1 problem in business is hiring the wrong people. The A Method uses structured scorecard-based interviewing to hire A players consistently.',
 '{"summary": "Scorecard: outcomes, competencies, culture fit. Four interviews: screening, who, focused, reference. Sell the vision only after candidate qualifies."}',
 ARRAY['hiring','onboarding','who-method','talent'],
 'opportunity'),

('storybrand',
 'Building a StoryBrand', 'Donald Miller',
 'SB7 Framework',
 'Customers don''t buy the best product. They buy the one they understand. Position your customer as the hero, your brand as the guide.',
 '{"summary": "7-part brand script: Character, Problem (external/internal/philosophical), Guide (empathy + authority), Plan, Call to Action, Failure, Success. Apply to all marketing."}',
 ARRAY['marketing','messaging','branding','value-proposition'],
 'opportunity'),

('atomic-habits',
 'Atomic Habits', 'James Clear',
 'Habit Stacking System',
 'You do not rise to the level of your goals. You fall to the level of your systems. Small 1% improvements compound to remarkable results.',
 '{"summary": "4 laws of behaviour change: Make it obvious, attractive, easy, satisfying. Habit stacking. Environment design. Identity-based habits."}',
 ARRAY['mindset','habits','productivity','growth'],
 'opportunity'),

('lra-discipline',
 'Labour Relations Act Discipline Guide', 'Department of Employment and Labour',
 'Schedule 8 Disciplinary Process',
 'Fair labour practices require a fair reason AND a fair procedure for any dismissal. The CCMA will scrutinise both.',
 '{"summary": "Schedule 8 Code of Good Practice. Progressive discipline. The hearing process. Substantive and procedural fairness. Documentation requirements."}',
 ARRAY['disciplinary','lra','hr','industrial-relations'],
 'warning'),

('cash-conversion',
 'Working Capital Management', 'SMME Finance Best Practice',
 'Cash Conversion Cycle Optimisation',
 'The gap between paying suppliers and collecting from customers is the hidden enemy of growing businesses. Shrink it systematically.',
 '{"summary": "Cash conversion cycle = inventory days + debtor days - creditor days. Three levers: invoice faster, collect faster, pay slower. Target: CCC under 30 days."}',
 ARRAY['debtors','cash-conversion','working-capital','cash-flow'],
 'warning'),

('popia-compliance',
 'POPIA Compliance Framework', 'Information Regulator (South Africa)',
 'POPIA 8 Conditions Framework',
 'Process personal information lawfully. The 8 conditions are not optional — they are the minimum standard for every South African business.',
 '{"summary": "8 conditions: Accountability, Processing limitation, Purpose specification, Further processing limitation, Information quality, Openness, Security safeguards, Data subject participation."}',
 ARRAY['popia','compliance','data-protection','legal'],
 'warning'),

('vat-guide',
 'VAT Guide for Vendors', 'South African Revenue Service',
 'SA VAT System',
 'VAT registration above R1M turnover is mandatory. Input vs output VAT. Zero-rated vs exempt. Filing and payment obligations.',
 '{"summary": "Register within 21 days of crossing R1M. Standard rate 15%. Zero-rated supplies (exports, basic foods). VAT201 every 2 months. eFiling recommended."}',
 ARRAY['vat','tax','compliance','scale'],
 'warning'),

('customer-recovery',
 'The Effortless Experience', 'Matthew Dixon',
 'Customer Effort Score & Recovery',
 'Customer loyalty is built by reducing effort and recovering perfectly from failures — not by exceeding expectations.',
 '{"summary": "Reduce customer effort: solve it first contact. Recovery paradox: a handled problem creates more loyalty than no problem. The LAST framework: Listen, Apologise, Solve, Thank."}',
 ARRAY['nps','customer-recovery','retention','customer-service'],
 'warning'),

('bbbbee-guide',
 'B-BBEE Codes of Good Practice', 'DTI South Africa',
 'B-BBEE Scorecard',
 'B-BBEE is both a compliance obligation and a competitive advantage. Improving your level opens tender markets and preferential procurement opportunities.',
 '{"summary": "7 pillars: Ownership, Management Control, Skills Development, Enterprise and Supplier Development, Socio-Economic Development, Gender, and Youth. EME certificate for turnover under R10M."}',
 ARRAY['bbbbee','transformation','compliance','procurement'],
 'opportunity'),

('fx-regulations',
 'SARB Exchange Control Manual', 'South African Reserve Bank',
 'SA Exchange Control Framework',
 'All cross-border payments require SARB approval or use of authorised dealer banks. Failure to comply is a criminal offence.',
 '{"summary": "Authorised dealer banks handle most standard FX transactions. Capital flows require SARB approval. Tax clearance required for transfers above R1M/year. FinSurv reporting for certain transactions."}',
 ARRAY['forex','sarb','international','compliance'],
 'warning'),

('payroll-compliance',
 'Payroll Compliance Guide', 'SARS / Department of Labour',
 'SA Payroll Compliance Framework',
 'Every employer must register for PAYE, UIF, and SDL. File EMP201 by the 7th of each month. Annual reconciliation via EMP501.',
 '{"summary": "Registration: PAYE and UIF on eFiling. Monthly EMP201 by 7th. Annual EMP501 reconciliation. IRP5 certificates to all employees. UIF via uFiling."}',
 ARRAY['payroll','compliance','uif','paye','employers'],
 'warning'),

('whatsapp-popia',
 'WhatsApp Business + POPIA Compliance', 'Compliance Best Practice',
 'WhatsApp Marketing Compliance',
 'WhatsApp marketing requires explicit POPIA consent. Sending unsolicited messages is a POPIA violation — and WhatsApp can ban your number.',
 '{"summary": "Consent: must be specific, informed, written. Opt-out mechanism required on every broadcast. Record consent with timestamp. Marketing messages must be relevant and limited in frequency."}',
 ARRAY['marketing','popia','whatsapp','broadcast'],
 'warning'),

('purchase-orders',
 'Procurement Best Practices', 'CIPS South Africa',
 'Purchase Order System',
 'Every purchase commitment should generate a PO. POs protect you: they authorise spend, define delivery expectations, and create an audit trail.',
 '{"summary": "PO number links to supplier invoice for 3-way matching. Prevents maverick spend. Required for VAT input claims on qualifying purchases. Automate PO creation in AdminOS Inventory module."}',
 ARRAY['procurement','purchase-orders','inventory','spend-control'],
 'opportunity'),

('key-client-risk',
 'Client Concentration Risk', 'SME Risk Management',
 'Client Diversification Framework',
 'If one client represents more than 20% of your revenue, they own you. Build to a maximum of 15% per client.',
 '{"summary": "Identify concentration risk. Diversification strategy: active pipeline for new clients. Retainer model to lock in existing clients with long-term agreements. Always be finding: treat sales as a continuous process."}',
 ARRAY['sales','client-risk','concentration','revenue-diversification'],
 'warning'),

('leave-management',
 'Managing Leave Under the BCEA', 'Labour Law Experts SA',
 'Leave Management Framework',
 'Leave management disputes are in the top 5 CCMA referral categories. A consistent, documented leave policy prevents most disputes.',
 '{"summary": "Leave policy must be in writing. Annual leave: 15 working days on 5-day week. Sick leave: 30 days per 3-year cycle. Family responsibility: 3 days per year. Process: request → approve/decline with reason → record in writing."}',
 ARRAY['hr','leave-management','conflict','bcea'],
 'warning'),

('international-expansion',
 'Exporting from South Africa', 'SEDA / DTI',
 'SA Export Framework',
 'International business from SA requires SARB foreign exchange authorisation, SARS clearance, and knowledge of the target market''s import requirements.',
 '{"summary": "Authorised dealer bank for FX. Tax compliance certificate for transfers >R1M. Incoterms for delivery obligations. Country import duties and regulations. Forex risk management."}',
 ARRAY['forex','sarb','international','export'],
 'opportunity')

ON CONFLICT (slug) DO NOTHING;

-- ─── Contextual Triggers ─────────────────────────────────────────────────────
-- All 30+ triggers from MASTER_ROADMAP §3.5
-- lesson_id is NULL — knowledge graph surfaces framework dynamically
-- cooldown_hours: 168 = 1 week, 720 = 1 month, 8760 = 1 year

INSERT INTO contextual_triggers (event_type, framework_slug, message_template, cooldown_hours, condition) VALUES

-- Finance
('invoice.first_sent',
 'storybrand',
 'You just sent your first invoice! Pro tip: your payment terms are on the invoice — have you agreed them with your client verbally too?',
 720, '{}'),

('invoice.overdue_7d',
 'cash-conversion',
 'An invoice has been unpaid for 7 days. AdminOS has sent a reminder. If not paid by day 21, a phone call closes 60% of late payments.',
 168, '{"days_overdue": 7}'),

('invoice.overdue_30d',
 'profit-first',
 'This invoice is 30 days overdue. Every rand sitting with a client costs you in interest and opportunity. Time for a formal demand letter.',
 168, '{"days_overdue": 30}'),

('financial.cash_negative',
 'profit-first',
 'Your cash position has gone negative. This is a crisis signal. Profit First can structurally prevent this from happening again.',
 720, '{}'),

('financial.margin_drop',
 'e-myth',
 'Your gross margin has dropped by 5 or more points this month. This usually means costs rose without a price adjustment. Review your pricing.',
 168, '{"drop_points": 5}'),

('financial.revenue_1m',
 'vat-guide',
 'Congratulations — your revenue has crossed R1 million! You are now approaching the mandatory VAT registration threshold. Time to register.',
 8760, '{}'),

('financial.debtor_days_45',
 'cash-conversion',
 'Your average debtor days have exceeded 45 days. Your working capital is under pressure. Review your collection process.',
 720, '{"debtor_days": 45}'),

('financial.vat_threshold',
 'vat-guide',
 'Your taxable supplies are approaching R1 million. VAT registration becomes mandatory at this threshold. Prepare now.',
 720, '{}'),

('financial.cash_positive',
 'profit-first',
 'Your cash position has been positive for 3 consecutive months — well done! Have you set up your Profit First accounts yet?',
 8760, '{}'),

('financial.revenue_plateau',
 'blue-ocean',
 'Your revenue has been flat for 3 consecutive months. This is a signal to examine your market strategy. Blue Ocean thinking asks: what can you create that does not yet exist?',
 720, '{"plateau_months": 3}'),

('financial.international_tx',
 'fx-regulations',
 'You have processed your first international transaction. South African exchange control rules apply to all cross-border payments.',
 8760, '{}'),

-- Staff and HR
('staff.first_added',
 'lra-discipline',
 'You just added your first team member! This module covers employment contracts, BCEA rights, and UIF registration — everything you need for a legally sound employment relationship.',
 8760, '{}'),

('staff.new_hire',
 'who-method',
 'You have added a new team member. The WHO method — scorecard-based hiring — dramatically increases the chances that your new hire is the right fit. Have you defined what success looks like for this role?',
 720, '{}'),

('staff.wellness_low',
 'five-dysfunctions',
 'Your team''s average wellness score has dropped below 3. Low wellness is an early warning of dysfunction. Patrick Lencioni''s team health pyramid can help diagnose the root cause.',
 168, '{"wellness_avg": 3}'),

('expense.first_submitted',
 'work-the-system',
 'Your first expense claim has been submitted. Have you documented your expense policy? A clear written policy prevents disputes and speeds up approvals.',
 8760, '{}'),

('leave.declined_twice',
 'leave-management',
 'You have declined leave for the same employee twice. Repeated leave refusals without documented reasons are a CCMA risk. Ensure your decision is documented.',
 168, '{"decline_count": 2}'),

('disciplinary.first_record',
 'lra-discipline',
 'You have recorded your first disciplinary incident. Ensure you follow Schedule 8 of the Labour Relations Act — a fair reason and a fair procedure are both required.',
 720, '{}'),

('payroll.first_run',
 'payroll-compliance',
 'You have run your first payroll. Have you registered as an employer with SARS for PAYE and with the Department of Labour for UIF? Both are required before your first payroll.',
 8760, '{}'),

-- Clients and Sales
('client.key_dependency',
 'key-client-risk',
 'One client now represents more than 20% of your revenue. This is a concentration risk. If they leave, you lose 20% of revenue overnight. Diversification is urgent.',
 720, '{"client_revenue_pct": 20}'),

('customer.nps_below_6',
 'customer-recovery',
 'A customer has given you an NPS score below 6. They are a Detractor. A personal follow-up within 24 hours has an 80% recovery rate.',
 168, '{"nps_score": 6}'),

-- Compliance
('contract.no_expiry',
 'lra-discipline',
 'You have uploaded a contract with no expiry date. Contracts without review dates become outdated and create legal risk. Set a reminder to review in 12 months.',
 720, '{}'),

('broadcast.first_sent',
 'whatsapp-popia',
 'You have sent your first broadcast. POPIA requires explicit consent from all recipients before receiving marketing messages. Have you documented consent for everyone on your list?',
 8760, '{}'),

('compliance.bbbbee_uploaded',
 'bbbbee-guide',
 'You have uploaded your B-BBEE certificate. Did you know your B-BBEE level determines your preference points for government tenders? Level 1 qualifies for 20 preference points.',
 8760, '{}'),

-- Operations
('supplier.first_no_po',
 'purchase-orders',
 'You have added a supplier without creating a purchase order. POs authorise spend before it happens. Without them, you lose control of your cost base.',
 720, '{}'),

('ops.no_sops',
 'work-the-system',
 'You have no Standard Operating Procedures documented. Sam Carpenter''s Work the System principle: document the 5 most critical business processes first. AdminOS SOP module makes this easy.',
 720, '{}'),

('owner.task_overload',
 'e-myth',
 'You are completing over 70% of all tasks yourself. This is the Technician Trap that Michael Gerber describes in The E-Myth. You are working IN the business when you should be working ON it.',
 168, '{"owner_task_pct": 70}'),

-- Business lifecycle
('business.year_one',
 'built-to-sell',
 'Your business has been operating for 1 year — congratulations! You are in the top 50% of SA businesses. Year two unlocks your Momentum Level academy content.',
 8760, '{}'),

('business.year_two',
 'built-to-sell',
 'Two years in business! You are now in the top 20% of SA businesses. Mastery Level academy content is now unlocked.',
 8760, '{}'),

('business.year_three',
 'built-to-sell',
 'Three years in business — you are in the top 10% of SA entrepreneurs. Legacy Level content is now available. Start thinking about what you want your business to become.',
 8760, '{}'),

('exit.score_calculated',
 'built-to-sell',
 'Your first exit readiness score has been calculated. John Warrillow''s Built to Sell framework gives you 5 criteria to work toward. The best time to build for exit is when you are not planning to exit.',
 8760, '{}'),

-- Health score
('health.score_below_60',
 'e-myth',
 'Your Business Health Score has dropped below 60. This means multiple dimensions of your business need attention simultaneously. Langa can help you prioritise the most impactful actions.',
 168, '{"health_score": 60}'),

-- Marketing
('financial.international_marketing',
 'whatsapp-popia',
 'Before expanding marketing to international audiences, check that your consent records and data storage comply with both POPIA and the destination country''s laws (e.g. GDPR for EU).',
 8760, '{}')

ON CONFLICT DO NOTHING;
