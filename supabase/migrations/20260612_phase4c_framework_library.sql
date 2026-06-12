-- Phase 4c: Framework Library batch — Finance, Leadership, Operations, Marketing
-- Adding 25 more entries to reach ~85 total

INSERT INTO framework_library (slug, title, source_book, author, category, situation_tags, urgency, summary, detailed_content)
VALUES

-- FINANCE & PROFITABILITY
('pareto-revenue-analysis', 'Pareto Revenue Analysis', 'The 80/20 Principle', 'Richard Koch', 'finance',
 ARRAY['cash-flow','pricing','profitability','revenue'],
 'opportunity',
 'Find the 20% of customers who generate 80% of your revenue — then double down on serving them.',
 '{"one_sentence": "20% of your customers likely generate 80% of your profits.", "problem_it_solves": "Business owners spread effort evenly across all customers and products, diluting attention from the highest-value relationships.", "how_it_works": "List all customers by revenue generated in the last 12 months. Rank them. Identify the top 20% by revenue. Calculate what percentage of total revenue they represent — it is often close to 80%. Apply the same analysis to products, services, and suppliers. Then ask: what would happen if you focused all your best time and energy on your top 20%?", "book_in_action": "A catering company with 80 clients found that 14 clients generated R1.2M of their R1.5M revenue. When they stopped chasing small orders and redirected sales effort to similar large clients, revenue grew 40% while workload dropped.", "african_context": "Township and informal businesses often over-serve low-paying loyal customers out of relationship obligation. The 80/20 lens gives you permission to prioritise without abandoning anyone — you serve everyone, but invest in the best-fit clients."}'
),

('envelope-budgeting', 'Cash Envelope System', 'Profit First', 'Mike Michalowicz', 'finance',
 ARRAY['cash-flow','expenses','budgeting','profit-first'],
 'crisis',
 'Physically separate cash into purpose-specific accounts to force spending discipline.',
 '{"one_sentence": "If money is not ring-fenced for its purpose, it will be spent on the wrong things.", "problem_it_solves": "Business owners pay suppliers from their operating account and then discover there is nothing left for their own salary, VAT, or profit.", "how_it_works": "Create five bank accounts: Income (all receipts), Profit (5-20%), Owner Pay (30-50%), Tax (15-20%), Operating Expenses (remainder). Every time income arrives, immediately transfer the correct percentages. You can only spend from OpEx for expenses — seeing a depleted OpEx account before month-end tells you to cut costs, not to dip into profit.", "book_in_action": "A Johannesburg bookkeeper ran her business from one account for 8 years, always feeling broke. After switching to Profit First, she had her first uninterrupted profit account in quarter one — R28 000 she had never seen before.", "african_context": "In South Africa, VAT obligations (25th of each month) routinely catch small businesses with empty accounts. Ring-fencing 15% for SARS from every payment solves this permanently."}'
),

('unit-economics', 'Unit Economics Mastery', 'Traction', 'Gabriel Weinberg', 'finance',
 ARRAY['pricing','profitability','growth','revenue'],
 'opportunity',
 'Know exactly what it costs to acquire one customer and what they are worth over their lifetime.',
 '{"one_sentence": "If you do not know your Customer Acquisition Cost (CAC) and Lifetime Value (LTV), you cannot price or grow confidently.", "problem_it_solves": "Businesses discount to win customers without realising each sale at that price is actually destroying value.", "how_it_works": "CAC = Total sales and marketing spend ÷ Number of new customers acquired. LTV = Average purchase value × Purchase frequency × Average customer lifespan. If LTV > 3× CAC, your model is healthy. If LTV < 3× CAC, you either need to raise prices, reduce acquisition cost, or improve retention.", "book_in_action": "A SaaS company discovered their CAC was R3 000 and LTV was R5 000 — barely viable. By adding a referral programme that cut CAC to R1 500 and a support tier that increased LTV to R9 000, they became highly profitable within 6 months.", "african_context": "Informal businesses often grow by word of mouth (zero CAC) but fail to retain customers. Calculating LTV helps you justify investment in better packaging, follow-up, or loyalty systems."}'
),

