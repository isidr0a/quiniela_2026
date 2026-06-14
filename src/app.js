import { createApp, computed, ref, onMounted } from "https://unpkg.com/vue@3/dist/vue.esm-browser.prod.js";
import { resultsConfig } from "./config.js";
import { clearApiResultsCache, loadApiResults } from "./resultsApi.js";

const FLAGS = {
  "alemania": "🇩🇪",
  "arabia-saudita": "🇸🇦",
  "argelia": "🇩🇿",
  "argentina": "🇦🇷",
  "australia": "🇦🇺",
  "austria": "🇦🇹",
  "belgica": "🇧🇪",
  "bosnia-y-herzegovina": "🇧🇦",
  "brasil": "🇧🇷",
  "cabo-verde": "🇨🇻",
  "canada": "🇨🇦",
  "chequia": "🇨🇿",
  "colombia": "🇨🇴",
  "rd-congo": "🇨🇩",
  "republica-de-corea": "🇰🇷",
  "costa-de-marfil": "🇨🇮",
  "croacia": "🇭🇷",
  "curazao": "🇨🇼",
  "ecuador": "🇪🇨",
  "egipto": "🇪🇬",
  "escocia": "🏴",
  "espana": "🇪🇸",
  "estados-unidos": "🇺🇸",
  "francia": "🇫🇷",
  "ghana": "🇬🇭",
  "haiti": "🇭🇹",
  "inglaterra": "🏴",
  "irak": "🇮🇶",
  "ri-de-iran": "🇮🇷",
  "japon": "🇯🇵",
  "jordania": "🇯🇴",
  "marruecos": "🇲🇦",
  "mexico": "🇲🇽",
  "noruega": "🇳🇴",
  "nueva-zelanda": "🇳🇿",
  "paises-bajos": "🇳🇱",
  "panama": "🇵🇦",
  "paraguay": "🇵🇾",
  "portugal": "🇵🇹",
  "qatar": "🇶🇦",
  "senegal": "🇸🇳",
  "sudafrica": "🇿🇦",
  "suecia": "🇸🇪",
  "suiza": "🇨🇭",
  "tunez": "🇹🇳",
  "turquia": "🇹🇷",
  "uruguay": "🇺🇾",
  "uzbekistan": "🇺🇿",
};

function outcome(home, away) {
  if (home === null || home === undefined || away === null || away === undefined) return null;
  if (home > away) return "H";
  if (home < away) return "A";
  return "D";
}

function scorePrediction(prediction, result) {
  if (!result || result.home === null || result.away === null) return 0;
  if (prediction.predictedHome === result.home && prediction.predictedAway === result.away) return 3;
  if (outcome(prediction.predictedHome, prediction.predictedAway) === outcome(result.home, result.away)) return 1;
  return 0;
}

