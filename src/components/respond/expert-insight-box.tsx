import { Lightbulb } from "lucide-react";

interface ExpertInsightBoxProps {
  title?: string;
  children: React.ReactNode;
}

export function ExpertInsightBox({
  title = "Expert Insight",
  children,
}: ExpertInsightBoxProps) {
  return (
    <div
      className="p-8 rounded-xl border-l-4"
      style={{
        backgroundColor: "var(--expert-lavender)",
        borderLeftColor: "var(--expert-tertiary)",
      }}
    >
      <div className="flex gap-4">
        <Lightbulb
          className="h-5 w-5 shrink-0 mt-0.5"
          style={{ color: "var(--expert-tertiary)" }}
        />
        <div className="space-y-2">
          <h4
            className="font-headline font-bold"
            style={{ color: "var(--expert-tertiary)" }}
          >
            {title}
          </h4>
          <div
            className="text-sm leading-relaxed"
            style={{ color: "var(--expert-on-surface-variant)" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
