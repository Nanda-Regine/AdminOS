export type Language = 'en' | 'zu' | 'xh' | 'af' | 'st'

export interface OnboardingMessages {
  // Step 0
  langSelectGreeting: string
  langSelectPrompt: string

  // Step 1
  siyandaIntro: (name: string) => string
  siyandaIntroList: string[]
  businessNamePrompt: string
  businessNameConfirm: (name: string) => string
  businessTypePrompt: string

  // Step 2 — Chase
  chaseIntro: string
  chaseClientPrompt: string
  chaseAmountPrompt: string
  chaseDueDatePrompt: string
  chaseMagicTitle: (clientName: string) => string
  chaseExplainer: string
  chaseAddAnother: string
  chaseKeepGoing: string
  chaseProgress: string

  // Step 3 — Care
  careIntro: string
  careNamePrompt: string
  careRolePrompt: string
  carePhonePlaceholder: string
  careMagicTitle: (staffName: string) => string
  careExplainer: string
  careProgress: string

  // Step 4 — Alex
  alexIntro: string
  alexFaqPrompt: string
  alexAnswerPrompt: (n: number) => string
  alexMagicTitle: string
  alexExplainer: string
  alexConnectNow: string
  alexConnectLater: string
  alexProgress: string

  // Step 5 — Doc
  docIntro: string
  docUploadLabel: string
  docExplainer: (docType: string) => string
  docRealLabel: string
  docReferenceLabel: string
  docReferenceTooltip: string
  docSkipMsg: string
  docMagicTitle: string
  docProgress: string

  // Step 6 — Pen
  penIntro: (clientName: string, amount: string) => string
  penIntroSimple: string
  penRecipientPrompt: string
  penMagicTitle: (name: string) => string
  penDone: string
  penButtonLabel: string
  penExplainer: string[]
  penCopy: string
  penOpen: string
  penKeepGoing: string

  // Step 7 — Complete
  celebrateHeadline: string
  celebrateSubhead: (name: string) => string
  agentSummary: (invoiceCount: number, staffCount: number) => Record<string, string>
  tourPrompt: string
  tourButton: string
  dashboardButton: string

  // Skips
  skipChase: string
  skipCare: string
  skipAlex: string
  skipDoc: string
  skipPen: string

  // Progress meter
  progressAlive: (pct: number) => string

  // Common
  continueBtn: string
  skipBtn: string
  addMoreBtn: string
  addAnotherBtn: string
}

