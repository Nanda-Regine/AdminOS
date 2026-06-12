-- Phase 4d: Framework Library batch — 30 more entries
-- Covering: HR, Customer Success, Digital Marketing, Cash Flow, Team Culture, Negotiation

INSERT INTO framework_library (slug, title, source_book, author, category, situation_tags, urgency, summary, detailed_content)
VALUES

-- HR & PEOPLE MANAGEMENT
('competency-framework', 'Competency-Based Hiring', 'Who', 'Geoff Smart', 'hr',
 ARRAY['hiring','recruitment','team','staff'],
 'opportunity',
 'Hire for outcomes, not CVs — define what success looks like before you interview anyone.',
 '{"one_sentence": "Most hiring mistakes happen because people interview candidates before defining what the role actually needs to achieve.", "problem_it_solves": "Businesses hire people who seem impressive in interviews but fail at the actual job, leading to costly turnover.", "how_it_works": "Before advertising a role, write a Scorecard: 1) Mission (one sentence describing the role''s purpose), 2) Outcomes (5-10 measurable outcomes the person must achieve in 12 months), 3) Competencies (leadership, self-discipline, communication etc specific to the role). In the interview, ask ''Tell me about your greatest achievement at your last role'' — listen for outcomes, not duties. Hire the person who achieved the most relevant outcomes, not the most impressive CV.", "book_in_action": "A Sandton marketing agency had 70% annual turnover. After implementing Scorecards, they hired based on proven lead-generation outcomes rather than degrees and logos. Turnover dropped to 20% in 18 months.", "african_context": "South African employment equity targets create pressure to hire quickly. Scorecards actually help — they make the business case for any hire objective and document-able, reducing unfair discrimination risk."}'
),

('stay-interviews', 'Stay Interviews', 'Love ''Em or Lose ''Em', 'Beverly Kaye', 'hr',
 ARRAY['retention','engagement','team','culture'],
 'warning',
 'Ask your best employees what would make them stay — before they hand in their notice.',
 '{"one_sentence": "Exit interviews are too late; stay interviews are the conversations that prevent the exit.", "problem_it_solves": "Managers only discover retention problems when resignation letters arrive — too late to fix them.", "how_it_works": "Once a year, have a private 30-minute ''stay interview'' with each valued team member. Ask: What do you look forward to at work? What do you dread? What would make you stay? What would make you leave? What could I do more of as your manager? Listen without defending. Take action on at least one item they mention. The conversation itself communicates that you value them.", "book_in_action": "A Pretoria law firm''s HR manager found through stay interviews that two senior associates wanted flexible Friday hours — a zero-cost change. Both rejected external offers that same quarter.", "african_context": "BEE-credentialed staff are aggressively recruited in South Africa. Stay interviews give you early warning and a chance to retain professionals whose departure would affect your scorecard."}'
),

('performance-improvement-plan', 'The PIP — Done Right', 'Crucial Conversations', 'Kerry Patterson', 'hr',
 ARRAY['performance','compliance','labour','staff'],
 'warning',
 'A Performance Improvement Plan protects both the employee and the business — document it correctly from day one.',
 '{"one_sentence": "A PIP is not a prelude to dismissal — it is a documented attempt to help the employee succeed.", "problem_it_solves": "Managers avoid formal performance processes, then face CCMA unfair dismissal claims because they never documented warnings or improvement plans.", "how_it_works": "A proper PIP contains: specific performance shortfall (with examples and dates), the standard expected, resources and support provided, timeline (usually 30-60 days), check-in schedule, and consequences if not met. Both parties sign. HR or a witness should be present. Conduct check-ins as scheduled — document progress or lack thereof. If performance does not improve after genuine support, the dismissal is substantively and procedurally fair.", "book_in_action": "A Cape Town retailer faced a R150 000 CCMA award because they dismissed an underperforming cashier without a PIP. The same situation with a documented PIP would have been defensible and fair.", "african_context": "South African labour law (LRA Schedule 8 Code of Good Practice) requires progressive discipline. PIPs are not optional — they are the foundation of legally defensible dismissal."}'
),

('onboarding-90-day', '90-Day Onboarding Plan', 'The First 90 Days', 'Michael Watkins', 'hr',
 ARRAY['onboarding','training','retention','staff'],
 'opportunity',
 'Structure the first 90 days for every new hire — it determines whether they stay for years or leave in months.',
 '{"one_sentence": "The first 90 days determine whether a new hire succeeds or fails — intentional onboarding is a multiplier on your recruitment investment.", "problem_it_solves": "New employees are handed a phone and told to figure it out — expensive hires who could contribute enormously are lost to confusion and discouragement.", "how_it_works": "Design three phases: Month 1 — Learn (shadow, observe, understand the business, no solo work), Month 2 — Apply (do tasks with supervision, ask questions, get feedback weekly), Month 3 — Contribute (independent work, take ownership of one clear area). Set explicit milestones for each month. The manager checks in weekly. At Day 90, conduct a formal review against the milestones.", "book_in_action": "A Johannesburg accounting firm implemented the 90-day plan. New graduate retention after year one went from 40% to 85%. Senior hires reached full productivity 6 weeks faster.", "african_context": "South Africa''s skills gap means even qualified hires need contextual onboarding for your industry, region, and regulatory environment. Do not assume any knowledge."}'
),