function formatDate(match) {
  const date = new Date(`${match.isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("es-VE", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function formatJourneyDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("es-VE", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Sin actualización";
  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sourceLabel(source) {
  if (source === "pdf:isidro-order") return "PDF Isidro";
  if (source === "xlsx:jesus-order") return "XLSX Jesús";
  return source;
}

createApp({
  setup() {
    const db = ref(null);
    const apiResults = ref({});
    const apiStatus = ref({ loading: false, attempts: [], loadedAt: null, error: "" });
    const selectedMatchId = ref(null);
    const selectedParticipantId = ref("all");
    const search = ref("");
    const selectedGroup = ref("all");
    const selectedMatchday = ref("all");
    const activeTab = ref("matches");
    const isMatchDrawerOpen = ref(false);

    const participantsById = computed(() => Object.fromEntries((db.value?.participants || []).map((p) => [p.id, p])));
    const matchesById = computed(() => Object.fromEntries((db.value?.matches || []).map((m) => [m.id, m])));
    const predictions = computed(() => db.value?.predictions || []);

    const selectedMatch = computed(() => matchesById.value[selectedMatchId.value] || filteredMatches.value[0] || null);

    const groups = computed(() => [...new Set((db.value?.matches || []).map((match) => match.group))].sort());

    const completedMatches = computed(() => Object.values(apiResults.value).filter((result) => result.home !== null && result.away !== null).length);

    const journeyDates = computed(() => [...new Set((db.value?.matches || []).map((match) => match.isoDate))].sort());

    const ranking = computed(() => {
      const rows = (db.value?.participants || []).map((participant) => {
        const participantPredictions = predictions.value.filter((item) => item.participantId === participant.id);
        const scored = participantPredictions.map((prediction) => ({
          prediction,
          points: scorePrediction(prediction, apiResults.value[prediction.matchId]),
        }));
        const exact = scored.filter((item) => item.points === 3).length;
        const resultOnly = scored.filter((item) => item.points === 1).length;
        const total = scored.reduce((sum, item) => sum + item.points, 0);
        return { ...participant, total, exact, resultOnly, played: completedMatches.value };
      });
      return rows
        .sort((a, b) => b.total - a.total || b.exact - a.exact || b.resultOnly - a.resultOnly || a.name.localeCompare(b.name))
        .map((row, index) => ({ ...row, position: index + 1 }));
    });

    const rankingByMatchday = computed(() => {
      return journeyDates.value.map((isoDate, journeyIndex) => {
        const matches = (db.value?.matches || []).filter((match) => match.isoDate === isoDate);
        const matchIds = new Set(matches.map((match) => match.id));
        const rows = (db.value?.participants || []).map((participant) => {
          const scored = predictions.value
            .filter((prediction) => prediction.participantId === participant.id && matchIds.has(prediction.matchId))
            .map((prediction) => scorePrediction(prediction, apiResults.value[prediction.matchId]));
          const exact = scored.filter((points) => points === 3).length;
          const resultOnly = scored.filter((points) => points === 1).length;
          const total = scored.reduce((sum, points) => sum + points, 0);
          return { ...participant, total, exact, resultOnly };
        }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
        const topTotal = rows[0]?.total || 0;
        return {
          day: journeyIndex + 1,
          isoDate,
          label: formatJourneyDate(isoDate),
          matchCount: matches.length,
          rows: rows.map((row, index) => ({
            ...row,
            position: index + 1,
            isTop: topTotal > 0 && row.total === topTotal,
          })),
        };
      });
    });

    const filteredMatches = computed(() => {
      const needle = search.value.trim().toLowerCase();
      return (db.value?.matches || []).filter((match) => {
        const byGroup = selectedGroup.value === "all" || match.group === selectedGroup.value;
        const byDay = selectedMatchday.value === "all" || match.matchday === Number(selectedMatchday.value);
        const haystack = `${match.number} ${match.homeTeam} ${match.awayTeam} ${match.city} ${match.venue}`.toLowerCase();
        return byGroup && byDay && (!needle || haystack.includes(needle));
      });
    });

    const matchPredictions = computed(() => {
      const match = selectedMatch.value;
      if (!match) return [];
      return predictions.value
        .filter((prediction) => prediction.matchId === match.id)
        .map((prediction) => {
          const participant = participantsById.value[prediction.participantId];
          const points = scorePrediction(prediction, apiResults.value[prediction.matchId]);
          return { ...prediction, participant, points };
        })
        .filter((row) => selectedParticipantId.value === "all" || row.participantId === selectedParticipantId.value)
        .sort((a, b) => b.points - a.points || a.participant.name.localeCompare(b.participant.name));
    });

    const participantDetail = computed(() => {
      if (selectedParticipantId.value === "all") return null;
      const participant = participantsById.value[selectedParticipantId.value];
      if (!participant) return null;
      const rows = predictions.value
        .filter((prediction) => prediction.participantId === participant.id)
        .map((prediction) => ({
          ...prediction,
          match: matchesById.value[prediction.matchId],
          result: apiResults.value[prediction.matchId],
          points: scorePrediction(prediction, apiResults.value[prediction.matchId]),
        }))
        .sort((a, b) => a.matchNumber - b.matchNumber);
      return { participant, rows };
    });

    function flag(teamId) {
      return FLAGS[teamId] || "";
    }

    function resultFor(match) {
      return apiResults.value[match.id] || null;
    }

    function displayScore(match) {
      const result = resultFor(match);
      if (!result || result.home === null || result.away === null) return "Pendiente";
      return `${result.home} - ${result.away}`;
    }

    function statusClass(match) {
      const result = resultFor(match);
      return result && result.home !== null && result.away !== null ? "finished" : "pending";
    }

    function isMobileViewport() {
      return window.matchMedia("(max-width: 980px)").matches;
    }

    function selectMatch(match) {
      selectedMatchId.value = match.id;
      activeTab.value = "predictions";
      isMatchDrawerOpen.value = isMobileViewport();
    }

    function closeMatchDrawer() {
      isMatchDrawerOpen.value = false;
      activeTab.value = "matches";
    }

    async function refreshResults(forceRefresh = false) {
      if (!db.value) return;
      if (forceRefresh) clearApiResultsCache();
      apiStatus.value = { ...apiStatus.value, loading: true, error: "" };
      try {
        const response = await loadApiResults(db.value.matches, resultsConfig, { forceRefresh });
        apiResults.value = response.results;
        apiStatus.value = {
          loading: false,
          attempts: response.attempts,
          loadedAt: response.loadedAt,
          error: "",
          unmapped: response.unmapped.length,
          fromCache: response.fromCache,
        };
      } catch (error) {
        apiStatus.value = { ...apiStatus.value, loading: false, error: error.message };
      }
    }

    onMounted(async () => {
      const response = await fetch("./data/quiniela-db.json");
      db.value = await response.json();
      selectedMatchId.value = db.value.matches[0]?.id || null;
      await refreshResults();
    });

    return {
      activeTab,
      apiStatus,
      completedMatches,
      closeMatchDrawer,
      db,
      displayScore,
      filteredMatches,
      flag,
      formatDate,
      formatDateTime,
      journeyDates,
      groups,
      isMatchDrawerOpen,
      matchPredictions,
      participantDetail,
      participantsById,
      ranking,
      rankingByMatchday,
      refreshResults,
      resultFor,
      search,
      selectMatch,
      selectedGroup,
      selectedMatch,
      selectedMatchday,
      selectedParticipantId,
      sourceLabel,
      statusClass,
    };
  },
}).mount("#app");
