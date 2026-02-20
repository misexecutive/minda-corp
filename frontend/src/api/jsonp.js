function toQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}

export function jsonpRequest(baseUrl, params = {}, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    if (!baseUrl) {
      reject(new Error("VITE_API_BASE_URL is not configured."));
      return;
    }

    const callbackName = `mindacorp_jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const payload = { ...params, callback: callbackName };
    const query = toQuery(payload);
    const separator = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${separator}${query}`;

    let timeoutId;

    const cleanup = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window[callbackName];
    };

    window[callbackName] = (response) => {
      cleanup();
      resolve(response);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Network error while calling API."));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("API request timed out."));
    }, timeoutMs);

    script.src = url;
    document.body.appendChild(script);
  });
}

