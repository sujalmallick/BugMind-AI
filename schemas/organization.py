from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
import re


# ── Helpers ──────────────────────────────────────────────────────────────────

def _slugify(value: str) -> str:
    """Convert an arbitrary string to a lowercase URL-safe slug."""
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_]+", "-", value)
    value = re.sub(r"-+", "-", value)
    return value.strip("-")


# ── Organization ─────────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str
    slug: Optional[str] = None          # auto-generated from name if omitted
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Organization name must not be empty.")
        if len(v) > 100:
            raise ValueError("Organization name must be 100 characters or fewer.")
        return v

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if not re.match(r"^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$", v):
            raise ValueError(
                "Slug must be lowercase alphanumeric with hyphens and 2–100 chars."
            )
        return v


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None


class OrgMemberRoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"owner", "admin", "member"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v


# ── Team ─────────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Team name must not be empty.")
        if len(v) > 100:
            raise ValueError("Team name must be 100 characters or fewer.")
        return v


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class TeamMemberAdd(BaseModel):
    user_id: int
    role: str = "member"

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"team_lead", "member"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v


class TeamMemberRoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"team_lead", "member"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v
