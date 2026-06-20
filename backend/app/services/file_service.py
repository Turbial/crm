"""File storage service: local filesystem or S3-compatible."""
from __future__ import annotations

import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO

from app.config import settings

_s3_client = None


def _get_s3():
    global _s3_client
    if _s3_client is None:
        import boto3
        kwargs: dict = {
            "region_name": settings.s3_region,
            "aws_access_key_id": settings.s3_access_key_id or None,
            "aws_secret_access_key": settings.s3_secret_access_key or None,
        }
        if settings.s3_endpoint_url:
            kwargs["endpoint_url"] = settings.s3_endpoint_url
        _s3_client = boto3.client("s3", **kwargs)
    return _s3_client


def _use_s3() -> bool:
    return settings.storage_backend == "s3" and bool(settings.s3_bucket)


def upload_file(
    file_obj: BinaryIO,
    filename: str,
    content_type: str = "application/octet-stream",
    prefix: str = "attachments",
) -> str:
    """Upload file and return its public URL."""
    ext = Path(filename).suffix
    key = f"{prefix}/{uuid.uuid4().hex}{ext}"

    if _use_s3():
        _get_s3().upload_fileobj(
            file_obj,
            settings.s3_bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        if settings.s3_endpoint_url:
            base = settings.s3_endpoint_url.rstrip("/")
            return f"{base}/{settings.s3_bucket}/{key}"
        return f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com/{key}"

    local_dir = Path(settings.local_storage_path) / prefix
    local_dir.mkdir(parents=True, exist_ok=True)
    dest = local_dir / Path(key).name
    with open(dest, "wb") as f:
        shutil.copyfileobj(file_obj, f)
    return f"{settings.storage_public_url}/{prefix}/{dest.name}"


def delete_file(url: str) -> None:
    """Delete a previously uploaded file by its public URL."""
    if _use_s3():
        bucket = settings.s3_bucket
        if settings.s3_endpoint_url:
            prefix = f"{settings.s3_endpoint_url.rstrip('/')}/{bucket}/"
        else:
            prefix = f"https://{bucket}.s3.{settings.s3_region}.amazonaws.com/"
        key = url.removeprefix(prefix)
        _get_s3().delete_object(Bucket=bucket, Key=key)
        return

    base = settings.storage_public_url.rstrip("/")
    rel = url.removeprefix(base + "/")
    target = Path(settings.local_storage_path) / rel
    if target.exists():
        os.remove(target)


def get_signed_url(url: str, expires: int = 3600) -> str:
    """Return a pre-signed URL for private S3 objects; returns url unchanged for local storage."""
    if not _use_s3():
        return url
    bucket = settings.s3_bucket
    if settings.s3_endpoint_url:
        prefix = f"{settings.s3_endpoint_url.rstrip('/')}/{bucket}/"
    else:
        prefix = f"https://{bucket}.s3.{settings.s3_region}.amazonaws.com/"
    key = url.removeprefix(prefix)
    return _get_s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
