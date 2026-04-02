import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Clock, Zap, Activity } from "lucide-react";
import type { AnalysisResult, TimelineEvent } from "./UploadZone";
import TimelineBar from "./TimelineBar";
import CoachFeedback from "./CoachFeedback";

interface AnalysisDashboardProps {
  data: AnalysisResult;
  videoUrl: string;
}

const decisionDot = {
  good: "bg-primary",
  bad: "bg-destructive",
  neutral: "bg-warning",
};

const AnalysisDashboard = ({ data, videoUrl }: AnalysisDashboardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      setCurrentTime(video.currentTime);
      setActiveEvent(findCurrentEvent(video.currentTime));
    };
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [findCurrentEvent]);

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setActiveEvent(findCurrentEvent(time));
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) videoRef.current.pause();
    else videoRef.current.play();
    setPlaying(!playing);
  };

  const restart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play();
    setPlaying(true);
  };

  const stats = [
    { icon: Zap, label: "Events", value: data.total_events },
    { icon: Clock, label: "Duration", value: `${data.duration}s` },
    { icon: Activity, label: "Good Plays", value: data.timeline.filter((e) => e.decision === "good").length },
  ];

  return (
    <section className="min-h-screen bg-background px-4 md:px-8 py-8 animate-fade-in">
      {/* Stats bar */}
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
        {/* Left: Video + Timeline */}
        <div className="flex flex-col gap-4">
          {/* Video */}
          <div className="relative rounded-2xl overflow-hidden glass">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full aspect-video bg-background/80"
              onEnded={() => setPlaying(false)}
            />

            {/* Overlay on active event */}
            {activeEvent && (
              <div className="absolute top-4 left-4 glass-strong rounded-xl px-4 py-2 flex items-center gap-2 animate-scale-in">
                <span className={`w-2 h-2 rounded-full ${decisionDot[activeEvent.decision]}`} />
                <span className="text-sm font-medium text-foreground capitalize">{activeEvent.event}</span>
              </div>
            )}

            {/* Controls */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors">
                  {playing ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                </button>
                <button onClick={restart} className="w-10 h-10 rounded-full bg-secondary hover:bg-accent flex items-center justify-center transition-colors">
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm text-muted-foreground ml-2 font-mono">
                  {currentTime.toFixed(1)}s / {data.duration}s
                </span>
              </div>
            </div>
          </div>

          {/* Timeline bar */}
          <div className="glass rounded-2xl px-4 py-2">
            <TimelineBar
              events={data.timeline}
              duration={data.duration}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          </div>
        </div>

        {/* Right: Event list + Feedback */}
        <div className="flex flex-col gap-4">
          {/* Coach feedback */}
          <div className="glass rounded-2xl min-h-[200px]">
            <div className="px-6 pt-5 pb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Coach Feedback
              </h2>
            </div>
            <CoachFeedback currentEvent={activeEvent} />
          </div>

          {/* Event list */}
          <div className="glass rounded-2xl flex-1 overflow-hidden">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Timeline Events
              </h2>
            </div>
            <div className="px-3 pb-3 space-y-1 max-h-[400px] overflow-y-auto">
              {data.timeline.map((event, i) => {
                const isActive = activeEvent?.time === event.time;
                return (
                  <button
                    key={i}
                    onClick={() => seekTo(event.time)}
                    className={`
                      w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200
                      ${isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary border border-transparent"}
                    `}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${decisionDot[event.decision]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground capitalize">
                            {event.event}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {event.time.toFixed(1)}s
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {event.feedback}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AnalysisDashboard;
