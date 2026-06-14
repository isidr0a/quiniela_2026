const TEAM_ALIASES = {
  "arabia saudi": "arabia-saudita",
  "arabia saudita": "arabia-saudita",
  "saudi arabia": "arabia-saudita",
  "austria": "austria",
  "belgium": "belgica",
  "belgica": "belgica",
  "bosnia and herzegovina": "bosnia-y-herzegovina",
  "bosnia herzegovina": "bosnia-y-herzegovina",
  "bosnia y herzegovina": "bosnia-y-herzegovina",
  "brazil": "brasil",
  "brasil": "brasil",
  "cabo verde": "cabo-verde",
  "cape verde": "cabo-verde",
  "canada": "canada",
  "catar": "qatar",
  "colombia": "colombia",
  "costa de marfil": "costa-de-marfil",
  "cote divoire": "costa-de-marfil",
  "cote d ivoire": "costa-de-marfil",
  "cote dvoire": "costa-de-marfil",
  "croatia": "croacia",
  "croacia": "croacia",
  "curacao": "curazao",
  "curazao": "curazao",
  "czech republic": "chequia",
  "czechia": "chequia",
  "chequia": "chequia",
  "dr congo": "rd-congo",
  "rd congo": "rd-congo",
  "congo dr": "rd-congo",
  "ecuador": "ecuador",
  "egypt": "egipto",
  "egipto": "egipto",
  "england": "inglaterra",
  "inglaterra": "inglaterra",
  "france": "francia",
  "francia": "francia",
  "germany": "alemania",
  "alemania": "alemania",
  "ghana": "ghana",
  "haiti": "haiti",
  "iran": "ri-de-iran",
  "ir iran": "ri-de-iran",
  "iran islamic republic": "ri-de-iran",
  "irak": "irak",
  "iraq": "irak",
  "ivory coast": "costa-de-marfil",
  "japan": "japon",
  "japon": "japon",
  "jordan": "jordania",
  "jordania": "jordania",
  "mexico": "mexico",
  "morocco": "marruecos",
  "marruecos": "marruecos",
  "netherlands": "paises-bajos",
  "paises bajos": "paises-bajos",
  "new zealand": "nueva-zelanda",
  "nueva zelanda": "nueva-zelanda",
  "norway": "noruega",
  "noruega": "noruega",
  "panama": "panama",
  "paraguay": "paraguay",
  "portugal": "portugal",
  "qatar": "qatar",
  "scotland": "escocia",
  "escocia": "escocia",
  "senegal": "senegal",
  "south africa": "sudafrica",
  "sudafrica": "sudafrica",
  "south korea": "republica-de-corea",
  "korea republic": "republica-de-corea",
  "republica de corea": "republica-de-corea",
  "spain": "espana",
  "espana": "espana",
  "sweden": "suecia",
  "suecia": "suecia",
  "switzerland": "suiza",
  "suiza": "suiza",
  "tunisia": "tunez",
  "tunez": "tunez",
  "turkiye": "turquia",
  "turkey": "turquia",
  "turquia": "turquia",
  "united states": "estados-unidos",
  "usa": "estados-unidos",
  "uruguay": "uruguay",
  "uzbekistan": "uzbekistan",
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamId(value) {
  const normalized = normalize(value);
  return TEAM_ALIASES[normalized] || normalized.replace(/\s+/g, "-");
}

function matchKey(homeTeam, awayTeam) {
  return `${teamId(homeTeam)}__${teamId(awayTeam)}`;
}

function numericScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildResultMap(matches, incoming) {
  const byKey = new Map(matches.map((match) => [`${match.homeTeamId}__${match.awayTeamId}`, match]));
  const results = {};
  const unmapped = [];

  incoming.forEach((item) => {
    const key = matchKey(item.homeTeam, item.awayTeam);
    const match = byKey.get(key);
    if (!match) {
      unmapped.push(item);
      return;
    }
    results[match.id] = {
      matchId: match.id,
      home: item.home,
      away: item.away,
      status: item.status,
      source: item.source,
      updatedAt: item.updatedAt || new Date().toISOString(),
    };
  });

  return { results, unmapped };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function fetchLocalResults() {
  const data = await fetchJson(`./data/results.json?v=${Date.now()}`);
  const matches = Array.isArray(data?.results) ? data.results : [];
  return matches.map((match) => ({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    home: numericScore(match.home),
    away: numericScore(match.away),
    status: match.status || "finished",
    source: match.source || "Resultados verificados",
    updatedAt: data.updatedAt || match.updatedAt || null,
  }));
}

async function fetchTheSportsDb(config) {
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${config.theSportsDbLeagueId}&s=${config.theSportsDbSeason}`;
  const data = await fetchJson(url);
  const events = Array.isArray(data?.events) ? data.events : [];
  return events
    .map((event) => {
      const home = numericScore(event.intHomeScore);
      const away = numericScore(event.intAwayScore);
      return {
        homeTeam: event.strHomeTeam,
        awayTeam: event.strAwayTeam,
        home,
        away,
        status: home === null || away === null ? "scheduled" : "finished",
        source: "TheSportsDB",
        updatedAt: event.dateEvent || null,
      };
    })
    .filter((event) => event.homeTeam && event.awayTeam);
}

async function fetchFootballDataWorker(config) {
  if (!config.footballDataWorkerUrl) return [];
  const data = await fetchJson(config.footballDataWorkerUrl);
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  return matches.map((match) => ({
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    home: numericScore(match.home),
    away: numericScore(match.away),
    status: match.status || "scheduled",
    source: data.source || match.source || "Football-Data Worker",
    updatedAt: match.updatedAt || data.updatedAt || null,
  }));
}

async function fetchFootballData(config) {
  if (!config.footballDataToken) return [];
  const url = `https://api.football-data.org/v4/competitions/${config.footballDataCompetition}/matches`;
  const data = await fetchJson(url, {
    headers: { "X-Auth-Token": config.footballDataToken },
  });
  const matches = Array.isArray(data?.matches) ? data.matches : [];
  return matches.map((match) => ({
    homeTeam: match.homeTeam?.name,
    awayTeam: match.awayTeam?.name,
    home: numericScore(match.score?.fullTime?.home),
    away: numericScore(match.score?.fullTime?.away),
    status: match.status === "FINISHED" ? "finished" : "scheduled",
    source: "Football-Data.org",
    updatedAt: match.lastUpdated || null,
  }));
}

const CACHE_KEY = "quiniela:api-results:v6";
const PENDING_CACHE_TTL_MS = 5 * 60 * 1000;
const FINISHED_CACHE_TTL_MS = 2 * 24 * 60 * 60 * 1000;

function isFinishedResult(result) {
  return result?.home !== null && result?.home !== undefined && result?.away !== null && result?.away !== undefined;
}

function cacheAge(cachedAt) {
  const time = new Date(cachedAt || 0).getTime();
  return Number.isFinite(time) ? Date.now() - time : Infinity;
}

function validCachedResults(cached) {
  const results = cached?.results || {};
  return Object.fromEntries(
    Object.entries(results).filter(([, result]) => {
      const ttl = isFinishedResult(result) ? FINISHED_CACHE_TTL_MS : PENDING_CACHE_TTL_MS;
      return cacheAge(result.cachedAt || cached.loadedAt) <= ttl;
    }),
  );
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return {
      ...cached,
      results: validCachedResults(cached),
    };
  } catch {
    return null;
  }
}

function hasFreshPendingWindow(cached) {
  return cached?.loadedAt && cacheAge(cached.loadedAt) <= PENDING_CACHE_TTL_MS;
}

function withCacheTimestamps(results, cachedAt) {
  return Object.fromEntries(
    Object.entries(results).map(([matchId, result]) => [matchId, { ...result, cachedAt }]),
  );
}

function writeCache(payload, previousResults = {}) {
  try {
    const cachedAt = payload.loadedAt;
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...payload,
        results: {
          ...previousResults,
          ...withCacheTimestamps(payload.results, cachedAt),
        },
      }),
    );
  } catch {
    // Cache is best-effort only.
  }
}

