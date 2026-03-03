import React from "react";

export function MediaCardSkeleton({ count = 12 }) {
  return Array.from({ length: count }, (_, index) => (
    <div key={`media-skeleton-${index}`} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", background: "rgba(13,17,27,0.9)", overflow: "hidden" }}>
      <div className="ui-skeleton" style={{ width: "100%", aspectRatio: "2 / 3" }} />
      <div style={{ padding: "10px 12px" }}>
        <div className="ui-skeleton" style={{ height: "14px", borderRadius: "6px", marginBottom: "8px" }} />
        <div className="ui-skeleton" style={{ height: "12px", width: "70%", borderRadius: "6px" }} />
      </div>
    </div>
  ));
}

export function EpisodeRowSkeleton({ count = 4 }) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      {Array.from({ length: count }, (_, index) => (
        <div key={`episode-skeleton-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 180px) 1fr auto", gap: "10px", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(34,42,60,0.6)" }}>
          <div className="ui-skeleton" style={{ minHeight: "92px" }} />
          <div style={{ padding: "10px 4px" }}>
            <div className="ui-skeleton" style={{ height: "16px", width: "50%", borderRadius: "6px", marginBottom: "8px" }} />
            <div className="ui-skeleton" style={{ height: "12px", width: "92%", borderRadius: "6px", marginBottom: "6px" }} />
            <div className="ui-skeleton" style={{ height: "12px", width: "80%", borderRadius: "6px" }} />
          </div>
          <div style={{ display: "grid", placeItems: "center", padding: "10px" }}>
            <div className="ui-skeleton" style={{ width: "72px", height: "36px", borderRadius: "10px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailHeaderSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px", padding: "18px" }}>
      <div className="ui-skeleton" style={{ width: "100%", borderRadius: "14px", aspectRatio: "2 / 3" }} />
      <div>
        <div className="ui-skeleton" style={{ width: "65%", height: "24px", borderRadius: "8px", marginBottom: "10px" }} />
        <div className="ui-skeleton" style={{ width: "42%", height: "14px", borderRadius: "6px", marginBottom: "14px" }} />
        <div className="ui-skeleton" style={{ width: "100%", height: "12px", borderRadius: "6px", marginBottom: "8px" }} />
        <div className="ui-skeleton" style={{ width: "90%", height: "12px", borderRadius: "6px", marginBottom: "8px" }} />
        <div className="ui-skeleton" style={{ width: "76%", height: "12px", borderRadius: "6px" }} />
      </div>
    </div>
  );
}
