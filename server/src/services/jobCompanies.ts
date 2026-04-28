// ═══════════════════════════════════════════════════════════════
// Company Lists & Location Maps for Job Fetcher
// Complete list covering Indian unicorns, global MNCs, startups
// ═══════════════════════════════════════════════════════════════

export const GREENHOUSE_COMPANIES = [
    // ── Indian Unicorns & Startups ──
    "swiggy", "zomato", "oyo", "razorpay", "meesho",
    "nykaa", "cars24", "spinny", "udaan", "moglix",
    "delhivery", "blackbuck", "porter", "shiprocket",
    "blinkit", "curefit", "urbancompany", "khatabook",
    "okcredit", "leadsquared", "betterplace", "springworks",
    "infoedge", "justdial", "indiamart", "policybazaar",
    "bankbazaar", "sharechat", "dailyhunt", "dream11",
    "mpl", "gamezop", "perpule", "superops",
    "licious", "wakefit", "pepperfry", "urbanladder",
    "paytm", "lenskart", "mamaearth", "boat",
    "dealshare", "ofbusiness",

    // ── Global MNCs with India offices ──
    "microsoft", "google", "amazon", "oracle", "sap",
    "qualcomm", "intel", "cisco", "vmware", "broadcom",
    "cognizant", "mphasis", "hexaware", "persistent",
    "zensar", "cyient", "ltimindtree", "kpit", "mastech",
    "kellton", "sonata", "sasken", "rubrik", "cohesity",
    "snowflake", "confluent", "nutanix", "arcesium",
    "deshaw", "tanium", "informatica", "qualtrics",
    "flipkart", "samsung", "ibm", "accenture", "deloitte",
    "ey", "pwc", "capgemini", "microfocus", "dxc",
    "mindtree", "pagerduty", "cloudera", "grab",

    // ── Global Startups/Tech ──
    "airbnb", "pinterest", "discord", "figma", "notion",
    "brex", "ramp", "twilio", "datadog", "okta", "plaid",
    "hashicorp", "docker", "vercel", "cloudflare", "gitlab",
    "postman", "openai", "anthropic", "scaleai", "huggingface",
    "reddit", "doordash", "lyft", "spotify", "duolingo",
    "stripe", "shopify", "atlassian", "canva", "webflow",
    "gusto", "robinhood", "coinbase", "kraken", "apollographql",
    "instacart",

    // ── Indian Series A/B & FinTech ──
    "jupiter-money", "fi-money", "niyo", "epifi",
    "open-financial", "paymatrix", "recko", "decentro", "setu", "hyperface",
    "chargebee", "freshteam", "capillarytech",
    "darwinbox", "keka", "greythr", "zoho", "freshworks",
    "hasura", "clevertap", "moengage", "webengage", "netcore",
    "wigzo", "haptik", "gupshup", "kaleyra", "exotel",
    "ozonetel", "knowlarity", "servetel",

    // ── Indian E-Commerce & Consumer ──
    "milkbasket", "bigbasket", "jiomart", "nature-basket",
    "limeroad", "snapdeal", "shopclues", "sleepy-owl", "mcaffeine",

    // ── Indian HealthTech ──
    "practo", "1mg", "pharmeasy", "netmeds", "cure-fit", "mfine",
    "niramai", "innovaccer", "doceree", "pristyncare", "fortis", "manipal",
];

export const LEVER_COMPANIES = [
    // ── Indian Tech ──
    "cred", "groww", "zepto", "phonepe", "jupiter",
    "slice", "bharatpe", "freshworks", "browserstack",
    "hasura", "clevertap", "moengage", "webengage",
    "cashfree", "juspay", "instamojo", "gojek",
    "chargebee", "cleartax", "darwinbox", "keka",
    "zoho", "netcore", "exotel", "kaleyra",
    "postman", "capillary", "setu", "decentro", "hyperface", "signzy",

    // ── Indian EdTech ──
    "physicswallah", "unacademy", "byju", "vedantu", "toppr", "extramarks",
    "doubtnut", "embibe", "testbook", "gradeup", "adda247", "mahendras",

    // ── Global Companies ──
    "revolut", "retool", "linear", "mux", "fivetran",
    "segment", "amplitude", "miro", "netflix", "atlassian",
    "canva", "squarespace", "shopify", "intercom",
    "yelp", "eventbrite", "quora", "glassdoor", "webflow",
];

export const ASHBY_COMPANIES = [
    // ── India Focused ──
    "unacademy", "byju", "physicswallah", "vedantu",
    "scaler", "upgrad", "toppr", "testbook",
    "practo", "1mg", "pharmeasy", "innovaccer",
    "pristyncare", "ather", "ola", "rapido",
    "dunzo", "yulu", "decentro", "hyperface", "signzy",
    "darwinbox", "keka", "zoho", "freshworks",
    "chargebee", "cleartax", "licious", "blackbuck",
    "delhivery", "udaan", "porter",
    "setu", "syntizen", "cashfree", "cure-fit",

    // ── Global ──
    "openai", "notion", "snowflake", "deel", "vanta",
    "airwallex", "confluent", "deliveroo",
    "kraken",
];

// ── JSearch Cron Queries ────────────────────────────────────
export const JSEARCH_CRON_QUERIES = [
    // Global queries
    { query: "software engineer", location: "India" },
    { query: "developer", location: "India" },
    { query: "software engineer", location: "United States" },
    { query: "developer", location: "United Kingdom" },
    { query: "software engineer", location: "Remote" },

    // India metro city queries
    { query: "software developer", location: "Hyderabad" },
    { query: "software developer", location: "Bangalore" },
    { query: "software developer", location: "Pune" },
    { query: "software developer", location: "Chennai" },
    { query: "software developer", location: "Mumbai" },
    { query: "software developer", location: "Delhi NCR" },

    // Fresher/Entry level India
    { query: "junior developer", location: "India" },
    { query: "fresher engineer", location: "India" },
    { query: "graduate engineer trainee", location: "India" },
    { query: "software engineer intern", location: "India" },
    { query: "associate software engineer", location: "India" },
    { query: "trainee developer", location: "India" },
    { query: "0-1 years experience developer", location: "India" },

    // Tech role queries
    { query: "react developer", location: "India" },
    { query: "node developer", location: "India" },
    { query: "python developer", location: "India" },
    { query: "java developer", location: "India" },

    // Non-tech / cross-functional
    { query: "data analyst", location: "India" },
    { query: "product designer", location: "India" },
    { query: "product manager", location: "India" },
    { query: "devops engineer", location: "India" },
    { query: "qa engineer", location: "India" },
    { query: "ui ux designer", location: "India" },
    { query: "sales", location: "India" },
    { query: "operations manager", location: "India" },
    { query: "marketing manager", location: "India" },
];

// ── Indian State to Nearest Metro Map ──────────────────────
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

    // Additional skills for non-tech roles
    "figma", "sketch", "adobe xd", "photoshop", "illustrator",
    "product management", "agile", "scrum", "jira", "confluence",
    "salesforce", "hubspot", "google analytics", "seo", "sem",
    "excel", "power bi", "tableau", "looker",
];

// ── Seniority allowed per experience range ──────────────────
export const SENIORITY_FOR_EXPERIENCE: Record<string, string[]> = {
    "0-1": ["intern", "entry"],
    "1-3": ["intern", "entry", "mid"],
    "3-5": ["mid", "senior"],
    "5+":  ["senior", "lead"],
};
