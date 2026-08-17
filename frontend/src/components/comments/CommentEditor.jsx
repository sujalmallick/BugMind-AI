import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { fetchProjectMembers } from "../../api/projectShareApi";

export default function CommentEditor({ projectId, onSubmit }) {
  const [text, setText] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [cursorPos, setCursorPos] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  
  const textareaRef = useRef(null);

  // Fetch project members for mentions
  useEffect(() => {
    if (projectId) {
      fetchProjectMembers(projectId).then(setMembers).catch(console.error);
    }
  }, [projectId]);

  const handleInput = (e) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    setText(value);
    setCursorPos(pos);

    // Basic mention detection logic
    const textBeforeCursor = value.slice(0, pos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);
    
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      const filtered = members.filter(m => 
        (m.user.username || m.user.name).toLowerCase().includes(query)
      );
      setFilteredMembers(filtered);
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username) => {
    const textBefore = text.slice(0, cursorPos);
    const textAfter = text.slice(cursorPos);
    
    // Replace the matched @query with @username
    const lastAtPos = textBefore.lastIndexOf("@");
    const newTextBefore = textBefore.slice(0, lastAtPos) + `@${username} `;
    
    setText(newTextBefore + textAfter);
    setShowMentions(false);
    
    // Focus back and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = newTextBefore.length;
        textareaRef.current.selectionEnd = newTextBefore.length;
      }
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(text);
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative bg-white border border-hairline rounded-xl shadow-sm p-3">
      {/* Mention Dropdown */}
      {showMentions && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-hairline rounded-xl shadow-lg overflow-hidden z-10">
          <ul className="max-h-48 overflow-y-auto">
            {filteredMembers.map((member) => {
              const u = member.user;
              const handle = u.username || u.name.replace(/\s+/g, '').toLowerCase();
              return (
                <li 
                  key={u.id}
                  className="px-3 py-2 hover:bg-surface cursor-pointer flex items-center gap-2"
                  onClick={() => insertMention(handle)}
                >
                  <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-xs font-bold text-violet-700">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink">{u.name}</span>
                    <span className="text-xs text-muted">@{handle}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onClick={handleInput}
          onKeyUp={handleInput}
          placeholder="Add a comment... (Type @ to mention)"
          className="w-full text-sm resize-none outline-none min-h-[60px]"
        />
        <div className="flex justify-end mt-2">
          <button 
            type="submit" 
            disabled={!text.trim() || submitting}
            className="flex items-center gap-2 px-3 py-1.5 bg-signal text-white text-sm font-medium rounded-lg hover:bg-signal/90 transition-colors disabled:opacity-50"
          >
            <Send size={16} />
            Post
          </button>
        </div>
      </form>
    </div>
  );
}