('ikigai-role-design', 'Ikigai Role Design', 'Linchpin', 'Seth Godin', 'hr',
 ARRAY['culture','engagement','motivation','staff'],
 'opportunity',
 'Design roles where what employees are good at, what they love, what the world needs, and what the business pays for intersect.',
 '{"one_sentence": "The most productive employees are doing work that sits at the intersection of their skills, passion, and your business need.", "problem_it_solves": "Misaligned roles produce mediocre performance and disengagement — employees are technically employed but emotionally absent.", "how_it_works": "Ikigai is a Japanese concept: the intersection of What you love, What you are good at, What the world needs, and What you can be paid for. For each role in your business, ask: does this person''s ikigai match this job? If not, can you reshape the role? If someone is excellent at customer engagement but stuck in a back-office data entry role, performance will always be average. Move people toward their ikigai.", "book_in_action": "A Durban logistics company realised their operations manager was in the wrong role — she was gifted at negotiation (sales) and hated route planning. A role swap tripled her contribution and improved sales by 25%.", "african_context": "In township economies, people often take any available job. But high-performing businesses invest in understanding what each person is genuinely good at — informal sector leaders do this intuitively."}'
),

-- CUSTOMER SUCCESS
('customer-success-playbook', 'Customer Success Playbook', 'Customer Success', 'Nick Mehta', 'sales',
 ARRAY['retention','customer','onboarding','revenue'],
 'opportunity',
 'Your best growth lever is not acquiring new customers — it is making existing ones wildly successful.',
 '{"one_sentence": "Retention is the new acquisition — a business with 90% customer retention grows twice as fast as one with 80% retention.", "problem_it_solves": "Businesses over-invest in sales and marketing while letting customers churn for preventable reasons.", "how_it_works": "Define customer success as the customer achieving their desired outcome with your product or service. Map the customer journey: Onboarding (first 30 days), Adoption (first 90 days), Renewal/Expansion, Advocacy. At each stage, identify the ''red flags'' (leading indicators of churn) and intervene proactively. Create a Health Score for each customer: usage frequency, NPS score, support ticket volume, and payment history.", "book_in_action": "A Johannesburg HR software company added a dedicated Customer Success function. Churn dropped from 25% to 8% annually. Revenue from expansion and upsells (existing customers) grew to 40% of total revenue.", "african_context": "South African SMEs cannot afford to replace churned customers as easily as large corporates. Customer success is an affordable retention tool: personal WhatsApp check-ins, quarterly business reviews, and proactive troubleshooting."}'
),

('churn-prediction', 'Early Churn Warning System', 'The Lean Startup', 'Eric Ries', 'sales',
 ARRAY['retention','customer','churn','revenue'],
 'warning',
 'Identify at-risk customers 60-90 days before they cancel — intervene while there is still time.',
 '{"one_sentence": "By the time a customer tells you they are leaving, the decision was made weeks ago.", "problem_it_solves": "Businesses only discover churn when it happens — every intervention arrives too late.", "how_it_works": "Define your churn warning signals. Common ones: NPS score below 7, no usage in 14+ days, support ticket unresolved for 5+ days, payment 7+ days late, key contact has changed. When two or more signals trigger simultaneously, assign that customer to an immediate outreach. Call first, email as follow-up. The question to ask: ''Is there anything standing between you and getting full value from us?''", "book_in_action": "A Pretoria payroll software company set up a ''Churn alert'' that triggered when a company had not run payroll in 21+ days (their usual cycle). Their customer success team contacted 140 at-risk accounts in one quarter, saving an estimated R2.4M ARR.", "african_context": "WhatsApp-based businesses in South Africa often lose customers silently — the last message just goes unanswered. A 14-day WhatsApp silence trigger plus a proactive ''Hi, how''s everything going?'' message saves relationships."}'
),

