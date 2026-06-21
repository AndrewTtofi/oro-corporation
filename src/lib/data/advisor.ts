/** AI Advisor intent tree — ported from the prototype. Deterministic
 *  keyword-matching that maps a free-text need to a service + jurisdiction
 *  recommendation. Client-safe. */
export type Intent = {
  id: string;
  triggers: string[];
  botReply: string;
  clarify?: string;
  clarifyChips?: string[];
  recommendServices: string[];
  recommendJurisdictions: string[];
  showProviders: boolean;
  branchRoute?: Record<string, string>;
  botReplyAfter?: Record<string, string>;
};

export const STARTER_CHIPS = [
  "I want to pay less tax", "Set up a crypto company", "Open a business bank account",
  "Relocate to the EU", "I run an online business", "I need a holding company",
  "Help me become non-dom", "Not sure — help me decide",
];

export const ADVISOR_INTENTS: Intent[] = [
  { id: "lower-tax", triggers: ["pay less tax", "less tax", "lower tax", "reduce tax", "save tax", "tax efficient", "low tax", "tax bill", "minimise tax", "minimize tax", "optimi"],
    botReply: "Smart move — most of the saving comes from where your company is based and where you're tax-resident, not from tricks. Quick question so I point you the right way:",
    clarify: "Is this mainly about your company's profits, your personal income, or both?", clarifyChips: ["My company's profits", "My personal income", "Both — I'd relocate too"],
    recommendServices: ["formation", "accounting"], recommendJurisdictions: ["cy", "mt", "ee"], showProviders: true,
    botReplyAfter: { "My company's profits": "Then the lever is corporate structuring. Cyprus (12.5%) and Malta (effective ~5% after refunds) are the workhorses for trading companies, with Estonia (0% on retained profits) if you reinvest. Here's where I'd start.", "My personal income": "Then it's about your tax residency. Cyprus non-dom and Malta's remittance basis are the cleanest routes for entrepreneurs — little to no tax on foreign dividends and capital gains. Let me line that up.", "Both — I'd relocate too": "Best of both — pair a low-tax company with a non-dom residency. Cyprus does both under one roof (12.5% corp + non-dom), which is why most founders land there." } },
  { id: "formation", triggers: ["set up a company", "form a company", "incorporate", "company formation", "register a company", "start a company", "open a company", "new company", "limited company", "set up a business", "register a business"],
    botReply: "Let's get you incorporated. I just need one thing to recommend the right home for it:",
    clarify: "What will the company mainly do?", clarifyChips: ["Trading / services", "Holding / IP", "Crypto or financial services", "E-commerce / online"],
    recommendServices: ["formation"], recommendJurisdictions: ["cy", "ee", "uk"], showProviders: false,
    branchRoute: { "Crypto or financial services": "crypto-licensing" },
    botReplyAfter: { "Trading / services": "For an active trading company, Cyprus (12.5% corp tax, full EU access) is the default pick, with Estonia a strong fully-digital alternative.", "Holding / IP": "For holding and IP you want a deep treaty network and a participation exemption — Cyprus and the Netherlands both excel.", "E-commerce / online": "For an online business, Estonia's e-Residency lets you run everything remotely, with Cyprus if you want EU substance and low tax." } },
  { id: "crypto-licensing", triggers: ["crypto", "blockchain", "web3", "token", "forex", "fx broker", "vasp", "casp", "mica", "exchange", "payment institution", "emi licen", "psp", "gambling", "igaming", "financial licen", "licence", "license", "regulated", "fund"],
    botReply: "Regulated activity — this is where getting the jurisdiction right really matters. You'll need a licence on top of the company, and only a handful of places issue them efficiently:",
    clarify: "Which best describes the activity?", clarifyChips: ["Crypto exchange / wallet", "Forex / brokerage", "Payments / EMI", "iGaming / gambling"],
    recommendServices: ["licensing", "formation"], recommendJurisdictions: ["mt", "ee", "gi"], showProviders: true,
    botReplyAfter: { "Crypto exchange / wallet": "Malta (the 'Blockchain Island', now MiCA-aligned) and Estonia are the established homes for crypto licensing, with Gibraltar's DLT framework as a respected alternative.", "Forex / brokerage": "Cyprus (CySEC) is Europe's brokerage capital, with Malta (MFSA) as the premium alternative.", "Payments / EMI": "Malta and Estonia are your practical EU routes for a payments/EMI licence.", "iGaming / gambling": "Malta (MGA) is the global gold standard for iGaming licensing, with Gibraltar a close second." } },
  { id: "banking-emi", triggers: ["bank account", "business bank", "corporate account", "open an account", "open a bank", "emi", "iban", "payment account", "neobank", "fintech account", "merchant account", "multi-currency"],
    botReply: "Banking is the step that trips most people up, so good to tackle early. The fastest route today is usually a regulated EMI (IBAN, cards, multi-currency) rather than a traditional branch:",
    clarify: "Do you already have a company, or do you need that too?", clarifyChips: ["I have a company", "I need the company too", "Just exploring options"],
    recommendServices: ["banking", "formation"], recommendJurisdictions: ["cy", "ee", "uk"], showProviders: true,
    botReplyAfter: { "I have a company": "Then we go straight to banking — I'll match you with EMI and bank partners that actually onboard companies like yours.", "I need the company too": "We'll bundle it: incorporate first (Cyprus or Estonia open fastest), then open the account in parallel.", "Just exploring options": "No problem — here's the lay of the land on accounts and the partners who open them, so you can see what's realistic." } },
  { id: "residency-nondom", triggers: ["non-dom", "nondom", "non dom", "tax residen", "residency", "residence", "60 day", "183 day", "domicile", "remittance", "personal tax", "move my tax"],
    botReply: "Tax residency is the single biggest personal-tax lever there is. The headline play is Cyprus non-dom: spend ~60 days a year, pay no tax on foreign dividends, interest or capital gains for 17 years. Malta and Portugal are the main alternatives.",
    clarify: "", clarifyChips: [], recommendServices: ["residency", "formation"], recommendJurisdictions: ["cy", "mt", "pt"], showProviders: true },
  { id: "immigration-visa", triggers: ["visa", "immigration", "relocate", "relocation", "move to", "permit", "residence permit", "work permit", "citizenship", "golden visa", "digital nomad", "move abroad", "emigrate", "settle in"],
    botReply: "Relocating is exciting — let's make it land cleanly. The right route depends mostly on one thing:",
    clarify: "Are you set on the EU, or open to anywhere that works?", clarifyChips: ["EU specifically", "Somewhere low-tax", "Open — surprise me"],
    recommendServices: ["immigration", "residency"], recommendJurisdictions: ["cy", "pt", "mt"], showProviders: true,
    botReplyAfter: { "EU specifically": "For the EU, Cyprus and Portugal are the smoothest for entrepreneurs — permit routes that lead to long-term residence, sunshine, and favourable tax.", "Somewhere low-tax": "If tax is the driver, Cyprus (non-dom + EU) and the UAE (0% personal tax) are the standouts.", "Open — surprise me": "Then I'd shortlist Cyprus (EU + non-dom), Portugal (lifestyle + residence) and the UAE (0% tax)." } },
  { id: "accounting-vat", triggers: ["accounting", "accountant", "bookkeeping", "vat", "audit", "payroll", "tax return", "financial statement", "annual return", "file accounts", "manage my company"],
    botReply: "Keeping the company clean and compliant is exactly what keeps it cheap to run. We can take bookkeeping, VAT, payroll and the annual audit off your plate so nothing slips. Here's our ongoing-management service and the local partners who handle the filings.",
    clarify: "", clarifyChips: [], recommendServices: ["accounting"], recommendJurisdictions: ["cy", "mt", "ie"], showProviders: true },
  { id: "holding-structure", triggers: ["holding", "holdco", "group structure", "ip box", "intellectual property", "royalt", "dividend", "participation exemption", "treaty", "double tax", "parent company", "spv"],
    botReply: "A holding structure is all about treaty access and a clean participation exemption — so foreign dividends and gains flow up tax-free. Cyprus and the Netherlands are the classic choices, with Luxembourg for fund-grade structures. Cyprus also has an IP box (effective ~2.5%) if royalties are in the mix.",
    clarify: "", clarifyChips: [], recommendServices: ["formation", "accounting"], recommendJurisdictions: ["cy", "nl", "lu"], showProviders: true },
  { id: "ecommerce-online", triggers: ["e-commerce", "ecommerce", "online business", "online store", "shopify", "saas", "dropship", "amazon", "digital business", "remote business", "sell online", "stripe"],
    botReply: "For an online business you want to run everything remotely and still invoice cleanly inside the EU. Estonia's e-Residency is purpose-built for this — incorporate and manage 100% online, 0% tax on profits you reinvest — with Cyprus if you'd rather have low-tax EU substance.",
    clarify: "", clarifyChips: [], recommendServices: ["formation", "accounting"], recommendJurisdictions: ["ee", "cy", "ie"], showProviders: false },
  { id: "help-me-decide", triggers: ["not sure", "help me decide", "don't know", "do not know", "no idea", "where do i start", "where to start", "confused", "guide me", "what do i need", "advise me", "recommend", "suggest", "just starting"],
    botReply: "No problem at all — that's exactly what I'm here for. Two quick questions and I'll give you a clear recommendation.",
    clarify: "First: what's the main goal right now?", clarifyChips: ["Lower my tax", "Start a company", "Get banking sorted", "Relocate / get residency", "Get a crypto/finance licence"],
    recommendServices: ["formation"], recommendJurisdictions: ["cy"], showProviders: true,
    branchRoute: { "Lower my tax": "lower-tax", "Start a company": "formation", "Get banking sorted": "banking-emi", "Relocate / get residency": "residency-nondom", "Get a crypto/finance licence": "crypto-licensing" },
    botReplyAfter: { "Lower my tax": "Got it — tax efficiency. Cyprus is where most founders land: 12.5% corporate tax plus non-dom personal status under one roof.", "Start a company": "Great — let's get you incorporated. Cyprus and Estonia are the easiest, lowest-tax EU starting points.", "Get banking sorted": "Banking first — sensible. The quickest path is a regulated EMI account, and I can match you with partners who actually onboard.", "Relocate / get residency": "Relocation — Cyprus gives you EU residence plus non-dom tax status, the combination most people are really after.", "Get a crypto/finance licence": "Regulated activity — Malta and Estonia are the practical homes for that." } },
  { id: "fallback", triggers: [], botReply: "I want to make sure I point you somewhere genuinely useful — I might have missed the mark there. I'm best at company formation, tax & residency, banking, licensing and relocation. Which of these is closest to what you need?",
    clarify: "", clarifyChips: ["Pay less tax", "Set up a company", "Open a bank account", "Get a licence", "Relocate"], recommendServices: [], recommendJurisdictions: [], showProviders: false },
];

export const intentById = (id: string): Intent =>
  ADVISOR_INTENTS.find((i) => i.id === id) ?? ADVISOR_INTENTS[ADVISOR_INTENTS.length - 1];

export function matchIntent(text: string): Intent {
  const t = (text || "").toLowerCase();
  if (/(crypto|forex|licen|vasp|mica|gambling|igaming)/.test(t) && /(company|bank|account|set up|start)/.test(t)) return intentById("crypto-licensing");
  let best: Intent | null = null, bestScore = 0;
  for (const it of ADVISOR_INTENTS) {
    if (it.id === "fallback") continue;
    let sc = 0;
    for (const trg of it.triggers) if (t.indexOf(trg) >= 0) sc++;
    if (sc > bestScore) { bestScore = sc; best = it; }
  }
  return bestScore > 0 && best ? best : intentById("fallback");
}

export const advisorGreeting = (brand: string) =>
  `Hi — I'm ${brand}'s advisor. Tell me what you're trying to do in plain words — lower your tax, set up a company, get a business bank account, relocate — and I'll point you to the right service and jurisdiction. What's on your mind?`;
