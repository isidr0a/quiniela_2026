import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data" / "quiniela-db.json"
SCHEMA_PATH = ROOT / "data" / "schema.sql"
DB_PATH = ROOT / "data" / "quiniela.sqlite"


def main():
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))

    if DB_PATH.exists():
        DB_PATH.unlink()

    connection = sqlite3.connect(DB_PATH)
    try:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

        connection.executemany(
            "INSERT INTO teams (id, name) VALUES (:id, :name)",
            data["teams"],
        )
        connection.executemany(
            """
            INSERT INTO matches (
              id,
              number,
              date,
              iso_date,
              time,
              kickoff,
              home_team_id,
              away_team_id,
              stage,
              group_name,
              status,
              result_home,
              result_away
            ) VALUES (
              :id,
              :number,
              :date,
              :isoDate,
              :time,
              :kickoff,
              :homeTeamId,
              :awayTeamId,
              :stage,
              :group,
              :status,
              :resultHome,
              :resultAway
            )
            """,
            data["matches"],
        )
        connection.executemany(
            "INSERT INTO participants (id, name, slug, source) VALUES (:id, :name, :slug, :source)",
            data["participants"],
        )
        connection.executemany(
            """
            INSERT INTO predictions (
              id,
              participant_id,
              match_id,
              match_number,
              source_order,
              source_match_number,
              predicted_home,
              predicted_away,
              points
            ) VALUES (
              :id,
              :participantId,
              :matchId,
              :matchNumber,
              :sourceOrder,
              :sourceMatchNumber,
              :predictedHome,
              :predictedAway,
              :points
            )
            """,
            data["predictions"],
        )

        connection.commit()

        counts = {}
        for table in ("teams", "matches", "participants", "predictions"):
            counts[table] = connection.execute(
                f"SELECT COUNT(*) FROM {table}"
            ).fetchone()[0]

        print(f"Wrote {DB_PATH.relative_to(ROOT)}")
        print(json.dumps(counts, indent=2))
    finally:
        connection.close()


if __name__ == "__main__":
    main()
