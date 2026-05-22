"use client";

import { useState, useEffect, useRef } from "react";

export type ShareModalProps = {
  mode: "weekly" | "achievement";
  jobId?: string;
  subjectId?: string;
  week?: number;
  subjectName?: string;
  subjectCode?: string;
  onClose: () => void;
};

export default function ShareModal({
  mode, jobId, subjectId, week, subjectName, subjectCode, onClose
}: ShareModalProps) {
  const [generating, setGenerating] = useState(true);
  const [shareId, setShareId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [storyImageUrl, setStoryImageUrl] = useState<string | null>(null);
  const [storyReady, setStoryReady] = useState(false);
  const [error, setError] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  const [format, setFormat] = useState<"square" | "story">("square");
  const deletedRef = useRef(false);
  const isExam = mode === "achievement";
  const accent = isExam ? "#fbbf24" : "#a5b4fc";

  useEffect(() => { generateCard(); }, []);

  // Delete card 60 seconds after download
  useEffect(() => {
    if (downloaded && shareId && !deletedRef.current) {
      const t = setTimeout(() => {
        deletedRef.current = true;
        fetch("/api/share/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ share_id: shareId }),
        }).catch(() => {});
      }, 60000);
      return () => clearTimeout(t);
    }
  }, [downloaded, shareId]);

  async function generateCard() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/share/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, job_id: jobId, subject_id: subjectId,
          week, subject_name: subjectName || "", subject_code: subjectCode || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShareId(data.share_id);
      setImageUrl(data.image_url);
      // Poll for story in background
      const storyUrl = data.story_image_url;
      if (storyUrl) {
        setStoryImageUrl(storyUrl);
        // Try loading the image directly — set ready when it loads
        let attempts = 0;
        const tryLoad = () => {
          attempts++;
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => setStoryReady(true);
          img.onerror = () => {
            if (attempts < 15) setTimeout(tryLoad, 2000);
          };
          img.src = storyUrl + "?t=" + Date.now(); // bust cache
        };
        setTimeout(tryLoad, 2000); // give VPS 2s head start
        // Force enable after 12s regardless — backend may be done
        setTimeout(() => setStoryReady(true), 12000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate card");
    }
    setGenerating(false);
  }

  async function download(format: "square" | "story") {
    const url = format === "story" && storyReady && storyImageUrl ? storyImageUrl : imageUrl;
    if (!url) return;
    // Extract Spaces key from URL and use our proxy to force download
    const key = url.split("studypack-storage.syd1.digitaloceanspaces.com/")[1];
    const filename = `StudyPack_${isExam ? "ExamPack" : "Week" + week}_${format}.png`;
    const proxyUrl = `/api/share/download?key=${encodeURIComponent(key)}&filename=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloaded(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#08080f] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: accent }}>
              {isExam ? "🏆 Share the Moment" : `🔥 Week ${week} Complete`}
            </div>
            <div className="text-sm font-black text-white">
              {isExam ? "Your exam pack is ready!" : "Your study pack is ready!"}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-2xl leading-none ml-4 transition">×</button>
        </div>

        {/* Loading state */}
        {(generating || error) && (
          <div className="flex items-center justify-center py-20">
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-indigo-400 animate-spin" />
                <div className="text-sm text-white/40">Generating your card…</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-red-400 text-sm mb-2">{error}</div>
                <button onClick={generateCard} className="text-xs text-indigo-400 underline">Try again</button>
              </div>
            )}
          </div>
        )}

        {/* Main content — two column */}
        {!generating && !error && imageUrl && (
          <div className="flex overflow-hidden" style={{ minHeight: "480px" }}>

            {/* LEFT — large card preview */}
            <div className="flex-1 flex items-center justify-center bg-[#040408] p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={format === "story" && storyReady && storyImageUrl ? storyImageUrl : (imageUrl || "")}
                alt="Share card"
                className="rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)]"
                style={{
                  maxHeight: "420px",
                  maxWidth: "100%",
                  width: format === "story" ? "auto" : "420px",
                  height: format === "story" ? "420px" : "auto",
                  aspectRatio: format === "story" ? "9/16" : "1/1",
                  objectFit: "cover",
                  transition: "all 0.4s ease",
                }}
              />
            </div>

            {/* RIGHT — controls */}
            <div className="w-64 shrink-0 border-l border-white/8 flex flex-col p-6 gap-6">

              {/* Perfect for */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-3">Perfect for</div>
                <div className="flex flex-col gap-2">
                  {(format === "square"
                    ? ["Instagram Feed", "Twitter / X", "Facebook", "WhatsApp"]
                    : ["TikTok", "Instagram Reels", "Instagram Stories", "Snapchat", "YouTube Shorts"]
                  ).map(p => (
                    <div key={p} className="flex items-center gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                      <span className="text-sm text-white/60 font-medium">{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format toggle */}
              <div>
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-3">Format</div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setFormat("square")}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition border ${format === "square" ? "bg-white/15 text-white border-white/20" : "text-white/40 border-white/8 hover:bg-white/5"}`}>
                    ◻ Square  <span className="text-xs opacity-50 ml-1">1:1</span>
                  </button>
                  <button onClick={() => setFormat("story")}
                    disabled={!storyReady}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition border ${format === "story" ? "bg-white/15 text-white border-white/20" : "text-white/40 border-white/8 hover:bg-white/5"} ${!storyReady ? "opacity-40 cursor-wait" : ""}`}>
                    {storyReady ? <>▯ Story  <span className="text-xs opacity-50 ml-1">9:16</span></> : "▯ Story  (preparing…)"}
                  </button>
                </div>
              </div>

              {/* Download */}
              <div className="mt-auto">
                <button onClick={() => download(format)}
                  disabled={format === "story" && !storyReady}
                  className="w-full rounded-xl py-4 text-base font-black transition hover:opacity-90 active:scale-95 disabled:opacity-40"
                  style={{ background: accent, color: accent === "#fbbf24" ? "#000" : "#fff" }}>
                  ⬇ Download
                </button>
                {downloaded && (
                  <div className="text-center text-[11px] text-emerald-400 font-bold mt-3">
                    ✓ Saved — post it anywhere!
                  </div>
                )}
                <p className="text-[9px] text-white/18 text-center mt-2 leading-relaxed">
                  Download and post to Instagram,<br/>TikTok, WhatsApp or anywhere
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
