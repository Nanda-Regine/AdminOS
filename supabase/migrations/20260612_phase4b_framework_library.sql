-- Phase 4b — Framework Library Expansion (batch 2)
-- Adding 20 more essential business frameworks with full content

INSERT INTO framework_library (
  slug, book_title, author, framework_name, core_insight,
  detailed_content, situation_tags, business_stage, urgency, action_label
) VALUES

-- ── PRICING & VALUE ───────────────────────────────────────────────────────────
(
  'value-based-pricing',
  'Pricing: The Third Business Skill',
  'Hermann Simon',
  'Value-Based Pricing',
  'Price to what the customer receives in value — not to what it costs you to deliver.',
  '{
    "one_sentence": "The maximum price is not the cost-plus margin — it is the value the customer perceives.",
    "problem_it_solves": "Entrepreneurs consistently underprice by anchoring to cost rather than value, leaving significant margin on the table.",
    "how_it_works": "Identify the value created for the customer (time saved, revenue earned, problem solved), quantify it, then price at a fraction of that value. Use tiered pricing to capture different willingness-to-pay segments.",
    "book_in_action": "List your 3 best clients. For each, calculate: what is this service worth to them in rand value? What would happen to their business without you? What are they currently paying for alternatives? Set your price at 20-30% of the value you create.",
    "african_context": "SA entrepreneurs are often afraid to charge what they are worth due to imposter syndrome. Value-based pricing is not arrogance — it is understanding your impact. A bookkeeper who prevents a R50k SARS penalty is worth far more than R500/month."
  }',
  ARRAY['pricing','revenue_growth','undercharging','service_business'],
  ARRAY['foundation','momentum'],
  'opportunity',
  'Review Pricing'
),

(
  'good-better-best',
  'The Art of Pricing',
  'Rafi Mohammed',
  'Good-Better-Best Pricing',
  'Offer three tiers of service to capture more revenue across different buyer types.',
  '{
    "one_sentence": "Most buyers choose the middle option — building a three-tier offer increases average transaction value without scaring anyone away.",
    "problem_it_solves": "Single-price businesses lose revenue at both ends: high-willingness buyers pay the same as low-willingness buyers.",
    "how_it_works": "Create Good (entry-level, no-frills), Better (your current main offer), and Best (premium with maximum support). The Best option makes Better look reasonable.",
    "book_in_action": "Take your current main service. Build a Best tier by adding: personal access, faster delivery, and a guarantee. Price it at 2x your current price. Watch what percentage of clients choose Best — most will choose Better, but Best lifts the whole average.",
    "african_context": "Taxi rank economics: minibus, sedan, premium Uber. Same route, very different willingness to pay. Your business can do the same."
  }',
  ARRAY['pricing','upsell','packaging','revenue_growth'],
  ARRAY['momentum','mastery'],
  'opportunity',
  'Design Pricing Tiers'
),

-- ── SALES & PIPELINE ──────────────────────────────────────────────────────────
(
  'challenger-sale',
  'The Challenger Sale',
  'Matthew Dixon & Brent Adamson',
  'The Challenger Approach',
  'The best salespeople teach, tailor, and take control — they don''t just build relationships.',
  '{
    "one_sentence": "Customers do not want a friend — they want someone who shows them something they do not already know.",
    "problem_it_solves": "Relationship-building sales cycles are long and lose to the competitor who can articulate value fastest.",
    "how_it_works": "Teach: lead with an insight the prospect has not considered. Tailor: connect the insight to their specific situation. Take control: propose the next step confidently, do not wait to be invited.",
    "book_in_action": "Before your next sales call, prepare one provocative insight: a regulatory change, a competitor weakness, or a market shift that affects their business. Lead with it. Observe how the conversation changes.",
    "african_context": "In South Africa, BBBEE requirements, load-shedding costs, and SARS changes are constantly creating new problems your prospects do not know they have yet. Use this as your teaching moment."
  }',
  ARRAY['sales','new_clients','proposals','conversion'],
  ARRAY['momentum','mastery'],
  'opportunity',
  'Prepare Sales Insight'
),

