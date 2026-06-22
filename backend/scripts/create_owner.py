import os

from app.database import SessionLocal
from app.models import Organization, User, UserRole
from app.security import hash_password


def main():
    email = os.environ.get("OWNER_EMAIL", "owner@mightymax.ai")
    password = os.environ.get("OWNER_PASSWORD")
    org_name = os.environ.get("OWNER_ORG_NAME", "MightyMax")
    if not password or len(password) < 10:
        raise SystemExit("OWNER_PASSWORD must be set and at least 10 characters")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"owner already exists: {email}")
            return
        org = Organization(name=org_name, industry="AI business operations", plan="production")
        db.add(org)
        db.flush()
        user = User(
            organization_id=org.id,
            name="Owner",
            email=email,
            password_hash=hash_password(password),
            role=UserRole.owner,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"created owner {email} for org {org.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