('referral-programme-design', 'Structured Referral Programme', 'The Referral Engine', 'John Jantsch', 'marketing',
 ARRAY['growth','customer','marketing','revenue'],
 'opportunity',
 'Design a systematic programme that makes it easy and rewarding for happy customers to refer others.',
 '{"one_sentence": "Word of mouth is your most powerful marketing channel — but only if you design it deliberately, not hope it happens by accident.", "problem_it_solves": "Happy customers want to refer but never quite get around to it — no one has made it easy or given them a reason to act now.", "how_it_works": "A referral programme has four components: 1) Ask at the right moment (after a win, not at renewal), 2) Make it frictionless (send the referral link immediately via WhatsApp), 3) Reward both parties (referrer and referee each get something), 4) Follow up quickly (a referred lead that waits more than 24 hours goes cold). Track referral sources in your CRM. The best time to ask: immediately after a customer says something like ''This saved me so much time'' or ''I didn''t know you could do that.''", "book_in_action": "Dropbox''s referral programme (extra storage for both parties) grew them from 100 000 to 4 000 000 users in 15 months. The mechanics are replicable by any business.", "african_context": "South African businesses run on trust networks. A formal referral programme formalises what already happens informally — and makes it scalable."}'
),

-- DIGITAL MARKETING
('content-calendar', 'The Content Calendar System', 'Content Inc.', 'Joe Pulizzi', 'marketing',
 ARRAY['marketing','social-media','content','brand'],
 'opportunity',
 'Publish valuable content consistently — a 12-week content calendar eliminates the blank-page paralysis.',
 '{"one_sentence": "Consistency beats brilliance: a mediocre post published every week outperforms a masterpiece published once a year.", "problem_it_solves": "Businesses know they should post on social media but create content reactively, producing random and sparse output that builds no audience.", "how_it_works": "Choose one primary content platform (Instagram, LinkedIn, WhatsApp broadcast, YouTube — whatever your customer uses). Commit to one post per week minimum. Create a 12-week content calendar: Week 1 — Problem, Week 2 — Solution, Week 3 — Customer Story, Week 4 — Behind the Scenes, Week 5 — Tip, Week 6 — FAQ. Batch-create content on one day per month. Use a template for each post type so creation takes 20 minutes not 2 hours.", "book_in_action": "A Durban photographer who posted consistently on Instagram for 12 weeks saw inquiries increase 5× — not because their photos improved, but because potential clients saw them regularly enough to trust them.", "african_context": "WhatsApp broadcast lists are underutilised by South African businesses. A weekly voice note or image update to your customer broadcast list takes 10 minutes and creates ongoing top-of-mind presence."}'
),

('local-seo', 'Local SEO for SMEs', 'Ultimate Guide to Local Business Marketing', 'Perry Marshall', 'marketing',
 ARRAY['marketing','digital','online','visibility'],
 'opportunity',
 'Rank at the top of Google when local customers search for what you offer — for free.',
 '{"one_sentence": "When someone in your area Googles your service, you should be the first result — Google Business Profile makes this possible for free.", "problem_it_solves": "Small businesses are invisible online despite being excellent at their trade — customers who would choose them never find them.", "how_it_works": "Claim and complete your Google Business Profile: add your exact address, phone number, hours, photos (at least 10), and business category. Ask every satisfied customer to leave a Google Review — even 15-20 reviews can push you to the top of local search results. Respond to every review (good and bad). Add one Google post per week with a photo and current offer or news. This is free and takes 30 minutes per week.", "book_in_action": "A Soweto bakery went from zero online presence to 3.8 stars with 47 reviews in 6 months. Monthly orders from Google searches went from 0 to 40% of total revenue.", "african_context": "South African consumers increasingly use Google Maps to find local services before WhatsApp. The business with more reviews and a complete profile almost always wins the first click."}'
),

('email-marketing-automation', 'Email Automation Sequences', 'Email Marketing Rules', 'Chad White', 'marketing',
 ARRAY['marketing','automation','retention','revenue'],
 'opportunity',
 'Automated email sequences work 24/7 to nurture, convert, and retain customers without your involvement.',
 '{"one_sentence": "An automated welcome email sent within 10 minutes of signup generates 4× more opens and 5× more clicks than one sent 24 hours later.", "problem_it_solves": "Businesses collect customer emails but never use them systematically — each email is a one-off effort that never compounds.", "how_it_works": "Build three core sequences: 1) Welcome (5 emails over 2 weeks introducing your business and delivering immediate value), 2) Purchase Follow-up (3 emails: delivery confirmation, usage tip, satisfaction check), 3) Win-Back (3 emails sent to customers inactive for 90 days: we miss you + offer). Each email should have one clear action. Use Mailchimp or Klaviyo (free tiers available).", "book_in_action": "A Cape Town online plant nursery set up a 5-email welcome sequence with watering tips and product recommendations. Email-attributed revenue tripled in 90 days with zero additional ad spend.", "african_context": "Email open rates in South Africa average 28% (higher than global 21%). South African SME audiences respond well to personal, conversational emails from the business owner."}'
),

