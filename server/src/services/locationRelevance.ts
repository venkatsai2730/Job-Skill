// ═══════════════════════════════════════════════════════════════
// Region-aware location matching
//
// The job data has NO reliable structured country: the `country`
// column is mis-parsed (e.g. "Remote - USA" is stored as
// country:"India", "Canada - Remote" as "BC"), so we must resolve a
// job's region from its location TEXT.
//
// This decides whether a job belongs in a user's regional feed:
//   • a job in the user's own country/city               → keep
//   • a plain, location-agnostic "Remote" job            → keep
//   • a job clearly in ANOTHER country (incl. "Remote,US")→ drop
//
// Why not computeLocationMatch() >= 0.5?  Because that keeps any
// string containing "remote" — including "San Francisco, CA, US
// Remote" — which floods an India feed with US-only roles, while
// also dropping genuine "Bengaluru" jobs that omit the word "India".
// ═══════════════════════════════════════════════════════════════

export type Region = "india" | "us" | "canada" | "uk" | "europe";

// Region → indicative location tokens. Order/priority does not matter;
// a token appearing in the location text marks that region as "present".
// Two-letter US state codes are matched as ", xx" (the "City, ST" form)
// to avoid false hits inside ordinary words.
const REGION_TOKENS: Record<Region, string[]> = {
    india: [
        "india", "bharat", "bengaluru", "bangalore", "hyderabad", "secunderabad",
        "mumbai", "bombay", "pune", "chennai", "madras", "kolkata", "calcutta",
        "delhi", "gurgaon", "gurugram", "noida", "ncr", "ahmedabad", "kochi",
        "cochin", "coimbatore", "jaipur", "indore", "chandigarh", "trivandrum",
        "thiruvananthapuram", "mysore", "mysuru", "nagpur", "vizag",
        "visakhapatnam", "bhubaneswar", "vadodara", "surat", "kerala",
        "karnataka", "telangana", "tamil nadu", "maharashtra",
    ],
    us: [
        "united states", "usa", "u.s.", "u.s ", " us ", " us;", " us,", ", us",
        "new york", "san francisco", "seattle", "austin", "boston", "chicago",
        "atlanta", "los angeles", "denver", "dallas", "houston", "san jose",
        "washington dc", "silicon valley", "bay area",
        ", ca", ", tx", ", ny", ", il", ", wa", ", ma", ", co", ", ga", ", fl",
        ", nc", ", va", ", pa", ", oh", ", az", ", nj", ", mi", ", mn", ", or",
    ],
    canada: [
        "canada", "toronto", "vancouver", "montreal", "ottawa", "calgary",
        "ontario", ", on", ", bc", ", ab", ", qc", ", ns",
    ],
    uk: [
        "united kingdom", "u.k.", "england", "scotland", "london", "manchester",
        "edinburgh", "birmingham, uk", ", uk",
    ],
    europe: [
        "germany", "deutschland", "munich", "münchen", "berlin", "hamburg",
        "frankfurt", "france", "paris", "netherlands", "amsterdam", "ireland",
        "dublin", "spain", "madrid", "barcelona", "poland", "warsaw", "portugal",
        "lisbon", "sweden", "stockholm", "switzerland", "zurich", "europe", "emea",
    ],
};

const REMOTE_RE = /\bremote\b|work from home|\bwfh\b|\banywhere\b/;

// Words that carry no *place* meaning. If a location is nothing but these
// (plus punctuation) it is a genuinely location-agnostic remote role.
// Anything left over (a country name/code like "us", "colombia", "japan") means
// the remote role is tied to another country and must NOT enter an India feed.
const REMOTE_STOPWORDS = new Set([
    "remote", "work", "from", "home", "wfh", "anywhere", "worldwide", "global",
    "fully", "hybrid", "onsite", "on", "site", "job", "jobs", "position", "role",
    "only", "friendly", "first", "based", "flexible", "full", "time", "part",
    "contract", "the", "and", "or", "in", "at",
]);

function norm(s: string): string {
    return (s || "").toLowerCase();
}

/**
 * True when a location is *purely* remote — i.e. it names no country/place.
 * "Remote", "Remote job", "Fully Remote / Worldwide" → true.
 * "Remote - US", "Remote - Colombia", "South Africa, Remote" → false.
 */
export function isPureRemote(loc: string): boolean {
    if (!REMOTE_RE.test(norm(loc))) return false;
    const leftover = norm(loc)
        .replace(/[^a-z]+/g, " ")
        .split(" ")
        .filter(w => w && !REMOTE_STOPWORDS.has(w));
    return leftover.length === 0;
}

/** Map a user's country string to a canonical Region (or null if unknown). */
export function regionOfCountry(country: string): Region | null {
    const c = norm(country).trim();
    if (!c) return null;
    if (/(india|bharat)/.test(c)) return "india";
    if (/(united states|u\.?s\.?a?|america)/.test(c)) return "us";
    if (/canada/.test(c)) return "canada";
    if (/(united kingdom|u\.?k\.?|england|britain)/.test(c)) return "uk";
    if (/(germany|france|netherlands|ireland|spain|europe|poland|portugal|sweden|switzerland)/.test(c)) return "europe";
    return null;
}

/** Which regions does this location text indicate? (may be empty) */
function regionsInText(loc: string): Set<Region> {
    const found = new Set<Region>();
    for (const region of Object.keys(REGION_TOKENS) as Region[]) {
        if (REGION_TOKENS[region].some(tok => loc.includes(tok))) found.add(region);
    }
    return found;
}

/**
 * Should this job appear in the user's regional feed?
 *
 * @param jobLocation - e.g. "Bengaluru, India" | "Remote - USA" | "Remote"
 * @param userCity    - e.g. "hyderabad" (may be empty)
 * @param userCountry - e.g. "india"     (may be empty)
 */
export function isJobInUserRegion(
    jobLocation: string,
    userCity: string,
    userCountry: string,
): boolean {
    const loc = norm(jobLocation);
    if (!loc || loc === "not specified") return true; // unknown location → don't drop

    const city = norm(userCity).trim();
    if (city && loc.includes(city)) return true; // exact city match always wins

    const home = regionOfCountry(userCountry);
    // No known home region → we cannot make a regional judgement; keep everything.
    if (!home) return true;

    const detected = regionsInText(loc);

    if (detected.has(home)) return true;            // in the user's country
    if (detected.size > 0) return false;            // clearly in a DIFFERENT country

    // No known region tokens. Keep ONLY a purely location-agnostic remote role.
    // A remote role tied to another country ("Remote - US", "Remote - Japan")
    // or any unrecognised physical location is dropped for a clean regional feed.
    return isPureRemote(loc);
}
