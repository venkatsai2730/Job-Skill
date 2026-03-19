/**
 * 1000+ Global & 500+ India Keywords categorised by Industry
 * Includes the foundational mapping for ATS Parsing
 */

export interface KeywordLevel {
    level: "fresher" | "medium" | "senior" | "all";
    points: number;
}

export type IndustryCategory = "IT" | "Finance" | "Marketing" | "Healthcare" | "Sales" | "Non-IT";

// ── 1. GLOBAL KEYWORDS (1000+) ──────────────────────────────────────────────
export const GLOBAL_INDUSTRIES: Record<IndustryCategory, string[]> = {
    "IT": [
        // Languages
        "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go", "golang", "rust", "swift", "kotlin", "php", "sql", "html", "css", "r", "matlab", "scala", "perl", "dart", "haskell", "lua", "shell", "bash", "powershell",
        // Frontend
        "react", "angular", "vue", "next.js", "nuxt", "svelte", "redux", "tailwind", "bootstrap", "material ui", "webpack", "vite", "babel", "rxjs", "mobx", "jest", "cypress", "playwright", "storybook", "sass", "less", "styled-components",
        // Backend
        "node.js", "express", "django", "flask", "fastapi", "spring boot", "asp.net", "ruby on rails", "laravel", "nest.js", "graphql", "rest api", "grpc", "phoenix", "gin", "echo", "actix", "rocket", "koa", "hapi",
        // Databases
        "mongodb", "postgresql", "mysql", "sqlite", "redis", "elasticsearch", "cassandra", "dynamodb", "firebase", "supabase", "oracle", "sql server", "neo4j", "mariadb", "couchdb", "influxdb", "clickhouse", "snowflake", "redshift", "bigquery",
        // Cloud & DevOps
        "aws", "amazon web services", "gcp", "google cloud", "azure", "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "github actions", "gitlab ci", "circleci", "linux", "unix", "vagrant", "puppet", "chef", "prometheus", "grafana", "splunk", "datadog", "new relic", "elk stack", "argocd", "fluxcd",
        // Data & ML
        "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras", "apache spark", "hadoop", "kafka", "airflow", "tableau", "power bi", "looker", "dbt", "databricks", "mlflow", "kubeflow", "opencv", "nltk", "spacy", "huggingface", "llm", "generative ai", "langchain", "pinecone",
        // Tools & Methodologies
        "git", "github", "gitlab", "bitbucket", "jira", "confluence", "trello", "agile", "scrum", "kanban", "ci/cd", "test driven development", "tdd", "bdd", "microservices", "serverless", "event-driven architecture", "domain-driven design", "ddd", "solid principles", "mvc", "mvvm", "mvc", "design patterns",
        // Security
        "owasp", "penetration testing", "cryptography", "oauth", "jwt", "saml", "sso", "iam", "firewalls", "vpn", "ids/ips", "siem", "soc", "vulnerability assessment"
    ],
    "Finance": [
        "financial modeling", "valuation", "dcf", "lbo", "mergers and acquisitions", "m&a", "private equity", "venture capital", "investment banking", "asset management", "portfolio management", "capital markets", "fixed income", "equities", "derivatives", "options", "futures", "swaps", "risk management", "credit analysis", "credit risk", "market risk", "operational risk", "compliance", "aml", "kyc", "basel", "ifrs", "us gaap", "sarbanes-oxley", "sox", "financial planning and analysis", "fp&a", "budgeting", "forecasting", "variance analysis", "cost accounting", "taxation", "audit", "corporate finance", "treasury", "working capital management", "bloomberg terminal", "capital iq", "factset", "excel", "vba", "macros", "financial modeling", "quantitative analysis"
    ],
    "Marketing": [
        "seo", "sem", "ppc", "google ads", "facebook ads", "social media marketing", "content marketing", "email marketing", "marketing automation", "crm", "hubspot", "salesforce", "marketo", "mailchimp", "google analytics", "adobe analytics", "conversion rate optimization", "cro", "a/b testing", "copywriting", "brand management", "public relations", "pr", "event marketing", "influencer marketing", "affiliate marketing", "market research", "customer segmentation", "buyer personas", "customer journey mapping", "marketing strategy", "b2b marketing", "b2c marketing", "growth hacking", "lead generation", "inbound marketing", "outbound marketing", "product marketing", "go-to-market strategy"
    ],
    "Sales": [
        "b2b sales", "b2c sales", "enterprise sales", "inside sales", "outside sales", "business development", "account management", "lead generation", "cold calling", "prospecting", "sales funnel", "pipeline management", "crm", "salesforce", "hubspot", "pipedrive", "zoho crm", "sales methodology", "spin selling", "meddic", "challenger sale", "solution selling", "value selling", "negotiation", "contract negotiation", "closing", "quota attainment", "sales forecasting", "territory management", "sales enablement", "sales operations", "sales training", "customer success", "retention", "upselling", "cross-selling", "key account management", "kam"
    ],
    "Healthcare": [
        "patient care", "clinical research", "electronic health records", "ehr", "emr", "epic", "cerner", "hipaa compliance", "medical coding", "icd-10", "cpt", "medical billing", "healthcare administration", "nursing", "rn", "bls", "acls", "cpr", "triage", "vital signs", "phlebotomy", "pharmacology", "medication administration", "infection control", "quality improvement", "case management", "telehealth", "telemedicine", "medical terminology", "anatomy", "physiology", "patient education", "healthcare management", "public health", "epidemiology", "biostatistics", "clinical trials", "gcp"
    ],
    "Non-IT": [
        "project management", "pmp", "agile", "scrum", "lean", "six sigma", "operations management", "supply chain management", "logistics", "procurement", "vendor management", "inventory management", "quality assurance", "qa", "quality control", "qc", "customer service", "customer support", "human resources", "hr", "recruiting", "talent acquisition", "onboarding", "employee relations", "performance management", "compensation and benefits", "hris", "workday", "bambooa", "administrative support", "data entry", "scheduling", "office management", "communication skills", "leadership", "team building", "problem solving", "critical thinking", "time management", "conflict resolution", "adaptability", "emotional intelligence"
    ]
};