-- CASH FLOW MANAGEMENT
('13-week-cash-forecast', '13-Week Cash Forecast', 'Simple Numbers', 'Greg Crabtree', 'finance',
 ARRAY['cash-flow','finance','planning','survival'],
 'crisis',
 'Project your cash inflows and outflows 13 weeks ahead — cash surprises kill otherwise healthy businesses.',
 '{"one_sentence": "Most business failures are not caused by unprofitability — they are caused by running out of cash at the wrong moment.", "problem_it_solves": "Business owners look at bank balance not cash forecast — a full bank account today can become an empty one in 6 weeks with no warning.", "how_it_works": "Create a simple spreadsheet with 13 weekly columns. Rows: Opening Balance, Plus: Invoices due this week + any other income, Minus: Payroll due, Rent due, VAT due, Supplier payments due, Other fixed costs, Closing Balance. Fill in known commitments first. Then forecast likely collections from outstanding invoices. A negative closing balance in any week means you need to act NOW — chase debtors, delay payments, or arrange a facility.", "book_in_action": "A Johannesburg event company discovered via their 13-week forecast that week 9 would leave them R180 000 short. With 9 weeks'' notice, they negotiated extended terms with two suppliers and collected early from a corporate client — crisis avoided.", "african_context": "VAT submissions on the 25th and payroll on the 25th often fall in the same week — a cash crunch that kills poorly-planned businesses. The 13-week forecast makes this visible months in advance."}'
),

('debtors-collection-system', 'Systematic Debtors Collection', 'Profit First', 'Mike Michalowicz', 'finance',
 ARRAY['cash-flow','debtors','invoicing','revenue'],
 'warning',
 'A structured follow-up system collects outstanding invoices weeks faster than ad hoc chasing.',
 '{"one_sentence": "Uncollected receivables are the most common cause of cash flow crises in otherwise profitable businesses.", "problem_it_solves": "Business owners feel awkward chasing payment and wait too long — average days to payment stretches from 30 to 90+ days.", "how_it_works": "Create a collection ladder: Day 1 (invoice sent with auto-payment reminder), Day 7 (WhatsApp: ''Hi, just checking the invoice arrived?''), Day 14 (Call: ''I''m following up on invoice #XXX due today''), Day 21 (Formal email: overdue notice, interest clause triggered), Day 30 (Final notice before handover to debt collector or lawyer), Day 45 (Handover). Never skip steps and never make it personal — make it systematic. The system chases, not you.", "book_in_action": "A Pretoria cleaning company reduced their debtors days outstanding from 67 to 31 by implementing this sequence in their admin system. Cash flow freed up R420 000 in working capital.", "african_context": "Restorative collection approach: South African community relationships are valuable. Use the early steps (Day 1-14) as care, not aggression. Many late payments are oversight, not avoidance — a WhatsApp beats a lawyer."}'
),

('working-capital-optimisation', 'Working Capital Optimisation', 'Simple Numbers', 'Greg Crabtree', 'finance',
 ARRAY['cash-flow','finance','operations','scale'],
 'opportunity',
 'Reduce the cash trapped in debtors and stock while lengthening supplier payment terms — free up working capital without borrowing.',
 '{"one_sentence": "Working capital is cash tied up in your operations — reducing the cash-to-cash cycle is equivalent to a free loan from within your own business.", "problem_it_solves": "Businesses need to borrow or inject cash to fund growth when improved working capital management would provide the same funds at zero cost.", "how_it_works": "The Cash Conversion Cycle = Days Sales Outstanding (how long customers take to pay) + Days Inventory Outstanding (how long stock sits) − Days Payable Outstanding (how long you take to pay suppliers). Shorten DSO by requiring deposits or shorter payment terms. Reduce DIO by stocking less slow-moving inventory. Extend DPO by negotiating 60-day terms with key suppliers. Reducing the CCC by 10 days in a R5M revenue business frees up R137 000 in cash.", "book_in_action": "A Durban food manufacturer reduced their CCC from 72 days to 44 days by requiring 50% deposits on custom orders and negotiating 45-day terms with their key supplier. No borrowing needed.", "african_context": "South African informal sector businesses instinctively understand cash cycles — they buy on Friday market day and sell by Sunday. Formalise this intuition into a working capital strategy."}'
),

