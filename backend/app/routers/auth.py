import logging
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.middleware.rate_limit import limiter
from app.models import Organization, User, UserRole
from app.schemas import (
    ForgotPasswordIn,
    LoginIn,
    MessageOut,
    RefreshIn,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
    UserOut,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    verify_password,
)
from app.services.email_service import send_email
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_RESET_TTL_HOURS = 1


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in. Check your inbox for the verification link.",
        )
    return TokenOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenOut)
@limiter.limit("30/minute")
def refresh(request: Request, payload: RefreshIn, db: Session = Depends(get_db)):
    user_id = decode_refresh_token(payload.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return TokenOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# ── Register (self-serve signup) ──────────────────────────────────────────────

@router.post("/register", response_model=MessageOut)
@limiter.limit("5/minute")
def register(request: Request, payload: RegisterIn, db: Session = Depends(get_db)):
    if len(payload.password) < settings.password_min_length:
        raise HTTPException(
            status_code=422,
            detail=f"Password must be at least {settings.password_min_length} characters",
        )

    existing = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    org = Organization(name=payload.org_name.strip())
    db.add(org)
    db.flush()

    token = secrets.token_urlsafe(32)
    user = User(
        organization_id=org.id,
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        role=UserRole.owner,
        is_active=True,
        email_verified=False,
        email_verification_token=token,
    )
    db.add(user)
    db.commit()

    verify_url = f"{settings.app_base_url}/verify-email?token={token}"
    _send_verification_email(user.email, user.name, verify_url)

    return MessageOut(message="Verification email sent. Please check your inbox.")


# ── Verify email ──────────────────────────────────────────────────────────────

@router.get("/verify-email", response_model=MessageOut)
def verify_email(token: str = Query(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email_verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")

    user.email_verified = True
    user.email_verification_token = None
    db.commit()

    return MessageOut(message="Email verified. You can now sign in.")


# ── Forgot password ───────────────────────────────────────────────────────────

@router.post("/forgot-password", response_model=MessageOut)
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    # Always return 200 — never reveal whether an email is registered
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if user and user.is_active:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=_RESET_TTL_HOURS)
        db.commit()

        reset_url = f"{settings.app_base_url}/reset-password?token={token}"
        _send_reset_email(user.email, user.name, reset_url)

    return MessageOut(message="If that email is registered, a reset link is on its way.")


# ── Reset password ────────────────────────────────────────────────────────────

@router.post("/reset-password", response_model=MessageOut)
@limiter.limit("10/minute")
def reset_password(request: Request, payload: ResetPasswordIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if not user.password_reset_expires or datetime.utcnow() > user.password_reset_expires:
        raise HTTPException(status_code=400, detail="This reset link has expired. Please request a new one.")

    if len(payload.password) < settings.password_min_length:
        raise HTTPException(
            status_code=422,
            detail=f"Password must be at least {settings.password_min_length} characters",
        )

    user.password_hash = hash_password(payload.password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.email_verified = True  # reset confirms ownership of the email
    db.commit()

    return MessageOut(message="Password updated. You can now sign in.")


# ── Email helpers ─────────────────────────────────────────────────────────────

def _send_verification_email(to: str, name: str, url: str) -> None:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin-bottom:8px">Verify your email</h2>
      <p style="color:#6b7280;font-size:15px;margin-bottom:24px">Hi {name}, click the button below to activate your MightyOps account.</p>
      <a href="{url}" style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">Verify email address</a>
      <p style="color:#9ca3af;font-size:13px;margin-top:24px">Or paste this link in your browser:<br><a href="{url}" style="color:#2563eb">{url}</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">If you didn't create a MightyOps account, you can safely ignore this email.</p>
    </div>
    """
    try:
        send_email(to=to, subject="Verify your MightyOps email", html_body=html)
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", to, exc)


def _send_reset_email(to: str, name: str, url: str) -> None:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin-bottom:8px">Reset your password</h2>
      <p style="color:#6b7280;font-size:15px;margin-bottom:24px">Hi {name}, click the button below to set a new password. This link expires in 1 hour.</p>
      <a href="{url}" style="display:inline-block;background:#2563eb;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">Reset password</a>
      <p style="color:#9ca3af;font-size:13px;margin-top:24px">Or paste this link in your browser:<br><a href="{url}" style="color:#2563eb">{url}</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px">If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    """
    try:
        send_email(to=to, subject="Reset your MightyOps password", html_body=html)
    except Exception as exc:
        logger.error("Failed to send reset email to %s: %s", to, exc)