(
  'referral-engine',
  'The Referral Engine',
  'John Jantsch',
  'Referral Engine',
  'The most reliable source of new business is a system that turns happy clients into active promoters.',
  '{
    "one_sentence": "Referrals do not happen by accident — they happen because you build a system that makes it easy and expected.",
    "problem_it_solves": "Relying on random word-of-mouth creates feast-or-famine revenue cycles.",
    "how_it_works": "Identify your top 20% of clients (the ones who love you). Create a referral process: timing (right after a win), framing (specific ask for a specific type of person), and reward (acknowledge every referral). Follow up every referral within 24 hours.",
    "book_in_action": "This week, contact your 3 best clients. Say: ''I''m growing my business and I''d love to work with more clients like you. Do you know anyone who [specific problem you solve]?'' Track how many referrals come from this one action.",
    "african_context": "Ubuntu networks are South Africa''s most powerful distribution channel. People buy from people they know and trust. A referral from a community member carries more weight than any advertisement."
  }',
  ARRAY['new_clients','referrals','word_of_mouth','growth'],
  ARRAY['foundation','momentum'],
  'opportunity',
  'Start Referral System'
),

-- ── CASH & FINANCIAL ──────────────────────────────────────────────────────────
(
  'cash-conversion-cycle',
  'Simple Numbers Straight Talk Big Profits',
  'Greg Crabtree',
  'Cash Conversion Cycle',
  'The time between paying for inputs and receiving cash from customers is where most businesses bleed out.',
  '{
    "one_sentence": "The faster you turn inventory and receivables into cash, the less working capital you need and the faster you can grow.",
    "problem_it_solves": "Profitable businesses can still die from a cash gap if they pay suppliers before they collect from customers.",
    "how_it_works": "CCC = Days Inventory + Days Receivable - Days Payable. A positive number means you are financing your customers. A negative number means your customers are financing you. Every day you shorten this cycle is money freed up.",
    "book_in_action": "Calculate your current Days Receivable: total outstanding invoices ÷ (annual revenue ÷ 365). If it is over 30 days, your collections process needs fixing. Use AdminOS Chase to cut it in half.",
    "african_context": "Many SA businesses extend 60-90 day credit to corporate clients while their own suppliers demand 30-day payment. This is a structural cash crisis. Negotiate payment terms aggressively."
  }',
  ARRAY['cashflow','collections','working_capital','invoicing'],
  ARRAY['foundation','momentum','mastery'],
  'warning',
  'Check Cash Cycle'
),

(
  'simple-numbers',
  'Simple Numbers Straight Talk Big Profits',
  'Greg Crabtree',
  'Simple Numbers Framework',
  'Four numbers tell you everything you need to know about your business health: Revenue, Gross Profit %, Labour Efficiency Ratio, and Pre-tax Profit.',
  '{
    "one_sentence": "You do not need 50 financial ratios — you need 4 numbers to run a healthy business.",
    "problem_it_solves": "Entrepreneurs drown in financial reports and miss the 4 metrics that actually predict whether the business will survive.",
    "how_it_works": "Revenue: are you growing? Gross Profit %: are you charging enough? Labour Efficiency Ratio (Revenue ÷ Labour Cost): is your team productive? Pre-tax Profit: is the business worth running? Review these weekly. React immediately if any move in the wrong direction.",
    "book_in_action": "Pull your last 3 months of financials. Calculate: (1) Gross Profit % (Gross Profit ÷ Revenue × 100). Under 30%? Pricing or cost problem. (2) LER (Revenue ÷ Total Labour). Under 1.5? You have too many people. Above 3? You can probably afford to hire.",
    "african_context": "Most SA micro-businesses have no management accounts. Start with these 4 numbers in a simple spreadsheet updated monthly. It is more valuable than any accounting software if you actually use it."
  }',
  ARRAY['financial_health','profitability','reporting','management'],
  ARRAY['foundation','momentum'],
  'warning',
  'Calculate Key Numbers'
),

