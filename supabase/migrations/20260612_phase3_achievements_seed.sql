-- Phase 3 — Seed all achievements
-- Every achievement referenced in the codebase must exist here before checking

INSERT INTO achievements (slug, name, description, icon, category, criteria) VALUES
-- Milestones
('first_breath',              'First Breath',            'Your business is live on AdminOS',                              '🌱', 'milestone',   '{"event":"tenant_created"}'),
('year_one_survivor',         'Year One Survivor',       'Your business has been running for 1 year',                     '🥇', 'milestone',   '{"business_age_months":12}'),
('year_two',                  'Year Two',                'Two years in business',                                         '🏆', 'milestone',   '{"business_age_months":24}'),
('year_three',                'Year Three',              'Three years — you are now in the top 10% of SA businesses',     '💎', 'milestone',   '{"business_age_months":36}'),
('clients_100',               '100 Clients',             '100 contacts in your client directory',                         '👥', 'milestone',   '{"contact_count":100}'),
('clients_500',               '500 Clients',             '500 contacts',                                                  '🌍', 'milestone',   '{"contact_count":500}'),
('revenue_1m',                'R1M Revenue',             'R1,000,000 in total invoiced revenue',                          '💰', 'milestone',   '{"total_revenue_zar":1000000}'),
('revenue_5m',                'R5M Revenue',             'R5,000,000 in total invoiced revenue',                          '🚀', 'milestone',   '{"total_revenue_zar":5000000}'),
('revenue_10m',               'R10M Revenue',            'R10,000,000 in total invoiced revenue',                         '🌟', 'milestone',   '{"total_revenue_zar":10000000}'),
('full_team',                 'Full Team',               '5 or more active staff members',                                '👨‍👩‍👧‍👦', 'milestone', '{"active_staff":5}'),
-- Compliance
('popia_certified',           'POPIA Certified',         'Completed POPIA compliance setup',                              '🔒', 'compliance',  '{"completed_popia_setup":true}'),
('tax_compliant',             'Tax Compliant',           'All tax deadlines met for the year',                            '📋', 'compliance',  '{"tax_deadlines_met":true}'),
('clean_debtor_book',         'Clean Debtor Book',       'No invoices overdue for 30 days straight',                      '✅', 'compliance',  '{"days_no_overdue":30}'),
('bbbbee_improved',           'B-BBEE Level Up',         'B-BBEE level improved',                                         '🏅', 'compliance',  '{"bbbbee_level_improved":true}'),
('women_owned_certified',     'Women-Owned Certified',   'Women-owned business status verified',                          '💜', 'compliance',  '{"women_owned_verified":true}'),
('informal_to_formal',        'Formal Business',         'Completed the informal-to-formal pathway',                      '📜', 'compliance',  '{"formalization_complete":true}'),
-- Learning
('foundation_graduate',       'Foundation Graduate',     'Completed all Foundation Level modules',                        '🎓', 'learning',    '{"academy_level":"foundation","completion":100}'),
('business_builder_graduate', 'Business Builder',        'Completed Momentum Level modules',                              '🎓', 'learning',    '{"academy_level":"momentum","completion":100}'),
('acbo',                      'ACBO Certified',          'Certified as an African Certified Business Owner',              '🎓', 'learning',    '{"academy_level":"mastery","completion":100}'),
('seven_day_streak',          '7-Day Learning Streak',   '7 consecutive days of learning',                                '🔥', 'learning',    '{"learning_streak":7}'),
('thirty_day_streak',         '30-Day Learning Streak',  '30 consecutive days of learning',                               '🔥', 'learning',    '{"learning_streak":30}'),
('ninety_day_streak',         '90-Day Learning Streak',  '90 consecutive days of learning — unstoppable',                 '⚡', 'learning',    '{"learning_streak":90}'),
('first_sop',                 'First SOP',               'Created your first Standard Operating Procedure',               '📘', 'learning',    '{"sop_count":1}'),
('sos_builder',               'SOS Builder',             '10 SOPs documented — your business can run without you',        '📚', 'learning',    '{"sop_count":10}'),
-- Financial
('profit_first_implemented',  'Profit First',            'Set up all 5 Profit First accounts',                           '💵', 'financial',   '{"profit_first_setup":true}'),
('cash_positive',             'Cash Positive',           'Business cash position positive for 3 consecutive months',      '💚', 'financial',   '{"cash_positive_months":3}'),
-- Team
('employer',                  'Employer',                'Added your first team member',                                  '🤝', 'team',        '{"staff_count":1}'),
-- Community
('community_mentor',          'Community Mentor',        'Accepted a mentorship request',                                 '🌟', 'community',   '{"mentorship_connection":true}'),
('stokvel_treasurer',         'Stokvel Treasurer',       'Managing a stokvel group',                                      '🏦', 'community',   '{"stokvel_group":true}')
ON CONFLICT (slug) DO NOTHING;
