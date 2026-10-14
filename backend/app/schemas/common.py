from pydantic import BaseModel, ConfigDict


class StrictBaseModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
    )


class ErrorResponse(StrictBaseModel):
    detail: str
    error_code: str
