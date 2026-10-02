import { LogoMark } from "@/components/ui/logo";

// Shown for the instant while we find out whether someone is signed in, and while a redirect happens.
// A calm pulse instead of a blank page or a flash of content they should not see.
export function AuthLoadingScreen({ label = "Getting things ready" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-[0.6rem] bg-brand-500/25 [animation-duration:1.8s]" />
          <LogoMark className="relative size-12 animate-pop" />
        </div>
        <p className="animate-fade-in text-sm font-medium text-muted [animation-delay:300ms]">{label}…</p>
      </div>
    </div>
  );
}
