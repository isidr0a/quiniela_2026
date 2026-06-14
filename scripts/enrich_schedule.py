import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "quiniela-db.json"

GROUP_BY_TEAM = {
    "mexico": "A",
    "sudafrica": "A",
    "republica-de-corea": "A",
    "republica-checa": "A",
    "chequia": "A",
    "canada": "B",
    "bosnia-y-herzegovina": "B",
    "catar": "B",
    "qatar": "B",
    "suiza": "B",
    "brasil": "C",
    "marruecos": "C",
    "haiti": "C",
    "escocia": "C",
    "estados-unidos": "D",
    "paraguay": "D",
    "australia": "D",
    "turquia": "D",
    "alemania": "E",
    "curazao": "E",
    "costa-de-marfil": "E",
    "ecuador": "E",
    "paises-bajos": "F",
    "japon": "F",
    "suecia": "F",
    "tunez": "F",
    "belgica": "G",
    "egipto": "G",
    "ri-de-iran": "G",
    "nueva-zelanda": "G",
    "espana": "H",
    "cabo-verde": "H",
    "arabia-saudita": "H",
    "uruguay": "H",
    "francia": "I",
    "senegal": "I",
    "irak": "I",
    "noruega": "I",
    "argentina": "J",
    "argelia": "J",
    "austria": "J",
    "jordania": "J",
    "portugal": "K",
    "rd-congo": "K",
    "uzbekistan": "K",
    "colombia": "K",
    "inglaterra": "L",
    "croacia": "L",
    "ghana": "L",
    "panama": "L",
}