('zero-based-budgeting', 'Zero-Based Budgeting', 'Good to Great', 'Jim Collins', 'finance',
 ARRAY['expenses','budgeting','discipline','operations'],
 'warning',
 'Start every budget from zero — justify every expense each period, not just carry it forward.',
 '{"one_sentence": "Legacy expenses compound silently; zero-based budgeting forces you to decide whether each spend still earns its place.", "problem_it_solves": "Businesses carry zombie expenses — subscriptions, staff costs, suppliers — that were useful once but are now draining profit without scrutiny.", "how_it_works": "Instead of starting from last year''s budget and adding a percentage, start from R0. List every single cost. For each, ask: if we did not have this today, would we choose to add it? If the answer is no or maybe, cut it or negotiate it down. Do this review annually or when cash is tight.", "book_in_action": "A Durban logistics company did its first zero-based review and eliminated R180 000 in annual costs: unused software licences, a vehicle kept for a role that no longer existed, and a storage unit for obsolete stock.", "african_context": "South African businesses face high fixed costs (rent, staff, insurance) that feel unmovable. Zero-based thinking challenges you to renegotiate everything — especially when economic conditions change."}'
),

-- LEADERSHIP & MANAGEMENT
('situational-leadership', 'Situational Leadership', 'The One Minute Manager', 'Ken Blanchard', 'leadership',
 ARRAY['management','delegation','team','staff'],
 'opportunity',
 'Match your leadership style to each employee''s current skill and motivation level.',
 '{"one_sentence": "There is no single best leadership style — adapt your approach to each person and task.", "problem_it_solves": "Managers either micromanage everyone (stifling skilled staff) or delegate to everyone (leaving new staff without support).", "how_it_works": "For each task and person, assess their Development Level: D1 (enthusiastic beginner), D2 (disillusioned learner), D3 (capable but cautious), D4 (high performer). Match with leadership style: S1 (directing), S2 (coaching), S3 (supporting), S4 (delegating). A D1 needs clear instructions. A D4 needs autonomy. Applying D4 style to a D1 employee causes failure.", "book_in_action": "A Cape Town restaurant owner treated her senior chef and new waiter the same — full autonomy. The chef thrived; the waiter was confused and quit after 6 weeks. After adopting situational leadership, staff retention improved dramatically.", "african_context": "Ubuntu philosophy aligns well here — leadership is relational, not positional. Meeting people where they are is both effective management and good community-building."}'
),

('fierce-conversations', 'Fierce Conversations', 'Fierce Conversations', 'Susan Scott', 'leadership',
 ARRAY['communication','conflict','feedback','management'],
 'warning',
 'Have the real conversation you have been avoiding — it is the most important conversation you are not having.',
 '{"one_sentence": "Every conversation that fails to happen is a problem that compounds quietly.", "problem_it_solves": "Business owners and managers avoid difficult conversations — underperformance, partnership conflicts, customer complaints — until they explode.", "how_it_works": "A fierce conversation is real, not aggressive. Use the Mineral Rights model: name the issue clearly, share your perspective, invite their view, resolve together. Rule: come prepared with one specific behavioural example, not a general complaint. Say: ''When you did X, the impact was Y. I need Z to change.'' Then stop talking.", "book_in_action": "A business owner had avoided telling a loyal employee that her attitude was affecting team morale for 18 months. One fierce conversation (15 minutes) solved a problem that had cost months of friction and two staff resignations.", "african_context": "South African workplace culture often avoids direct feedback to preserve harmony — yet unresolved tension leads to worse conflict. Frame fierce conversations as acts of respect, not aggression."}'
),

('okr-goal-framework', 'OKRs — Objectives and Key Results', 'Measure What Matters', 'John Doerr', 'leadership',
 ARRAY['goals','strategy','focus','accountability'],
 'opportunity',
 'Set ambitious goals (Objectives) with measurable outcomes (Key Results) that align your entire team.',
 '{"one_sentence": "What you measure is what gets done — OKRs align individual effort to company mission.", "problem_it_solves": "Teams are busy but not necessarily aligned. Everyone works hard in different directions.", "how_it_works": "Set 3-5 Objectives per quarter — inspiring but achievable. Under each, define 2-4 Key Results: specific, measurable outcomes that prove the Objective was achieved. Review weekly. Score at quarter end (0.7 = success; 1.0 means it was too easy). OKRs cascade from company → department → individual so everyone can see how their work connects.", "book_in_action": "Google adopted OKRs in 1999 with 40 employees. Larry Page credits them with enabling explosive growth while maintaining organisational focus. They still use them with 100 000+ employees.", "african_context": "Small South African businesses often operate on instinct and daily firefighting. Quarterly OKRs create just enough structure to make strategic progress without bureaucracy."}'
),

