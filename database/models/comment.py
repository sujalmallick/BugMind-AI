from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.base import Base

class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(50), index=True) # 'test_case' or 'issue'
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), nullable=True)
    
    body: Mapped[str] = mapped_column(Text)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    author = relationship("User", foreign_keys=[author_id])
    replies = relationship(
        "Comment",
        backref="parent",
        remote_side=[id],
        cascade="all",          # no delete-orphan here; DB ondelete=CASCADE handles it
    )
    reactions = relationship("CommentReaction", back_populates="comment", cascade="all, delete-orphan")
    mentions = relationship("Mention", back_populates="comment", cascade="all, delete-orphan")

class CommentReaction(Base):
    __tablename__ = "comment_reactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    emoji: Mapped[str] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    comment = relationship("Comment", back_populates="reactions")
    user = relationship("User", foreign_keys=[user_id])

class Mention(Base):
    __tablename__ = "mentions"

    id: Mapped[int] = mapped_column(primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"))
    mentioned_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    notified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    comment = relationship("Comment", back_populates="mentions")
    mentioned_user = relationship("User", foreign_keys=[mentioned_user_id])
