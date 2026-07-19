/**
 * Hand-held onboarding training — a structured, step-by-step "getting started"
 * journey shown to new owners in their chosen language.
 *
 * Languages match what AdminOS actually supports: English, isiZulu, isiXhosa,
 * Afrikaans. NOTE: the Nguni (zu/xh) translations are a solid v1 written to be
 * simple and clear — worth a native-speaker review before a big rollout.
 */

export type Lang = 'en' | 'zu' | 'xh' | 'af'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zu', label: 'isiZulu' },
  { code: 'xh', label: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans' },
]

/** Map a tenant's stored language_primary to a training language (default en). */
export function toLang(primary?: string | null): Lang {
  const p = (primary ?? '').toLowerCase()
  if (p.startsWith('zu')) return 'zu'
  if (p.startsWith('xh')) return 'xh'
  if (p.startsWith('af')) return 'af'
  return 'en'
}

export const INTRO: Record<Lang, { title: string; subtitle: string; progress: string; done: string; markDone: string; allDone: string }> = {
  en: { title: 'Welcome to AdminOS', subtitle: "Let's get your business running — one step at a time. Do them in order; each takes about a minute.", progress: 'done', done: 'Done', markDone: 'Mark as done', allDone: "You're all set up. Welcome aboard! 🎉" },
  zu: { title: 'Wamukelekile ku-AdminOS', subtitle: 'Ake sisebenzise ibhizinisi lakho — isinyathelo ngasinye. Wenze ngokulandelana; isinyathelo ngasinye sithatha cishe umzuzu.', progress: 'kwenziwe', done: 'Kwenziwe', markDone: 'Maka njengokwenziwe', allDone: 'Usulungisiwe konke. Siyakwamukela! 🎉' },
  xh: { title: 'Wamkelekile kwi-AdminOS', subtitle: 'Masiqalise ishishini lakho — inyathelo ngenyathelo. Yenza ngokulandelelana; inyathelo ngalinye lithatha malunga nomzuzu.', progress: 'kwenziwe', done: 'Kwenziwe', markDone: 'Phawula njengokwenziwe', allDone: 'Ulungiselele yonke into. Wamkelekile! 🎉' },
  af: { title: 'Welkom by AdminOS', subtitle: 'Kom ons kry jou besigheid aan die gang — een stap op ’n slag. Doen hulle in volgorde; elkeen neem omtrent ’n minuut.', progress: 'klaar', done: 'Klaar', markDone: 'Merk as klaar', allDone: 'Alles is opgestel. Welkom aan boord! 🎉' },
}

export interface TrainingStep {
  id: string
  icon: string
  href: string
  title: Record<Lang, string>
  body: Record<Lang, string>
  action: Record<Lang, string>
}