('the-coaching-habit', 'The Coaching Habit', 'The Coaching Habit', 'Michael Bungay Stanier', 'leadership',
 ARRAY['management','delegation','questions','team'],
 'opportunity',
 'Say less, ask more — seven coaching questions that make you a better manager instantly.',
 '{"one_sentence": "The best managers ask more questions and give fewer answers.", "problem_it_solves": "Managers create dependency by always providing solutions. Staff never develop. Manager is always the bottleneck.", "how_it_works": "Use these 7 questions in sequence: 1. What''s on your mind? 2. And what else? 3. What''s the real challenge here for you? 4. What do you want? 5. How can I help? 6. If you said yes to this, what are you saying no to? 7. What was most useful for you? Resist giving your answer until you have asked at least three. Most problems dissolve before you need to answer.", "book_in_action": "A management consultant changed one habit: stopped answering email questions immediately and asked ''What have you already tried?'' Staff problem-solving improved noticeably within a month. His inbox dropped by 40%.", "african_context": "In communal cultures, being seen as wise and knowledgeable is valued — but over-answering creates learned helplessness. Coaching builds people up, which aligns with Ubuntu."}'
),

-- OPERATIONS & SYSTEMS
('kaizen-continuous-improvement', 'Kaizen — 1% Better Every Day', 'Atomic Habits', 'James Clear', 'operations',
 ARRAY['productivity','process','quality','growth'],
 'opportunity',
 'Small, consistent daily improvements compound into massive results over time.',
 '{"one_sentence": "Improving by 1% every day means you are 37 times better after one year.", "problem_it_solves": "Businesses try to fix everything at once through big projects that never complete, while small improvements are ignored.", "how_it_works": "Identify one process that frustrates your team or customers. Make the smallest possible improvement this week. Measure it. Do it again next week. Over 52 weeks of 1% improvements, the compound effect is dramatic. Apply kaizen to customer response time, product quality, delivery accuracy, sales conversion — one at a time.", "book_in_action": "A Cape Town car wash improved their drying process by 90 seconds one week, then their vacuuming sequence the next. Six months later, average service time dropped by 22 minutes — without any major investment.", "african_context": "Resource-constrained businesses cannot afford big transformation projects. Kaizen is accessible: pen and paper, no consultants, just attention and discipline."}'
),

('checklists-manifesto', 'The Checklist System', 'The Checklist Manifesto', 'Atul Gawande', 'operations',
 ARRAY['systems','quality','process','sops','delegation'],
 'opportunity',
 'Checklists prevent failures of memory and attention — even experts use them.',
 '{"one_sentence": "Aviation and surgery both use checklists — not because pilots and surgeons are incompetent, but because complex tasks have failure points that memory alone cannot cover.", "problem_it_solves": "Skilled people skip steps when busy or confident, leading to preventable errors. Junior staff perform inconsistently without clear step-by-step guidance.", "how_it_works": "For any process with 5+ steps, write a checklist. Keep items short and action-oriented (''verify customer phone number'' not ''customer contact details checked and confirmed''). Test the checklist with someone who doesn''t know the process. If they can follow it successfully, it is complete. Display it at the point of use.", "book_in_action": "WHO Safe Surgery Checklist — a one-page document — reduced post-surgery complications by 36% and deaths by 47% when implemented across hospitals in 8 countries.", "african_context": "Staff turnover is high in small South African businesses. Checklists make knowledge transferable, reducing the impact of every departure."}'
),