-- ── OPERATIONS ────────────────────────────────────────────────────────────────
(
  'work-the-system',
  'Work the System',
  'Sam Carpenter',
  'Systems Mindset',
  'Your business is a collection of processes. Fix the processes and the business fixes itself.',
  '{
    "one_sentence": "Most business problems are not people problems — they are systems problems that get blamed on people.",
    "problem_it_solves": "Business owners who fix the same problems repeatedly instead of building systems that prevent them.",
    "how_it_works": "For every recurring problem, write a one-page procedure. The procedure replaces your need to be there. Over 90 days, document every recurring task. Within a year, you will have 80% of your business running without you.",
    "book_in_action": "This week, pick the single most recurring problem in your business. Write a one-page procedure: (1) Purpose of the task, (2) Steps in sequence, (3) What done looks like. Have your staff follow it exactly. Update when it breaks.",
    "african_context": "Township businesses are the most systems-resistant because the owner IS the system. The same skills that built the business become the ceiling. Document first, delegate second."
  }',
  ARRAY['operations','systemisation','delegation','scale'],
  ARRAY['momentum','mastery'],
  'opportunity',
  'Create First SOP'
),

(
  'traction-eos',
  'Traction',
  'Gino Wickman',
  'Entrepreneurial Operating System (EOS)',
  'Six components — Vision, People, Data, Issues, Process, Traction — must all be strong for a business to scale.',
  '{
    "one_sentence": "Struggling businesses usually have weak People, Data, or Traction components — rarely a Vision problem.",
    "problem_it_solves": "Businesses that are stuck in the 10-50 employee range, where the owner is still doing everything despite having a team.",
    "how_it_works": "Weekly Level 10 Meeting: issues list, rocks review, scorecard review. 90-day Rocks: maximum 3-5 priorities per person per quarter. Accountability Chart: who owns what — not org chart, ownership chart.",
    "book_in_action": "Run your first Level 10 Meeting this week: (1) Good news (5 min), (2) Review scorecard (5 min), (3) Review rocks (5 min), (4) Issues list (45 min). Keep it to 90 minutes exactly. The discipline IS the benefit.",
    "african_context": "EOS was designed for 10-250 person companies. Many SA businesses are at exactly this stage: big enough to need structure, small enough that every meeting is still informal."
  }',
  ARRAY['management','operations','scale','team_alignment'],
  ARRAY['mastery','legacy'],
  'opportunity',
  'Start Level 10 Meeting'
),

-- ── PEOPLE & LEADERSHIP ───────────────────────────────────────────────────────
(
  'multipliers',
  'Multipliers',
  'Liz Wiseman',
  'Multipliers vs Diminishers',
  'Some leaders make everyone around them smarter — others, despite good intentions, create dependency and reduce team intelligence.',
  '{
    "one_sentence": "Accidental Diminishers believe they are helping but they are actually preventing their team from growing.",
    "problem_it_solves": "Business owners who complain that their team cannot function without them — without realising they have created that dependency.",
    "how_it_works": "The 5 Multiplier disciplines: Talent Magnet (find and stretch people), Liberator (create safe environment to contribute), Challenger (pose questions not answers), Debate Maker (demand data-driven decisions), Investor (give full ownership of results).",
    "book_in_action": "For the next week, replace every answer you give with a question. When a staff member asks for a decision, respond: ''What do you think we should do?'' Track how many times they solve it themselves.",
    "african_context": "In many African workplace cultures, asking the boss for permission before every decision is normal. Multiplier leadership disrupts this pattern in a respectful, empowering way."
  }',
  ARRAY['leadership','team_performance','delegation','management'],
  ARRAY['mastery','legacy'],
  'opportunity',
  'Try Multiplier Question'
),

(
  'radical-candor',
  'Radical Candor',
  'Kim Scott',
  'Radical Candor',
  'Caring personally while challenging directly produces the best teams — silence is not kindness, it is negligence.',
  '{
    "one_sentence": "Avoiding hard feedback is not being nice — it is withholding information that your team needs to grow.",
    "problem_it_solves": "Managers who are either brutally harsh (obnoxious aggression) or avoidantly silent (ruinous empathy) — both destroy teams.",
    "how_it_works": "Radical Candor sits in the quadrant of High Care + High Challenge. Before every feedback conversation: (1) Make sure you care about the person, (2) Be specific, (3) Separate the behaviour from the identity, (4) Focus on impact not intent.",
    "book_in_action": "Think of feedback you have been avoiding giving a staff member. Write one sentence of radically candid feedback: ''When [specific behaviour], [specific impact]. I''m telling you this because [genuine reason].'' Have the conversation this week.",
    "african_context": "Ubuntu values harmony and community. Radical Candor is not un-African — it is Ubuntu applied to growth: I care enough about you to tell you the truth."
  }',
  ARRAY['feedback','management','hr','team_performance'],
  ARRAY['momentum','mastery'],
  'opportunity',
  'Give Candid Feedback'
),

