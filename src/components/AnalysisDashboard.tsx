import { useRef, useState, useCallback } from "react";
import { Clock, Zap, Activity } from "lucide-react";
import type { AnalysisResult, TimelineEvent } from "@/lib/api";
import VideoPlayer from "./VideoPlayer";
import TimelineBar from "./TimelineBar";
import TimelineItem from "./TimelineItem";
import CoachFeedback from "./CoachFeedback";

interface AnalysisDashboardProps {
  data: AnalysisResult;
  videoUrl: string;
}

const AnalysisDashboard = ({ data, videoUrl }: AnalysisDashboardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeEvent, setActiveEvent] = useState<TimelineEvent | null>(null);

  const findCurrentEvent = useCallback(
    (time: number) => {
      let closest: TimelineEvent | null = null;
      let minDist = Infinity;
      for (const ev of data.timeline) {
        const dist = Math.abs(ev.time - time);
        if (dist < 1.5 && dist < minDist) {
          minDist = dist;
          closest = ev;
        }
      }
      return closest;
    },
    [data.timeline]
  );

  const handleTimeUpdate = useCallback(
    (time: number) => {
      setCurrentTime(time);
      setActiveEvent(findCurrentEvent(time));
    },
    [findCurrentEvent]
  );

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setActiveEvent(findCurrentEvent(time));
    }
  };

  const stats = [
    { icon: Zap, label: "Events", value: data.timeline.length },
    { icon: Clock, label: "Duration", value: `${data.duration.toFixed(1)}s` },
    { icon: Activity, label: "Drives", value: data.timeline.filter((e) => e.event === "drive").length },
  ];

  return (
    <section className="min-h-screen bg-background px-4 md:px-8 py-8 animate-fade-in">
      <div className="max-w-7xl mx-auto mb-6 flex items-center gap-6">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-2 glass rounded-xl px-4 py-2.5">
            <s.icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{s.value}</span>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="flex flex-col gap-4">
          <VideoPlayer
            ref={videoRef}
            videoUrl={videoUrl}
            currentTime={currentTime}
            duration={data.duration}
            activeEvent={activeEvent}
            onTimeUpdate={handleTimeUpdate}
          />
          <div className="glass rounded-2xl px-4 py-2">
            <TimelineBar
              events={data.timeline}
              duration={data.duration}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="glass rounded-2xl min-h-[200px]">
            <div className="px-6 pt-5 pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Coach Feedback
              </h2>
            </div>
            <CoachFeedback currentEvent={activeEvent} />
          </div>

          <div className="glass rounded-2xl flex-1 overflow-hidden">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Timeline Events
              </h2>
            </div>
            <div className="px-3 pb-3 space-y-1 max-h-[400px] overflow-y-auto">
              {data.timeline.map((event, i) => (
                <TimelineItem
                  key={i}
                  event={event}
                  isActive={activeEvent?.time === event.time}
                  index={i}
                  onSeek={seekTo}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisDashboard;
