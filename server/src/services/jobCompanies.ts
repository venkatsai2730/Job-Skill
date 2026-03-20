// ═══════════════════════════════════════════════════════════════
// Company Lists & Location Maps for Job Fetcher
// ═══════════════════════════════════════════════════════════════

export const GREENHOUSE_COMPANIES = [
    // Indian Unicorns
    "swiggy", "zomato", "oyo", "paytm", "cred", "groww", "zepto", "meesho",
    "nykaa", "razorpay", "lenskart", "mamaearth", "boat", "cars24", "spinny",
    "dealshare", "udaan", "moglix", "ofbusiness", "delhivery", "blackbuck",
    "porter", "shiprocket", "blinkit", "curefit", "urbancompany",

    // Global MNCs India Office
    "google", "microsoft", "amazon", "flipkart", "samsung", "ibm",
    "accenture", "deloitte", "ey", "pwc", "capgemini",

    // Famous Startups / Unicorns
    "airbnb", "pinterest", "discord", "figma", "notion", "brex", "ramp",
    // Enterprise Tech
    "twilio", "datadog", "okta", "plaid", "gusto", "robinhood", "coinbase", "kraken",
    // Cloud / DevTools
    "hashicorp", "docker", "vercel", "cloudflare", "gitlab", "postman", "apollographql",
    // AI / Forward edge
    "openai", "anthropic", "scaleai", "huggingface",
    // Hyderabad/India presence
    "rubrik", "cohesity", "confluent", "snowflake", "nutanix", "arcesium", "deshaw",
    "tanium", "informatica", "qualtrics", "pagerduty", "cloudera", "grab",
    // Well known consumer
    "reddit", "doordash", "instacart", "lyft", "spotify", "duolingo",

    // Problem 4B — MNCs with strong Hyderabad/Bangalore presence
    "oracle", "sap", "qualcomm", "intel", "cisco", "vmware", "broadcom",
    "microfocus", "dxc", "cognizant", "mindtree", "mphasis", "hexaware",
    "persistent", "zensar", "cyient", "ltimindtree", "kpit", "mastech",
    "kellton", "sonata", "sasken", "infobeam", "infoedge", "justdial",
    "indiamart", "policybazaar", "bankbazaar", "sharechat", "dailyhunt",
    "verse", "dream11", "mpl", "sportsbuzz", "gamezop",

    // Problem 6 — Indian Series A/B Startups
    "khatabook", "okcredit", "jupiter-money", "fi-money", "niyo", "epifi",
    "open-financial", "paymatrix", "recko", "decentro", "setu", "hyperface",
    "perpule", "superops", "chargebee", "freshteam", "leadsquared",
    "capillarytech", "betterplace", "springworks", "darwinbox", "keka",
    "greythr", "zoho", "freshworks", "hasura", "clevertap", "moengage",
    "webengage", "netcore", "wigzo", "haptik", "gupshup", "kaleyra",
    "exotel", "ozonetel", "knowlarity", "servetel", "milkbasket",
    "bigbasket", "jiomart", "nature-basket", "limeroad", "snapdeal",
    "shopclues", "pepperfry", "urban-ladder", "wakefit", "sleepy-owl", "mcaffeine",

    // HealthTech India
    "practo", "1mg", "pharmeasy", "netmeds", "cure-fit", "mfine",
    "niramai", "innovaccer", "doceree", "pristyncare", "fortis", "manipal",
];

export const LEVER_COMPANIES = [
    // Indian Tech
    "cred", "groww", "zepto", "phonepe", "jupiter", "slice", "bharatpe",
    "freshworks", "postman", "browserstack", "hasura", "clevertap", "moengage",
    "webengage", "capillary", "setu", "decentro", "hyperface", "signzy",
    "cashfree", "juspay", "instamojo", "gojek",
    // Finance/Payments
    "revolut",
    // Dev Tools & SaaS
    "retool", "linear", "mux", "fivetran", "segment", "amplitude", "miro",
    // Big names
    "netflix", "yelp", "eventbrite", "quora", "glassdoor", "atlassian",
    "canva", "squarespace", "webflow", "shopify",

    // Problem 6 — EdTech India
    "physicswallah", "unacademy", "byju", "vedantu", "toppr", "extramarks",
    "doubtnut", "embibe", "testbook", "gradeup", "adda247", "mahendras",
];