-- ── MARKETING & BRAND ─────────────────────────────────────────────────────────
(
  'contagious-jonah',
  'Contagious',
  'Jonah Berger',
  'STEPPS Framework',
  'Products and ideas spread for 6 predictable reasons: Social Currency, Triggers, Emotion, Public, Practical Value, and Stories.',
  '{
    "one_sentence": "Word-of-mouth is not random — it is the predictable outcome of building the right 6 elements into how you present your business.",
    "problem_it_solves": "Businesses that invest in advertising but get little organic spread because their offering is not built to be talked about.",
    "how_it_works": "STEPPS: (S) Social Currency — does sharing this make people look good? (T) Triggers — what in daily life reminds people of your brand? (E) Emotion — does it make people feel something? (P) Public — is use visible? (P) Practical Value — is it genuinely useful? (S) Stories — is there a narrative worth retelling?",
    "book_in_action": "Apply STEPPS to your business: What makes people feel clever for choosing you? (S). What everyday moment should trigger them to think of you? (T). What emotion do you consistently create? (E). Answer just these three and redesign one touchpoint to maximise them.",
    "african_context": "Stokvels, burial societies, and church networks are South Africa''s original viral marketing engines. They spread through story and social currency — the STEPPS framework already exists in our communities."
  }',
  ARRAY['marketing','word_of_mouth','brand','customer_acquisition'],
  ARRAY['momentum','mastery'],
  'opportunity',
  'Apply STEPPS'
),

(
  'purple-cow',
  'Purple Cow',
  'Seth Godin',
  'Remarkability',
  'Average products for average people — marketed to the masses — are invisible. The only path to growth is being remarkable.',
  '{
    "one_sentence": "In a world of noise, ordinary is invisible — you must be remarkable enough that people feel compelled to tell others.",
    "problem_it_solves": "Businesses that compete on price because they see themselves as interchangeable with competitors.",
    "how_it_works": "Ask: if someone described my business to a friend, what is the single thing they would mention? If the answer is ''They are pretty good'' — you have a problem. Identify the one thing you can do that no competitor does: speed, obsession, specialisation, story.",
    "book_in_action": "Describe your business in one sentence to a stranger. Does their face light up? Do they ask follow-up questions? If not, rewrite until it creates a reaction. The reaction is the purple cow.",
    "african_context": "South African entrepreneurs who have a ''built in South Africa, for South African conditions'' story have an instant purple cow: load-shedding-proof, B-BBEE empowered, township-born — these are powerful differentiators globally."
  }',
  ARRAY['marketing','differentiation','brand','positioning'],
  ARRAY['foundation','momentum'],
  'opportunity',
  'Find Your Purple Cow'
),

-- ── STRATEGY ──────────────────────────────────────────────────────────────────
(
  'good-to-great',
  'Good to Great',
  'Jim Collins',
  'Hedgehog Concept',
  'Great companies sit at the intersection of what they are passionate about, what they can be world-class at, and what drives their economic engine.',
  '{
    "one_sentence": "Doing too many things at mediocre quality is the primary reason good companies never become great.",
    "problem_it_solves": "Entrepreneurs who say yes to every opportunity and spread themselves across too many products, clients, and markets.",
    "how_it_works": "The Hedgehog Concept: draw three overlapping circles. (1) What you are deeply passionate about. (2) What you can be best in your market at. (3) What drives your revenue per [unit of effort]. Where all three overlap is your Hedgehog. Everything outside it is a distraction.",
    "book_in_action": "Draw the three circles for your business right now. Be honest: what do you truly do better than any competitor in your area? What do customers pay the most for per hour of your effort? Where the two answers overlap — double down there.",
    "african_context": "South African entrepreneurs often say yes to everything because scarcity has trained them to. The Hedgehog Concept is permission to say no."
  }',
  ARRAY['strategy','focus','differentiation','scale'],
  ARRAY['mastery','legacy'],
  'opportunity',
  'Find Your Hedgehog'
),