export const TRAINING_STEPS: TrainingStep[] = [
  {
    id: 'business', icon: '🏢', href: '/dashboard/settings',
    title: { en: 'Set up your business', zu: 'Lungiselela ibhizinisi lakho', xh: 'Seta ishishini lakho', af: 'Stel jou besigheid op' },
    body: {
      en: 'Add your business name, type and VAT number so your invoices and reports come out correct.',
      zu: 'Faka igama lebhizinisi lakho, uhlobo kanye nenombolo ye-VAT ukuze ama-invoyisi nemibiko kube yikho.',
      xh: 'Faka igama leshishini lakho, uhlobo kunye nenombolo ye-VAT ukuze ii-invoyisi neengxelo zakho zichane.',
      af: 'Voeg jou besigheidsnaam, tipe en BTW-nommer by sodat jou fakture en verslae reg uitkom.',
    },
    action: { en: 'Open settings', zu: 'Vula izilungiselelo', xh: 'Vula iisetingi', af: 'Maak instellings oop' },
  },
  {
    id: 'logo', icon: '🎨', href: '/dashboard/settings',
    title: { en: 'Add your logo', zu: 'Faka ilogo yakho', xh: 'Faka ilogo yakho', af: 'Voeg jou logo by' },
    body: {
      en: 'Upload your logo — it appears on your payslips, reports and documents, so everything looks like your brand.',
      zu: 'Layisha ilogo yakho — ivela kuma-payslip, imibiko namadokhumenti, ukuze konke kubukeke njengebhizinisi lakho.',
      xh: 'Layisha ilogo yakho — ivela kwii-payslip, iingxelo namaxwebhu, ukuze yonke into ibonakale njengophawu lwakho.',
      af: 'Laai jou logo op — dit verskyn op jou betaalstrokies, verslae en dokumente, sodat alles soos jou handelsmerk lyk.',
    },
    action: { en: 'Upload logo', zu: 'Layisha ilogo', xh: 'Layisha ilogo', af: 'Laai logo op' },
  },
  {
    id: 'whatsapp', icon: '💬', href: '/dashboard/settings/onboarding',
    title: { en: 'Connect WhatsApp', zu: 'Xhuma i-WhatsApp', xh: 'Nxibelelanisa i-WhatsApp', af: 'Koppel WhatsApp' },
    body: {
      en: 'WhatsApp is how your customers reach you. Connect your number to switch on the inbox and your AI agents.',
      zu: 'I-WhatsApp yindlela amakhasimende akho afinyelela ngayo kuwe. Xhuma inombolo yakho ukuvula ibhokisi lemilayezo nama-ejenti akho e-AI.',
      xh: 'I-WhatsApp yindlela abathengi bakho abafikelela ngayo kuwe. Nxibelelanisa inombolo yakho ukuvula ibhokisi kunye nee-arhente zakho ze-AI.',
      af: 'WhatsApp is hoe jou kliënte jou bereik. Koppel jou nommer om die inmandjie en jou KI-agente aan te skakel.',
    },
    action: { en: 'Connect WhatsApp', zu: 'Xhuma i-WhatsApp', xh: 'Nxibelelanisa i-WhatsApp', af: 'Koppel WhatsApp' },
  },
  {
    id: 'contact', icon: '👤', href: '/dashboard/contacts',
    title: { en: 'Add your first customer', zu: 'Faka ikhasimende lakho lokuqala', xh: 'Faka umthengi wakho wokuqala', af: 'Voeg jou eerste kliënt by' },
    body: {
      en: 'Add a customer so you can invoice them, chat on WhatsApp, and keep their history in one place.',
      zu: 'Faka ikhasimende ukuze ukwazi ukulithumelela i-invoyisi, uxoxe ku-WhatsApp, futhi ugcine umlando walo endaweni eyodwa.',
      xh: 'Faka umthengi ukuze ukwazi ukumthumela i-invoyisi, uncokole ku-WhatsApp, kwaye ugcine imbali yakhe kwindawo enye.',
      af: 'Voeg ’n kliënt by sodat jy hulle kan faktureer, op WhatsApp gesels, en hul geskiedenis op een plek hou.',
    },
    action: { en: 'Add a customer', zu: 'Faka ikhasimende', xh: 'Faka umthengi', af: 'Voeg kliënt by' },
  },
  {
    id: 'invoice', icon: '🧾', href: '/dashboard/invoices',
    title: { en: 'Send your first invoice', zu: 'Thumela i-invoyisi yakho yokuqala', xh: 'Thumela i-invoyisi yakho yokuqala', af: 'Stuur jou eerste faktuur' },
    body: {
      en: 'Create an invoice and get paid. If it goes overdue, AdminOS follows up politely for you.',
      zu: 'Dala i-invoyisi bese uyakhokhelwa. Uma isephuzile, i-AdminOS iyalandelela ngenhlonipho egameni lakho.',
      xh: 'Yenza i-invoyisi ukuze uhlawulwe. Ukuba iyalibaziseka, i-AdminOS iyalandelela ngembeko egameni lakho.',
      af: 'Skep ’n faktuur en word betaal. As dit agterstallig raak, volg AdminOS beleefd namens jou op.',
    },
    action: { en: 'Create an invoice', zu: 'Dala i-invoyisi', xh: 'Yenza i-invoyisi', af: 'Skep faktuur' },
  },
  {
    id: 'agents', icon: '🤖', href: '/dashboard',
    title: { en: 'Meet your AI team', zu: 'Hlangana neqembu lakho le-AI', xh: 'Dibana neqela lakho le-AI', af: 'Ontmoet jou KI-span' },
    body: {
      en: 'Six agents work for you — answering chats, chasing payments, checking on staff, briefing you each morning. See them on your Command Center.',
      zu: 'Ama-ejenti ayisithupha akusebenzela — aphendula izingxoxo, axoshe izinkokhelo, ahlole abasebenzi, akwazise njalo ekuseni. Wabone ku-Command Center yakho.',
      xh: 'Ii-arhente ezintandathu zisebenzela wena — ziphendula iincoko, zilandelela iintlawulo, zijonge abasebenzi, zikwazise qho kusasa. Zibone kwi-Command Center yakho.',
      af: 'Ses agente werk vir jou — beantwoord geselsies, jaag betalings na, kyk na personeel, en gee jou elke oggend ’n oorsig. Sien hulle op jou Command Center.',
    },
    action: { en: 'Open Command Center', zu: 'Vula i-Command Center', xh: 'Vula i-Command Center', af: 'Maak Command Center oop' },
  },
  {
    id: 'autonomy', icon: '🎛️', href: '/dashboard/settings/autonomy',
    title: { en: 'Decide what runs on its own', zu: 'Nquma ukuthi yini ezenzakalelayo', xh: 'Thatha isigqibo ngento ezenzekelayo', af: 'Besluit wat vanself loop' },
    body: {
      en: 'Choose what AdminOS does automatically, what it drafts for you to send, and what it just flags. You always stay in control.',
      zu: 'Khetha ukuthi yini i-AdminOS eyenza ngokuzenzakalela, eyilungiselelayo ukuze uyithumele, neyimane iyiphawule. Uhlala ulawula.',
      xh: 'Khetha into i-AdminOS eyenzayo ngokuzenzekelayo, eyilungiselelayo ukuze uyithumele, neyiphawulayo nje. Uhlala ulawula.',
      af: 'Kies wat AdminOS outomaties doen, wat dit vir jou opstel om te stuur, en wat dit net uitwys. Jy bly altyd in beheer.',
    },
    action: { en: 'Set autonomy', zu: 'Setha i-autonomy', xh: 'Seta i-autonomy', af: 'Stel outonomie' },
  },
  {
    id: 'langa', icon: '🎓', href: '/dashboard/langa',
    title: { en: 'Ask Langa anything', zu: 'Buza uLanga noma yini', xh: 'Buza uLanga nantoni na', af: 'Vra Langa enigiets' },
    body: {
      en: 'Langa is your AI business mentor. Ask about cash flow, staff, tax or growth — any time, in your language.',
      zu: 'ULanga ungumeluleki wakho webhizinisi we-AI. Buza ngokungena kwemali, abasebenzi, intela noma ukukhula — nganoma yisiphi isikhathi, ngolimi lwakho.',
      xh: 'ULanga ngumcebisi wakho weshishini we-AI. Buza malunga nokungena kwemali, abasebenzi, irhafu okanye ukukhula — nangaliphi na ixesha, ngolwimi lwakho.',
      af: 'Langa is jou KI-besigheidsmentor. Vra oor kontantvloei, personeel, belasting of groei — enige tyd, in jou taal.',
    },
    action: { en: 'Chat to Langa', zu: 'Xoxa noLanga', xh: 'Ncokola noLanga', af: 'Gesels met Langa' },
  },
]
