"""
guardrails/log_redaction.py — scrub secrets and PII from every log record.

Installed as a LogRecordFactory, so it applies to all loggers and handlers
(app, uvicorn, gunicorn, litellm), including handlers attached later.
Exception tracebacks are rendered and redacted up front, since exception
messages often carry connection strings or provider keys.

If redaction itself fails, the message is withheld rather than emitted raw.
"""

import logging
import threading
import traceback

from guardrails.config import get_settings
from guardrails.detection import PII, SECRET

_tls = threading.local()
WITHHELD = "[log message withheld: redaction failed]"


def redact_record(record: logging.LogRecord) -> None:
    if getattr(_tls, "active", False):
        return
    _tls.active = True
    try:
        from guardrails.data_masker import masker

        kinds = (SECRET, PII)
        record.msg = masker.redact(record.getMessage(), kinds=kinds, stage="log")
        record.args = None
        if record.exc_info and not record.exc_text:
            rendered = "".join(traceback.format_exception(*record.exc_info)).rstrip("\n")
            record.exc_text = masker.redact(rendered, kinds=kinds, stage="log")
        if record.stack_info:
            record.stack_info = masker.redact(record.stack_info, kinds=kinds, stage="log")
    except Exception:
        record.msg = WITHHELD
        record.args = None
        record.exc_info = None
        record.exc_text = None
    finally:
        _tls.active = False


def install_log_redaction() -> None:
    current = logging.getLogRecordFactory()
    if getattr(current, "_bugmind_redacting", False):
        return

    def factory(*args, **kwargs):
        record = current(*args, **kwargs)
        settings = get_settings()
        if settings.enabled and settings.log_redaction_enabled:
            redact_record(record)
        return record

    factory._bugmind_redacting = True
    logging.setLogRecordFactory(factory)