(
  'competitive-strategy',
  'Competitive Strategy',
  'Michael Porter',
  'Porter''s Five Forces',
  'Industry profitability is determined by five structural forces: rivalry, new entrants, substitutes, supplier power, and buyer power.',
  '{
    "one_sentence": "Understanding your industry forces tells you where the profit pools are and which competitive moves will be sustainable.",
    "problem_it_solves": "Businesses that make competitive moves without understanding the structural forces that will determine whether those moves generate sustainable profit.",
    "how_it_works": "Rate each force 1-5 (1=weak, 5=strong): Rivalry intensity, Threat of new entrants, Threat of substitutes, Supplier bargaining power, Buyer bargaining power. High forces = low industry profitability. Low forces = attractive industry.",
    "book_in_action": "Rate the five forces for your industry. Your competitive strategy should neutralise the highest-rated force. If buyer power is high (many alternatives, easy to switch): lock in with contracts, loyalty programmes, switching costs. If rivalry is high: differentiate aggressively.",
    "african_context": "Load-shedding created new forces for every SA business: backup power suppliers suddenly have extreme supplier power. Understanding forces helps you see where the power is shifting in your market."
  }',
  ARRAY['strategy','competition','industry_analysis','positioning'],
  ARRAY['mastery','legacy'],
  'opportunity',
  'Analyse Five Forces'
),

-- ── CUSTOMER ──────────────────────────────────────────────────────────────────
(
  'raving-fans',
  'Raving Fans',
  'Ken Blanchard',
  'Raving Fans Framework',
  'Satisfied customers leave. Only Raving Fans stay and grow your business through referrals.',
  '{
    "one_sentence": "Customer satisfaction is the minimum required to stay in business — Raving Fans are what grow it.",
    "problem_it_solves": "Businesses with high client turnover despite reasonable satisfaction scores.",
    "how_it_works": "Three steps to Raving Fans: (1) Decide what you want (your vision of perfect service). (2) Discover what the customer wants (their vision). (3) Deliver plus one: exceed their expectations by a tiny margin, consistently. Consistency matters more than the occasional grand gesture.",
    "book_in_action": "Call your three best clients this week. Ask: ''What is the one thing we do that no other supplier does for you?'' Their answer is your Raving Fan service. Make sure every client experiences it every time.",
    "african_context": "Ubuntu demands we see the whole person, not just the transaction. A South African Raving Fan experience honours the relationship: remember names, family events, celebrate wins together."
  }',
  ARRAY['customer_service','retention','referrals','growth'],
  ARRAY['foundation','momentum'],
  'opportunity',
  'Create Fan Experience'
),

(
  'customer-success',
  'Customer Success',
  'Nick Mehta',
  'Customer Success Framework',
  'The revenue you keep is more valuable than the revenue you win. Proactive success management beats reactive support.',
  '{
    "one_sentence": "Companies that track customer health scores and intervene before problems surface have dramatically lower churn.",
    "problem_it_solves": "Service businesses that only hear from clients when something goes wrong — by then it is too late.",
    "how_it_works": "Define 3-5 health signals for your service: usage, engagement, NPS, milestone completion, payment behaviour. Create a simple health score (1-10). When a client score drops below 6, proactively reach out within 48 hours.",
    "book_in_action": "List your top 10 clients. Rate each from 1-10 on: (1) Have they used your service this month? (2) Would they recommend you today? (3) Are they getting the value they expected? Anyone under 7 on any dimension: call them this week.",
    "african_context": "In South Africa, many businesses only check in at invoice time. A monthly check-in call — not a sales call, a genuine ''how are things going'' — transforms relationships and prevents churn."
  }',
  ARRAY['customer_success','retention','churn','recurring_revenue'],
  ARRAY['momentum','mastery'],
  'warning',
  'Review Client Health'
),

