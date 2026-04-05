export interface TimelineEvent {
  time: number;
  event: string;
  feedback: string;
}

export interface AnalysisResult {
  timeline: TimelineEvent[];
  video_url: string;
  duration: number;
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  window.location.origin;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getVideoUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchVideoBlob(path: string): Promise<string> {
  // Wait 5 seconds for the backend to finish writing the file
  await delay(5000);

  const res = await fetch(getVideoUrl(path), {
    headers: { "ngrok-skip-browser-warning": "true" },
  });
  if (!res.ok) throw new Error("Failed to load video");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function analyzeVideo(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(getVideoUrl("/analyze"), {
    method: "POST",
    body: formData,
    headers: { "ngrok-skip-browser-warning": "true" },
  });

  if (!response.ok) {
    throw new Error(`Analysis failed: ${response.statusText}`);
  }

  return response.json();
}