('theory-of-constraints', 'Theory of Constraints', 'The Goal', 'Eliyahu Goldratt', 'operations',
 ARRAY['productivity','process','capacity','bottleneck'],
 'warning',
 'Every system has one constraint limiting throughput — improve that single point before anything else.',
 '{"one_sentence": "The chain is only as strong as its weakest link — find your bottleneck and you have found your growth lever.", "problem_it_solves": "Businesses invest in improving fast parts of their operation while the constraint remains, creating queues and wasted capacity.", "how_it_works": "Identify the one constraint (machine, person, process, or decision) that limits your output. Exploit it: make sure it is never idle and always working on the right things. Subordinate everything else to support it. Elevate it if needed. When resolved, find the next constraint. Never stop — there is always a new constraint.", "book_in_action": "A furniture manufacturer''s constraint was the painting booth — 4 hours per unit. By optimising the prep stage (sending pieces to the booth perfectly ready), throughput increased 35% with no new capital expenditure.", "african_context": "Load-shedding creates an artificial operational constraint for South African businesses. Mapping your full production flow helps you identify which steps to move to generator-powered slots versus off-peak hours."}'
),

('standard-work-instructions', 'Standard Work Instructions', 'Work the System', 'Sam Carpenter', 'operations',
 ARRAY['sops','systems','delegation','training','consistency'],
 'opportunity',
 'Document exactly how every recurring task must be done so anyone can execute it consistently.',
 '{"one_sentence": "If a process lives only in someone''s head, it leaves with them.", "problem_it_solves": "Business quality is inconsistent — great when a certain person is present, chaotic when they are absent.", "how_it_works": "For your top 10 most-repeated processes, write a Standard Work Instruction: trigger (what starts the process), steps (numbered, specific, sequenced), tools/materials needed, expected outcome, and who owns it. Review SWIs every 6 months. The goal is that any trained person following the SWI produces the same result.", "book_in_action": "A Pretoria cleaning company had quality vary wildly per crew. After writing 12 SWIs covering every cleaning scenario, complaint rates dropped 80% and client retention increased significantly.", "african_context": "South African SMEs often depend on one key person — often the founder. SWIs are business continuity insurance: operations survive leave, illness, or departure."}'
),

-- MARKETING & CUSTOMER
('jobs-to-be-done', 'Jobs-to-Be-Done Framework', 'Competing Against Luck', 'Clayton Christensen', 'marketing',
 ARRAY['marketing','product','customer','positioning'],
 'opportunity',
 'Customers do not buy products — they hire them to do a job. Know the job to win the sale.',
 '{"one_sentence": "People buy a milkshake in the morning not because they are hungry but because they need something to occupy one hand and last the commute.", "problem_it_solves": "Products and services are designed around features instead of the real outcome customers need.", "how_it_works": "For each product or service, ask: what ''job'' is the customer hiring this to do? What outcome do they need? What frustration does it remove? Then design your offering, marketing, and sales pitch entirely around that job. The customer asking for faster horses wants to arrive sooner — the job is speed, not the horse.", "book_in_action": "An accounting software company repositioned from ''easy invoicing'' to ''get paid faster'' — the actual job clients needed done. Conversions increased 60% on the same product with no changes.", "african_context": "Informal economy customers are especially jobs-focused — they are outcome-driven, not brand-driven. Speak to the result you deliver, not the process you use."}'
),

('customer-journey-mapping', 'Customer Journey Mapping', 'This Is Marketing', 'Seth Godin', 'marketing',
 ARRAY['customer','marketing','experience','retention'],
 'opportunity',
 'Map every touchpoint your customer experiences — before, during, and after purchase.',
 '{"one_sentence": "Your customer''s experience is not just the product — it is every interaction from first awareness to last impression.", "problem_it_solves": "Businesses optimise the sale but ignore the before (awareness, trust) and after (onboarding, loyalty, referral) — losing customers who should have stayed.", "how_it_works": "Draw a timeline with five stages: Awareness (how do they find you?), Consideration (how do they evaluate you?), Purchase (how easy is it to buy?), Delivery (what happens next?), Retention/Advocacy (what keeps them and makes them refer?). For each stage, list: current experience, pain points, opportunities to delight. Fix one touchpoint per month.", "book_in_action": "A Johannesburg florist found that most customers arrived via Instagram but the first DM response took 8+ hours. Automating a WhatsApp reply within 2 minutes increased bookings by 30%.", "african_context": "In South Africa, WhatsApp IS the customer journey for many businesses. Mapping your WhatsApp response flow — from first message to completed order — often reveals the biggest improvement opportunities."}'
),

