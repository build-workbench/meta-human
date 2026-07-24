"""Session storage abstraction for DialogueService.

Provides a pluggable SessionStore interface with an in-memory implementation.
The in-memory store is the default and works for single-process development;
sessions are lost on restart.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import time
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)


class SessionStore(ABC):
    """Abstract session store interface."""

    @abstractmethod
    def get_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get the conversation history for a session."""
        ...

    @abstractmethod
    def append_history(
        self, session_id: str, role: str, content: str, timestamp: str, max_length: int = 40
    ) -> None:
        """Append a message to the session history."""
        ...

    @abstractmethod
    def get_messages(self, session_id: str) -> List[Dict[str, str]]:
        """Get the LLM-format messages for a session."""
        ...

    @abstractmethod
    def append_messages(
        self, session_id: str, messages: List[Dict[str, str]], max_length: int = 10
    ) -> None:
        """Append messages to the LLM-format session store."""
        ...

    @abstractmethod
    def touch(self, session_id: str) -> None:
        """Update the last-active timestamp for a session."""
        ...

    @abstractmethod
    def clear(self, session_id: str) -> bool:
        """Clear all data for a session. Returns True if anything was removed."""
        ...

    @abstractmethod
    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all active sessions with summary info."""
        ...

    @abstractmethod
    def cleanup_expired(self, ttl_seconds: int) -> int:
        """Remove sessions older than TTL. Returns count of removed sessions."""
        ...


class InMemorySessionStore(SessionStore):
    """In-memory session storage using Python dicts.

    Suitable for single-process development. Sessions are lost on restart.
    """

    def __init__(self) -> None:
        self._histories: Dict[str, List[Dict[str, str]]] = defaultdict(list)
        self._messages: Dict[str, List[Dict[str, str]]] = {}
        self._last_active: Dict[str, float] = {}

    def get_history(self, session_id: str) -> List[Dict[str, str]]:
        return list(self._histories.get(session_id, []))

    def append_history(
        self, session_id: str, role: str, content: str, timestamp: str, max_length: int = 40
    ) -> None:
        self._histories[session_id].append({
            "role": role,
            "content": content,
            "timestamp": timestamp,
        })
        # Truncate if needed
        if len(self._histories[session_id]) > max_length:
            self._histories[session_id] = self._histories[session_id][-max_length:]
        self.touch(session_id)

    def get_messages(self, session_id: str) -> List[Dict[str, str]]:
        return list(self._messages.get(session_id, []))

    def append_messages(
        self, session_id: str, messages: List[Dict[str, str]], max_length: int = 10
    ) -> None:
        history = self._messages.get(session_id, [])
        history.extend(messages)
        self._messages[session_id] = history[-max_length:]

    def touch(self, session_id: str) -> None:
        self._last_active[session_id] = time.monotonic()

    def clear(self, session_id: str) -> bool:
        removed = False
        if session_id in self._histories:
            del self._histories[session_id]
            removed = True
        if session_id in self._messages:
            del self._messages[session_id]
            removed = True
        if session_id in self._last_active:
            del self._last_active[session_id]
            removed = True
        return removed

    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions = []
        for sid, history in self._histories.items():
            if not history:
                continue
            sessions.append({
                "sessionId": sid,
                "messageCount": len(history),
                "lastActivity": history[-1].get("timestamp", ""),
                "preview": history[-1].get("content", "")[:80],
            })
        sessions.sort(key=lambda s: s["lastActivity"], reverse=True)
        return sessions

    def cleanup_expired(self, ttl_seconds: int) -> int:
        cutoff = time.monotonic() - ttl_seconds
        expired = [sid for sid, ts in self._last_active.items() if ts < cutoff]
        for sid in expired:
            self.clear(sid)
        if expired:
            logger.info("Cleaned up %d expired sessions", len(expired))
        return len(expired)
