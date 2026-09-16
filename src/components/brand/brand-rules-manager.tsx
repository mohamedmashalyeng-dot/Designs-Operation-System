"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { addBrandRuleAction, deleteBrandRuleAction, toggleBrandRuleAction } from "@/lib/actions/brand";
import type { Tables } from "@/types/database";

export function BrandRulesManager({ brandId, rules }: { brandId: string; rules: Tables<"brand_rules">[] }) {
  const [newRule, setNewRule] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    if (!newRule.trim()) return;
    startTransition(async () => {
      const result = await addBrandRuleAction({ brandId, ruleText: newRule.trim() });
      if (result?.error) toast.error(result.error);
      else setNewRule("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newRule}
          onChange={(e) => setNewRule(e.target.value)}
          placeholder="e.g. Avoid generic stock photography"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={pending || !newRule.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} />
        ))}
        {rules.length === 0 && <li className="p-4 text-sm text-muted-foreground">No rules yet.</li>}
      </ul>
    </div>
  );
}

function RuleRow({ rule }: { rule: Tables<"brand_rules"> }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-3 p-3">
      <Switch
        checked={rule.is_active}
        onCheckedChange={(checked) => startTransition(async () => { await toggleBrandRuleAction(rule.id, checked); })}
        disabled={pending}
      />
      <span className={`flex-1 text-sm ${rule.is_active ? "" : "text-muted-foreground line-through"}`}>{rule.rule_text}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => startTransition(async () => { await deleteBrandRuleAction(rule.id); })}
        disabled={pending}
        aria-label="Delete rule"
      >
        <Trash2 />
      </Button>
    </li>
  );
}
