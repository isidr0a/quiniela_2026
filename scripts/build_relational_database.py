import json
import re
import subprocess
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
JESUS_PDF_PATH = ROOT / "quiniela jesus 2026.pdf"
ISIDRO_PDF_PATH = ROOT / "quiniela isidro.pdf"
QUINIELA_JSON_PATH = ROOT / "data" / "quiniela.json"
OUTPUT_PATH = ROOT / "data" / "quiniela-db.json"
ISIDRO_EXCLUDED_SOURCE_MATCH_NUMBERS = {1}


JESUS_MATCH_LINE_RE = re.compile(
    r"^(?P<number>\d+)\s+"
    r"(?P<date>\d{1,2}-[A-Za-zÁÉÍÓÚáéíóúÑñ]+)\s+"
    r"(?P<time>\d{1,2}:\d{2})\s+"
    r"(?P<home>.+?)\s{2,}"
    r"(?P<away>.+?)\s*$"
)

ISIDRO_MATCH_LINE_RE = re.compile(
    r"^(?P<date>\d{2}/\d{2}/\d{4})\s+"
    r"(?P<time>\d{2}:\d{2})\s+"
    r"(?P<home>.+?)\s+"
    r"(?P<pred_home>\d+)\s+"
    r"(?P<pred_away>\d+)\s+"
    r"(?P<away>.+?)\s*$"
)

MONTHS = {
    "ene": "01",
    "feb": "02",
    "mar": "03",
    "abr": "04",
    "may": "05",
    "jun": "06",
    "jul": "07",
    "ago": "08",
    "sep": "09",
    "oct": "10",
    "nov": "11",
    "dic": "12",
}

TEAM_KEY_ALIASES = {
    "arabia-saudi": "arabia-saudita",
    "catar": "qatar",
    "congo-rd": "rd-congo",
    "corea-del-sur": "republica-de-corea",
    "iran": "ri-de-iran",
    "republica-checa": "chequia",
}


def slug(value):
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def clean_text(value):
    return " ".join(value.strip().split())


def team_key(value):
    key = slug(value)
    return TEAM_KEY_ALIASES.get(key, key)


def match_key(match):
    return (team_key(match["homeTeam"]), team_key(match["awayTeam"]))


def pdf_text(path):
    return subprocess.check_output(["pdftotext", "-layout", str(path), "-"], text=True)


def jesus_date_to_iso_date(value):
    day, month_name = value.lower().split("-")
    return f"2026-{MONTHS[month_name]}-{int(day):02d}"


def isidro_date_to_iso_date(value):
    day, month, year = value.split("/")
    return f"{year}-{month}-{day}"


def iso_datetime(date_value, time_value):
    safe_time = "00:00" if time_value == "24:00" else time_value.zfill(5)
    return f"{date_value}T{safe_time}:00-04:00"


def extract_jesus_matches():
    matches = []
    for line in pdf_text(JESUS_PDF_PATH).splitlines():
        parsed = JESUS_MATCH_LINE_RE.match(line.strip())
        if not parsed:
            continue

        data = parsed.groupdict()
        match_number = int(data["number"])
        iso_date = jesus_date_to_iso_date(data["date"])
        time_value = data["time"].zfill(5)
        matches.append(
            {
                "id": match_number,
                "date": data["date"],
                "isoDate": iso_date,
                "time": time_value,
                "kickoff": iso_datetime(iso_date, time_value),
                "homeTeam": clean_text(data["home"]),
                "awayTeam": clean_text(data["away"]),
            }
        )

    if len(matches) != 72:
        raise ValueError(f"Expected 72 matches from Jesus PDF, got {len(matches)}")

    numbers = [match["id"] for match in matches]
    if numbers != list(range(1, 73)):
        raise ValueError(f"Jesus PDF match numbers are not sequential: {numbers}")

    return matches


def extract_isidro_predictions():
    predictions = []
    for line in pdf_text(ISIDRO_PDF_PATH).splitlines():
        parsed = ISIDRO_MATCH_LINE_RE.match(line.strip())
        if not parsed:
            continue

        data = parsed.groupdict()
        iso_date = isidro_date_to_iso_date(data["date"])
        predictions.append(
            {
                "sourceMatchNumber": len(predictions) + 1,
                "date": data["date"],
                "isoDate": iso_date,
                "time": data["time"].zfill(5),
                "kickoff": iso_datetime(iso_date, data["time"]),
                "homeTeam": clean_text(data["home"]),
                "awayTeam": clean_text(data["away"]),
                "predictedHome": int(data["pred_home"]),
                "predictedAway": int(data["pred_away"]),
            }
        )

    if len(predictions) != 72:
        raise ValueError(f"Expected 72 Isidro predictions from PDF, got {len(predictions)}")

    return predictions


