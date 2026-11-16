from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routers import admin, auth, bookmarks, catalog, health, materials

settings = get_settings()

app = FastAPI(
    title="Campus Study Hub API",
    description="Backend API for the UniMak Campus Study Hub React application.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-XSRF-TOKEN", "Authorization"],
)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api")
app.include_router(catalog.departments_router, prefix="/api")
app.include_router(catalog.courses_router, prefix="/api")
app.include_router(materials.router, prefix="/api")
app.include_router(materials.alias_router, prefix="/api")
app.include_router(bookmarks.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request, error: StarletteHTTPException):
    code = error.headers.get("X-Error-Code") if error.headers else None
    content = {"detail": error.detail}
    if code:
        content["code"] = code
    return JSONResponse(status_code=error.status_code, content=content, headers=error.headers)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, error: RequestValidationError):
    details = [
        {
            "loc": item.get("loc", ()),
            "msg": item.get("msg", "Invalid value."),
            "type": item.get("type", "value_error"),
        }
        for item in error.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(details), "code": "VALIDATION_ERROR"},
    )


@app.middleware("http")
async def protect_unsafe_requests(request, call_next):
    if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path.startswith("/api/"):
        cookie_token = request.cookies.get("csrf_token")
        header_token = request.headers.get("X-XSRF-TOKEN")
        if not cookie_token or not header_token or cookie_token != header_token:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token is missing or invalid.", "code": "CSRF_INVALID"},
            )
    return await call_next(request)
