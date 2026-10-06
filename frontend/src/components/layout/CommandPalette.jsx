import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from "react-router-dom";
export default function CommandPalette({ open, onClose, commands }) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const filtered = useMemo(
    () => commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase())),
    [commands, query],
  )

  function handleQueryChange(value) {
    setQuery(value)
    setHighlighted(0)
  }

  function closePalette() {
    setQuery('')
    setHighlighted(0)
    onClose()
  }

  function runCommand(command) {
    command.action()
    closePalette()
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      closePalette()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      const command = filtered[highlighted]
      if (command) runCommand(command)
    }
  }

  if (!open) return null

  return (
    <div
      className="modal-backdrop-enter fixed inset-0 z-50 flex items-start justify-center bg-ink/25 backdrop-blur-[6px] px-4 pt-[12vh]"
      onClick={closePalette}
    >
      <div
        className="glass modal-pop-enter w-full max-w-md overflow-hidden rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hairline px-3.5 py-2.5">
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a tab or run an action…"
            className="w-full bg-transparent text-[14px] text-ink placeholder:text-muted outline-none"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-2.5 py-3 text-[13px] text-muted">No matching commands.</p>
          )}
          {filtered.map((command, index) => (
            <button
              key={command.label}
              type="button"
              onClick={() => runCommand(command)}
              onMouseEnter={() => setHighlighted(index)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] ${
                index === highlighted ? 'bg-signal-soft text-signal' : 'text-ink hover:bg-paper'
              }`}
            >
              {command.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
