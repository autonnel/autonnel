import { cn } from "@/lib/utils";
import { FadeContent, ShinyText } from "./animations";
import { Skeleton } from "./Skeleton";

type SpinnerSize = "sm" | "md" | "lg" | "xl";
type SpinnerColor = "primary" | "white" | "slate";

interface LoaderProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}

const SPINNER_SIZE: Record<SpinnerSize, string> = {
  sm: "w-4 h-4 border-2",
  md: "w-6 h-6 border-2",
  lg: "w-8 h-8 border-2",
  xl: "w-12 h-12 border-3",
};

const SPINNER_COLOR: Record<SpinnerColor, string> = {
  primary: "border-primary border-t-transparent",
  white: "border-foreground border-t-transparent",
  slate: "border-muted-foreground border-t-transparent",
};

const DOT_SIZE: Record<SpinnerSize, string> = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-3 h-3",
  xl: "w-4 h-4",
};

const DOT_BG: Record<SpinnerColor, string> = {
  primary: "bg-primary",
  white: "bg-foreground",
  slate: "bg-muted-foreground",
};

function LoadingSpinner({
  size = "md",
  color = "primary",
  className = "",
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-autonnel-loader="spinner"
      className={cn(
        "animate-spin rounded-full",
        SPINNER_SIZE[size],
        SPINNER_COLOR[color],
        className,
      )}
    />
  );
}

const DOT_INDICES = [0, 1, 2] as const;

function renderDots(
  size: SpinnerSize,
  color: SpinnerColor,
  motionClass: string,
  delayStep: number,
) {
  return DOT_INDICES.map((index) => (
    <div
      key={index}
      data-autonnel-loader-dot={index}
      className={cn("rounded-full", motionClass, DOT_SIZE[size], DOT_BG[color])}
      style={{ animationDelay: `${index * delayStep}s` }}
    />
  ));
}

export function PulseLoader({
  size = "md",
  color = "primary",
  className = "",
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-autonnel-loader="pulse"
      className={cn("flex items-center gap-1.5", className)}
    >
      {renderDots(size, color, "animate-bounce", 0.15)}
    </div>
  );
}

export function DotsLoader({
  size = "md",
  color = "primary",
  className = "",
}: LoaderProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      data-autonnel-loader="dots"
      className={cn("flex items-center gap-1.5", className)}
    >
      {renderDots(size, color, "animate-pulse", 0.2)}
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <FadeContent
      direction="up"
      duration={0.4}
      className="flex flex-col items-center justify-center py-20"
      data-autonnel-loader="overlay"
    >
      <LoadingSpinner size="lg" />
      <div className="mt-4">
        <ShinyText
          text={message}
          className="text-muted-foreground text-base font-medium"
        />
      </div>
    </FadeContent>
  );
}

export default LoadingSpinner;
export { Skeleton };
