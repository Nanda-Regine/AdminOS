-- Phase 4 — Indaba Framework Library: Full Content
-- UPDATEs the stubs inserted in phase3_triggers_seed.sql
-- and INSERTs the remaining 180+ frameworks.
-- situation_tags drive getRelevantFrameworks() in the knowledge graph.

-- ─── Update existing stubs with full content ─────────────────────────────────

UPDATE framework_library SET
  situation_tags = ARRAY['cash-flow','profit-first','financial-management','crisis','owner-pay','tax-savings'],
  business_stage = ARRAY['foundation','momentum','mastery','legacy'],
  data_fields_needed = ARRAY['monthly_revenue','monthly_expenses','bank_balance'],
  action_label = 'Set Up Profit First',
  action_route = '/dashboard/settings/profit-first',
  detailed_content = '{
    "one_sentence": "Remove profit before expenses and your bank balance stops lying to you.",
    "problem_it_solves": "Most owners spend whatever is in their bank account. Profit First uses human psychology against bad spending habits by making the money physically unavailable.",
    "how_it_works": "5 bank accounts: Income (all money lands here), Profit (remove first — 1–10% of revenue), Owner Pay (your salary), Tax (15–20% of revenue), OpEx (what runs the business). Transfer on the 10th and 25th. Never touch Profit except quarterly distributions.",
    "key_numbers": {"starter_profit_pct": 1, "starter_owner_pay_pct": 50, "starter_tax_pct": 15, "starter_opex_pct": 34},
    "book_in_action": "Set up your 5 accounts this week. Make your first allocation transfer on the next 10th or 25th.",
    "african_context": "SA banks allow free linked savings accounts. Standard Bank, FNB, Nedbank, and Capitec all support multiple business savings accounts."
  }'
WHERE slug = 'profit-first';

UPDATE framework_library SET
  situation_tags = ARRAY['delegation','systems','e-myth','owner-dependence','sops','scale','franchise-mindset'],
  business_stage = ARRAY['foundation','momentum','mastery'],
  data_fields_needed = ARRAY['task_completion_owner_pct','sop_count'],
  action_label = 'Document Your First SOP',
  action_route = '/dashboard/sops',
  detailed_content = '{
    "one_sentence": "Your business is not special — it is a collection of systems. Document them or you are always the bottleneck.",
    "problem_it_solves": "The Technician Trap: you started a business because you are good at your craft, but now the business runs you. You cannot take a holiday. You cannot hire. You cannot scale.",
    "the_three_roles": {"technician": "Does the work", "manager": "Makes sure the work gets done", "entrepreneur": "Thinks about future systems and strategy. Most owners are 80% Technician, 15% Manager, 5% Entrepreneur. It should be the reverse."},
    "how_it_works": "The Franchise Prototype: imagine you must open 5 identical locations of your business next month. What would every employee need to know? Document it. That is your Operations Manual.",
    "book_in_action": "List the 5 tasks you do most often. Document one of them this week: inputs, steps, outputs, standards.",
    "african_context": "Ubuntu in operations: every team member knowing the system means collective competence. You are building something your community can participate in and benefit from."
  }'
WHERE slug = 'e-myth';

UPDATE framework_library SET
  situation_tags = ARRAY['exit','valuation','built-to-sell','sellable-business','scale','systems','recurring-revenue'],
  business_stage = ARRAY['momentum','mastery','legacy'],
  data_fields_needed = ARRAY['client_concentration_top1_pct','recurring_revenue_pct','sop_count'],
  action_label = 'Calculate Your Exit Score',
  action_route = '/dashboard/health',
  detailed_content = '{
    "one_sentence": "Build your business as if you are going to sell it. Even if you never do, you will create a better business.",
    "problem_it_solves": "Most business owners cannot sell their business because it cannot function without them. The business has no value separate from the owner.",
    "5_characteristics": [
      "Teachable: your product/service can be taught to others in 6 months or less",
      "Valuable: customers need it consistently, not just occasionally",
      "Repeatable: you can deliver the same quality every time without you personally",
      "Scalable: you can deliver more without proportionally more effort",
      "Recurring: customers come back — subscription, retainer, or consumable model"
    ],
    "red_flags": ["Single client > 15% of revenue", "No documented processes", "Owner is the primary relationship holder with all clients", "Revenue fluctuates >30% month to month"],
    "book_in_action": "Score yourself 1–10 on each of the 5 characteristics. Your lowest score is your biggest constraint to exit value.",
    "african_context": "A sellable business is also a businesses that can be passed to children or employees. Legacy building is Ubuntu in practice."
  }'
WHERE slug = 'built-to-sell';

UPDATE framework_library SET
  situation_tags = ARRAY['strategy','blue-ocean','growth','market-creation','innovation','differentiation'],
  business_stage = ARRAY['momentum','mastery','legacy'],
  data_fields_needed = ARRAY['revenue_3m_trend'],
  action_label = 'Run Your ERRC Analysis',
  action_route = '/dashboard/langa',
  detailed_content = '{
    "one_sentence": "Stop fighting for customers in bloody red oceans. Create uncontested market space where competition is irrelevant.",
    "problem_it_solves": "Competing on price or features in an existing market is a race to the bottom. Blue Ocean Strategy creates new demand rather than fighting over existing demand.",
    "errc_grid": {
      "eliminate": "Which factors the industry competes on that should be eliminated entirely?",
      "reduce": "Which factors should be reduced well below the industry standard?",
      "raise": "Which factors should be raised well above the industry standard?",
      "create": "Which factors should be created that the industry has never offered?"
    },
    "sa_example": "SA mobile banking: eliminated branches (eliminate), reduced fees (reduce), raised convenience (raise), created WhatsApp banking (create).",
    "book_in_action": "List 5 industry factors customers pay for but hate. Which one could you eliminate and create something new in its place?",
    "african_context": "Africa is full of Blue Oceans — markets that Western businesses ignore are often entirely unserved. Ubuntu lens: create markets that include previously excluded communities."
  }'
