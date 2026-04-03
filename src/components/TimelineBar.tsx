import { useState } from "react";
import type { TimelineEvent } from "@/lib/api";

interface TimelineBarProps {
  events: TimelineEvent[];
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

const eventColor: Record<string, string> = {
  drive: "bg-primary",
  retreat: "bg-destructive",
  stall: "bg-warning",
};

const eventGlow: Record<string, string> = {
  drive: "shadow-[0_0_8px_hsla(142,72%,50%,0.5)]",
  retreat: "shadow-[0_0_8px_hsla(0,72%,55%,0.5)]",
  stall: "shadow-[0_0_8px_hsla(38,92%,55%,0.5)]",
};

const TimelineBar = ({ events, duration, currentTime, onSeek }: TimelineBarProps) => {
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-full px-2 py-4">
      <div
        className="relative h-2 rounded-full bg-secondary cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          onSeek(x * duration);
        }}
      >
        <div
          className="absolute h-full rounded-full bg-primary/30 transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />

        {events.map((event, i) => {
          const left = (event.time / duration) * 100;
          return (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full cursor-pointer transition-all duration-200 hover:scale-150 ${eventColor[event.event] || "bg-muted-foreground"} ${eventGlow[event.event] || ""}`}
              style={{ left: `${left}%`, transform: "translate(-50%, -50%)" }}
              onMouseEnter={() => setHoveredEvent(event)}
              onMouseLeave={() => setHoveredEvent(null)}
              onClick={(e) => { e.stopPropagation(); onSeek(event.time); }}
            />
          );
        })}

        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-foreground border-2 border-background shadow-lg transition-all duration-150"
          style={{ left: `${progressPercent}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>

      {hoveredEvent && (
        <div
          className="absolute bottom-full mb-3 glass-strong rounded-xl px-4 py-3 text-sm max-w-xs pointer-events-none animate-scale-in z-50"
          style={{ left: `${(hoveredEvent.time / duration) * 100}%`, transform: "translateX(-50%)" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${eventColor[hoveredEvent.event] || "bg-muted-foreground"}`} />
            <span className="font-semibold capitalize text-foreground">{hoveredEvent.event}</span>
            <span className="text-muted-foreground">@ {hoveredEvent.time.toFixed(1)}s</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">{hoveredEvent.feedback}</p>
        </div>
      )}
    </div>
  );
};

export default TimelineBar;