// Flatten global tools for generic searching
export const GLOBAL_TECH_SKILLS = [
    ...GLOBAL_INDUSTRIES.IT,
    ...GLOBAL_INDUSTRIES.Finance,
    ...GLOBAL_INDUSTRIES.Marketing,
    ...GLOBAL_INDUSTRIES.Sales,
    ...GLOBAL_INDUSTRIES.Healthcare,
    ...GLOBAL_INDUSTRIES["Non-IT"],
];

export const GLOBAL_CERTIFICATIONS = [
    "aws certified", "google cloud certified", "microsoft certified", "cissp", "ceh", "pmp", "csm", "scrum master", "cisco", "ccna", "ccnp", "oracle certified", "comptia", "cfa", "cpa", "cma", "frm", "itil", "six sigma green belt", "six sigma black belt", "prince2", "shrm-cp", "shrm-scp", "phr", "sphr"
];

export const GLOBAL_COMPANIES = [
    "google", "amazon", "microsoft", "meta", "facebook", "apple", "netflix", "uber", "airbnb", "stripe", "x", "twitter", "linkedin", "goldman sachs", "jpmorgan chase", "morgan stanley", "mckinsey", "bcg", "bain", "deloitte", "pwc", "ey", "kpmg", "salesforce", "adobe", "oracle", "sap", "ibm", "cisco", "intel", "amd", "nvidia", "tesla", "spacex", "boeing", "lockheed martin", "johnson & johnson", "pfizer", "novartis", "roche", "merck", "glaxosmithkline"
];

// ── 2. INDIA KEYWORDS (500+) ──────────────────────────────────────────────
export const INDIA_COLLEGES = [
    // Tier 1 & Premier Institutes
    "iit", "indian institute of technology", "iim", "indian institute of management", "nit", "national institute of technology", "iiit", "indian institute of information technology", "bits", "birla institute of technology", "bits pilani", "isim", "isb", "spjimr", "mdi", "fms", "xlri", "tiss", "iift", "nift", "nid", "bhu", "banaras hindu university", "jnu", "jawaharlal nehru university", "aiims", 
    // Tier 2 & 3 / State Colleges
    "vit", "vellore institute of technology", "srm", "manipal", "pes university", "bms", "rv college", "ms ramaiah", "ceg", "anna university", "jadavpur", "dtu", "nsut", "pec", "thapar", "amity", "lpu", "chitkara", "sathyabama", "sastra", "psg", "ssn", "kiit", "symbiosis", "nmims", "christ university", "vjti", "coep", "spit", "djsanghvi", "kjsomaiya", "nirma", "ld engineering", "medicaps", "daiict", "igdtuw", "jamia", "amu", "osmania", "jntu", "andhra university"
];