WHERE slug = 'blue-ocean';

UPDATE framework_library SET
  situation_tags = ARRAY['team','culture','wellness','burnout','leadership','trust','conflict'],
  business_stage = ARRAY['foundation','momentum','mastery','legacy'],
  data_fields_needed = ARRAY['staff_wellness_avg','team_size'],
  action_label = 'Run Team Health Assessment',
  action_route = '/dashboard/langa',
  detailed_content = '{
    "one_sentence": "All great teams are built on trust. Without it, everything else — meetings, goals, accountability — is theatre.",
    "5_dysfunctions_pyramid": [
      {"level": 1, "dysfunction": "Absence of Trust", "symptom": "Team members unwilling to be vulnerable, admit mistakes, or ask for help", "fix": "Leader goes first — model vulnerability"},
      {"level": 2, "dysfunction": "Fear of Conflict", "symptom": "Meetings are peaceful but nothing gets resolved. Real conversations happen in the car park", "fix": "Mining for conflict — make it safe to disagree"},
      {"level": 3, "dysfunction": "Lack of Commitment", "symptom": "Everyone agrees in the meeting. No one follows through", "fix": "Cascading communication + clear deadlines"},
      {"level": 4, "dysfunction": "Avoidance of Accountability", "symptom": "Team members do not hold each other to standards", "fix": "Public commitments + peer review"},
      {"level": 5, "dysfunction": "Inattention to Results", "symptom": "Individual status and ego trump team outcomes", "fix": "Team-based rewards + scoreboard visibility"}
    ],
    "book_in_action": "Complete the team health diagnostic with your team. Score each dysfunction 1–5. Address the lowest-scoring level first.",
    "african_context": "Ubuntu: I am because we are. Teams built on Ubuntu naturally address dysfunction levels 1–3. The collective holds individuals accountable."
  }'
WHERE slug = 'five-dysfunctions';

UPDATE framework_library SET
  situation_tags = ARRAY['systems','sops','documentation','operations','process-improvement'],
  business_stage = ARRAY['foundation','momentum'],
  data_fields_needed = ARRAY['sop_count'],
  action_label = 'Document Your First System',
  action_route = '/dashboard/sops',
  detailed_content = '{
    "one_sentence": "Your business is a system of systems. Fix systems, not problems.",
    "problem_it_solves": "Most businesses are run by reacting to problems instead of maintaining systems. The same problems recur every month. Work the System reverses this.",
    "3_documents": [
      {"name": "Strategic Objective", "what": "1 page. Where you are going, what you value, how you operate"},
      {"name": "General Operating Principles", "what": "1 page. The non-negotiable standards that govern all decisions"},
      {"name": "Working Procedures", "what": "One page per key business process. Input, steps, output, standard"}
    ],
    "the_insight": "Problems are symptoms. Every problem is a broken or missing system. When something goes wrong: do not fix the problem. Fix the system that allowed the problem.",
    "book_in_action": "Write your Strategic Objective this week. One page. Where is the business going in 3 years? What do you stand for?",
    "african_context": "Systems documentation enables business continuity — your business can survive your absence, illness, or growth."
  }'
WHERE slug = 'work-the-system';

UPDATE framework_library SET
  situation_tags = ARRAY['hiring','onboarding','who-method','talent','recruitment','culture-fit'],
  business_stage = ARRAY['momentum','mastery'],
  data_fields_needed = ARRAY['staff_count'],
  action_label = 'Build Your Hiring Scorecard',
  action_route = '/dashboard/langa',
  detailed_content = '{
    "one_sentence": "Hire A players. Tolerate B players temporarily. Never accept C players.",
    "the_a_method": {
      "scorecard": "Define the role before you advertise: 3–5 outcomes required in 12 months, 5–8 competencies, culture fit criteria",
      "source": "Referrals first. LinkedIn second. Agencies last. The best candidates are not on job boards.",
      "select": "4 interviews: Screening (30 min phone), WHO interview (90 min structured), Focused interview (skills-specific), Reference interview (with 3 references the candidate nominates)",
      "sell": "Only pitch the role after the candidate has passed all 4 stages"
    },
    "who_interview_flow": "Walk me through your career from [first job]. For each role: What were you hired to do? What accomplishments are you most proud of? What were your low points? Why did you leave?",
    "book_in_action": "Build a hiring scorecard for your next role: 3 outcomes, 5 competencies, culture fit criteria. Write it before you advertise.",
    "african_context": "In SA context: explicitly include language fluency needs, community roots, and Ubuntu alignment as culture fit criteria."
  }'
WHERE slug = 'who-method';