('hook-model-retention', 'The Hook Model', 'Hooked', 'Nir Eyal', 'marketing',
 ARRAY['retention','customer','engagement','product'],
 'opportunity',
 'Build products and services with trigger-action-reward-investment loops that create habit.',
 '{"one_sentence": "Products become indispensable when they attach to existing customer habits through reliable trigger-reward loops.", "problem_it_solves": "Businesses build great products but customers do not return often enough to justify acquisition costs.", "how_it_works": "The Hook has four parts: Trigger (external: notification, ad; or internal: a feeling or need), Action (simplest behaviour that moves toward reward), Variable Reward (unpredictable result that sustains interest — scroll for new posts, check for new messages), Investment (time, data, content the customer puts in, making switching harder). For your business, identify the internal trigger (loneliness? insecurity? pride?) and build a loop around it.", "book_in_action": "Instagram hooks users via the internal trigger of boredom and FOMO, the action of scrolling, variable reward of new content, and investment of their profile and followers — making exit very costly.", "african_context": "Stokvel and burial society apps use the Hook Model naturally: social obligation is the trigger, contribution is the action, group milestone is the reward, and accumulated pot is the investment."}'
),

('loss-aversion-pricing', 'Loss Aversion Pricing', 'Thinking, Fast and Slow', 'Daniel Kahneman', 'marketing',
 ARRAY['pricing','sales','psychology','conversion'],
 'opportunity',
 'Frame your offer in terms of what the customer loses by not buying, not what they gain.',
 '{"one_sentence": "The pain of losing R1 000 is twice as powerful psychologically as the pleasure of gaining R1 000.", "problem_it_solves": "Sales pitches focus on benefits and gains, which are weak motivators compared to loss prevention.", "how_it_works": "Identify what your customer loses by not using your product: time wasted, money left on the table, risk not managed, stress not removed. Lead your pitch with the loss: ''Every month you operate without this, you lose approximately R8 000 in uncollected VAT refunds.'' Then offer the solution. Price your premium tier as protection against a larger loss.", "book_in_action": "An insurance broker changed ''Get R1M cover for R300/month'' to ''Without cover, one accident could cost you R1M — this policy is R300/month.'' The same product. Conversion rate doubled.", "african_context": "SARS penalties, labour tribunal awards, and Section 189 retrenchment costs are tangible loss frames for South African SME owners — use them honestly and specifically."}'
),

-- GROWTH & SCALE
('flywheel-effect', 'The Flywheel Effect', 'Good to Great', 'Jim Collins', 'strategy',
 ARRAY['growth','scale','momentum','strategy'],
 'opportunity',
 'Consistent effort in the right direction builds unstoppable momentum — not one dramatic push.',
 '{"one_sentence": "Amazon, Walmart, and every great business had a flywheel — a self-reinforcing cycle that compounded over time.", "problem_it_solves": "Business owners look for the one big breakthrough (the big client, the viral post, the product launch) instead of building compounding systems.", "how_it_works": "Map your flywheel: what actions lead to what outcomes that reinforce what starting point? Amazon''s flywheel: Lower prices → more customers → more seller activity → more revenue → lower cost structure → lower prices. Draw your own three-to-five step loop. Then focus all energy on making one turn of that flywheel faster.", "book_in_action": "Netflix''s flywheel: more subscribers → more content budget → better originals → more subscribers. Every investment in content strengthened every other part.", "african_context": "A South African township pharmacy flywheel: faster dispensing → happier patients → more referrals → more scripts → lower per-unit cost → even faster service. Find your loop."}'
),

('blue-ocean-strategy', 'Blue Ocean Strategy', 'Blue Ocean Strategy', 'W. Chan Kim & Renée Mauborgne', 'strategy',
 ARRAY['strategy','positioning','competition','differentiation'],
 'opportunity',
 'Stop competing in red oceans — create uncontested market space where competition is irrelevant.',
 '{"one_sentence": "Instead of fighting over the same customers as your competitors, redefine your market so you are the only option.", "problem_it_solves": "Businesses compete on price and features in crowded markets, destroying margins and exhausting everyone.", "how_it_works": "Use the Strategy Canvas: list all competitive factors in your industry. Rate yourself and competitors on each (1-5). Then ask: which factors can you Eliminate (no value)? Reduce (below industry standard)? Raise (above standard)? Create (brand new)? The four actions create a new value curve that opens a different market.", "book_in_action": "Cirque du Soleil eliminated animals and star performers (expensive), reduced thrills and danger, raised theatrical production and storyline, and created a new experience: luxury entertainment for adults. No circus competition was relevant.", "african_context": "South African market often has one dominant player in each vertical (Tiger Brands, Shoprite). Blue Ocean thinking asks where the unserved customer lives — not how to beat the incumbent on their own turf."}'
),

