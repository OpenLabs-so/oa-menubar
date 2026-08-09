import { BrandLoader } from "@/components/brand";

export function CodeScreen({ userCode }: { userCode: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
      <BrandLoader className="size-11 text-primary" label="Waiting for approval" />
      <p className="mt-1 text-xs text-muted-foreground">
        Confirm this code in your browser
      </p>
      <p className="rounded-[14px] border border-border bg-background px-4 py-2.5 font-mono text-[26px] font-medium tracking-[0.18em]">
        {userCode}
      </p>
      <p className="text-xs text-muted-foreground">
        The approval page opened in your browser.
      </p>
    </div>
  );
}
