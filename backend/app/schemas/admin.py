from pydantic import BaseModel, Field


class MaterialReview(BaseModel):
    rejection_reason: str | None = Field(default=None, alias="rejectionReason", max_length=1000)

    model_config = {"populate_by_name": True}


class ResourceStatus(BaseModel):
    status: str
    rejection_reason: str | None = Field(default=None, alias="rejectionReason", max_length=1000)

    model_config = {"populate_by_name": True}


class UserStatus(BaseModel):
    status: str
