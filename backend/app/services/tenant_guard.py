from fastapi import HTTPException


def require_same_org(record, organization_id: str):
    if not record or getattr(record, "organization_id", None) != organization_id:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


def apply_org(query, model, organization_id: str):
    return query.filter(model.organization_id == organization_id)
