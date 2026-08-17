import React, { useState, useEffect } from "react";
import { Sparkles, X, Check, Loader2, AlertCircle } from "lucide-react";
import { applySuggestions, dismissSuggestion } from "../../services/aiWorkloadApi";
import { getProjectMembers } from "../../services/projectApi";

export default function WorkloadSuggestionPanel({ 
  projectId, 
  suggestion, 
  onClose,
  onApplied 
}) {
  const [members, setMembers] = useState({});
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [applying, setApplying] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    // Select all by default
    if (suggestion?.suggestions) {
      setSelectedIndices(suggestion.suggestions.map((_, i) => i));
    }
  }, [suggestion]);

  useEffect(() => {
    async function loadMembers() {
      try {
        const mems = await getProjectMembers(projectId);
        const memMap = {};
        mems.forEach(m => {
          memMap[m.user.id] = m.user;
        });
        setMembers(memMap);
      } catch (err) {
        console.error("Failed to load members for names", err);
      }
    }
    loadMembers();
  }, [projectId]);

  if (!suggestion) return null;

  const handleToggle = (index) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleApply = async () => {
    if (selectedIndices.length === 0) return;
    setApplying(true);
    try {
      await applySuggestions(projectId, suggestion.id, selectedIndices);
      onApplied();
    } catch (err) {
      console.error(err);
      alert("Failed to apply suggestions");
    } finally {
      setApplying(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await dismissSuggestion(projectId, suggestion.id);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to dismiss suggestions");
    } finally {
      setDismissing(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-surface shadow-2xl border-l border-hairline z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
      <div className="flex items-center justify-between p-6 border-b border-hairline bg-white">
        <div className="flex items-center gap-2 text-indigo-600">
          <Sparkles size={20} />
          <h2 className="text-lg font-bold text-ink">AI Auto-Assign Plan</h2>
        </div>
        <button onClick={handleDismiss} className="text-muted hover:text-ink transition-colors p-1" disabled={applying || dismissing}>
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {suggestion.suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <AlertCircle size={32} className="mb-2 text-flagged" />
            <p>No valid suggestions were generated.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted mb-4">
              BugMind AI has analyzed your team's workload and generated the following distribution plan. Select the assignments you'd like to apply.
            </p>
            
            <div className="space-y-3">
              {suggestion.suggestions.map((item, index) => {
                const isSelected = selectedIndices.includes(index);
                const user = members[item.assignee_id];
                const userName = user ? (user.first_name || user.email.split('@')[0]) : "Unknown";
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${isSelected ? 'border-signal bg-signal-soft/30' : 'border-hairline bg-white hover:border-gray-300'}`}
                    onClick={() => handleToggle(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border ${isSelected ? 'bg-signal border-signal text-white' : 'border-gray-300 bg-white'}`}>
                        {isSelected && <Check size={14} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${item.entity_type === 'issue' ? 'bg-flagged-soft text-flagged' : 'bg-blue-50 text-blue-600'}`}>
                            {item.entity_type === 'issue' ? 'Bug' : 'Test Case'}
                          </span>
                          <span className="text-xs font-medium text-ink bg-paper px-2 py-0.5 rounded border border-hairline">
                            ID: {item.entity_id}
                          </span>
                        </div>
                        
                        <p className="text-sm font-medium text-ink mt-2 mb-2">
                          Assign to: <span className="text-indigo-600 font-bold">{userName}</span>
                        </p>
                        
                        <div className="bg-paper p-3 rounded-lg border border-hairline">
                          <p className="text-xs text-muted leading-relaxed">
                            <span className="font-semibold text-ink">Reason: </span>
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="p-6 border-t border-hairline bg-white flex gap-3">
        <button 
          onClick={handleDismiss} 
          disabled={applying || dismissing}
          className="flex-1 py-2.5 rounded-lg border border-hairline text-ink font-medium hover:bg-paper transition disabled:opacity-50"
        >
          {dismissing ? "Dismissing..." : "Dismiss Plan"}
        </button>
        <button 
          onClick={handleApply} 
          disabled={applying || dismissing || selectedIndices.length === 0}
          className="flex-1 py-2.5 rounded-lg bg-signal text-white font-medium hover:bg-signal-hover shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {applying && <Loader2 size={16} className="animate-spin" />}
          {applying ? "Applying..." : `Apply (${selectedIndices.length})`}
        </button>
      </div>
    </div>
  );
}
