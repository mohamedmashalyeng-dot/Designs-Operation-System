"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction, type AuthActionResult } from "@/lib/actions/auth";

const initialState: AuthActionResult = {};

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);

  if (state.needsEmailConfirmation) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-5 text-emerald-600" />
        </div>
        <div className="space-y-1">
          <h1 className="font-heading text-2xl text-kbc-purple dark:text-kbc-purple-bright">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a confirmation link — click it to activate your workspace and sign in.
          </p>
        </div>
        <Link href="/login" className="text-sm font-medium underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-2xl text-kbc-purple dark:text-kbc-purple-bright">Create your workspace</h1>
        <p className="text-sm text-muted-foreground">Start turning ideas into campaigns</p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required placeholder="Jordan Smith" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="organisationName">Workspace name</Label>
          <Input id="organisationName" name="organisationName" placeholder="Acme Marketing" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Create workspace
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