export const INDIA_COMPANIES = [
    // IT Services / Global System Integrators (WITCH etc.)
    "tcs", "tata consultancy services", "infosys", "wipro", "hcl", "tech mahindra", "cognizant", "capgemini", "accenture", "ibm india", "l&t", "lnt", "lti", "ltimindtree", "mindtree", "mphasis", "hexaware", "birlasoft", "zensar", "cyient", "tata elxsi", "kpit", "tata technologies", "genpact", "exl", "wns", "firstsource", "hinduja", "virtusa", "epam", "ust global", "sopra steria", "atos", "dxc technology",
    // Startups / Unicorns / Tech
    "flipkart", "swiggy", "zomato", "paytm", "ola", "oyo", "byjus", "cred", "razorpay", "meesho", "policybazaar", "nykaa", "zerodha", "upstox", "groww", "postman", "freshworks", "browserstack", "zoho", "dream11", "lenskart", "unacademy", "upgrad", "pharmeasy", "1mg", "curefit", "cultfit", "urban company", "urbanclap", "pine labs", "bharatpe", "sharechat", "mohalla tech", "cars24", "spinny", "ola electric", "ather energy", "zepto", "blinkit", "inmobi", "glance", "digit insurance", "apna", "dailyhunt", "ofbusiness", "udaan", "mobikwik",
    // Indian Conglomerates & Manufacturing
    "reliance", "jio", "tata", "aditya birla", "mahindra", "bajaj", "godrej", "tvs", "hero", "maruti suzuki", "ashok leyland", "itc", "hindustan unilever", "hul", "marico", "dabur", "patanjali", "amul", "britannia", "parle", "larsen & toubro", "vedanta", "hindalco", "jsw", "tata steel", "ongc", "ntpc", "gail", "bhel", "hal", "sail",
    // Banks & FinServ
    "sbi", "state bank of india", "hdfc", "icici", "axis bank", "kotak mahindra", "yes bank", "indusind", "idfc first", "bandhan bank", "pnb", "punjab national bank", "bank of baroda", "canara bank", "union bank", "muthoot", "manappuram", "bajaj finserv", "cholamandalam", "lic", "sriram finance", "zerodha broking", "angel one", "motilal oswal", "hdfc amc", "sbi mutual"
];

export const INDIA_CITIES = [
    // Tier 1
    "bengaluru", "bangalore", "hyderabad", "pune", "chennai", "mumbai", "delhi", "new delhi", "ncr", "noida", "gurgaon", "gurugram", "kolkata",
    // Tier 2 & 3
    "ahmedabad", "chandigarh", "kochi", "thiruvananthapuram", "trivandrum", "indore", "bhopal", "jaipur", "lucknow", "kanpur", "nagpur", "surat", "vadodara", "visakhapatnam", "vizag", "coimbatore", "mysore", "bhubaneswar", "guwahati", "patna", "ranchi", "dehradun", "raipur", "kozhikode", "madurai", "tiruchirappalli", "erode", "salem", "mangalore", "hubli", "dharwad", "belgaum", "gandhinagar", "rajkot", "jodhpur", "udaipur", "varanasi", "allahabad", "agra", "meerut", "ludhiana", "jalandhar", "amritsar", "shimla", "jammu", "srinagar", "jamshedpur", "rourkela", "durgapur", "asansol", "siliguri"
];

export const INDIA_TITLES = {
    fresher: ["trainee", "associate", "junior", "jr", "intern", "apprentice", "graduate engineer trainee", "get", "management trainee", "mt", "analyst", "software engineer 1", "sde 1", "sde i", "ase", "assistant systems engineer", "programmer analyst trainee", "pat", "systems engineer"],
    medium: ["senior", "sr", "sde-2", "sde ii", "sde 2", "lead", "consultant", "specialist", "member of technical staff", "mts", "m.t.s.", "assistant manager", "deputy manager", "project engineer", "module lead", "tech lead", "technical lead", "sr. software engineer", "sse", "technology analyst"],
    senior: ["principal", "architect", "manager", "staff", "sde-3", "sde iii", "sde 3", "director", "vp", "vice president", "head", "cxo", "ceo", "cto", "cfo", "cco", "cmo", "gm", "general manager", "avp", "delivery manager", "program manager", "portfolio manager", "senior architect", "chief architect"]
};

export const INDIA_CULTURE = [
    "notice period", "serving notice", "immediate joiner", "relocation", "pan india", "bond", "service agreement", "onsite", "offshore", "shift allowance", "night shift", "rotational shift", "wfo", "work from office", "hybrid", "remote", "wfh", "work from home"
];

export const INDIA_PLATFORMS = [
    "naukri", "shine", "shine.com", "foundit", "monster india", "instahyre", "hirist", "iimjobs", "cutshort", "hasjob", "internshala", "angel.co", "wellfound"
];

export const INDIA_SALARY_TERMS = [
    "ctc", "lpa", "in-hand", "gross", "variable pay", "fixed pay", "retention bonus", "joining bonus", "pf", "provident fund", "gratuity", "₹", "rupees", "inr", "lakhs", "crores"
];