('10x-thinking', '10x Thinking', '10x Is Easier Than 2x', 'Dan Sullivan & Benjamin Hardy', 'strategy',
 ARRAY['growth','mindset','vision','ambition'],
 'opportunity',
 'Setting a 10x goal forces you to question every assumption and find a fundamentally different path.',
 '{"one_sentence": "2x goals encourage incremental improvement; 10x goals demand a completely different approach.", "problem_it_solves": "Businesses improve tactically but never escape the constraints of their current model.", "how_it_works": "Ask: if you had to achieve 10x your current result in 3 years with the same team and resources, what would have to be true? You cannot get there by working 10x harder. You must automate, delegate, eliminate, and partner. This forces you to identify your highest-value activities (the 20%) and stop everything else.", "book_in_action": "Dan Sullivan quit all clients except those paying 10x his average fee. Revenue increased 4x in two years because he delivered better results with less complexity.", "african_context": "Many South African entrepreneurs have a survival mindset that makes ambitious thinking feel irresponsible. 10x thinking is a planning tool — you do not need to believe it yet, just let it show you what is possible."}'
),

-- MINDSET & RESILIENCE
('growth-mindset', 'Growth Mindset', 'Mindset', 'Carol Dweck', 'mindset',
 ARRAY['mindset','learning','resilience','leadership'],
 'opportunity',
 'Believe that your abilities are developed through dedication and hard work — not fixed at birth.',
 '{"one_sentence": "People with a growth mindset see challenges as opportunities; people with a fixed mindset see them as threats to their self-image.", "problem_it_solves": "Fixed mindset business owners avoid hard feedback, stop innovating after initial success, and interpret failure as evidence they are not cut out for business.", "how_it_works": "When you face a difficult challenge, notice your inner voice. If it says ''I can''t do this'' — that is fixed mindset. Replace with: ''I can''t do this yet — what would I need to learn?'' Praise your team for effort and process, not just outcomes. Create a culture where mistakes are shared openly as learning opportunities.", "book_in_action": "Microsoft CEO Satya Nadella transformed Microsoft''s culture from ''know it all'' (fixed) to ''learn it all'' (growth) — crediting Dweck''s work. The company went from $300B to $2.5T market cap in 8 years.", "african_context": "Ubuntu entrepreneurship is growth mindset by design — the community''s wisdom is always available to learn from. Formalise this with peer learning circles, mentorship, and cross-industry stokvel groups."}'
),

('anti-fragility', 'Antifragility', 'Antifragile', 'Nassim Nicholas Taleb', 'mindset',
 ARRAY['resilience','risk','strategy','mindset'],
 'warning',
 'Do not just survive volatility — design systems that get stronger when disrupted.',
 '{"one_sentence": "Fragile things break under stress; robust things survive; antifragile things improve.", "problem_it_solves": "Businesses are designed to run smoothly when conditions are normal — a single shock (economic downturn, key staff departure, supplier failure) destroys them.", "how_it_works": "Remove fragilities: single points of failure, high fixed costs, debt-to-income ratios that leave no buffer. Add antifragilities: multiple revenue streams, skills that transfer across industries, customer types that do not all face the same risk. Add optionality: maintain the ability to respond to opportunity when others cannot.", "book_in_action": "Restaurants that added delivery during COVID did not just survive — many discovered delivery was 40% of revenue they had not accessed before. The disruption strengthened the business model.", "african_context": "South Africa''s economy is volatile — electricity, currency, political cycles. Antifragile businesses include generators, multi-currency pricing, and customer bases across income levels."}'
),