def participant_record(index, name, source):
    return {
        "id": f"participant-{index:03d}",
        "name": name,
        "slug": slug(name),
        "source": source,
    }


def main():
    source = json.loads(QUINIELA_JSON_PATH.read_text(encoding="utf-8"))
    jesus_matches = extract_jesus_matches()
    isidro_pdf_predictions = extract_isidro_predictions()
    jesus_by_pair = {match_key(match): match for match in jesus_matches}

    teams_by_id = {}
    for match in jesus_matches:
        for team_name in (match["homeTeam"], match["awayTeam"]):
            teams_by_id.setdefault(team_key(team_name), {"id": team_key(team_name), "name": team_name})

    matches = []
    for match in jesus_matches:
        matches.append(
            {
                "id": f"match-{match['id']:03d}",
                "number": match["id"],
                "date": match["date"],
                "isoDate": match["isoDate"],
                "time": match["time"],
                "kickoff": match["kickoff"],
                "homeTeamId": team_key(match["homeTeam"]),
                "awayTeamId": team_key(match["awayTeam"]),
                "homeTeam": match["homeTeam"],
                "awayTeam": match["awayTeam"],
                "stage": "group",
                "group": None,
                "status": "scheduled",
                "resultHome": None,
                "resultAway": None,
            }
        )

    participants = []
    predictions = []
    validation = {
        "xlsxParticipantsNamedIsidro": [],
        "isidroUnmappedPredictions": [],
        "isidroExcludedLatePredictions": [],
        "isidroInsertedFromPdf": False,
    }

    participant_index = 1
    for participant in source["participants"]:
        if slug(participant["name"]) == "isidro-garcia":
            validation["xlsxParticipantsNamedIsidro"].append(participant["name"])
            continue

        participant = {**participant, "name": clean_text(participant["name"])}
        db_participant = participant_record(participant_index, participant["name"], "xlsx:jesus-order")
        participants.append(db_participant)

        for prediction in participant["predictions"]:
            match_number = prediction["matchId"]
            predictions.append(
                {
                    "id": f"{db_participant['id']}-match-{match_number:03d}",
                    "participantId": db_participant["id"],
                    "matchId": f"match-{match_number:03d}",
                    "matchNumber": match_number,
                    "sourceOrder": "jesus-pdf",
                    "sourceMatchNumber": match_number,
                    "predictedHome": prediction["home"],
                    "predictedAway": prediction["away"],
                    "points": prediction["points"],
                }
            )
        participant_index += 1

    isidro = participant_record(participant_index, "ISIDRO GARCIA", "pdf:isidro-order")
    participants.append(isidro)
    validation["isidroInsertedFromPdf"] = True

    for source_prediction in isidro_pdf_predictions:
        if source_prediction["sourceMatchNumber"] in ISIDRO_EXCLUDED_SOURCE_MATCH_NUMBERS:
            validation["isidroExcludedLatePredictions"].append(source_prediction)
            continue

        target_match = jesus_by_pair.get(match_key(source_prediction))
        if target_match is None:
            validation["isidroUnmappedPredictions"].append(source_prediction)
            continue

        match_number = target_match["id"]
        predictions.append(
            {
                "id": f"{isidro['id']}-match-{match_number:03d}",
                "participantId": isidro["id"],
                "matchId": f"match-{match_number:03d}",
                "matchNumber": match_number,
                "sourceOrder": "isidro-pdf",
                "sourceMatchNumber": source_prediction["sourceMatchNumber"],
                "predictedHome": source_prediction["predictedHome"],
                "predictedAway": source_prediction["predictedAway"],
                "points": None,
            }
        )

    payload = {
        "metadata": {
            "sources": {
                "matches": JESUS_PDF_PATH.name,
                "xlsxPredictions": source["source"]["file"],
                "isidroPredictions": ISIDRO_PDF_PATH.name,
            },
            "timezone": "America/Caracas",
            "scoring": source["scoring"],
            "counts": {
                "teams": len(teams_by_id),
                "matches": len(matches),
                "participants": len(participants),
                "predictions": len(predictions),
                "xlsxParticipantsLoaded": len(participants) - 1,
                "isidroPredictionsLoaded": sum(1 for p in predictions if p["participantId"] == isidro["id"]),
            },
            "validation": validation,
        },
        "teams": sorted(teams_by_id.values(), key=lambda item: item["name"]),
        "matches": matches,
        "participants": participants,
        "predictions": sorted(predictions, key=lambda item: (item["participantId"], item["matchNumber"])),
    }

    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
    print(json.dumps(payload["metadata"]["counts"], indent=2))
    if validation["isidroUnmappedPredictions"]:
        print(f"Isidro unmapped predictions: {len(validation['isidroUnmappedPredictions'])}")
    else:
        print("Isidro unmapped predictions: 0")


if __name__ == "__main__":
    main()