export async function loadApiResults(matches, config, options = {}) {
  const cached = options.forceRefresh ? null : readCache();
  if (cached && hasFreshPendingWindow(cached)) return { ...cached, fromCache: true };

  const attempts = [];
  const allResults = [];

  const sources = [
    ["Football-Data Worker", () => fetchFootballDataWorker(config)],
    ["Football-Data.org", () => fetchFootballData(config)],
    ["TheSportsDB", () => fetchTheSportsDb(config)],
    ["Resultados verificados", () => fetchLocalResults()],
  ];

  for (const [name, loader] of sources) {
    try {
      const items = await loader();
      attempts.push({ name, ok: true, count: items.length });
      allResults.push(...items);
    } catch (error) {
      attempts.push({ name, ok: false, error: error.message });
    }
  }

  const mapped = buildResultMap(matches, allResults);
  const loadedAt = new Date().toISOString();
  const previousFinished = Object.fromEntries(
    Object.entries(cached?.results || {}).filter(([, result]) => isFinishedResult(result)),
  );
  const mergedResults = {
    ...previousFinished,
    ...mapped.results,
  };
  const payload = {
    results: mergedResults,
    attempts,
    unmapped: mapped.unmapped,
    loadedAt,
    fromCache: false,
  };
  writeCache({ ...payload, results: mapped.results }, previousFinished);
  return payload;
}

export function clearApiResultsCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Cache is best-effort only.
  }
}