-- SALES
('spin-selling', 'SPIN Selling', 'SPIN Selling', 'Neil Rackham', 'sales',
 ARRAY['sales','conversion','b2b','revenue'],
 'opportunity',
 'Win complex sales with four types of questions that help customers sell themselves.',
 '{"one_sentence": "In complex sales, the customer who does the most talking is most likely to buy.", "problem_it_solves": "Salespeople present too early before fully understanding the problem — customers feel pressured, not helped.", "how_it_works": "SPIN stands for four question types to use in sequence: Situation (''How many staff do you have managing your payroll?''), Problem (''What manual steps are most time-consuming?''), Implication (''What happens when errors occur at month-end?''), Need-Payoff (''If you could process payroll automatically in under an hour, what would that mean for your team?''). By the Need-Payoff stage, the customer is selling the solution to themselves.", "book_in_action": "A B2B software company trained their sales team in SPIN. Deal size increased 40% and close rate improved because reps stopped pitching before understanding the full problem.", "african_context": "South African B2B sales are relationship-heavy — trust is required before closing. SPIN conversations build trust by demonstrating genuine interest in the client''s world."}'
),

('consultative-selling', 'Consultative Selling', 'The Trusted Advisor', 'David Maister', 'sales',
 ARRAY['sales','trust','relationships','b2b'],
 'opportunity',
 'Position yourself as a trusted advisor rather than a vendor — clients who trust you do not compare your prices.',
 '{"one_sentence": "When you become the first person a client calls when they have a problem, you have won — competitor price comparisons become irrelevant.", "problem_it_solves": "Businesses win on price or relationships that are actually vendor relationships, not advisory ones — vulnerable to any better offer.", "how_it_works": "Move up the trust spectrum from Vendor (deliver what''s ordered) to Expert (solve stated problems) to Partner (help define problems) to Trusted Advisor (called first for anything important). To move up: share insight proactively, admit what you do not know, put the client''s long-term interest above the short-term sale, and be consistent over time.", "book_in_action": "A Durban accountant spent 12 years as a tax filer for one family business. After one proactive call about a BEE structuring opportunity she had spotted, she became their full business advisor — quadrupling the relationship value.", "african_context": "In South Africa, professional advisory trust is influenced by transformation credentials, language competence, and community embeddedness — not just expertise."}'
),

-- HR & TEAM
('radical-transparency', 'Radical Transparency', 'Principles', 'Ray Dalio', 'leadership',
 ARRAY['culture','communication','trust','team'],
 'opportunity',
 'Share financial results, strategy decisions, and failure learnings openly — it builds culture and capability.',
 '{"one_sentence": "When everyone sees the same data, alignment becomes possible and politics become unnecessary.", "problem_it_solves": "Opaque organisations breed rumour, mistrust, and disengagement. Staff who do not know the company''s health cannot make aligned decisions.", "how_it_works": "Radical transparency means sharing: monthly financial results with all staff, reasoning behind decisions (not just the decision), feedback on performance openly, and failures with the lessons learned. This does not mean sharing salary or personal information — it means sharing organisational truth. Start small: share monthly revenue and expense numbers in a team meeting. Answer ''why'' questions openly.", "book_in_action": "Bridgewater Associates, the world''s largest hedge fund, uses radical transparency including recording all meetings and making them available to all staff. Performance culture is exceptional and turnover is low for the industry.", "african_context": "Many South African SMEs are opaque by default — often because the founder is the only one who sees the numbers. Transparency removes the ''black box'' and invites staff into the mission."}'
),

('recognition-culture', 'Culture of Recognition', 'The Carrot Principle', 'Adrian Gostick', 'leadership',
 ARRAY['culture','motivation','retention','team'],
 'opportunity',
 'Specific, frequent recognition outperforms salary increases in employee motivation and retention.',
 '{"one_sentence": "People work for money but go the extra mile for recognition.", "problem_it_solves": "High-performing employees leave not because of low pay but because they feel invisible and undervalued.", "how_it_works": "Recognition must be: specific (name the exact behaviour), timely (within 48 hours), proportional (public praise for public contributions, private for private wins), and sincere. Create a weekly team habit: ''Recognition Round'' — each person names one colleague who helped them. Even verbal recognition from a manager increases productivity by 31% (Gallup). Written recognition doubles this.", "book_in_action": "A Johannesburg call centre with 30% annual turnover launched a simple card and WhatsApp recognition system. Turnover dropped to 15% in year one. No salary changes.", "african_context": "Ubuntu businesses naturally recognise collectively. Channel this into structured weekly recognition — it is the lowest-cost, highest-return HR investment available to a small business."}'
)

ON CONFLICT (slug) DO NOTHING;