-- NEGOTIATION
('principled-negotiation', 'Principled Negotiation (BATNA)', 'Getting to Yes', 'Roger Fisher', 'strategy',
 ARRAY['negotiation','suppliers','contracts','sales'],
 'opportunity',
 'Negotiate outcomes that work for both parties — your BATNA (Best Alternative To Negotiated Agreement) is your real power.',
 '{"one_sentence": "Your power in any negotiation is determined by how good your alternative is if the negotiation fails.", "problem_it_solves": "Business owners either capitulate in negotiations (to preserve the relationship) or take hard positions (damaging it) — both produce poor outcomes.", "how_it_works": "Before any negotiation, define your BATNA: what will you do if this deal falls through? The better your BATNA, the stronger your position. In the negotiation, focus on interests (what each party actually needs) not positions (what they say they want). Often both parties'' interests can be satisfied with a creative option neither originally proposed. End every negotiation with a written confirmation of what was agreed.", "book_in_action": "A freelance designer was offered R800/day by a client. Her BATNA was three other clients at R1 200/day. She named R1 500/day knowing she could walk. They met at R1 100. She accepted — still better than her walk-away.", "african_context": "Ubuntu negotiation: acknowledge the relationship before the terms. ''I want us both to do well here'' is not weakness — it is how South African business relationships are built to last."}'
),

('supplier-negotiation-tactics', 'Supplier Negotiation Tactics', 'Never Split the Difference', 'Chris Voss', 'operations',
 ARRAY['negotiation','suppliers','costs','procurement'],
 'opportunity',
 'Use tactical empathy and calibrated questions to negotiate better terms with suppliers.',
 '{"one_sentence": "Negotiation is not a battle — it is a collaborative search for a deal that both parties can commit to.", "problem_it_solves": "Business owners accept supplier terms at face value, leaving significant cost reduction on the table.", "how_it_works": "Chris Voss''s key tactics: Mirroring (repeat the last 2-3 words they said — creates rapport and more information), Labelling (''It seems like you''re concerned about...''), Calibrated questions (''How am I supposed to do that?'' — makes them solve your problem), The Ackermann model (offer 65%, then 85%, then 95%, then 100% of your target — final offer with a non-round number creates credibility). Never accept a first price. Always ask ''Is that the best you can do?'' at least once.", "book_in_action": "A Johannesburg print shop applied Voss''s calibrated question approach with their paper supplier. The question ''How am I supposed to afford that at current volumes?'' led to a structured volume discount that saved R180 000 annually.", "african_context": "South African market relationships are often long-standing and personal. Tactical empathy fits perfectly: acknowledge the relationship, then have the commercial conversation."}'
),

-- FINANCIAL INTELLIGENCE
('financial-statements-101', 'Reading Financial Statements', 'Financial Intelligence', 'Karen Berman', 'finance',
 ARRAY['finance','accounting','reporting','decision-making'],
 'opportunity',
 'Every business owner must be able to read and understand three financial statements.',
 '{"one_sentence": "You cannot manage what you cannot read — financial statements are the dashboard of your business.", "problem_it_solves": "Business owners delegate all financial understanding to their accountant, making them dependent and unable to spot problems or opportunities early.", "how_it_works": "Three essential statements: 1) Income Statement (P&L): Revenue − Cost of Sales = Gross Profit. Gross Profit − Operating Expenses = Net Profit. Focus on gross margin % and net margin %. 2) Balance Sheet: Assets = Liabilities + Equity. Assets you own, Liabilities you owe, Equity is what''s left for you. 3) Cash Flow Statement: Operating cash flow (from operations), Investing (buying equipment), Financing (loans/equity). A business can show profit on the P&L while running out of cash — the cash flow statement shows you why.", "book_in_action": "A Johannesburg entrepreneur saw a R250 000 profit on her P&L but had R40 000 in the bank. After learning to read the cash flow statement, she found R180 000 was locked in outstanding debtors — a collections problem, not a profitability one.", "african_context": "SARS monthly submissions, provisional tax, and VAT all reference financial statement data. Understanding them personally protects you from errors and from unscrupulous accountants."}'
),

('vat-management', 'VAT Management for SMEs', 'Tax for Dummies', 'Eric Tyson', 'finance',
 ARRAY['tax','compliance','cash-flow','finance'],
 'warning',
 'VAT is not your money — manage it separately from day one to avoid SARS penalties.',
 '{"one_sentence": "VAT you collect belongs to SARS from the moment it enters your account — treat it that way.", "problem_it_solves": "Business owners spend their VAT collections on operating expenses and then face a VAT payment crisis every two months.", "how_it_works": "If you are VAT registered (or approaching the R1M threshold): Open a dedicated VAT savings account. Every time you receive a VAT-inclusive payment, transfer 15/115 of the total (the VAT portion) to this account immediately. When your bi-monthly VAT return is due, the funds are there. Also track VAT on expenses — you can claim Input VAT back against your Output VAT. Keep all VAT invoices from suppliers. If your output VAT exceeds input, you pay SARS. If input exceeds output, SARS refunds you.", "book_in_action": "A Gauteng contractor received R115 000 on a project (including R15 000 VAT). He spent the full amount. When SARS required R15 000 net payment, he had to borrow from family. After implementing the VAT account, this never happened again.", "african_context": "SARS late payment penalties are 10% of the VAT amount plus 10% annual interest — far more expensive than any bank facility. The dedicated account approach eliminates this risk completely."}'
),