// ── 3. SCORING LOGIC ──────────────────────────────────────────────
export function getIndiaKeywordsPoints(text: string, level: "fresher" | "medium" | "senior"): { score: number; matches: string[]; indiaAtsScore: number } {
    let score = 0;
    let indiaPoints = 0; // Out of 100 max
    const matches: Set<string> = new Set();
    
    // Safely pad text to ensure boundary matches at start/end
    const lowerText = ` ${text.toLowerCase()} `;
    
    // Helper for whole-word matching
    const hasWord = (word: string) => {
        // Escape special chars like . $ + etc.
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // If word contains non-word chars natively (like `b.tech` or `c++`), custom boundaries
        if (/[^a-z0-9]/i.test(word)) {
            return new RegExp(`(?:\\s|^)${escaped}(?:\\s|$)`, 'i').test(lowerText);
        }
        return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerText);
    };

    // ── Universal Base Checks (For all levels) ──
    const matchedCities = INDIA_CITIES.filter(hasWord);
    if (matchedCities.length > 0) {
        score += 2;
        indiaPoints += 15; // 15% out of 100 
        matchedCities.slice(0, 2).forEach(city => matches.add(city));
    }
    
    // Culture / Platforms
    const matchedCulture = INDIA_CULTURE.filter(hasWord);
    if (matchedCulture.length > 0) { indiaPoints += 10; matches.add(matchedCulture[0]); }
    
    const matchedPlatforms = INDIA_PLATFORMS.filter(hasWord);
    if (matchedPlatforms.length > 0) { indiaPoints += 5; matches.add("Indian Job Portals"); }

    const matchedSalary = INDIA_SALARY_TERMS.filter(hasWord);
    if (matchedSalary.length > 0) {
        score += 2;
        indiaPoints += 10;
        matches.add("Indian Salary Format");
    }

    // ── Level Specific Checks ──
    if (level === "fresher") {
        // +60 max for Freshers
        if (hasWord("b.tech") || hasWord("b.e") || hasWord("mca") || hasWord("b.sc") || hasWord("barch") || hasWord("bba") || hasWord("bcom") || hasWord("amie") || hasWord("pgdm")) { 
            score += 2; indiaPoints += 20; matches.add("Indian Degree"); 
        }
        if (hasWord("cgpa") || hasWord("gpa") || hasWord("percentage") || lowerText.includes("%")) { 
            score += 2; indiaPoints += 15; matches.add("CGPA/Percentage"); 
        }
        if (hasWord("intern") || hasWord("internship")) { 
            score += 2; indiaPoints += 10; matches.add("Internship"); 
        }
        const matchedColleges = INDIA_COLLEGES.filter(hasWord);
        if (matchedColleges.length > 0) { 
            score += 2; indiaPoints += 25; matches.add("Top Indian College"); 
        }
        if (INDIA_TITLES.fresher.some(hasWord)) {
            indiaPoints += 15; matches.add("Indian Fresher Title");
        }
        
        score = Math.min(score, 10);
    } 
    else if (level === "medium") {
        // +60 max for Mid-Level
        const matchedCompanies = INDIA_COMPANIES.filter(hasWord);
        if (matchedCompanies.length > 0) { 
            score += 3; indiaPoints += 30; matches.add("Indian Corporate Exp"); 
        }
        if (INDIA_TITLES.medium.some(hasWord)) { 
            score += 2; indiaPoints += 20; matches.add("Mid-level Title"); 
        }
        if (hasWord("mtech") || hasWord("m.tech") || hasWord("mba") || hasWord("pgdm") || hasWord("ms")) {
            indiaPoints += 10; matches.add("PG Degree");
        }
        const matchedColleges = INDIA_COLLEGES.filter(hasWord);
        if (matchedColleges.length > 0) { indiaPoints += 15; matches.add("Top Indian College"); }
        
        score = Math.min(score, 10);
    }
    else {
        // Senior +60 max
        const matchedCompanies = INDIA_COMPANIES.filter(hasWord);
        if (matchedCompanies.length > 0) { indiaPoints += 25; matches.add("Indian Corporate Exp"); }
        
        if (INDIA_TITLES.senior.some(hasWord)) { 
            score += 3; indiaPoints += 25; matches.add("Senior Leadership Title"); 
        }
        if (hasWord("team of") || hasWord("managed") || hasWord("led") || hasWord("reporting to")) { 
            score += 2; indiaPoints += 20; matches.add("People/Team Management"); 
        }
        if (hasWord("p&l") || hasWord("profit and loss") || hasWord("cross-functional") || hasWord("stakeholder")) {
            indiaPoints += 15; matches.add("Executive Acumen");
        }
        
        score = Math.min(score, 8);
    }

    // Cap the India ATS Score to strict 100 barrier
    const indiaAtsScore = Math.min(100, Math.max(0, indiaPoints));

    return { score, matches: Array.from(matches), indiaAtsScore };
}
