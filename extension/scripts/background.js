// JobSkill AI Chrome Extension — Background Service Worker

const DEFAULT_API_BASE = "http://localhost:3001";

// Helper to retrieve API base URL and token
async function getConfig() {
  const result = await chrome.storage.local.get(["apiUrl", "authToken", "userProfile"]);
  return {
    apiUrl: result.apiUrl || DEFAULT_API_BASE,
    authToken: result.authToken || "",
    userProfile: result.userProfile || null,
  };
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_AUTH") {
    getConfig().then(({ authToken, userProfile }) => {
      sendResponse({ isAuthenticated: Boolean(authToken), userProfile });
    });
    return true;
  }

  if (message.type === "SET_AUTH") {
    chrome.storage.local.set({
      authToken: message.token,
      apiUrl: message.apiUrl || DEFAULT_API_BASE,
    }, () => {
      // Immediately fetch and cache profile
      fetchProfile().then(profile => {
        sendResponse({ success: true, profile });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    });
    return true;
  }

  if (message.type === "FETCH_PROFILE") {
    fetchProfile()
      .then(profile => sendResponse({ success: true, profile }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "CLIP_JOB") {
    clipJob(message.jobData)
      .then(res => sendResponse({ success: true, result: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === "TAILOR_ANSWER") {
    tailorAnswer(message.payload)
      .then(answer => sendResponse({ success: true, answer }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function fetchProfile() {
  const { apiUrl, authToken } = await getConfig();
  if (!authToken) {
    throw new Error("Not authenticated. Please connect your JobSkill AI account in the extension popup.");
  }

  const res = await fetch(`${apiUrl}/api/autofill/profile`, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  await chrome.storage.local.set({ userProfile: data.profile });
  return data.profile;
}

async function clipJob(jobData) {
  const { apiUrl, authToken } = await getConfig();
  if (!authToken) {
    throw new Error("Not authenticated. Please connect your account.");
  }

  const res = await fetch(`${apiUrl}/api/autofill/clip-job`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(jobData)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return await res.json();
}

async function tailorAnswer(payload) {
  const { apiUrl, authToken } = await getConfig();
  if (!authToken) {
    throw new Error("Not authenticated.");
  }

  const res = await fetch(`${apiUrl}/api/autofill/tailor-for-job`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.answer;
}