-- INNOVATION & PRODUCT
('design-thinking', 'Design Thinking Process', 'Creative Confidence', 'Tom Kelley', 'strategy',
 ARRAY['product','innovation','customer','problem-solving'],
 'opportunity',
 'Solve business problems from the customer''s perspective using empathy, prototyping, and iteration.',
 '{"one_sentence": "Design thinking starts with watching real customers, not asking them what they want.", "problem_it_solves": "Solutions are designed from the inside out — what the business finds easy to deliver — rather than from the outside in — what the customer actually needs.", "how_it_works": "Five stages: Empathise (observe real customers in their environment — not a survey, watch them use your product), Define (write a problem statement: ''[User] needs a way to [need] because [insight]''), Ideate (generate 20 ideas — quantity before quality), Prototype (build the cheapest possible version of your best idea — paper, cardboard, mockup), Test (show 5 real users and observe silently). Iterate based on what you see, not what they say they like.", "book_in_action": "IDEO redesigned a hospital room using design thinking — they filmed patients, found that lying flat staring at ceiling tiles caused anxiety, and redesigned for the patient''s visual experience. Patient satisfaction scores tripled.", "african_context": "Township entrepreneurs are natural design thinkers — they build what their community needs from what is available. Formalise this instinct into a repeatable innovation process."}'
),

('mvp-methodology', 'Minimum Viable Product', 'The Lean Startup', 'Eric Ries', 'strategy',
 ARRAY['product','innovation','risk','validation'],
 'opportunity',
 'Test your riskiest assumption with the smallest possible investment before building the full product.',
 '{"one_sentence": "The goal of an MVP is not a minimum product — it is maximum validated learning with minimum waste.", "problem_it_solves": "Businesses invest months and significant money building complete products or services that customers do not want.", "how_it_works": "Identify the riskiest assumption in your business idea. Design the cheapest test that could prove or disprove it. An MVP might be: a landing page with a sign-up button (tests demand before building anything), a manual service disguised as automated (tests if customers value it before you automate), or a single sale at a premium price (tests willingness to pay before scaling). Run the test. Learn. Build only what the market confirms it wants.", "book_in_action": "Zappos started not by building a shoe-shipping operation, but by posting photos of shoes from physical stores online. When orders came in, they bought the shoes themselves and shipped them manually. Proved demand before building the warehouse.", "african_context": "South African entrepreneurs often launch with full inventory, fit-out, and staff — high financial risk. An MVP approach: sell 10 units via WhatsApp before ordering 100. Test the price point before opening the shop."}'
),

-- COMMUNICATION
('pyramid-principle', 'The Pyramid Principle', 'The Pyramid Principle', 'Barbara Minto', 'leadership',
 ARRAY['communication','presentations','persuasion','writing'],
 'opportunity',
 'Structure all communication with your conclusion first — then the supporting evidence.',
 '{"one_sentence": "Busy executives and clients want the answer first, then the reasoning — not a build-up to a conclusion.", "problem_it_solves": "Proposals, emails, and presentations bury the key point at the end after extensive background — listeners lose attention before the conclusion.", "how_it_works": "The Pyramid: Start with the single answer/recommendation at the top. Below it, group your 3 supporting reasons. Below each reason, the evidence. In a proposal: ''We recommend Option A. Here are three reasons. First...'' In an email: ''We need to renegotiate the contract by Friday. Three changes are required: 1) Price, 2) Delivery terms, 3) Liability clause.'' Then detail each. Never make the reader wait for the point.", "book_in_action": "McKinsey & Company trains all consultants in the Pyramid Principle. Every client deck starts with an executive summary that contains the full answer — partners can read 2 pages and make a decision without reading 80 slides.", "african_context": "South African business communication still tends toward formal preamble. In email and WhatsApp: state your ask in the first sentence. The context follows — not the other way around."}'
),

('non-violent-communication', 'Nonviolent Communication', 'Nonviolent Communication', 'Marshall Rosenberg', 'leadership',
 ARRAY['communication','conflict','feedback','culture'],
 'warning',
 'Express needs and feelings without blame — a framework for resolving conflict without casualties.',
 '{"one_sentence": "Most workplace conflict is caused not by incompatible goals but by how needs are expressed.", "problem_it_solves": "Conflict in teams escalates because people express frustration as blame or criticism — triggering defensiveness instead of resolution.", "how_it_works": "NVC has four components: Observation (describe what you observed without evaluation: ''In the last three meetings, the reports were not ready''), Feeling (describe your feeling: ''I feel anxious''), Need (identify the need behind the feeling: ''because I need us to be prepared for clients''), Request (make a specific request: ''Would you be willing to send the report 24 hours before each meeting?''). No blame, no accusation — only observation, feeling, need, request.", "book_in_action": "A Johannesburg agency replaced their annual performance review with quarterly NVC-structured conversations. Grievance filings dropped to zero. Team survey scores on psychological safety increased from 52% to 89% in one year.", "african_context": "Ubuntu communication values relationship preservation. NVC provides a formal framework for this — it makes the relationship the container within which performance issues can be addressed safely."}'
),

