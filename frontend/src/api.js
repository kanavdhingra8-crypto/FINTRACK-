const apiBaseUrl = import.meta.env.VITE_API_URL;
const accessTokenKey = 'fintrack.accessToken';
const refreshTokenKey = 'fintrack.refreshToken';

if (!apiBaseUrl) {
  throw new Error('VITE_API_URL is missing. Set it in the environment before starting the frontend.');
}

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getTokens() {
  return {
    accessToken: localStorage.getItem(accessTokenKey),
    refreshToken: localStorage.getItem(refreshTokenKey),
  };
}

export function saveTokens(tokens) {
  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new ApiError('The server did not return both authentication tokens.');
  }

  localStorage.setItem(accessTokenKey, tokens.accessToken);
  localStorage.setItem(refreshTokenKey, tokens.refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(accessTokenKey);
  localStorage.removeItem(refreshTokenKey);
}

function apiUrl(path) {
  return `${apiBaseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('The gateway returned an unreadable response.', response.status);
  }
}

let refreshPromise;

async function refreshTokens() {
  const { refreshToken } = getTokens();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(apiUrl('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;

        const data = await parseResponse(response);
        saveTokens(data);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = undefined;
      }
    })();
  }

  return refreshPromise;
}

function endSession() {
  clearTokens();
  window.dispatchEvent(new Event('fintrack:session-expired'));
}

export async function apiRequest(path, options = {}, retryAfterRefresh = true) {
  const { auth = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers || {});
  if (fetchOptions.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }

  if (auth) {
    const { accessToken } = getTokens();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response;
  try {
    response = await fetch(apiUrl(path), { ...fetchOptions, headers });
  } catch {
    throw new ApiError('Could not reach the FinTrack gateway. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  if (response.status === 401 && auth) {
    if (retryAfterRefresh && await refreshTokens()) {
      return apiRequest(path, options, false);
    }

    endSession();
    throw new ApiError('Your session expired. Please log in again.', 401, 'SESSION_EXPIRED');
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(
      data?.error?.message || 'The request could not be completed.',
      response.status,
      data?.error?.code,
    );
  }

  return data;
}
