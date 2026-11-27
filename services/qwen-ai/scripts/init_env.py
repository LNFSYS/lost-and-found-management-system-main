"""Create a local secret without printing it or replacing an existing .env."""
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / ".env"
if not path.exists():
    template = (root / ".env.example").read_text(encoding="utf-8")
    template = template.replace("CHANGE_ME_TO_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS", secrets.token_urlsafe(32))
    with path.open("x", encoding="utf-8") as file:
        file.write(template)
    print("Created .env with a random API key (not displayed).")
else:
    print("Existing .env preserved.")