-- SCALE & SYSTEMS
('franchise-thinking', 'Franchise Mindset (E-Myth)', 'The E-Myth Revisited', 'Michael Gerber', 'strategy',
 ARRAY['systems','scale','delegation','sops'],
 'opportunity',
 'Build your business as if you were going to franchise it — even if you never do.',
 '{"one_sentence": "Build systems that can be operated by people far less talented than you, and your business can scale without you.", "problem_it_solves": "The business is entirely dependent on the owner — they cannot take leave, cannot step back, and the business cannot grow past their personal capacity.", "how_it_works": "Ask: if you had to open a second location of this business run by strangers who had never met you, what would they need? That answer is your operations manual. Document every system, every process, every script, every standard. Then train anyone using the manual. The business should be able to run at 80% of quality without you present. This is the McDonald''s model — the product is the system, not the food.", "book_in_action": "A Cape Town car wash owner documented his 14-step process, created photo-based SWIs, and trained a manager using them. He took his first holiday in 6 years. Revenue was the same when he returned.", "african_context": "Many South African family businesses collapse when the founder retires or becomes ill because knowledge was never documented. Franchise thinking is succession planning for every business, not just large ones."}'
),

('delegation-matrix', 'Delegation Decision Matrix', 'The One Thing', 'Gary Keller', 'leadership',
 ARRAY['delegation','productivity','leadership','management'],
 'opportunity',
 'Decide what to delegate based on importance and who can do it — not on what feels comfortable.',
 '{"one_sentence": "Doing work that someone else could do is not virtuous — it is expensive.", "problem_it_solves": "Business owners do everything themselves — lower-value tasks crowd out strategic work that only they can do.", "how_it_works": "Map your weekly tasks on a 2×2 matrix: Axis 1 — Can only I do this? (Yes/No). Axis 2 — Does this generate high or low value? High-value, only-I tasks: do them personally and protect the time. High-value, others-can-do: delegate up (hire better or train someone). Low-value, only-I tasks: simplify or eliminate. Low-value, others-can-do: delegate immediately. The goal: work only in the top-left quadrant.", "book_in_action": "A Johannesburg financial planner tracked his time for 2 weeks. He found he was personally managing his social media (low value, others-can-do) for 8 hours per week. Delegating that freed time for 3 additional client consultations per week — a 5× ROI.", "african_context": "Owner-operator businesses in South Africa often avoid delegation due to trust issues or past bad experiences. Start with low-stakes tasks and build delegation confidence gradually — the first successful delegation is transformative."}'
),

-- ETHICAL BUSINESS
('stakeholder-capitalism', 'Stakeholder Value Model', 'Conscious Capitalism', 'John Mackey', 'strategy',
 ARRAY['strategy','purpose','impact','sustainability'],
 'opportunity',
 'Create value for all stakeholders — customers, staff, suppliers, community, and investors — not just shareholders.',
 '{"one_sentence": "Businesses that optimise for stakeholder value consistently outperform those that optimise for shareholder return alone.", "problem_it_solves": "Short-term profit maximisation destroys staff morale, supplier relationships, and community trust — undermining the long-term health of the business.", "how_it_works": "For each decision, evaluate impact across five stakeholders: Customers (does this serve them well?), Team (does this support their wellbeing and growth?), Suppliers (does this build a sustainable relationship?), Community (does this leave the community better off?), Investors/Owners (does this build long-term value?). A business that passes this filter consistently builds a reputation no competitor can easily replicate.", "book_in_action": "Whole Foods Market built a highly profitable business by paying above-market wages, sourcing from local suppliers, and environmental practices. Conscious capitalism was not charity — it was differentiation that drove premium pricing and fierce loyalty.", "african_context": "B-BBEE is a legislated form of stakeholder capitalism in South Africa. Businesses that embed transformation beyond compliance into purpose — genuine supplier development, skills transfer, community investment — outperform those treating BEE as a box to tick."}'
),

