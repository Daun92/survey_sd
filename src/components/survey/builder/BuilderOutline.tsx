"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BuilderOutlineItem } from "./BuilderOutlineItem";
import type { BuilderQuestion } from "./types";

interface BuilderOutlineProps {
  questions: BuilderQuestion[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onReorder: (next: BuilderQuestion[]) => void;
}

interface Group {
  key: string;
  label: string;
  items: { question: BuilderQuestion; index: number }[];
}

function groupByCategory(questions: BuilderQuestion[]): Group[] {
  const map = new Map<string, Group>();
  questions.forEach((q, index) => {
    const key = q.category ?? "__none__";
    const label = q.category ?? "(카테고리 없음)";
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key)!.items.push({ question: q, index });
  });
  return Array.from(map.values());
}

export function BuilderOutline({
  questions,
  selectedId,
  onSelect,
  onReorder,
}: BuilderOutlineProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({
      ...q,
      questionOrder: (i + 1) * 10,
    }));
    onReorder(reordered);
  };

  const groups = groupByCategory(questions);
  const itemIds = questions.map((q) => q.id);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-3 py-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          문항 목록
        </h3>
        <span className="text-xs text-muted-foreground">{questions.length}</span>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {questions.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            문항이 없습니다.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {groups.map((group) => (
                <div key={group.key} className="mb-3">
                  <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map(({ question, index }) => (
                      <BuilderOutlineItem
                        key={question.id}
                        question={question}
                        index={index}
                        isSelected={selectedId === question.id}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </aside>
  );
}