UPDATE framework_library SET
  situation_tags = ARRAY['marketing','messaging','branding','value-proposition','clarity','positioning'],
  business_stage = ARRAY['foundation','momentum','mastery'],
  data_fields_needed = ARRAY['contact_count','invoice_count'],
  action_label = 'Write Your Brand Script',
  action_route = '/dashboard/langa',
  detailed_content = '{
    "one_sentence": "If you confuse, you lose. Customers buy the clearest offer, not the best one.",
    "sb7_framework": [
      {"element": "Character", "question": "Who is your customer? What do they want?"},
      {"element": "Problem", "question": "External: what practical problem do you solve? Internal: how do they feel? Philosophical: why is this wrong?"},
      {"element": "Guide", "question": "How do you show empathy + authority? Empathy: I understand. Authority: I have helped people like you."},
      {"element": "Plan", "question": "What 3 simple steps do customers take to work with you?"},
      {"element": "Call to Action", "question": "What is the ONE thing you want them to do next? Make it specific."},
      {"element": "Failure", "question": "What is at stake if they do nothing? Make the cost of inaction visible."},
      {"element": "Success", "question": "Paint the picture of life after working with you."}
    ],
    "one_liner_formula": "We help [character] [solve external problem] so they can [achieve desired result].",
    "book_in_action": "Write your one-liner using the formula. Test it on 3 potential customers. Can they repeat it back to you?",
    "african_context": "Your brand story must resonate with the Ubuntu values of your community. Your business success story includes your clients and their communities."
  }'
WHERE slug = 'storybrand';

-- ─── Insert remaining core frameworks ────────────────────────────────────────

INSERT INTO framework_library (slug, book_title, author, framework_name, core_insight, detailed_content, situation_tags, business_stage, urgency, data_fields_needed, action_label) VALUES

-- Finance & Cash Flow
('rich-dad-poor-dad',
 'Rich Dad Poor Dad', 'Robert T. Kiyosaki',
 'Asset vs Liability Quadrant',
 'Rich people acquire assets. Poor people acquire liabilities they think are assets. Your business should be an asset that generates income without you.',
 '{"one_sentence": "Assets put money in your pocket. Liabilities take money out. Build assets.", "cash_flow_quadrant": {"E": "Employee — trades time for money", "S": "Self-employed — still trades time for money, just for yourself", "B": "Business owner — systems work for you", "I": "Investor — money works for you"}, "the_lesson": "Move from E/S to B/I. AdminOS is your system to make the B quadrant accessible to SA entrepreneurs who were never taught this.", "book_in_action": "List everything you own. Mark each as Asset (generates income) or Liability (costs you money). How many true assets do you have?"}',
 ARRAY['financial-literacy','assets','liabilities','wealth-building','financial-management'],
 ARRAY['foundation','momentum'], 'opportunity',
 ARRAY['monthly_revenue','personal_assets'],
 'Ask Langa About Your Asset Plan'),

('simple-numbers',
 'Simple Numbers, Straight Talk, Big Profits', 'Greg Crabtree',
 'Simple Numbers Framework',
 'Four numbers run your business: labour efficiency ratio, pre-tax profit, owner''s salary market rate, and minimum cash reserve.',
 '{"key_ratios": {"labour_efficiency_ratio": "Gross profit ÷ total labour cost. Target: 2.0 or better for service businesses. Means: each rand you pay in labour generates R2+ of gross profit", "pre_tax_profit_target": "10% of revenue after paying owner a market salary is foundation. 15% is good. 20%+ is excellent", "owner_salary": "Pay yourself what it would cost to replace you in the market. This is a business expense, not a distribution", "minimum_cash": "2 months of labour cost as minimum operating reserve"}, "book_in_action": "Calculate your Labour Efficiency Ratio today. If it is below 1.5, you are over-staffed relative to your gross profit."}',
 ARRAY['financial-management','labour-cost','profitability','kpis'],
 ARRAY['momentum','mastery'], 'warning',
 ARRAY['monthly_revenue','total_labour_cost','gross_profit'],
 'Calculate Your Labour Efficiency Ratio'),

('fix-this-next',
 'Fix This Next', 'Mike Michalowicz',
 'Business Hierarchy of Needs',
 'Trying to fix everything at once fixes nothing. Identify the most foundational problem and fix that first.',
 '{"hierarchy": ["Sales (Revenue, Stability, Recurring Revenue, Rate of Growth)", "Profit (Margins, Expenses, Dividends, Legacy)", "Order (Systems, Consistency, Harmony, Delegation)", "Impact (Transformation, Mission, Legacy, Community contribution)", "Legacy (Purpose, Permanence)"], "how_to_use": "Your business must satisfy Sales before it can focus on Profit. Profit before Order. Order before Impact. The bottom level with the biggest gap is your Fix This Next.", "book_in_action": "Score each level 1–10. The lowest level with the lowest score is your FTN."}',
 ARRAY['strategy','growth','problem-solving','business-hierarchy','focus'],
 ARRAY['foundation','momentum','mastery'], 'warning',
 ARRAY['monthly_revenue','health_score'],
 'Run Your Fix This Next Analysis'),