('circular-economy-model', 'Circular Business Model', 'Cradle to Cradle', 'William McDonough', 'strategy',
 ARRAY['sustainability','innovation','differentiation','operations'],
 'opportunity',
 'Design waste out of your business model — reduce input costs and attract conscious customers.',
 '{"one_sentence": "The most profitable material in your business is often the one you are currently paying to throw away.", "problem_it_solves": "Linear business models (take-make-waste) generate unnecessary costs and environmental impact — both of which are increasingly penalised commercially.", "how_it_works": "Ask: what waste does my business produce? Can it be sold, reused, or redesigned away? Examples: food waste → compost → supplier to local farmers, packaging → returnable deposit system, offcuts → sold to other manufacturers, heat from refrigeration → repurposed for hot water. For service businesses: digital delivery removes paper waste; repair-over-replace models extend product life and create recurring revenue.", "book_in_action": "Interface, a carpet tile company, redesigned their product as a take-back programme. Old tiles become new tiles. They reduced raw material costs by 80% and their sustainability story attracted corporate clients who would not previously consider them.", "african_context": "South African township economy has always been circular — nothing is wasted. Spaza shops sell single cigarettes, oil is reused, containers repurposed. Formalising this intuition is a competitive advantage as ESG buying criteria increase."}'
),

-- PRICING STRATEGY
('price-anchoring', 'Price Anchoring Strategy', 'Priceless', 'William Poundstone', 'marketing',
 ARRAY['pricing','sales','conversion','psychology'],
 'opportunity',
 'The first price a customer sees shapes how they evaluate every price that follows.',
 '{"one_sentence": "When you present your most expensive option first, your middle option looks like a bargain by comparison.", "problem_it_solves": "Business owners list prices from cheapest to most expensive, making the most profitable option feel expensive relative to the anchor.", "how_it_works": "Always present your Premium/Most Expensive option first. This sets the psychological anchor. Then present your Standard option — it feels reasonable compared to Premium. The Budget option exists to make Standard look smart. Most customers choose the middle option when it is positioned between a high anchor and a low safety net. For proposals, lead with your most comprehensive package even if you know the client''s budget is lower.", "book_in_action": "The Economist tested three subscription options: Online only (R59), Print only (R125), Print + Online (R125). When the middle option was removed, 68% chose online-only. With all three options, 84% chose Print + Online. The ''illogical'' middle option made the expensive combination seem rational.", "african_context": "South African customers are price-sensitive but also status-sensitive. A well-anchored premium option signals quality. Many clients choose the ''good'' middle because they associate cheapest with risk."}'
),

('subscription-pricing-model', 'Subscription Business Model', 'The Automatic Customer', 'John Warrillow', 'finance',
 ARRAY['pricing','revenue','recurring','growth'],
 'opportunity',
 'Converting any part of your revenue to recurring subscription income dramatically increases business value and cash predictability.',
 '{"one_sentence": "A business with R50 000/month recurring revenue is worth 5-10× more than one with the same average monthly revenue from one-off sales.", "problem_it_solves": "Project-based and transactional businesses have unpredictable revenue — every month starts at zero, creating financial stress and limiting planning.", "how_it_works": "Identify the most commonly repeated service your customers pay for. Can you bundle it into a monthly retainer or subscription? Examples: accountant → monthly bookkeeping package, car wash → monthly unlimited wash card, IT support → monthly managed service. Price the subscription so customers get convenience, you get predictability. Start with your top 10 clients and offer a discount to switch to monthly.", "book_in_action": "A Johannesburg web designer converted 8 of 20 clients to monthly maintenance retainers at R2 500/month. This generated R20 000/month guaranteed — providing a base income that allowed him to decline low-quality project work.", "african_context": "Monthly debit order culture is well-established in South Africa (medical aid, insurance, cell phone contracts). Customers are comfortable with subscription models for services they use regularly."}'
),

('bundle-pricing', 'Product Bundling Strategy', 'Confessions of the Pricing Man', 'Hermann Simon', 'marketing',
 ARRAY['pricing','revenue','sales','product'],
 'opportunity',
 'Bundle complementary products or services to increase average transaction value and reduce comparison shopping.',
 '{"one_sentence": "When you sell individually, customers compare your price to competitors; when you bundle, the comparison becomes impossible.", "problem_it_solves": "Customers cherry-pick single items and compare prices precisely — commoditising your offer and pressuring margins.", "how_it_works": "Create bundles that combine: your bestselling service + a complementary service + a premium add-on. Price the bundle at a meaningful saving (15-25%) versus individual prices. Key: the customer must feel the bundle is customised for their situation, not arbitrary. Also use unbundling: price your baseline very low, then charge for each additional feature — telecoms companies use this to extract maximum value from different willingness-to-pay levels.", "book_in_action": "McDonald''s Happy Meal is a bundle. The meal costs the same as burger + fries + drink individually, but the bundle eliminates price comparison and increases average spend with the toy add-on.", "african_context": "South African hair salons bundle wash+cut+blowdry. Restaurants bundle starter+main+dessert. These are intuitive bundles. The opportunity is to formalise them, price them with clear value communication, and create distinct tiers."}'
)

ON CONFLICT (slug) DO NOTHING;
