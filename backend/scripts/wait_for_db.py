import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import check_database

for attempt in range(1, 61):
    try:
        check_database()
        print("database ready")
        sys.exit(0)
    except Exception as exc:
        print(f"waiting for database attempt={attempt}: {exc}")
        time.sleep(2)

print("database did not become ready", file=sys.stderr)
sys.exit(1)
