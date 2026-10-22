// JobSkill AI — In-Page Autofill & Form Detection Engine

(function () {
  if (window.__jobskill_injected) return;
  window.__jobskill_injected = true;

  // ── 1. Detect ATS Platform ─────────────────────────────────────────
  function detectAts() {
    const url = window.location.href;
    const html = document.documentElement.innerHTML.slice(0, 10000);

    if (url.includes("greenhouse.io") || html.includes("boards.greenhouse.io")) return "greenhouse";
    if (url.includes("jobs.lever.co") || html.includes("lever.co")) return "lever";
    if (url.includes("myworkdayjobs.com") || html.includes("wd1.myworkday")) return "workday";
    if (url.includes("ashbyhq.com") || html.includes("jobs.ashbyhq.com")) return "ashby";
    if (url.includes("linkedin.com/jobs")) return "linkedin";
    if (url.includes("indeed.com")) return "indeed";

    // Generic heuristic
    const formInputs = document.querySelectorAll("input, textarea, select");
    if (formInputs.length >= 3) {
      const hasResume = document.querySelector("input[type='file'], [id*='resume'], [name*='resume']");
      const hasEmail = document.querySelector("input[type='email'], [name*='email'], [id*='email']");
      if (hasEmail || hasResume) return "generic_ats";
    }

    return null;
  }

  // ── 2. Extract Job Details from DOM for Clipping ───────────────────
  function extractJobDetails() {
    let title = "";
    let company = "";
    let location = "Remote";

    const titleEl = document.querySelector("h1, .app-title, .posting-headline h2, [data-automation-id='jobPostingHeader']");
    if (titleEl) title = titleEl.innerText.trim();

    const companyEl = document.querySelector(".company-name, [data-automation-id='companyName'], .posting-headline h2 + span, a[href*='/company/']");
    if (companyEl) company = companyEl.innerText.trim();

    const locEl = document.querySelector(".location, [data-automation-id='locations'], .posting-categories .location");
    if (locEl) location = locEl.innerText.trim();

    if (!title) title = document.title.split(/[-–|]/)[0]?.trim() || "Target Role";
    if (!company) {
      const hostParts = window.location.hostname.split(".");
      company = hostParts.length >= 2 ? hostParts[hostParts.length - 2] : "Company";
      company = company.charAt(0).toUpperCase() + company.slice(1);
    }

    return {
      title,
      company,
      location,
      jobUrl: window.location.href,
      description: document.body.innerText.slice(0, 2000),
      source: window.location.hostname,
    };
  }

  // ── 3. Smart Field Matching Heuristics ─────────────────────────────
  function matchFieldType(input) {
    const text = [
      input.getAttribute("name") || "",
      input.getAttribute("id") || "",
      input.getAttribute("autocomplete") || "",
      input.getAttribute("placeholder") || "",
      input.getAttribute("aria-label") || "",
      input.getAttribute("data-automation-id") || "",
      getLabelText(input)
    ].join(" ").toLowerCase();

    // First Name
    if (text.match(/first\s*name|given\s*name|fname|legalnamesection_firstname/)) return "firstName";
    // Last Name
    if (text.match(/last\s*name|family\s*name|surname|lname|legalnamesection_lastname/)) return "lastName";
    // Full Name
    if (text.match(/full\s*name|your\s*name|^name$/)) return "fullName";
    // Email
    if (input.type === "email" || text.match(/email|e-mail/)) return "email";
    // Phone
    if (input.type === "tel" || text.match(/phone|mobile|telephone|cell/)) return "phone";
    // LinkedIn
    if (text.match(/linkedin/)) return "linkedin";
    // GitHub
    if (text.match(/github/)) return "github";
    // Portfolio / Website
    if (text.match(/portfolio|website|personal\s*site|urls\[portfolio\]/)) return "portfolio";
    // Address / Street
    if (text.match(/street|address\s*line|addressline1/)) return "address";
    // City
    if (text.match(/city|municipality/)) return "city";
    // State / Province
    if (text.match(/state|province|region/)) return "state";
    // Zip / Postal
    if (text.match(/postal|zip\s*code|postcode/)) return "zipCode";
    // Country
    if (text.match(/country/)) return "country";
    // Work authorization
    if (text.match(/authorized\s*to\s*work|legal\s*right\s*to\s*work|work\s*permit/)) return "workAuth";
    // Visa sponsorship
    if (text.match(/sponsorship|require\s*sponsorship|visa\s*status/)) return "visaRequired";

    return null;
  }

  function getLabelText(input) {
    if (input.id) {
      const lbl = document.querySelector(`label[for="${input.id}"]`);
      if (lbl) return lbl.innerText;
    }
    const parentLabel = input.closest("label");
    if (parentLabel) return parentLabel.innerText;

    // Check sibling label
    const prev = input.previousElementSibling;
    if (prev && prev.tagName === "LABEL") return prev.innerText;

    return "";
  }

  // ── 4. Set Value & Trigger Framework Synthetic Events ───────────────
  function setNativeValue(element, value) {
    if (!element || value === undefined || value === null) return false;

    if (element.tagName === "SELECT") {
      const valStr = String(value).toLowerCase();
      let matched = false;
      for (const opt of element.options) {
        if (opt.text.toLowerCase().includes(valStr) || opt.value.toLowerCase().includes(valStr)) {
          element.value = opt.value;
          matched = true;
          break;
        }
      }
      if (!matched && element.options.length > 1) {
        element.selectedIndex = 1;
      }
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    if (element.type === "checkbox" || element.type === "radio") {
      const shouldCheck = Boolean(value) && String(value).toLowerCase() !== "no";
      element.checked = shouldCheck;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    // Modern React 16+ setter hack to trigger state hook updates
    const prototype = Object.getPrototypeOf(element);
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

    if (nativeSetter) {
      nativeSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));

    // Visual highlight feedback
    element.classList.add("jobskill-autofilled-field");
    return true;
  }

  // ── 5. Autofill Operation ──────────────────────────────────────────
  async function performAutofill(profile) {
    if (!profile) {
      showToast("⚠️ Please connect your JobSkill AI account in the extension.", "error");
      return;
    }

    let filledCount = 0;
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select"));

    const contact = profile.contact || {};
    const disclosures = profile.disclosures || {};

    for (const input of inputs) {
      // Don't overwrite if already filled by user unless asked
      if (input.value && input.value.trim().length > 0 && !input.classList.contains("jobskill-autofilled-field")) {
        continue;
      }

      const fieldType = matchFieldType(input);
      if (!fieldType) continue;

      let valueToFill = "";
      switch (fieldType) {
        case "firstName":
          valueToFill = contact.firstName || contact.fullName?.split(" ")[0] || "";
          break;
        case "lastName":
          valueToFill = contact.lastName || contact.fullName?.split(" ").slice(1).join(" ") || "";
          break;
        case "fullName":
          valueToFill = contact.fullName || `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
          break;
        case "email":
          valueToFill = contact.email || "";
          break;
        case "phone":
          valueToFill = contact.phone || "";
          break;
        case "linkedin":
          valueToFill = contact.linkedinUrl || "";
          break;
        case "github":
          valueToFill = contact.githubUrl || "";
          break;
        case "portfolio":
          valueToFill = contact.portfolioUrl || "";
          break;
        case "address":
          valueToFill = contact.address || "";
          break;
        case "city":
          valueToFill = contact.city || "";
          break;
        case "state":
          valueToFill = contact.state || "";
          break;
        case "zipCode":
          valueToFill = contact.zipCode || "";
          break;
        case "country":
          valueToFill = contact.country || "United States";
          break;
        case "workAuth":
          valueToFill = disclosures.authorizedToWorkInCountry || "Yes";
          break;
        case "visaRequired":
          valueToFill = disclosures.requiresSponsorship || "No";
          break;
      }

      if (valueToFill) {
        if (setNativeValue(input, valueToFill)) {
          filledCount++;
        }
      }
    }

    showToast(`⚡ JobSkill Copilot filled ${filledCount} field${filledCount === 1 ? "" : "s"}!`, "success");
  }

  // ── 6. In-Page Floating Copilot Widget ─────────────────────────────
  function injectFloatingWidget() {
    const existing = document.getElementById("jobskill-floating-copilot");
    if (existing) return;

    const widget = document.createElement("div");
    widget.id = "jobskill-floating-copilot";
    widget.innerHTML = `
      <div class="jobskill-pill">
        <div class="jobskill-brand">
          <span class="jobskill-dot"></span>
          <span class="jobskill-title">JobSkill Copilot</span>
        </div>
        <div class="jobskill-actions">
          <button id="jobskill-btn-autofill" title="Autofill this job application" class="jobskill-btn jobskill-btn-primary">
            ⚡ Autofill
          </button>
          <button id="jobskill-btn-clip" title="Clip and track in your Kanban board" class="jobskill-btn jobskill-btn-secondary">
            📌 Track
          </button>
          <button id="jobskill-btn-close" title="Close" class="jobskill-btn-close">×</button>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Event handlers
    document.getElementById("jobskill-btn-autofill").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "FETCH_PROFILE" }, (response) => {
        if (response && response.success) {
          performAutofill(response.profile);
        } else {
          showToast(response?.error || "Please connect JobSkill AI in the extension popup.", "error");
        }
      });
    });

    document.getElementById("jobskill-btn-clip").addEventListener("click", () => {
      const jobData = extractJobDetails();
      chrome.runtime.sendMessage({ type: "CLIP_JOB", jobData }, (response) => {
        if (response && response.success) {
          showToast(`📌 Saved ${jobData.title} at ${jobData.company} to your Application Pipeline!`, "success");
        } else {
          showToast(response?.error || "Failed to save job", "error");
        }
      });
    });

    document.getElementById("jobskill-btn-close").addEventListener("click", () => {
      widget.style.display = "none";
    });
  }

  // ── 7. Floating Toast Notification ────────────────────────────────
  function showToast(message, type = "info") {
    let container = document.getElementById("jobskill-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "jobskill-toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `jobskill-toast jobskill-toast-${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("jobskill-toast-fade");
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // ── 8. Initialize on Page Load ─────────────────────────────────────
  const ats = detectAts();
  if (ats) {
    setTimeout(injectFloatingWidget, 1200);
  }

  // Listen for direct trigger from popup
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.type === "TRIGGER_AUTOFILL") {
      performAutofill(req.profile);
      sendResponse({ success: true });
    }
    if (req.type === "GET_PAGE_JOB") {
      sendResponse({ job: extractJobDetails() });
    }
  });
})();
