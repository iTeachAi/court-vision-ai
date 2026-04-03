import { useEffect, useState } from "react";
import type { TimelineEvent } from "@/lib/api";
import { MessageSquare } from "lucide-react";

interface CoachFeedbackProps {
  currentEvent: TimelineEvent | null;
}

const decisionColor: Record<string, string> = {
  drive: "text-primary bg-primary/10 border-primary/20",
  retreat: "text-destructive bg-destructive/10 border-destructive/20",
  stall: "text-warning bg-warning/10 border-warning/20",
};

const CoachFeedback = ({ currentEvent }: CoachFeedbackProps) => {
  const [visible, setVisible] = useState(false);
  const [displayEvent, setDisplayEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    if (currentEvent) {
      setVisible(false);
      const t = setTimeout(() => {
        setDisplayEvent(currentEvent);
        setVisible(true);
      }, 150);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [currentEvent]);

  if (!displayEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <MessageSquare className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">
          Play the video or click a timeline event to see coaching feedback
        </p>
      </div>
    );
  }

  const colorClass = decisionColor[displayEvent.event] || decisionColor.stall;

  return (
    <div className={`px-6 py-8 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${colorClass}`}>
          {displayEvent.event}
        </span>
        <span className="text-xs text-muted-foreground">{displayEvent.time.toFixed(1)}s</span>
      </div>
      <h3 className="text-2xl font-bold text-foreground capitalize mb-3">{displayEvent.event}</h3>
      <p className="text-base leading-relaxed text-secondary-foreground">{displayEvent.feedback}</p>
    </div>
  );
};

export default CoachFeedback;