VENUES = {
    1: ("Mexico City Stadium", "Ciudad de Mexico", "Mexico"),
    2: ("Estadio Guadalajara", "Guadalajara", "Mexico"),
    3: ("Toronto Stadium", "Toronto", "Canada"),
    4: ("Los Angeles Stadium", "Los Angeles", "Estados Unidos"),
    5: ("San Francisco Bay Area Stadium", "San Francisco Bay Area", "Estados Unidos"),
    6: ("New York New Jersey Stadium", "New York/New Jersey", "Estados Unidos"),
    7: ("Boston Stadium", "Boston", "Estados Unidos"),
    8: ("BC Place Vancouver", "Vancouver", "Canada"),
    9: ("Houston Stadium", "Houston", "Estados Unidos"),
    10: ("Dallas Stadium", "Dallas", "Estados Unidos"),
    11: ("Philadelphia Stadium", "Philadelphia", "Estados Unidos"),
    12: ("Estadio Monterrey", "Monterrey", "Mexico"),
    13: ("Atlanta Stadium", "Atlanta", "Estados Unidos"),
    14: ("Seattle Stadium", "Seattle", "Estados Unidos"),
    15: ("Miami Stadium", "Miami", "Estados Unidos"),
    16: ("Los Angeles Stadium", "Los Angeles", "Estados Unidos"),
    17: ("New York New Jersey Stadium", "New York/New Jersey", "Estados Unidos"),
    18: ("Boston Stadium", "Boston", "Estados Unidos"),
    19: ("Kansas City Stadium", "Kansas City", "Estados Unidos"),
    20: ("San Francisco Bay Area Stadium", "San Francisco Bay Area", "Estados Unidos"),
    21: ("Houston Stadium", "Houston", "Estados Unidos"),
    22: ("Dallas Stadium", "Dallas", "Estados Unidos"),
    23: ("Toronto Stadium", "Toronto", "Canada"),
    24: ("Mexico City Stadium", "Ciudad de Mexico", "Mexico"),
    25: ("Atlanta Stadium", "Atlanta", "Estados Unidos"),
    26: ("Los Angeles Stadium", "Los Angeles", "Estados Unidos"),
    27: ("BC Place Vancouver", "Vancouver", "Canada"),
    28: ("Estadio Guadalajara", "Guadalajara", "Mexico"),
    29: ("Seattle Stadium", "Seattle", "Estados Unidos"),
    30: ("Boston Stadium", "Boston", "Estados Unidos"),
    31: ("Philadelphia Stadium", "Philadelphia", "Estados Unidos"),
    32: ("San Francisco Bay Area Stadium", "San Francisco Bay Area", "Estados Unidos"),
    33: ("Houston Stadium", "Houston", "Estados Unidos"),
    34: ("Toronto Stadium", "Toronto", "Canada"),
    35: ("Kansas City Stadium", "Kansas City", "Estados Unidos"),
    36: ("Estadio Monterrey", "Monterrey", "Mexico"),
    37: ("Atlanta Stadium", "Atlanta", "Estados Unidos"),
    38: ("Los Angeles Stadium", "Los Angeles", "Estados Unidos"),
    39: ("Miami Stadium", "Miami", "Estados Unidos"),
    40: ("BC Place Vancouver", "Vancouver", "Canada"),
    41: ("Dallas Stadium", "Dallas", "Estados Unidos"),
    42: ("Philadelphia Stadium", "Philadelphia", "Estados Unidos"),
    43: ("New York New Jersey Stadium", "New York/New Jersey", "Estados Unidos"),
    44: ("San Francisco Bay Area Stadium", "San Francisco Bay Area", "Estados Unidos"),
    45: ("Houston Stadium", "Houston", "Estados Unidos"),
    46: ("Boston Stadium", "Boston", "Estados Unidos"),
    47: ("Toronto Stadium", "Toronto", "Canada"),
    48: ("Estadio Guadalajara", "Guadalajara", "Mexico"),
    49: ("BC Place Vancouver", "Vancouver", "Canada"),
    50: ("Seattle Stadium", "Seattle", "Estados Unidos"),
    51: ("Miami Stadium", "Miami", "Estados Unidos"),
    52: ("Atlanta Stadium", "Atlanta", "Estados Unidos"),
    53: ("Mexico City Stadium", "Ciudad de Mexico", "Mexico"),
    54: ("Estadio Monterrey", "Monterrey", "Mexico"),
    55: ("Philadelphia Stadium", "Philadelphia", "Estados Unidos"),
    56: ("New York New Jersey Stadium", "New York/New Jersey", "Estados Unidos"),
    57: ("Dallas Stadium", "Dallas", "Estados Unidos"),
    58: ("Kansas City Stadium", "Kansas City", "Estados Unidos"),
    59: ("Los Angeles Stadium", "Los Angeles", "Estados Unidos"),
    60: ("San Francisco Bay Area Stadium", "San Francisco Bay Area", "Estados Unidos"),
    61: ("Boston Stadium", "Boston", "Estados Unidos"),
    62: ("Toronto Stadium", "Toronto", "Canada"),
    63: ("Houston Stadium", "Houston", "Estados Unidos"),
    64: ("Estadio Guadalajara", "Guadalajara", "Mexico"),
    65: ("Seattle Stadium", "Seattle", "Estados Unidos"),
    66: ("BC Place Vancouver", "Vancouver", "Canada"),
    67: ("New York New Jersey Stadium", "New York/New Jersey", "Estados Unidos"),
    68: ("Philadelphia Stadium", "Philadelphia", "Estados Unidos"),
    69: ("Miami Stadium", "Miami", "Estados Unidos"),
    70: ("Atlanta Stadium", "Atlanta", "Estados Unidos"),
    71: ("Kansas City Stadium", "Kansas City", "Estados Unidos"),
    72: ("Dallas Stadium", "Dallas", "Estados Unidos"),
}

def main():
    data = json.loads(DB_PATH.read_text(encoding="utf-8"))
    for match in data["matches"]:
        venue, city, country = VENUES[match["number"]]
        group = GROUP_BY_TEAM[match["homeTeamId"]]
        match["group"] = group
        match["matchday"] = 1 if match["number"] <= 24 else 2 if match["number"] <= 48 else 3
        match["venue"] = venue
        match["city"] = city
        match["country"] = country
    data["metadata"]["counts"]["venues"] = len(set(item["venue"] for item in data["matches"]))
    data["metadata"]["scheduleEnriched"] = True
    DB_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Enriched", DB_PATH.relative_to(ROOT))
    print(json.dumps(data["metadata"]["counts"], indent=2))

if __name__ == "__main__":
    main()
