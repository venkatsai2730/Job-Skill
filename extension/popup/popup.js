// JobSkill AI Popup Logic

document.addEventListener("DOMContentLoaded", async () => {
  const statusPill = document.getElementById("status-pill");
  const statusText = document.getElementById("status-text");
  const authSection = document.getElementById("auth-section");
  const mainSection = document.getElementById("main-section");

  const inputApiUrl = document.getElementById("input-api-url");
  const inputAuthToken = document.getElementById("input-auth-token");
  const btnSaveAuth = document.getElementById("btn-save-auth");

  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  const userAvatarEl = document.getElementById("user-avatar");
  const atsScoreNumEl = document.getElementById("ats-score-num");

  const btnAutofill = document.getElementById("btn-popup-autofill");
  const btnClip = document.getElementById("btn-popup-clip");
  const btnSyncProfile = document.getElementById("btn-sync-profile");
  const btnDisconnect = document.getElementById("btn-disconnect");

  const inputAiQuestion = document.getElementById("input-ai-question");
  const btnGenerateAi = document.getElementById("btn-generate-ai");
  const aiAnswerBox = document.getElementById("ai-answer-box");
  const aiAnswerText = document.getElementById("ai-answer-text");
  const btnCopyAnswer = document.getElementById("btn-copy-answer");

  let currentProfile = null;

  // ── 1. Check Auth Status ──────────────────────────────────────────
  function checkAuth() {
    chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (response) => {
      if (response && response.isAuthenticated && response.userProfile) {
        setConnectedUI(response.userProfile);
      } else if (response && response.isAuthenticated) {
        // Fetch profile
        chrome.runtime.sendMessage({ type: "FETCH_PROFILE" }, (pRes) => {
          if (pRes && pRes.success) {
            setConnectedUI(pRes.profile);
          } else {
            setDisconnectedUI();
          }
        });
      } else {
        setDisconnectedUI();
      }
    });
  }

  function setConnectedUI(profile) {
    currentProfile = profile;
    statusPill.className = "status-pill status-connected";
    statusText.innerText = "Connected";

    authSection.classList.add("hidden");
    mainSection.classList.remove("hidden");

    const contact = profile.contact || {};
    const name = contact.fullName || contact.firstName || "Job Applicant";
    userNameEl.innerText = name;
    userEmailEl.innerText = contact.email || "";

    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    userAvatarEl.innerText = initials || "JS";

    if (profile.atsScore) {
      atsScoreNumEl.innerText = `${profile.atsScore}%`;
    } else {
      atsScoreNumEl.innerText = "Ready";
    }
  }

  function setDisconnectedUI() {
    currentProfile = null;
    statusPill.className = "status-pill status-disconnected";
    statusText.innerText = "Not Connected";

    authSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
  }

  // ── 2. Save Auth Token ────────────────────────────────────────────
  btnSaveAuth.addEventListener("click", () => {
    const token = inputAuthToken.value.trim();
    const apiUrl = inputApiUrl.value.trim() || "http://localhost:3001";

    if (!token) {
      alert("Please paste your auth token.");
      return;
    }

    btnSaveAuth.innerText = "Connecting...";
    chrome.runtime.sendMessage({ type: "SET_AUTH", token, apiUrl }, (res) => {
      btnSaveAuth.innerText = "Connect Account";
      if (res && res.success) {
        setConnectedUI(res.profile);
      } else {
        alert(res?.error || "Failed to connect to JobSkill AI. Check your token and server.");
      }
    });
  });

  // ── 3. Autofill Active Tab ────────────────────────────────────────
  btnAutofill.addEventListener("click", async () => {
    if (!currentProfile) {
      alert("Profile not loaded.");
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    btnAutofill.classList.add("btn-loading");
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_AUTOFILL", profile: currentProfile }, (res) => {
      btnAutofill.classList.remove("btn-loading");
      window.close(); // Close popup so user sees filled form
    });
  });

  // ── 4. Clip Job on Active Tab ─────────────────────────────────────
  btnClip.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_JOB" }, (res) => {
      const jobData = res?.job || {
        title: tab.title || "Target Role",
        company: "Target Company",
        jobUrl: tab.url,
      };

      chrome.runtime.sendMessage({ type: "CLIP_JOB", jobData }, (clipRes) => {
        if (clipRes && clipRes.success) {
          alert(`📌 Saved "${jobData.title}" at ${jobData.company} to your Application Pipeline!`);
        } else {
          alert(clipRes?.error || "Failed to save job.");
        }
      });
    });
  });

  // ── 5. AI ATS Question Assistant ─────────────────────────────────
  btnGenerateAi.addEventListener("click", () => {
    const questionText = inputAiQuestion.value.trim();
    if (!questionText) {
      alert("Please paste an application question first.");
      return;
    }

    btnGenerateAi.innerText = "Generating with AI...";
    chrome.runtime.sendMessage({
      type: "TAILOR_ANSWER",
      payload: { questionText }
    }, (res) => {
      btnGenerateAi.innerText = "Generate Tailored Answer";
      if (res && res.success) {
        aiAnswerText.innerText = res.answer;
        aiAnswerBox.classList.remove("hidden");
      } else {
        alert(res?.error || "Failed to generate answer.");
      }
    });
  });

  btnCopyAnswer.addEventListener("click", () => {
    navigator.clipboard.writeText(aiAnswerText.innerText).then(() => {
      btnCopyAnswer.innerText = "Copied!";
      setTimeout(() => btnCopyAnswer.innerText = "Copy", 2000);
    });
  });

  // ── 6. Sync Profile & Disconnect ─────────────────────────────────
  btnSyncProfile.addEventListener("click", () => {
    btnSyncProfile.innerText = "Syncing...";
    chrome.runtime.sendMessage({ type: "FETCH_PROFILE" }, (res) => {
      btnSyncProfile.innerText = "🔄 Refresh Profile";
      if (res && res.success) {
        setConnectedUI(res.profile);
      }
    });
  });

  btnDisconnect.addEventListener("click", () => {
    chrome.storage.local.clear(() => {
      setDisconnectedUI();
    });
  });

  // Initialize
  checkAuth();
});
