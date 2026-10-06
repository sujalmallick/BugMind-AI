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

# Loggers whose formatters unpack record.args, so the args tuple must survive
# redaction. uvicorn's AccessFormatter reads (client_addr, method, full_path,
# http_version, status_code) from it and crashes on args=None.
_ARGS_PRESERVING_LOGGERS = {"uvicorn.access"}


def _keeps_args(record: logging.LogRecord) -> bool:
    return record.name in _ARGS_PRESERVING_LOGGERS and isinstance(record.args, tuple)


def redact_record(record: logging.LogRecord) -> None:
    if getattr(_tls, "active", False):
        return
    _tls.active = True
    keeps_args = _keeps_args(record)
    try:
        from guardrails.data_masker import masker

        kinds = (SECRET, PII)
        if keeps_args:
            # The format string is a fixed uvicorn template; only the args
            # carry request data, so redact each one in place.
            record.args = tuple(
                masker.redact(arg, kinds=kinds, stage="log") if isinstance(arg, str) else arg
                for arg in record.args
            )
        else:
            record.msg = masker.redact(record.getMessage(), kinds=kinds, stage="log")
            record.args = None
        if record.exc_info and not record.exc_text:
            rendered = "".join(traceback.format_exception(*record.exc_info)).rstrip("\n")
            record.exc_text = masker.redact(rendered, kinds=kinds, stage="log")
        if record.stack_info:
            record.stack_info = masker.redact(record.stack_info, kinds=kinds, stage="log")
    except Exception:
        if keeps_args:
            record.args = tuple(WITHHELD if isinstance(arg, str) else arg for arg in record.args)
        else:
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