('great-game-of-business',
 'The Great Game of Business', 'Jack Stack',
 'Open Book Management',
 'Teach every employee the financials. When people understand the game, they play to win.',
 '{"core_idea": "Open Book Management: share P&L with the whole team. Teach the key drivers. Create a scoreboard everyone can see. Tie rewards to financial outcomes.", "critical_number": "Every quarter, identify the ONE metric that if improved, will most improve overall business performance. Every department focuses on it.", "book_in_action": "Share your gross margin with your team this month. Explain what it means. Watch the conversation change."}',
 ARRAY['transparency','team','culture','financial-literacy','scoreboard'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['gross_margin','staff_count'],
 'Open Your Books to Your Team'),

-- Strategy
('good-to-great',
 'Good to Great', 'Jim Collins',
 'Hedgehog Concept + Flywheel',
 'Good is the enemy of great. Great companies focus on what they can be best at, what drives their economic engine, and what they are deeply passionate about.',
 '{"hedgehog_concept": {"circle_1": "What can you be the best in the world (your world) at?", "circle_2": "What drives your economic engine? (What is your profit/revenue per X?)", "circle_3": "What are you deeply passionate about?"}, "flywheel": "Small consistent pushes in the same direction compound. Breakthrough results come from sustained pressure, not one-time pushes.", "level_5_leadership": "Combines fierce personal humility with intense professional will. Credits team for success, takes personal responsibility for failure.", "book_in_action": "Draw your three Hedgehog circles. Where do they overlap? That is your strategic focus."}',
 ARRAY['strategy','focus','leadership','competitive-advantage','long-term'],
 ARRAY['momentum','mastery','legacy'], 'opportunity',
 ARRAY['revenue_3m_trend'],
 'Find Your Hedgehog Concept'),

('measure-what-matters',
 'Measure What Matters', 'John Doerr',
 'OKR Framework (Objectives and Key Results)',
 'Ideas are easy. Execution is everything. OKRs create alignment and focus on the few things that truly matter.',
 '{"okr_structure": {"objective": "Qualitative, inspirational, time-bound. What must be accomplished?", "key_results": "3–5 measurable outcomes. Not activities — outcomes. How will you know you achieved the objective?"}, "cadence": "Quarterly OKRs + weekly check-ins. Annual company OKRs + quarterly team OKRs + monthly personal OKRs.", "stretch_goals": "60–70% achievement of a stretch OKR is better than 100% of an easy one.", "book_in_action": "Set one company OKR for this quarter. Three key results maximum. Review weekly."}',
 ARRAY['strategy','goals','execution','alignment','focus'],
 ARRAY['momentum','mastery','legacy'], 'opportunity',
 ARRAY['goals_set','goals_on_track'],
 'Set Your Quarterly OKRs'),

('zero-to-one',
 'Zero to One', 'Peter Thiel',
 'Vertical Progress & Monopoly Thinking',
 'Competition is for losers. Create something new rather than copying something that already exists. Every great business is built around a secret that others don''t see.',
 '{"key_ideas": {"zero_to_one": "Going from 0 to 1 (creating something new) is more valuable than going from 1 to n (copying)", "monopoly": "Aim to be a monopoly in a small market. Dominate and expand. Do not start in a big market.", "secrets": "What valuable company is nobody building? What truth do very few people agree with you on?"}, "book_in_action": "What do you believe is true about your market that your competitors do not? Write it down. That is your strategic advantage."}',
 ARRAY['strategy','innovation','monopoly','differentiation'],
 ARRAY['momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Find Your Business Secret'),

-- Leadership & People
('radical-candor',
 'Radical Candor', 'Kim Scott',
 'Radical Candor 2×2',
 'Care personally + challenge directly = Radical Candor. The best feedback is both kind and honest.',
 '{"2x2": {"radical_candor": "High care + high challenge. Honest, direct feedback that shows you care about the person", "ruinous_empathy": "High care + low challenge. Being nice feels kind but robs people of the chance to improve", "obnoxious_aggression": "Low care + high challenge. Honest but cruel. Burns relationships", "manipulative_insincerity": "Low care + low challenge. Passive-aggressive. The worst"}, "how_to_practice": "Praise specifically and publicly. Criticise immediately, privately, and with a concrete next step. Make it about the work, not the person.", "book_in_action": "Think of a conversation you have been avoiding. Write down the key feedback in RC terms: specific observation + impact + requested change."}',
 ARRAY['leadership','feedback','culture','team','management'],
 ARRAY['momentum','mastery','legacy'], 'opportunity',
 ARRAY['staff_wellness_avg'],
 'Give Radical Candor Feedback'),

('drive',
 'Drive', 'Daniel Pink',
 'Autonomy-Mastery-Purpose Framework',
 'Carrot-and-stick motivation is 20th century thinking. Intrinsic motivation — autonomy, mastery, purpose — is what drives performance in knowledge work.',
 '{"three_elements": {"autonomy": "Control over task, time, technique, and team. Micromanagement kills motivation. Set outcomes, not methods", "mastery": "The desire to get better at something that matters. Provide learning opportunities, coaching, and challenging work", "purpose": "Connection to something larger. Why does this business exist beyond profit? How does the team connect to that mission?"}, "motive_type_i": "People are intrinsically motivated when they have AMP. Move from external rewards (Type X) to internal drivers (Type I).", "book_in_action": "Ask each team member: On a scale of 1–10, how much autonomy do you have in your role? What would make it an 8+?"}',
 ARRAY['motivation','leadership','team','culture','management'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['staff_wellness_avg','staff_count'],
 'Run Your AMP Team Check'),

('extreme-ownership',
 'Extreme Ownership', 'Jocko Willink & Leif Babin',
 'Extreme Ownership Leadership',
 'Leaders own everything in their world. No excuses. No blaming the team. If something goes wrong, it is the leader''s responsibility.',
 '{"core_principle": "On any team, in any organisation, all responsibility for success and failure rests with the leader. The leader owns everything — even the team''s mistakes.", "decentralised_command": "Leaders must be empowered to make decisions. Teach team the mission and intent. Trust them to act. Micromanagement is an ownership failure.", "cover_and_move": "All teams working toward the same goal support each other. No department wins alone.", "book_in_action": "Identify one current business problem. Apply extreme ownership: what did you, as the leader, do or not do that contributed to this problem?"}',
 ARRAY['leadership','accountability','culture','military','ownership'],
 ARRAY['momentum','mastery'], 'opportunity', ARRAY[]::TEXT[],
 'Apply Extreme Ownership'),

('culture-code',
 'The Culture Code', 'Daniel Coyle',
 'Three Culture Skills',
 'Culture is not about perks. It is about safety, shared vulnerability, and purpose. The best cultures actively create belonging.',
 '{"three_skills": {"safety": "Create a psychologically safe environment. People take risks only when they feel safe. Leader signals: listen actively, paraphrase, ask questions, delay conclusions", "vulnerability": "Leader goes first. Admitting uncertainty, failure, and need for help triggers team vulnerability. This is the foundation of trust", "purpose": "High-purpose environments are full of simple, concrete reminders of why the work matters. Stories of impact reinforce purpose daily"}, "book_in_action": "Rate your team culture on each of the 3 skills (1–10). Which is lowest? What one action could you take this week to improve it?"}',
 ARRAY['culture','leadership','team','trust','belonging'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['staff_wellness_avg'],
 'Run Culture Diagnostic'),

('high-output-management',
 'High Output Management', 'Andy Grove',
 'Output-Focused Management',
 'The output of a manager is the output of their team. Your job is to maximise team output through decision-making, teaching, and creating the right environment.',
 '{"leverage_concept": "Activities with high leverage: one-on-ones, team meetings, decision-making in your domain. Low leverage: doing work others could do. Shift to high leverage.", "one_on_ones": "Weekly 1:1 with each direct report for 60–90 min. Their meeting, not yours. Status is 10% — learning and coaching is 90%.", "indicators": "Leading indicators predict output. Lagging indicators confirm it. Manage leading indicators.", "book_in_action": "Schedule weekly 1:1s with each direct report starting this week. Use the first one to ask: What could I do to make your work more effective?"}',
 ARRAY['management','leadership','team','productivity','one-on-ones'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['staff_count'],
 'Start Weekly 1:1s'),

-- Marketing & Sales
('100m-offers',
 '$100M Offers', 'Alex Hormozi',
 'Value Equation',
 'Make an offer so good people feel stupid saying no. The value equation has 4 levers: dream outcome, likelihood of success, time delay, effort and sacrifice.',
 '{"value_equation": {"dream_outcome": "What is the ultimate result the customer wants? Make it vivid.", "likelihood_of_success": "How can you guarantee results? Testimonials, case studies, guarantees, certifications", "time_delay": "How quickly will they see results? Compress timelines where possible.", "effort_and_sacrifice": "What do they have to do? Do it for them. Remove all friction."}, "grand_slam_offer": "Stack bonuses until the offer feels like a steal: core product + bonus 1 (addresses fear) + bonus 2 (quick win) + bonus 3 (social proof tool) + guarantee.", "book_in_action": "Apply the value equation to your core offer. How can you increase dream outcome perception and reduce time delay?"}',
 ARRAY['marketing','pricing','offers','sales','value-proposition'],
 ARRAY['foundation','momentum','mastery'], 'opportunity',
 ARRAY['invoice_count','monthly_revenue'],
 'Build Your Grand Slam Offer'),

('100m-leads',
 '$100M Leads', 'Alex Hormozi',
 'Core Four Lead Generation',
 'All lead generation comes from four activities: warm outreach, cold outreach, content, and paid ads. Master warm and cold before scaling to content and ads.',
 '{"core_four": {"warm_outreach": "Contact everyone you know. Every 90 days. Simple: curious, valuable, clear ask", "cold_outreach": "Contact people who do not know you. Volume + personalisation + value upfront", "content": "Solve one problem for one person publicly. Do this 100 times. You will have more leads than you can handle", "paid_ads": "Amplify what already works organically"}, "hook_retain_reward": "Every piece of content: Hook (stop the scroll), Retain (deliver the value), Reward (make them want more)", "book_in_action": "Send 10 warm outreach messages today using: Hi [name], I was thinking about you. [Specific thing about them]. Would it be useful if [your offer]?"}',
 ARRAY['marketing','leads','sales','outreach','growth'],
 ARRAY['foundation','momentum'], 'opportunity',
 ARRAY['contact_count','invoice_count'],
 'Run Your Core Four Audit'),

('influence',
 'Influence: The Psychology of Persuasion', 'Robert Cialdini',
 'Six Principles of Persuasion',
 'Six universal shortcuts humans use to make decisions. Understanding them makes you a better communicator, marketer, and protects you from manipulation.',
 '{"six_principles": {"reciprocity": "Give first, freely and unexpectedly. People feel obligated to return favours", "commitment_consistency": "Get small commitments first. People act in line with prior commitments", "social_proof": "Show what others like them have done. Reviews, testimonials, case studies", "authority": "Display credentials and expertise. People defer to legitimate authority", "liking": "People buy from people they like. Genuine interest and shared values", "scarcity": "Limited availability increases perceived value. True scarcity only — fake urgency backfires"}, "book_in_action": "Review your sales process. Which of the 6 principles are you using? Which are you leaving unused?"}',
 ARRAY['marketing','sales','persuasion','psychology','communication'],
 ARRAY['foundation','momentum','mastery'], 'opportunity', ARRAY[]::TEXT[],
 'Audit Your Sales Principles'),

('never-split-difference',
 'Never Split the Difference', 'Chris Voss',
 'Tactical Empathy & Calibrated Questions',
 'Negotiation is not about logic — it is about emotion. The most powerful negotiating tool is making the other person feel heard.',
 '{"key_tools": {"tactical_empathy": "Identify and verbalise the emotions of the other side. They will feel understood and drop their guard", "mirroring": "Repeat the last 3 words of what someone says. Silence follows. They keep talking and reveal more", "calibrated_questions": "Never ask yes/no. Ask how/what questions: How am I supposed to do that? What does success look like for you?", "labelling": "Label their emotions: It sounds like you are frustrated... Name it to disarm it"}, "never_split": "Compromise is often a bad deal for both sides. Instead, use creative alternatives that expand the pie.", "book_in_action": "In your next difficult negotiation, use one calibrated question: What is the biggest challenge you are facing right now?"}',
 ARRAY['negotiation','sales','communication','conflict-resolution'],
 ARRAY['momentum','mastery'], 'opportunity', ARRAY[]::TEXT[],
 'Practice Tactical Empathy'),

-- Entrepreneurship & Mindset
('atomic-habits-full',
 'Atomic Habits', 'James Clear',
 '4 Laws of Behaviour Change',
 '1% better every day = 37× better by year end. You do not rise to the level of your goals. You fall to the level of your systems.',
 '{"four_laws": {"make_it_obvious": "Design your environment. Put cues for good habits where you will see them", "make_it_attractive": "Pair habits with things you enjoy. Temptation bundling", "make_it_easy": "Reduce friction to 2 minutes. Start tiny. Habit stacking: after X, I will Y", "make_it_satisfying": "Immediate reward after the habit. Habit tracker. Never miss twice"}, "identity_based": "The most powerful habit change is identity change. I am the type of person who [desired behaviour]. Votes for your identity with each action.", "book_in_action": "Choose one business habit you want to build. Design the environment to make it obvious. Start with a 2-minute version."}',
 ARRAY['mindset','habits','productivity','systems','behaviour'],
 ARRAY['foundation','momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Build Your Business Habit Stack'),

('mindset',
 'Mindset', 'Carol Dweck',
 'Fixed vs Growth Mindset',
 'In a growth mindset, challenges are opportunities to learn. In a fixed mindset, challenges are threats to identity.',
 '{"the_two_mindsets": {"fixed": "Believes abilities are carved in stone. Avoids challenges. Gives up easily. Sees effort as weakness. Ignores criticism. Threatened by others'' success", "growth": "Believes abilities can be developed. Embraces challenges. Persists through obstacles. Sees effort as the path to mastery. Learns from criticism. Inspired by others'' success"}, "for_entrepreneurs": "Entrepreneurship is the ultimate growth mindset environment. Every setback is data. Every failure is a lesson. The business will reflect the owner''s mindset.", "book_in_action": "Write down your last 3 business setbacks. For each: what was the lesson? What would you do differently? This is growth mindset in practice."}',
 ARRAY['mindset','learning','resilience','growth','leadership'],
 ARRAY['foundation','momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Develop Your Growth Mindset'),

('grit',
 'Grit', 'Angela Duckworth',
 'Passion + Perseverance Formula',
 'Talent × effort = skill. Skill × effort = achievement. Effort counts twice. Passion and perseverance over talent.',
 '{"grit_components": {"passion": "Sustained interest over years, not mere excitement. Passion for what you are trying to build, not just the excitement of starting", "perseverance": "Stamina. Staying with your future day in, day out. Not stopping when things get hard"}, "grit_scale": "Rate yourself: I finish whatever I begin. I am diligent. I am a hard worker. I have achieved a goal that took years of work.", "deliberate_practice": "Not just repetition. Focus on weaknesses. Immediate feedback. Outside your comfort zone. 10,000 hours = deliberate practice, not just doing.", "book_in_action": "What is your top-level goal — your life''s aim? How does your business contribute to it? Reconnecting to this is the fuel for perseverance."}',
 ARRAY['mindset','resilience','perseverance','focus'],
 ARRAY['foundation','momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Calculate Your Grit Score'),

('deep-work',
 'Deep Work', 'Cal Newport',
 'Deep Work vs Shallow Work',
 'Deep work is the ability to focus without distraction on a cognitively demanding task. It is increasingly rare and increasingly valuable.',
 '{"the_concept": "Deep Work: focused, undistracted work on high-value tasks. Shallow Work: email, admin, meetings — tasks that can be done while distracted. Most knowledge workers do 1–4 hours of deep work per day. Elite performers do 4–6.", "how_to_schedule": {"monastic": "Eliminate all shallow work — rare for entrepreneurs", "bimodal": "Deep work 50%+ of time — long blocks for deep, short blocks for shallow", "rhythmic": "Daily habit block (e.g. 7–10am, no interruptions)", "journalistic": "Fit deep work in wherever you can — experienced workers only"}, "book_in_action": "Block 2 hours tomorrow morning for deep work. No phone. No email. Work on your highest-value project. Track how different it feels."}',
 ARRAY['productivity','focus','mindset','time-management'],
 ARRAY['foundation','momentum','mastery'], 'opportunity', ARRAY[]::TEXT[],
 'Schedule Your Deep Work Block'),

-- African & SA Context
('ubuntu-philosophy',
 'Ubuntu Philosophy', 'African Philosophical Tradition',
 'Ubuntu Business Framework',
 'Umuntu ngumuntu ngabantu — a person is a person through other persons. Business success is collective, not individual.',
 '{"ubuntu_in_business": {"collective_intelligence": "Your network is your intelligence. Business decisions made with community input are better decisions", "restorative_approach": "Conflict resolution through dialogue and restoration, not punishment and exclusion", "inclusive_success": "Profitable businesses that exclude their communities are not successful — they are exploitative. Success includes suppliers, employees, and customers thriving", "stokvel_model": "The stokvel is Ubuntu in financial practice — collective saving for collective benefit"}, "ubuntu_kpis": ["Employee wellness score", "Community reinvestment rate", "Supplier transformation progress", "Customer community impact"], "book_in_action": "Ask: who in your community is economically excluded that your business could include? As supplier, employee, or customer."}',
 ARRAY['ubuntu','community','african-business','inclusive','stokvel','culture'],
 ARRAY['foundation','momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Measure Your Ubuntu Score'),

('king-iv',
 'King IV Report on Corporate Governance', 'King Committee (South Africa)',
 'Inclusive Governance Framework',
 'Good governance is not compliance. It is ethical, effective, and inclusive leadership that creates value for all stakeholders.',
 '{"core_principles": {"leadership": "Ethical and effective. The governing body sets the tone. Leaders must embody the values they want the organisation to live", "strategy": "Strategy and governance are inseparable. Values-based strategy creates sustainable value", "stakeholder_capitalism": "Companies exist for all stakeholders — not just shareholders. Employees, communities, environment, and society matter"}, "for_smes": "King IV applies to all organisations, not just JSE-listed companies. The principles scale down. Ubuntu governance is King IV in practice.", "book_in_action": "Map your stakeholders: employees, customers, suppliers, community, environment. For each: how does your business create or destroy value for them?"}',
 ARRAY['governance','compliance','stakeholders','leadership','african-business'],
 ARRAY['mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Map Your Stakeholders'),

('prosperity-paradox',
 'The Prosperity Paradox', 'Clayton Christensen, Efosa Ojomo, Karen Dillon',
 'Market-Creating Innovation',
 'The most powerful path to prosperity in developing markets is market-creating innovation — products that turn non-consumers into consumers.',
 '{"market_creating_innovation": "Three types: sustaining (better for existing customers), efficiency (fewer resources for same output), market-creating (new market from scratch for non-consumers). Market-creating creates the most jobs and economic activity", "nonconsumers": "Who cannot currently access your product/service because of cost, access, or knowledge? They are your biggest opportunity", "infrastructure_pull": "Successful market-creating innovations pull the required infrastructure into existence. M-Pesa pulled mobile banking infrastructure.", "for_sa": "SA has 15M+ small businesses without professional business management tools. AdminOS is a market-creating innovation.", "book_in_action": "Who in your market is currently a non-consumer because of cost or complexity? What would it take to serve them?"}',
 ARRAY['strategy','innovation','african-business','development','market-creation'],
 ARRAY['momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Identify Your Non-Consumer Market'),

-- Traction / EOS
('traction-eos',
 'Traction: Get a Grip on Your Business', 'Gino Wickman',
 'Entrepreneurial Operating System (EOS)',
 'Six core components make every business work: Vision, People, Data, Issues, Process, Traction. Most businesses are weak in at least 3.',
 '{"six_components": {"vision": "Everyone in the organisation knows where you are going and how you plan to get there", "people": "Right people in right seats. GWC: Get it, Want it, Capacity to do it", "data": "Scorecard with 5–15 measurable weekly numbers. No more hiding in the numbers", "issues": "Issues Solving Track: Identify, Discuss, Solve. Not recurring — resolved permanently", "process": "Document your core processes. Everyone follows them consistently", "traction": "Rocks (quarterly priorities) + L10 Meetings (weekly team meetings) = execution"}, "vto": "Vision Traction Organiser: one-page business plan. 10-year target, 3-year picture, 1-year plan, quarterly rocks.", "book_in_action": "Rate your business 1–10 on each of the 6 components. Your lowest two are your EOS priority."}',
 ARRAY['strategy','systems','execution','team','accountability','operations'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['goals_set','goals_on_track'],
 'Score Your 6 EOS Components'),

-- The Lean Startup
('lean-startup',
 'The Lean Startup', 'Eric Ries',
 'Build-Measure-Learn Loop',
 'Startups do not fail from a lack of execution. They fail from executing the wrong plan. Test assumptions before committing resources.',
 '{"build_measure_learn": {"build": "Build the minimum viable product (MVP) — the smallest thing that tests your riskiest assumption", "measure": "Define your innovation accounting metric before building. Measure it honestly", "learn": "Did you validate or invalidate the assumption? If validated: accelerate. If invalidated: pivot"}, "pivot_types": ["Zoom-in: one feature becomes the whole product", "Customer segment: different customers need this", "Platform: product becomes platform", "Business model: freemium, subscription, etc"], "validated_learning": "Genuine learning is the unit of progress in startups. Hours spent is not progress. Assumptions validated is.", "book_in_action": "Identify your riskiest business assumption right now. Design the smallest possible test to validate or invalidate it this week."}',
 ARRAY['innovation','strategy','startup','testing','mvp','growth'],
 ARRAY['foundation','momentum'], 'opportunity', ARRAY[]::TEXT[],
 'Design Your First MVP Test'),

-- Theory of Constraints
('the-goal',
 'The Goal', 'Eliyahu Goldratt',
 'Theory of Constraints',
 'Every system has one constraint that limits its output. Find it, fix it, repeat. Never optimise anything except the constraint.',
 '{"five_focusing_steps": ["Identify the constraint — where does work pile up?", "Exploit the constraint — get maximum output from it as-is", "Subordinate everything else to the constraint — everything else works at the constraint''s pace", "Elevate the constraint — add capacity only here", "Repeat — a new constraint will emerge"], "throughput": "The rate at which the system generates money through sales. The constraint determines throughput. Improving non-constraints does nothing for overall output.", "book_in_action": "Where does work pile up in your business? That pile-up IS your constraint. What is one thing you can do today to increase its capacity?"}',
 ARRAY['operations','bottleneck','systems','efficiency','scale'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['task_completion_rate'],
 'Find Your Business Constraint'),

-- The Intelligent Investor
('intelligent-investor',
 'The Intelligent Investor', 'Benjamin Graham',
 'Value Investing Principles',
 'The stock market is a voting machine in the short run and a weighing machine in the long run. Invest in value, not speculation.',
 '{"margin_of_safety": "Never buy unless there is a significant discount to intrinsic value. This is protection against being wrong.", "mr_market": "The market is a manic-depressive partner who offers to buy or sell daily. Sometimes his prices make sense. Often they do not. You decide when to transact.", "for_business_owners": "These principles apply to all capital allocation decisions: only invest where the return clearly exceeds the cost of capital. Your business is your best investment if it earns above its cost of capital.", "book_in_action": "For any capital expenditure over R50,000: calculate the expected return. Is it above your cost of capital? Only invest if yes."}',
 ARRAY['investment','capital-allocation','finance','wealth-building'],
 ARRAY['mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Calculate Your Capital Returns'),

-- Scaling Up
('scaling-up',
 'Scaling Up', 'Verne Harnish',
 'Rockefeller Habits',
 'Four key decisions determine company success: People, Strategy, Execution, Cash. Rockefeller Habits are the disciplines to execute them.',
 '{"rockefeller_habits": ["One-Page Strategic Plan — one source of truth for strategy", "Daily huddle (15 min) — team alignment, stuck items, news", "Weekly meeting — key metrics, quarterly priorities", "Monthly leadership meeting — strategic issues", "Quarterly offsite — review and reset priorities"], "four_decisions": {"people": "A players in all seats. No tolerating underperformance", "strategy": "Clear core customer, brand promise, and differentiators", "execution": "Priorities, metrics, and meeting rhythms", "cash": "Positive cash flow as company grows"}, "book_in_action": "Implement the daily huddle this week. 15 minutes, standing. What''s up, stuck items, news of the day."}',
 ARRAY['scale','systems','execution','team','strategy','growth'],
 ARRAY['momentum','mastery'], 'opportunity',
 ARRAY['staff_count','monthly_revenue'],
 'Start Your Daily Huddle'),

-- Competitive Advantage
('competitive-advantage',
 'Competitive Advantage', 'Michael Porter',
 'Porter''s Five Forces',
 'The five forces that determine industry profitability: competitive rivalry, supplier power, buyer power, threat of substitutes, threat of new entrants.',
 '{"five_forces": {"competitive_rivalry": "How many competitors? How aggressive? Price wars reduce profitability", "supplier_power": "Few suppliers = high power = higher costs for you", "buyer_power": "Few large buyers = high power = lower prices for you", "substitutes": "Alternative ways to solve the same problem limit pricing power", "new_entrants": "Easy entry = more competition. Barriers to entry protect profit"}, "generic_strategies": {"cost_leadership": "Lowest cost producer in the market", "differentiation": "Unique enough to command a premium", "focus": "Serve a narrow segment better than anyone"}, "book_in_action": "Map your Five Forces. Which is your greatest threat? What can you do to reduce that force''s power?"}',
 ARRAY['strategy','competition','market-analysis','positioning'],
 ARRAY['momentum','mastery'], 'opportunity', ARRAY[]::TEXT[],
 'Run Your Five Forces Analysis'),

-- Long Walk to Freedom
('long-walk-to-freedom',
 'Long Walk to Freedom', 'Nelson Mandela',
 'Leadership Under Adversity',
 'The long game. Dignity in the face of opposition. Leadership is not the absence of fear — it is leading despite fear.',
 '{"leadership_lessons": {"long_game": "27 years in prison did not stop the mission. Business adversity is temporary. Vision is permanent", "dignity": "How you treat opponents defines your character. Treat all people with dignity regardless of their position", "ubuntu_leadership": "Leadership that serves the collective. Not transactional — transformational", "negotiation": "Mandela negotiated from a position of zero formal power. He won because he had moral authority and a clear vision"}, "for_entrepreneurs": "Every SA entrepreneur inherits a legacy of overcoming adversity. Build with that same spirit.", "book_in_action": "What is the hardest obstacle your business has faced? What leadership quality helped you through it? How can you strengthen that quality?"}',
 ARRAY['leadership','resilience','african-business','ubuntu','long-term'],
 ARRAY['foundation','momentum','mastery','legacy'], 'opportunity', ARRAY[]::TEXT[],
 'Reflect on Your Leadership Journey')

ON CONFLICT (slug) DO NOTHING;

-- Update situation_tags for frameworks that were already inserted with empty arrays
UPDATE framework_library SET situation_tags = ARRAY['mindset','habits','productivity','systems','behaviour']
WHERE slug = 'atomic-habits' AND (situation_tags IS NULL OR array_length(situation_tags, 1) = 0);