-- ── MINDSET & FOUNDER ─────────────────────────────────────────────────────────
(
  'the-obstacle-is-the-way',
  'The Obstacle Is the Way',
  'Ryan Holiday',
  'Stoic Obstacle Reframe',
  'Every obstacle contains an opportunity — the most successful people do not avoid problems, they transform them into advantages.',
  '{
    "one_sentence": "What stands in the way becomes the way.",
    "problem_it_solves": "Entrepreneurs who are paralysed by obstacles rather than using them as competitive advantages.",
    "how_it_works": "Three disciplines: Perception (see obstacles clearly, without distortion), Action (break the obstacle into small actions), Will (accept what cannot be changed and act on what can). When you face an obstacle: what can I learn from this? What does this make possible that did not exist before?",
    "book_in_action": "Think of your biggest current obstacle. Write: (1) The worst realistic outcome if this obstacle wins. (2) Three actions that would reduce this obstacle by 10%. (3) One way this obstacle, if overcome, makes you more competitive than a business that never faced it. Then take the first action today.",
    "african_context": "South African entrepreneurs have built businesses through apartheid, load-shedding, and COVID. The obstacle has always been the way. The resilience is the competitive advantage globally."
  }',
  ARRAY['mindset','resilience','problem_solving','leadership'],
  ARRAY['foundation','momentum','mastery'],
  'opportunity',
  'Reframe Obstacle'
),

(
  'deep-work',
  'Deep Work',
  'Cal Newport',
  'Deep Work Practice',
  'The ability to focus without distraction on cognitively demanding tasks is becoming rare and increasingly valuable.',
  '{
    "one_sentence": "One hour of deep, focused work produces more than four hours of shallow, interrupted work.",
    "problem_it_solves": "Entrepreneurs who are always busy but rarely productive — drowning in WhatsApp, email, and low-value tasks.",
    "how_it_works": "Schedule 2-3 hour Deep Work blocks for your highest-value activities (business development, product creation, strategic thinking). No phone, no WhatsApp, no email during these blocks. Treat them as unmovable appointments.",
    "book_in_action": "Tomorrow: block 7am-9am for one project that moves your business forward. Phone on airplane mode. Tell your team you are in a meeting. At the end: measure what you achieved. Commit to doing this every morning for 30 days.",
    "african_context": "South African business culture runs on WhatsApp. Deep work blocks are one of the most disruptive practices an entrepreneur can adopt — and most disruptive in the best way."
  }',
  ARRAY['productivity','focus','time_management','growth'],
  ARRAY['foundation','momentum','mastery'],
  'opportunity',
  'Schedule Deep Work'
),

-- ── EXECUTION ─────────────────────────────────────────────────────────────────
(
  'four-disciplines',
  'The 4 Disciplines of Execution',
  'Chris McChesney',
  '4DX Framework',
  'People fail to execute on strategy not because they do not care, but because they are consumed by the Whirlwind — the urgent daily work.',
  '{
    "one_sentence": "You cannot execute on your biggest strategic goals while you are fighting fires — 4DX creates the structure to advance both simultaneously.",
    "problem_it_solves": "Businesses where strategic goals are set in January but forgotten by March because day-to-day urgency crowds them out.",
    "how_it_works": "4 Disciplines: (1) Focus on the Wildly Important Goal (WIG) — maximum 1-2 per team. (2) Act on Lead Measures (the actions that predict the lag measure). (3) Keep a Compelling Scoreboard (visible, real-time). (4) Create a Cadence of Accountability (weekly commitment meeting).",
    "book_in_action": "Define your one WIG for the next 90 days. Write it as: ''From X to Y by [date].'' Identify two lead measures (actions your team controls). Create a paper scoreboard on your wall. Review it every Monday morning in a 10-minute meeting.",
    "african_context": "4DX was used to transform US Army corps — it works in any size organisation. South African businesses often have good vision but weak execution infrastructure. This fixes that."
  }',
  ARRAY['execution','strategy','goals','accountability'],
  ARRAY['momentum','mastery'],
  'opportunity',
  'Set Your WIG'
)

ON CONFLICT (slug) DO NOTHING;
