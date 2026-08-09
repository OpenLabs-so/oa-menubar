import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function LoginScreen({
  error,
  onSignIn,
}: {
  error: string | null;
  onSignIn: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
      <Logo className="size-11 text-primary" />
      <h1 className="mt-1 text-base font-medium">Open Analytics</h1>
      <p className="text-xs text-muted-foreground">
        Your live visitors, one glance away.
      </p>
      <Button className="mt-2 min-w-28" onClick={onSignIn}>
        Sign in
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
