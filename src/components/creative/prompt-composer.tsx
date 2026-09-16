"use client";

import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "Promote the Associate Project Manager Apprenticeship to employers in England. The objective is lead generation.",
  "Announce our new London office with a launch event for prospective clients.",
  "Encourage existing customers to upgrade to the annual plan before it expires.",
];

export function PromptComposer({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Promote the Associate Project Manager Apprenticeship to employers in England. The objective is lead generation."
        className="min-h-36 resize-none text-base leading-relaxed md:text-lg"
        autoFocus
      />
      <div className="flex flex-wrap gap-2">
        <span className="pt-1 text-xs text-muted-foreground">Try:</span>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled}
            onClick={() => onChange(example)}
            className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:pointer-events-none"
          >
            {example.length > 60 ? `${example.slice(0, 60)}…` : example}
          </button>
        ))}
      </div>
    </div>
  );
}