const messages: Record<Language, OnboardingMessages> = {
  en: {
    langSelectGreeting: 'Sawubona. Molo. Hello. Hallo. Dumela.',
    langSelectPrompt: 'Which language would you like to use?',

    siyandaIntro: (name) =>
      `Hi ${name}. I'm Siyanda, your AdminOS guide.\n\nI'm going to help you set up your business in the next 15 minutes. But here's the thing — we're not going to fill in forms. We're going to do real things together.\n\nBy the time we're done, you'll have:`,
    siyandaIntroList: [
      'Your first invoice in the system (and Chase will be ready to chase it)',
      'Your team added (and Care will know who to check on)',
      'Alex ready to handle your WhatsApp messages',
      'Your first AI email drafted by Pen',
    ],
    businessNamePrompt: "Let's start. What's your business called?",
    businessNameConfirm: (name) =>
      `Perfect. ${name} is officially in AdminOS. Let's get it running.`,
    businessTypePrompt: 'What type of business is it?',

    chaseIntro:
      "Every business has at least one client who owes them money right now. Let's put that first invoice in.",
    chaseClientPrompt: "Who owes you money? Just give me their name — doesn't matter if it's a person or a company.",
    chaseAmountPrompt: "How much do they owe you? (Just the number — no R sign needed)",
    chaseDueDatePrompt: 'When was it due?',
    chaseMagicTitle: (c) => `Chase just drafted this message for ${c}:`,
    chaseExplainer:
      "Chase will send messages like this automatically so you never have to chase an invoice yourself again.",
    chaseAddAnother: 'Add another invoice',
    chaseKeepGoing: 'Keep going →',
    chaseProgress: "AdminOS is 20% alive",

    careIntro:
      "Now let's add your team. Care will check in on them every week and let you know if anyone needs support.",
    careNamePrompt: "What's your first staff member's name?",
    careRolePrompt: "What's their role or job title?",
    carePhonePlaceholder: '+27 82 000 0000',
    careMagicTitle: (n) => `On Monday morning, Care will send ${n} this:`,
    careExplainer:
      "If their score drops below 3 for more than a week, you'll get a private alert. You'll always know how your team is really doing.",
    careProgress: "AdminOS is 40% alive",

    alexIntro:
      "Alex handles your WhatsApp messages automatically. Let's teach Alex about your business.",
    alexFaqPrompt: 'What are 3 questions your clients ask you most often?',
    alexAnswerPrompt: (n) => `What's your standard answer to question ${n}?`,
    alexMagicTitle: 'This is what happens when a client asks Alex one of these questions:',
    alexExplainer:
      "Alex is now trained on your business. Connect your WhatsApp number in Settings to go live.",
    alexConnectNow: 'Connect WhatsApp now',
    alexConnectLater: 'Do this later',
    alexProgress: "AdminOS is 60% alive",

    docIntro:
      "Doc can read your business documents and extract important information automatically — no manual data entry ever.\n\nUpload something — a contract, an invoice, a strategy document. Anything.",
    docUploadLabel: 'Drop your document here, or click to browse',
    docExplainer: (docType) => `Here's what Doc would extract from a typical ${docType} for your type of business:`,
    docRealLabel: 'Real document',
    docReferenceLabel: 'Reference copy (no sensitive data)',
    docReferenceTooltip:
      "Upload a blank version of your document format. Doc learns the structure without storing your actual client or staff data. Perfect for NDAs, employee contracts, or client invoices.",
    docSkipMsg: "No problem. You can upload documents from the Documents page anytime. Doc is ready.",
    docMagicTitle: 'Doc found these in your document:',
    docProgress: "AdminOS is 80% alive",

    penIntro: (client, amount) =>
      `Last one. And this one will save you time every single day.\n\nPen writes professional emails for you — using your actual business data. Let's write your first one right now.\n\nThat client we added — ${client} — who owes you R${amount}? Let's write them a proper payment request email.`,
    penIntroSimple: "Last one. Pen writes professional emails for you — welcome letters, payment requests, proposals — using your actual business data. Let's write your first one right now.",
    penRecipientPrompt: "Who should Pen write a welcome email to? (Just give me their first name)",
    penMagicTitle: (name) => `Pen is writing a welcome email for ${name} right now...`,
    penDone: "Pen saved that draft to your Email Studio. You can edit and send it any time.",
    penButtonLabel: 'Write this email →',
    penExplainer: [
      'Your business name',
      "Your client's name",
      'The invoice amount',
      'Your tone preference: Professional',
    ],
    penCopy: 'Copy email',
    penOpen: 'Open Email Studio',
    penKeepGoing: 'Finish setup →',

    celebrateHeadline: 'AdminOS is 100% alive. 🌿',
    celebrateSubhead: (name) => `${name} is now running on AI.`,
    agentSummary: (inv, staff) => ({
      chase: `Monitoring ${inv} invoice${inv !== 1 ? 's' : ''}, ready to recover`,
      care: `Checking in on ${staff} staff member${staff !== 1 ? 's' : ''} weekly`,
      alex: 'Trained on your FAQs, ready to handle WhatsApp',
      doc: 'Ready for your first upload',
      pen: 'Ready to write any business email',
      insight: 'Your first morning brief arrives tomorrow at 7am',
    }),
    tourPrompt: "Here's a quick tour of where everything lives.",
    tourButton: 'Next →',
    dashboardButton: 'Go to my dashboard →',

    skipChase: "Chase won't have invoices to recover",
    skipCare: "Care won't have anyone to check in on",
    skipAlex: "Alex won't know your business yet — train him later in Settings",
    skipDoc: 'Doc is ready when you are',
    skipPen: 'Pen is waiting in Email Studio',

    progressAlive: (pct) => `AdminOS is ${pct}% alive`,

    continueBtn: 'Continue →',
    skipBtn: 'Skip for now',
    addMoreBtn: '+ Add more',
    addAnotherBtn: '+ Add another',
  },

  zu: {
    langSelectGreeting: 'Sawubona. Molo. Hello. Hallo. Dumela.',
    langSelectPrompt: 'Ufuna ukusebenzisa ulimi olunjani?',

    siyandaIntro: (name) =>
      `Sawubona ${name}. NginguSiyanda, umhlahli wakho we-AdminOS.\n\nNgizonikiza ukusethapa ibhizinisi lakho emizuzwini engu-15. Kodwa okubalulekile — asizugcwalisa amafom. Sizokhuluma ngezinto eziyiqiniso ndawonye.\n\nNgesikhathi siqeda, uzoba nalo:`,
    siyandaIntroList: [
      'I-invoice yakho yokuqala (futhi uChase uzimisele ukuyilandela)',
      'Ithimu yakho engezwe (futhi uCare uzazi ukuthi umuntu onjani ukuhlola)',
      'U-Alex ulungele ukuphatha imiyalezo yakho ye-WhatsApp',
      'I-imeyili yakho yokuqala yazwa nguPen',
    ],
    businessNamePrompt: 'Masiقula. Ibhizinisi lakho libizwa ngani?',
    businessNameConfirm: (name) =>
      `Kuhle. ${name} isemthethweni ku-AdminOS. Asisebenze.`,
    businessTypePrompt: 'Luhlobo luni lwebhizinisi?',

    chaseIntro:
      'Yonke ibhizinisi inawe iklayenti elithwele imali manje. Masifake i-invoice yokuqala.',
    chaseClientPrompt: 'Ubani okuselekelwa imali? Nika igama — akubalulekile noma umuntu noma inkampani.',
    chaseAmountPrompt: 'Bakhokha malini? (Inombolo kuphela — akudingeki uphawu lika-R)',
    chaseDueDatePrompt: 'Kwakufanele kukhokhwe nini?',
    chaseMagicTitle: (c) => `UChase usanda kulungiselela le miyalezo ye-${c}:`,
    chaseExplainer:
      'UChase uzothuma imiyalezo nje ngalena ngokuzenzakalelayo ukuze ungabaphathi abantu abakukhokhela.',
    chaseAddAnother: 'Engeza enye i-invoice',
    chaseKeepGoing: 'Qhubeka →',
    chaseProgress: "I-AdminOS isephila ngo-20%",

    careIntro: "Manje asisengeze ithimu yakho. UCare uzohamba nazo njalo nsuku zonke futhi akutshele uma umuntu edinga usizo.",
    careNamePrompt: 'Igama lomuntu wakho wokuqala wabasebenzi liyini?',
    careRolePrompt: 'Yikuphi isikhundla noma umsebenzi wabo?',
    carePhonePlaceholder: '+27 82 000 0000',
    careMagicTitle: (n) => `NgoMsombuluko ekuseni, uCare uzothumela ${n} lokhu:`,
    careExplainer:
      "Uma inani labo lehle ngaphansi kuka-3 amaviki ambalwa, uzothola isixwayiso sangasese. Uzohlala wazi ukuthi ithimu yakho izwa kanjani ngempela.",
    careProgress: "I-AdminOS isephila ngo-40%",

    alexIntro: "U-Alex uphatha imiyalezo yakho ye-WhatsApp ngokuzenzakalelayo. Masifundise u-Alex ngeBhizinisi lakho.",
    alexFaqPrompt: 'Yimiphi imibuzo emitathu amaklayeni akubuza kakhulu?',
    alexAnswerPrompt: (n) => `Iyini impendulo yakho evamile yombuzo ${n}?`,
    alexMagicTitle: 'Naku okwenzakalayo uma ikhlaythi limbuza u-Alex esinye saleyo mibuzo:',
    alexExplainer: "U-Alex manje ufundiswe ngeBhizinisi lakho. Xhuma inombolo yakho ye-WhatsApp ku-Settings ukuze uqale.",
    alexConnectNow: 'Xhuma i-WhatsApp manje',
    alexConnectLater: 'Yenza lokhu kamuva',
    alexProgress: "I-AdminOS isephila ngo-60%",

    docIntro: "UDoc angafunda amandokumenti akho ebhizinisi futhi akhiphe ulwazi olubalulekile ngokuzenzakalelayo.\n\nLayisha okuthile — isivumelwano, i-invoice, idokumenti lesu. Noma yini.",
    docUploadLabel: 'Donsa idokumenti lakho lapha, noma ucofele ukukhangela',
    docExplainer: (docType) => `Naku uDoc angakukhipha ku-${docType} yohlobo lwakho lebhizinisi:`,
    docRealLabel: 'Idokumenti langempela',
    docReferenceLabel: 'Ikhophi yesifundo (ngaphandle kwedatha ezimqoka)',
    docReferenceTooltip: "Layisha inguqulo ehlanzwe yefomethi yakho yadokumenti. UDoc ufunda isakhiwo ngaphandle kokugcina amaklayeni akho noma idatha yabasebenzi.",
    docSkipMsg: "Kulungile. Ungayilayisha amandokumenti kusukela kukhasi Lamadokumenti noma nini. UDoc ulungile.",
    docMagicTitle: 'UDoc uthole lokhu kumandokumenti akho:',
    docProgress: "I-AdminOS isephila ngo-80%",

    penIntro: (client, amount) =>
      `Okwokugcina. Futhi lokhu kuzokusindisa isikhathi nsuku zonke.\n\nUPen ubhala ama-imeyili esemthethweni kuwe — esebenzisa idatha yakho yangempela yebhizinisi. Asisibhale sokuqala manje.\n\nIklayeni esangengeza — ${client} — okukhokhela u-R${amount}? Asisibhalele imeyili efanele yokuhlola inkokhelo.`,
    penIntroSimple: "Okwokugcina. UPen ubhala ama-imeyili esemthethweni — izimemo, izicelo zokukhokha, iziphakamiso — esebenzisa idatha yakho yangempela. Asisibhale sokuqala manje.",
    penRecipientPrompt: "Ubhalela ubani i-imeyili yokwamukela? (Nika igama labo lokuqala)",
    penMagicTitle: (name) => `UPen ubhala i-imeyili yokwamukela nge-${name} manje...`,
    penDone: "UPen uligcine lelo adrafti ku-Email Studio yakho. Ungalichopha futhi ulithumele noma nini.",
    penButtonLabel: 'Bhala le imeyili →',
    penExplainer: [
      'Igama lakho lebhizinisi',
      'Igama leklayeni',
      'Inani le-invoice',
      'Ukhetha kwakho kwesimo: Okwesemthethweni',
    ],
    penCopy: 'Kopisha i-imeyili',
    penOpen: 'Vula i-Email Studio',
    penKeepGoing: 'Qeda ukusethapa →',

    celebrateHeadline: 'I-AdminOS isephila ngo-100%. 🌿',
    celebrateSubhead: (name) => `${name} manje isebenza nge-AI.`,
    agentSummary: (inv, staff) => ({
      chase: `Ihlola ama-invoice angu-${inv}, ilungele ukubuyisa`,
      care: `Ihlola abasebenzi angu-${staff} njalo ngesonto`,
      alex: 'Ufundisiwe nge-FAQ zakho, ulungele ukuphatha i-WhatsApp',
      doc: 'Ulungele ukuphelela kwakho',
      pen: 'Ulungele ukubhala noma iyiphi i-imeyili yebhizinisi',
      insight: 'Incwadi yakho yokuqala yobusuku iyeza kusasa ngo-7am',
    }),
    tourPrompt: "Nansi uhlobo olusheshayo lwendawo lapho konke kukona.",
    tourButton: 'Okulandelayo →',
    dashboardButton: 'Iya ku-dashboard yami →',

    skipChase: "UChase ngeke abe nama-invoice azobuyisa",
    skipCare: "UCare ngeke abe nabantu azazihlola",
    skipAlex: "U-Alex ngeke azi ibhizinisi lakho — mfundise kamuva ku-Settings",
    skipDoc: 'UDoc ulungile nawe ngokukufanele',
    skipPen: 'UPen ulindile ku-Email Studio',

    progressAlive: (pct) => `I-AdminOS isephila ngo-${pct}%`,

    continueBtn: 'Qhubeka →',
    skipBtn: 'Yeqa okwamanje',
    addMoreBtn: '+ Engeza okunye',
    addAnotherBtn: '+ Engeza omunye',
  },

  xh: {
    langSelectGreeting: 'Sawubona. Molo. Hello. Hallo. Dumela.',
    langSelectPrompt: 'Ufuna ukusebenzisa loluphi ulwimi?',

    siyandaIntro: (name) =>
      `Molo ${name}. NdinguSiyanda, umhlahli wakho we-AdminOS.\n\nNdiza kukunceda ukusetha ishishini lakho kwimizuzu eli-15. Kodwa okubalulekileyo — asiyi kuzalisa iifom. Siza kwenza izinto zenyani kunye.\n\nRhona siziqedile, uza kuba ne:`,
    siyandaIntroList: [
      'I-invoice yakho yokuqala (uChase uza kulungela ukuyilandela)',
      'Iqela lakho elifakiweyo (uCare uya kwazi ukubani amkele)',
      'U-Alex elungele ukuphatha imiyalezo yakho ye-WhatsApp',
      'I-imeyili yakho yokuqala ibhaliwe nguPen',
    ],
    businessNamePrompt: 'Masiiqale. Ibhizinisi lakho libizwa ngantoni?',
    businessNameConfirm: (name) =>
      `Kuhle. ${name} isemthethweni ku-AdminOS. Masiqale.`,
    businessTypePrompt: 'Luhlobo luni lweshishini?',

    chaseIntro:
      'Yonke ishishini linokulunca iklayente elikweleta imali ngoku. Masifake i-invoice yokuqala.',
    chaseClientPrompt: 'Ngubani okukweleta imali? Nika igama kuphela — akubalulekanga noba ngumntu okanye inkampani.',
    chaseAmountPrompt: 'Bakweleta malini? (Inani kuphela — akufuneki uphawu lwe-R)',
    chaseDueDatePrompt: 'Yayifanele inkokhelo nini?',
    chaseMagicTitle: (c) => `UChase usanda kulungiselela lo myalezo woku-${c}:`,
    chaseExplainer:
      'UChase uza kuthumela imiyalezo enje ngokuzenzekeleyo ukuze ungaze ulandele i-invoice wena.',
    chaseAddAnother: 'Faka enye i-invoice',
    chaseKeepGoing: 'Qhubeka →',
    chaseProgress: "I-AdminOS isephila ngo-20%",

    careIntro: "Ngoku masiongeze iqela lakho. UCare uza kuzikhangela njalo ngeveki yonke akwazise ukuba nabani udinga inkxaso.",
    careNamePrompt: 'Ngubani igama lomsebenzi wakho wokuqala?',
    careRolePrompt: 'Yintoni indima okanye isihloko sabo somsebenzi?',
    carePhonePlaceholder: '+27 82 000 0000',
    careMagicTitle: (n) => `NgoMvulo ekuseni, uCare uza kuthumela ${n} oku:`,
    careExplainer:
      "Ukuba amanqaku abo ahla ngaphantsi kuka-3 kangangeveki, uza kufumana isaziso sangasese. Uza kuhlala wazi ukuba iqela lakho liziva njani ngokwenene.",
    careProgress: "I-AdminOS isephila ngo-40%",

    alexIntro: "U-Alex uphatha imiyalezo yakho ye-WhatsApp ngokuzenzekeleyo. Masifundise u-Alex ngeshishini lakho.",
    alexFaqPrompt: 'Zeziphi imibuzo emithathu amaklayente akubuza kakhulu?',
    alexAnswerPrompt: (n) => `Yintoni impendulo yakho eyajwayelekileyo kumbuzo ${n}?`,
    alexMagicTitle: 'Nantsi into eyenzekayo xa ikhlaythi libuza u-Alex enye yale mibuzo:',
    alexExplainer: "U-Alex ngoku ufundisiwe ngeshishini lakho. Xhuma inombolo yakho ye-WhatsApp ku-Settings ukuze uqalise.",
    alexConnectNow: 'Xhuma i-WhatsApp ngoku',
    alexConnectLater: 'Yenza oku kamva',
    alexProgress: "I-AdminOS isephila ngo-60%",

    docIntro: "UDoc unokufunda iimvilophu zakho zeshishini kwaye akhuthe ulwazi olubalulekileyo ngokuzenzekeleyo.\n\nLayisha into — isivumelwano, i-invoice, idokhumenti leqhinga. Nantoni.",
    docUploadLabel: 'Tsala idokhumenti yakho apha, okanye cofa ukukhangela',
    docExplainer: (docType) => `Nantsi into uDoc angayikhutha ku-${docType} yohlobo lweshishini lakho:`,
    docRealLabel: 'Idokhumenti yangempela',
    docReferenceLabel: 'Ikopi yesifundo (ngaphandle kwedatha ezimfihlo)',
    docReferenceTooltip: "Layisha inguqulelo engenanto yefometi yakho yedokhumenti. UDoc uyafunda isakhiwo ngaphandle kokulondoloza idatha yakho yangempela yeklayente okanye yabasebenzi.",
    docSkipMsg: "Kulungile. Ungazilayisha iidokhumenti kwiphepha leeMvilophu ngenxa enayiphina. UDoc ulungile.",
    docMagicTitle: 'UDoc ufumene oku kudokhumenti yakho:',
    docProgress: "I-AdminOS isephila ngo-80%",

    penIntro: (client, amount) =>
      `Yokugqibela. Kwaye le iza kukusinda ixesha yonke imihla.\n\nUPen ubhala ii-imeyili zezobusino kuwe — esebenzisa idatha yakho yangempela yeshishini. Masibhale eyokuqala ngoku.\n\nIklayente esafaka — ${client} — okukweleta u-R${amount}? Masibhalele i-imeyili efanelekileyo yokucela inkokhelo.`,
    penIntroSimple: "Yokugqibela. UPen ubhala ii-imeyili zezobusino — izamkelo, izicelo zeenkokhelo, iziphakamiso — esebenzisa idatha yakho yangempela. Masibhale eyokuqala ngoku.",
    penRecipientPrompt: "UPen uza kubhalela ubani i-imeyili yokwamkela? (Ndinike igama labo lokuqala)",
    penMagicTitle: (name) => `UPen ubhala i-imeyili yokwamkela ye-${name} ngoku...`,
    penDone: "UPen ulondolozile loo drафтi ku-Email Studio yakho. Unokuyichulumancisa uyithumele nang'aphi na.",
    penButtonLabel: 'Bhala le imeyili →',
    penExplainer: [
      'Igama lakho leshishini',
      'Igama leklayente',
      'Inani le-invoice',
      'Ukhetha kwakho kwesimo: Sokusemthethweni',
    ],
    penCopy: 'Kopa i-imeyili',
    penOpen: 'Vula i-Email Studio',
    penKeepGoing: 'Qeda ukusetha →',

    celebrateHeadline: 'I-AdminOS isephila ngo-100%. 🌿',
    celebrateSubhead: (name) => `${name} ngoku isebenza nge-AI.`,
    agentSummary: (inv, staff) => ({
      chase: `Ikhangela ii-invoice ezili-${inv}, ilungele ukubuyisela`,
      care: `Ikhangela abasebenzi abangu-${staff} njalo ngeveki`,
      alex: 'Ufundisiwe ngeeFAQ zakho, ulungele ukuphatha i-WhatsApp',
      doc: 'Ulungele ukuphelela kwakho',
      pen: 'Ulungele ukubhala nayiphi na i-imeyili yeshishini',
      insight: 'Ingxelo yakho yokuqala yentanda iyeza ngomso ngo-7am',
    }),
    tourPrompt: "Nantsi ingxelo emfutshane yalapho konke kukhoyo.",
    tourButton: 'Okulandelayo →',
    dashboardButton: 'Yiya ku-dashboard yam →',

    skipChase: "UChase akayi kuba nee-invoice zokubuyisela",
    skipCare: "UCare akayi kuba nabantu ababoniswayo",
    skipAlex: "U-Alex akayi kwazi ishishini lakho — mfundise kamva ku-Settings",
    skipDoc: 'UDoc ulungile xa ulungele',
    skipPen: 'UPen ulindile ku-Email Studio',

    progressAlive: (pct) => `I-AdminOS isephila ngo-${pct}%`,

    continueBtn: 'Qhubeka →',
    skipBtn: 'Yiyela ngoku',
    addMoreBtn: '+ Faka okunye',
    addAnotherBtn: '+ Faka omunye',
  },

  af: {
    langSelectGreeting: 'Sawubona. Molo. Hello. Hallo. Dumela.',
    langSelectPrompt: 'Watter taal wil jy gebruik?',

    siyandaIntro: (name) =>
      `Hallo ${name}. Ek is Siyanda, jou AdminOS-gids.\n\nEk gaan jou help om jou besigheid in die volgende 15 minute op te stel. Maar hier is die ding — ons gaan nie vorms invul nie. Ons gaan saam regte dinge doen.\n\nTegen die tyd dat ons klaar is, sal jy hê:`,
    siyandaIntroList: [
      'Jou eerste faktuur in die stelsel (en Chase sal gereed wees om dit in te vorder)',
      'Jou span bygevoeg (en Care sal weet wie om na te kyk)',
      'Alex gereed om jou WhatsApp-boodskappe te hanteer',
      'Jou eerste KI-e-pos deur Pen opgestel',
    ],
    businessNamePrompt: 'Kom ons begin. Wat is jou besigheid se naam?',
    businessNameConfirm: (name) =>
      `Perfek. ${name} is nou amptelik in AdminOS. Kom ons kry dit aan die gang.`,
    businessTypePrompt: 'Watter tipe besigheid is dit?',

    chaseIntro:
      'Elke besigheid het ten minste een kliënt wat hulle nou geld skuld. Kom ons sit die eerste faktuur in.',
    chaseClientPrompt: 'Wie skuld jy geld? Gee my net hul naam — dit maak nie saak of dit \'n persoon of \'n maatskappy is nie.',
    chaseAmountPrompt: 'Hoeveel skuld hulle jou? (Net die nommer — geen R-teken nodig)',
    chaseDueDatePrompt: 'Wanneer was dit verskuldig?',
    chaseMagicTitle: (c) => `Chase het sopas hierdie boodskap vir ${c} opgestel:`,
    chaseExplainer:
      'Chase sal sulke boodskappe outomaties stuur sodat jy nooit self \'n faktuur hoef in te vorder nie.',
    chaseAddAnother: 'Nog \'n faktuur byvoeg',
    chaseKeepGoing: 'Aanhou →',
    chaseProgress: "AdminOS leef 20%",

    careIntro: "Kom ons voeg nou jou span by. Care sal hulle elke week incheck en jou laat weet as iemand ondersteuning nodig het.",
    careNamePrompt: "Wat is jou eerste personeellid se naam?",
    careRolePrompt: "Wat is hul rol of posbeskrywing?",
    carePhonePlaceholder: '+27 82 000 0000',
    careMagicTitle: (n) => `Maandagoggend sal Care hierdie aan ${n} stuur:`,
    careExplainer:
      "As hulle telling vir meer as \'n week onder 3 daal, kry jy \'n privaatwaarskuwing. Jy sal altyd weet hoe jou span regtig voel.",
    careProgress: "AdminOS leef 40%",

    alexIntro: "Alex hanteer jou WhatsApp-boodskappe outomaties. Kom ons leer Alex oor jou besigheid.",
    alexFaqPrompt: 'Wat is die 3 vrae wat jou kliënte die meeste vra?',
    alexAnswerPrompt: (n) => `Wat is jou standaardantwoord op vraag ${n}?`,
    alexMagicTitle: 'Dit is wat gebeur wanneer \'n kliënt Alex een van hierdie vrae stel:',
    alexExplainer: "Alex is nou opgelei in jou besigheid. Koppel jou WhatsApp-nommer in Instellings om lewendig te gaan.",
    alexConnectNow: 'Koppel WhatsApp nou',
    alexConnectLater: 'Doen dit later',
    alexProgress: "AdminOS leef 60%",

    docIntro: "Doc kan jou besigheidsdokumente lees en belangrike inligting outomaties onttrek — geen handmatige data-inskrywing ooit nie.\n\nLaai iets op — \'n kontrak, \'n faktuur, \'n strategie-dokument. Enigiets.",
    docUploadLabel: 'Sleep jou dokument hier, of klik om te blaai',
    docExplainer: (docType) => `Hier is wat Doc uit 'n tipiese ${docType} vir jou tipe besigheid sou onttrek:`,
    docRealLabel: 'Regte dokument',
    docReferenceLabel: 'Verwysingskopie (geen sensitiewe data)',
    docReferenceTooltip: "Laai \'n leë weergawe van jou dokumentformaat op. Doc leer die struktuur sonder om jou werklike kliënt- of personeeldata te stoor.",
    docSkipMsg: "Geen probleem nie. Jy kan dokumente enige tyd vanaf die Dokumente-bladsy oplaai. Doc is gereed.",
    docMagicTitle: 'Doc het dit in jou dokument gevind:',
    docProgress: "AdminOS leef 80%",

    penIntro: (client, amount) =>
      `Laaste een. En hierdie een sal jou elke dag tyd bespaar.\n\nPen skryf professionele e-posse vir jou — met jou werklike besigheidsdata. Kom ons skryf die eerste nou.\n\nDaardie kliënt wat ons bygevoeg het — ${client} — wat jou R${amount} skuld? Kom ons skryf hulle \'n ordentlike betalingsversoek-e-pos.`,
    penIntroSimple: "Laaste een. Pen skryf professionele e-posse — welkom-briewe, betalingsversoeke, voorstelle — met jou werklike besigheidsdata. Kom ons skryf die eerste nou.",
    penRecipientPrompt: "Vir wie moet Pen \'n welkom-e-pos skryf? (Gee my net hul voornaam)",
    penMagicTitle: (name) => `Pen skryf tans \'n welkom-e-pos vir ${name}...`,
    penDone: "Pen het daardie konsep gestoor in jou E-pos Studio. Jy kan dit enige tyd redigeer en stuur.",
    penButtonLabel: 'Skryf hierdie e-pos →',
    penExplainer: [
      'Jou besigheidsnaam',
      'Jou kliënt se naam',
      'Die faktuur-bedrag',
      'Jou toonvoorkeur: Professioneel',
    ],
    penCopy: 'Kopieer e-pos',
    penOpen: 'Maak E-pos Studio oop',
    penKeepGoing: 'Klaarmaakinstellings →',

    celebrateHeadline: 'AdminOS leef 100%. 🌿',
    celebrateSubhead: (name) => `${name} loop nou op KI.`,
    agentSummary: (inv, staff) => ({
      chase: `Monitor ${inv} faktuur${inv !== 1 ? 'e' : ''}, gereed om in te vorder`,
      care: `Check in by ${staff} personeellid${staff !== 1 ? 'e' : ''} weekliks`,
      alex: 'Opgelei in jou vrae, gereed om WhatsApp te hanteer',
      doc: 'Gereed vir jou eerste oplaai',
      pen: 'Gereed om enige besigheids-e-pos te skryf',
      insight: 'Jou eerste oggendberig kom môre om 7vm',
    }),
    tourPrompt: "Hier is \'n vinnige toer van waar alles is.",
    tourButton: 'Volgende →',
    dashboardButton: 'Gaan na my paneelbord →',

    skipChase: "Chase sal geen fakture hê om in te vorder nie",
    skipCare: "Care sal niemand hê om in te check nie",
    skipAlex: "Alex sal jou besigheid nog nie ken nie — leer hom later in Instellings",
    skipDoc: 'Doc is gereed wanneer jy is',
    skipPen: 'Pen wag in E-pos Studio',

    progressAlive: (pct) => `AdminOS leef ${pct}%`,

    continueBtn: 'Verder →',
    skipBtn: 'Slaan oor',
    addMoreBtn: '+ Meer byvoeg',
    addAnotherBtn: '+ Nog een byvoeg',
  },

  st: {
    langSelectGreeting: 'Sawubona. Molo. Hello. Hallo. Dumela.',
    langSelectPrompt: 'O batla ho sebedisa puo efe?',

    siyandaIntro: (name) =>
      `Dumela ${name}. Ke Siyanda, moetapele wa hao wa AdminOS.\n\nKe tla o thusa ho bea kabo ya khoebo ya hao ka metsotso e leshome le metso e mehlano. Empa ntho ena — ha re tlatsa diforomo. Re tla etsa dintho tsa nnete mmoho.\n\nHa re qeta, o tla ba le:`,
    siyandaIntroList: [
      'Akhawnte ya hao ya pele ya ho lefsa (Chase o tla ikemisetsa ho e latela)',
      'Sehlopha sa hao se eketsehileng (Care o tla tseba ke mang eo a hlokang thuso)',
      'Alex o lokela ho tshwara melaetsa ya hao ya WhatsApp',
      'Lengolo-tshedimosetso la hao la pele le hlokolositsweng ke Pen',
    ],
    businessNamePrompt: 'A re qaleng. Khoebo ya hao e bitswa eng?',
    businessNameConfirm: (name) =>
      `Ke hantle. ${name} e se e le ya molao ho AdminOS. A re e sebedise.`,
    businessTypePrompt: 'Ke mofuta ofe wa khoebo?',

    chaseIntro:
      'Khoebo yohle e na le moreki a le mong ya e kolota tjhelete joale. A re kenya akhawnte ya pele ya ho lefsa.',
    chaseClientPrompt: 'Ke mang ya o kolota tjhelete? Mpha lebitso la bona feela — ha ho na phareng hore ke motho kapa khamphani.',
    chaseAmountPrompt: 'Ba o kolota bokae? (Nomoro feela — ha o hloke letshwao la R)',
    chaseDueDatePrompt: 'E ne e lokela ho lefswa neng?',
    chaseMagicTitle: (c) => `Chase o sa tswa hlophisa molaetsa ona wa ${c}:`,
    chaseExplainer:
      'Chase o tla romela melaetsa e tjena ka ho ithatela hore o se ke wa hloka ho latela akhawnte ya ho lefsa ka bowena.',
    chaseAddAnother: 'Kenya akhawnte e nngwe ya ho lefsa',
    chaseKeepGoing: 'Tswela pele →',
    chaseProgress: "AdminOS e a phela 20%",

    careIntro: "Joale a re eketseng sehlopha sa hao. Care o tla sheba hore na ba ntse ba phela bonyane o bua le bona beke le beke mme a o tsebise ha motho a hloka thuso.",
    careNamePrompt: "Lebitso la mosebetsi wa hao wa pele ke lefe?",
    careRolePrompt: "Mosebetsi kapa sehlophahlopha sa bona ke ofe?",
    carePhonePlaceholder: '+27 82 000 0000',
    careMagicTitle: (n) => `Mantsiboea a Mantaha, Care o tla romela ${n} sena:`,
    careExplainer:
      "Ha lenaneo la bona le wela tlase ho 3 ka beke le fetang, o tla amohela tliso ya sephiri. O tla tseba kamehla hore sehlopha sa hao se ikutlwa joang ka nnete.",
    careProgress: "AdminOS e a phela 40%",

    alexIntro: "Alex o tshwara melaetsa ya hao ya WhatsApp ka ho ithatela. A re ruteng Alex ka khoebo ya hao.",
    alexFaqPrompt: 'Ke dipotso dife tse tharo tse barekisi ba hao ba u botsa tsona haholo?',
    alexAnswerPrompt: (n) => `Ke karabo efe ya hao ya tlwaelehang ho potso ya ${n}?`,
    alexMagicTitle: 'Sena ke se etsahalang ha moreki a botsa Alex enngwe ya dipotso tsena:',
    alexExplainer: "Alex joale o ithutilwe ka khoebo ya hao. Hokela nomoro ya hao ya WhatsApp ho Ditlhophiso ho ya phelang.",
    alexConnectNow: 'Hokela WhatsApp joale',
    alexConnectLater: 'Etsa sena hamorao',
    alexProgress: "AdminOS e a phela 60%",

    docIntro: "Doc a kgona ho bala dikumento tsa khoebo ya hao mme a ntsha tshedimosetso ya bohlokwa ka ho ithatela — ha o hloke ho kenya data ka letsoho le leng le le leng.\n\nKhutsisa seng — konteraka, akhawnte ya ho lefsa, tokomane ya leano. Ntho efe kapa efe.",
    docUploadLabel: 'Suba tokomane ya hao mona, kapa cofa ho tseba tsela',
    docExplainer: (docType) => `Sena ke seo Doc a ka se ntshang ho ${docType} ya mofuta wa khoebo ya hao:`,
    docRealLabel: 'Tokomane ya nnete',
    docReferenceLabel: 'Phetolelo ya ho bua (ha ho na data ya sephiri)',
    docReferenceTooltip: "Khutsisa phetolelo e se nang letho ya sebopeho sa hao sa tokomane. Doc o ithuta sebopeho ntle le ho boloka data ya nnete ya moreki kapa mosebetsi.",
    docSkipMsg: "Ha ho na bothata. O kgona ho khutsisa dikumento ho tswa leqepheng la Dikumento neng kapa neng. Doc o lokela.",
    docMagicTitle: 'Doc o fumane sena tokomaning ya hao:',
    docProgress: "AdminOS e a phela 80%",

    penIntro: (client, amount) =>
      `Wa ho qetela. Mme sena se tla o boloka nako letsatsi le leng le le leng.\n\nPen o ngola di-imeyile tsa khoebo tsa hao — a sebedisa data ya hao ya nnete ya khoebo. A re ngoleng ya pele joale.\n\nMoreki eo re mo eketseng — ${client} — ya o kolota R${amount}? A re mo ngolele imeyile e nepahetseng ya kopo ya tefo.`,
    penIntroSimple: "Wa ho qetela. Pen o ngola di-imeyile tsa khoebo — makala a amohelo, dikopo tsa tefo, diphetoho — a sebedisa data ya hao ya nnete. A re ngoleng ya pele joale.",
    penRecipientPrompt: "Pen o ngolele mang imeyile ya amohelo? (Mpha lebitso la bona la pele feela)",
    penMagicTitle: (name) => `Pen o ngola imeyile ya amohelo ya ${name} joale...`,
    penDone: "Pen o bolokilse sebaphi seo ho Setudio sa Imeyile ya hao. O kgona ho se fetola le ho se romela neng kapa neng.",
    penButtonLabel: 'Ngola imeyile ena →',
    penExplainer: [
      'Lebitso la hao la khoebo',
      'Lebitso la moreki',
      'Palohalo ya akhawnte ya ho lefsa',
      'Kgetho ya hao ya tone: E a Lokelana',
    ],
    penCopy: 'Kopi imeyile',
    penOpen: 'Bula Setudio sa Imeyile',
    penKeepGoing: 'Qeta ho bea kabo →',

    celebrateHeadline: 'AdminOS e a phela 100%. 🌿',
    celebrateSubhead: (name) => `${name} joale e a matha ka AI.`,
    agentSummary: (inv, staff) => ({
      chase: `E hlahloba diakhawnte tse ${inv} tsa ho lefsa, e lokela ho busa`,
      care: `E sheba basebetsi ba ${staff} beke le beke`,
      alex: 'O ithutilwe ka dipotso tsa hao, o lokela ho tshwara WhatsApp',
      doc: 'O lokela phutsiso ya hao ya pele',
      pen: 'O lokela ho ngola imeyile efe kapa efe ya khoebo',
      insight: 'Tlaleho ya hao ya pele ya hosane e fihla hosane ka hora ya 7',
    }),
    tourPrompt: "Ena ke ketelo e shebelletsweng ea moo ho leng teng ntho tsohle.",
    tourButton: 'E latelang →',
    dashboardButton: 'Ea ho dashboard ya ka →',

    skipChase: "Chase ha e na ho ba le diakhawnte tsa ho busa",
    skipCare: "Care ha e na ho ba le motho a hlokang ho shebelwa",
    skipAlex: "Alex ha a na ho tseba khoebo ya hao ha ya — ruta ka hamorao ho Ditlhophiso",
    skipDoc: 'Doc o lokela ha o lokela',
    skipPen: 'Pen o emetse ho Setudio sa Imeyile',

    progressAlive: (pct) => `AdminOS e a phela ${pct}%`,

    continueBtn: 'Tswela pele →',
    skipBtn: 'Tlola joale',
    addMoreBtn: '+ Kenya tse ding',
    addAnotherBtn: '+ Kenya e nngwe',
  },
}

export const LANGUAGES: Array<{ code: Language; label: string; nativeLabel: string }> = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'zu', label: 'isiZulu', nativeLabel: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa', nativeLabel: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans', nativeLabel: 'Afrikaans' },
  { code: 'st', label: 'Sesotho', nativeLabel: 'Sesotho' },
]

export function getMessages(lang: Language): OnboardingMessages {
  return messages[lang] ?? messages.en
}
