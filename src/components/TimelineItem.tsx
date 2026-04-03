import type { TimelineEvent } from "@/lib/api";

const eventDot: Record<string, string> = {
  drive: "bg-primary",
  retreat: "bg-destructive",
  stall: "bg-warning",
};

interface TimelineItemProps {
  event: TimelineEvent;
  isActive: boolean;
  index: number;
  onSeek: (time: number) => void;
}

const TimelineItem = ({ event, isActive, index, onSeek }: TimelineItemProps) => (
  <button
    onClick={() => onSeek(event.time)}
    className={`
      w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200
      ${isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary border border-transparent"}
    `}
    style={{ animationDelay: `${index * 0.05}s` }}
  >
    <div className="flex items-center gap-3">
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${eventDot[event.event] || "bg-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground capitalize">{event.event}</span>
          <span className="text-xs text-muted-foreground font-mono">{event.time.toFixed(1)}s</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.feedback}</p>
      </div>
    </div>
  </button>
);

export default TimelineItem;
