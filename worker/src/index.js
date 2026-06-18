const FOOTBALL_DATA_BASE_URL = "https://api.football-data.org/v4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const RATE_LIMIT_PERIOD_SECONDS = 60;

const TEAM_NAME_ALIASES = {
  "algeria": "Argelia",
  "bosnia-herzegovina": "Bosnia y Herzegovina",
  "brazil": "Brasil",
  "cape verde islands": "Cabo Verde",
  "curacao": "Curazao",
  "czechia": "República Checa",
  "czech republic": "República Checa",
  "germany": "Alemania",
  "haiti": "Haití",
  "ivory coast": "Costa de Marfil",
  "mexico": "México",
  "morocco": "Marruecos",
  "qatar": "Catar",
  "scotland": "Escocia",
  "south africa": "Sudáfrica",
  "south korea": "República de Corea",
  "switzerland": "Suiza",
  "turkey": "Turquía",
  "turkiye": "Turquía",
  "united states": "Estados Unidos",
};

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
      ...(init.headers || {}),
    },
  });
}

async function enforceRateLimit(request, env) {
  if (!env.RESULTS_RATE_LIMITER) return null;

  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const key = `${new URL(request.url).pathname}:${clientIp}`;
  const { success } = await env.RESULTS_RATE_LIMITER.limit({ key });

  if (success) return null;

  return jsonResponse(
    {
      error: "Too many requests",
      retryAfter: RATE_LIMIT_PERIOD_SECONDS,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(RATE_LIMIT_PERIOD_SECONDS),
        "Cache-Control": "no-store",
      },
    },
  );
}

function numericScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTeamName(value) {
  const key = normalizeKey(value);
  return TEAM_NAME_ALIASES[key] || value || "";
}

function mapFootballDataMatch(match) {
  return {
    homeTeam: normalizeTeamName(match.homeTeam?.name),
    awayTeam: normalizeTeamName(match.awayTeam?.name),
    home: numericScore(match.score?.fullTime?.home),
    away: numericScore(match.score?.fullTime?.away),
    status: match.status === "FINISHED" ? "finished" : "scheduled",
    updatedAt: match.lastUpdated || null,
  };
}

function cacheTtl(env) {
  const parsed = Number(env.CACHE_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120;
}

async function fetchFootballData(env) {
  if (!env.FOOTBALL_DATA_TOKEN) {
    return jsonResponse({ error: "Missing FOOTBALL_DATA_TOKEN secret" }, { status: 500 });
  }

  const competition = env.FOOTBALL_DATA_COMPETITION || "WC";
  const url = `${FOOTBALL_DATA_BASE_URL}/competitions/${competition}/matches`;
  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
      "Accept": "application/json",
    },
    cf: {
      cacheTtl: cacheTtl(env),
      cacheEverything: true,
    },
  });

  if (!response.ok) {
    return jsonResponse(
      {
        error: "Football-Data request failed",
        status: response.status,
        statusText: response.statusText,
      },
      { status: response.status },
    );
  }

  const data = await response.json();
  const matches = Array.isArray(data.matches) ? data.matches.map(mapFootballDataMatch) : [];

  return jsonResponse(
    {
      source: "Football-Data Worker",
      competition,
      updatedAt: new Date().toISOString(),
      matches,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${cacheTtl(env)}`,
      },
    },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, { status: 405 });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "quiniela-2026-results" });
    }

    if (url.pathname === "/results") {
      const rateLimited = await enforceRateLimit(request, env);
      if (rateLimited) return rateLimited;
      return fetchFootballData(env);
    }

    return jsonResponse({ error: "Not found" }, { status: 404 });
  },
};
