import { useState } from 'react'
import { ChevronDown, ListChecks } from 'lucide-react'
import EmptyState from '../shared/EmptyState'
import SkeletonBlock from '../shared/SkeletonBlock'
import AIThinking from "../shared/AIThinking";

function ConfidenceDot({ confidence }) {
  const isConfirmed = confidence === 'confirmed'

  return (
    <span
      title={
        isConfirmed
          ? 'AI is confident this scenario applies'
          : 'Exploratory suggestion'
      }
      className={`h-2 w-2 shrink-0 rounded-full border ${
        isConfirmed
          ? 'border-verified bg-verified'
          : 'border-ochre bg-transparent'
      }`}
    />
  )
}

function ChecklistGroup({ group, checkedItems, onToggleItem }) {
  const [isOpen, setIsOpen] = useState(true)

  const items = group.items ?? []

  return (
    <div className="rounded-lg border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-[14px] font-semibold text-ink">
          {group.module}
        </span>

        <span className="flex items-center gap-2 text-[12px] text-muted">
          {items.length} items

          <ChevronDown
            size={15}
            className={`transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </span>
      </button>

      {isOpen && (
        <ul className="border-t border-hairline">
          {items.map((item) => (
            <li
              key={`${group.module}-${item.id}`}
              className="flex items-start gap-3 px-4 py-2.5 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hairline"
            >
              <input
                type="checkbox"
                checked={Boolean(checkedItems[item.id])}
                onChange={() => onToggleItem(item.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-signal"
              />

              <span
                className={`flex-1 text-[14px] ${
                  checkedItems[item.id]
                    ? 'text-muted line-through'
                    : 'text-ink'
                }`}
              >
                {item.text}
              </span>

              <ConfidenceDot confidence={item.confidence} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ChecklistTab({
  checklist,
  isLoading,
  checkedItems,
  onToggleItem,
}) {


  if (!checklist || checklist.length === 0) {
    return (
      <div className="p-3.5 sm:p-5">
        <EmptyState
          icon={<ListChecks size={22} />}
          title="No checklist yet"
          description="Analyze a workflow above to generate an exploratory testing checklist grouped by module."
        />
      </div>
    )
  }

  return (
    <div className="p-3.5 sm:p-5">
      <p className="mb-3 text-[12px] text-muted">
        Execution progress is stored only for the current session.
        It will reset if you refresh the page or run a new analysis.
      </p>

      <div className="flex flex-col gap-3">
        {checklist.map((group) => (
          <ChecklistGroup
            key={group.module}
            group={group}
            checkedItems={checkedItems}
            onToggleItem={onToggleItem}
          />
        ))}
      </div>
    </div>
  )
}