export const ASHBY_COMPANIES = [
    // Global Tech
    "openai", "notion", "snowflake", "deel", "vanta",
    "airwallex", "confluent", "kraken", "deliveroo",
    // India Focused
    "darwinbox", "keka", "zoho", "freshworks",
    "chargebee", "cleartax", "licious", "blackbuck",
    "delhivery", "udaan", "vedantu", "unacademy",
    "byju", "physicswallah", "scaler", "upgrad",
    // Startups Using Ashby in India
    "setu", "hyperface", "decentro", "cashfree",
    "signzy", "syntizen", "yulu", "ather", "ola",
    "rapido", "porter", "dunzo",

    // Problem 6 — EdTech/HealthTech
    "practo", "1mg", "pharmeasy", "cure-fit", "innovaccer",
];

// ── JSearch Cron Queries ────────────────────────────────────
export const JSEARCH_CRON_QUERIES = [
    // Original global queries
    { query: "software engineer", location: "India" },
    { query: "developer", location: "India" },
    { query: "software engineer", location: "United States" },
    { query: "developer", location: "United Kingdom" },
    { query: "software engineer", location: "Remote" },
    { query: "data analyst", location: "India" },
    { query: "designer", location: "India" },
    { query: "product manager", location: "India" },

    // Problem 4A — India metro city queries
    { query: "software developer", location: "Hyderabad" },
    { query: "software developer", location: "Bangalore" },
    { query: "software developer", location: "Pune" },
    { query: "software developer", location: "Chennai" },
    { query: "software developer", location: "Mumbai" },
    { query: "software developer", location: "Delhi NCR" },
    { query: "software developer", location: "Noida" },
    { query: "fresher developer", location: "Hyderabad" },
    { query: "fresher developer", location: "Bangalore" },
    { query: "entry level", location: "India" },
    { query: "0-2 years experience", location: "India" },
    { query: "junior developer", location: "India" },
    { query: "trainee engineer", location: "India" },
    { query: "associate engineer", location: "India" },
];

// ── Problem 4C — Indian State to Nearest Metro Map ──────────
export const INDIAN_STATE_TO_NEAREST_METRO: Record<string, string> = {
    "telangana": "Hyderabad",
    "andhra pradesh": "Hyderabad",
    "karnataka": "Bangalore",
    "tamil nadu": "Chennai",
    "maharashtra": "Mumbai",
    "gujarat": "Ahmedabad",
    "rajasthan": "Jaipur",
    "uttar pradesh": "Noida",
    "west bengal": "Kolkata",
    "kerala": "Kochi",
    "punjab": "Chandigarh",
    "madhya pradesh": "Indore",
};

// ── Skill Patterns for extraction ───────────────────────────
export const SKILL_PATTERNS = [
    // Global Tech Skills
    "javascript", "typescript", "python", "java", "react", "angular", "vue",
    "node", "express", "django", "flask", "spring", "aws", "azure", "gcp",
    "docker", "kubernetes", "terraform", "git", "sql", "mongodb", "postgresql",
    "redis", "graphql", "rest", "api", "microservices", "html", "css",
    "linux", "devops", "machine learning", "data science", "golang", "rust",
    "swift", "kotlin", "flutter", "react native", "next.js", "nest.js",
    "kafka", "rabbitmq", "elasticsearch", "ci/cd", "jenkins", "github actions",

    // Indian Tech Stack & Domains
    "j2ee", "spring mvc", "hibernate", ".net", "asp.net", "c#", "angular.js",
    "php", "laravel", "codeigniter", "oracle db", "selenium", "testng", "junit",
    "sap abap", "sap fico", "sap mm", "sap sd", "oracle erp", "salesforce",
    "upi", "payment gateway", "bbps", "aadhaar api", "digilocker", "npci",
    "customer service", "voice process", "non-voice", "data entry", "back office", "kyc",
];

// ── Seniority allowed per experience range ──────────────────
export const SENIORITY_FOR_EXPERIENCE: Record<string, string[]> = {
    "0-1": ["intern", "entry"],
    "1-3": ["intern", "entry", "mid"],
    "3-5": ["mid", "senior"],
    "5+":  ["senior", "lead"],
};
