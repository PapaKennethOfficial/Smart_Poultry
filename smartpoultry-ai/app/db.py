"""SQLAlchemy session helper.

The AI service only reads from the DB (never writes). We use a single Engine
per process and hand out short-lived Sessions via `get_session()`. The Node
backend remains the sole writer.
"""

from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings


@lru_cache
def get_engine():
    settings = get_settings()
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
    )


@lru_cache
def get_session_factory():
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


@contextmanager
def get_session() -> Session:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
