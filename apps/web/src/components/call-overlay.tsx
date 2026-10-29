import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, AlertCircle } from "lucide-react";
import type { CallState } from "../hooks/use-webrtc-call";
import "./call-overlay.css";

interface CallOverlayProps {
  state: CallState;
  peerName: string;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function getEndReasonText(reason: CallState["endReason"]): string {
  switch (reason) {
    case "DECLINED":
      return "Cuộc gọi bị từ chối";
    case "BUSY":
      return "Đối phương đang bận cuộc gọi khác";
    case "MISSED":
      return "Đối phương không trả lời";
    case "TIMEOUT":
      return "Cuộc gọi đã hết thời gian tối đa";
    case "DISCONNECTED":
      return "Mất kết nối";
    case "ERROR":
      return "Lỗi kết nối cuộc gọi";
    case "ENDED":
    default:
      return "Cuộc gọi đã kết thúc";
  }
}

export function CallOverlay({
  state,
  peerName,
  onAccept,
  onDecline,
  onEnd,
  onToggleMic,
  onToggleCamera
}: CallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Attach local stream to video
  useEffect(() => {
    if (localVideoRef.current && state.localStream) {
      localVideoRef.current.srcObject = state.localStream;
    }
  }, [state.localStream]);

  // Attach remote stream to video & audio
  useEffect(() => {
    if (remoteVideoRef.current && state.remoteStream) {
      remoteVideoRef.current.srcObject = state.remoteStream;
    }
    if (remoteAudioRef.current && state.remoteStream) {
      remoteAudioRef.current.srcObject = state.remoteStream;
    }
  }, [state.remoteStream]);

  // Ringtone synthesizer using Web Audio API for ringing/calling states
  useEffect(() => {
    if (state.status !== "CALLING" && state.status !== "RINGING") return;

    let audioCtx: AudioContext | null = null;
    let timer: number | null = null;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextClass();

      const playTone = () => {
        if (!audioCtx || audioCtx.state === "closed") return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        // 440Hz / 480Hz US ring tone or 425Hz European tone
        osc.frequency.setValueAtTime(state.status === "RINGING" ? 440 : 425, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
      };

      playTone();
      timer = window.setInterval(playTone, state.status === "RINGING" ? 2500 : 3500);
    } catch {
      // AudioContext might be blocked until user gesture, safe to ignore
    }

    return () => {
      if (timer !== null) window.clearInterval(timer);
      if (audioCtx && audioCtx.state !== "closed") {
        void audioCtx.close();
      }
    };
  }, [state.status]);

  if (state.status === "IDLE") return null;

  const isVideo = state.callType === "VIDEO";

  return (
    <div className={`call-overlay-backdrop call-overlay--${state.status.toLowerCase()}`}>
      {/* Hidden remote audio element ensuring sound playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="call-overlay-modal">
        {/* Header / Info bar */}
        <div className="call-header">
          <div className="call-header-badge">
            <span className="call-pulse-dot" />
            {state.status === "CONNECTED"
              ? isVideo ? "Cuộc gọi video" : "Cuộc gọi thoại"
              : state.status === "CALLING"
                ? "Đang gọi đi..."
                : state.status === "RINGING"
                  ? "Cuộc gọi đến..."
                  : "Kết thúc"}
          </div>
          {state.status === "CONNECTED" && (
            <div className="call-duration-badge">
              {formatDuration(state.duration)}
            </div>
          )}
        </div>

        {/* Error notification if any */}
        {state.error && (
          <div className="call-error-banner">
            <AlertCircle size={16} />
            <span>{state.error}</span>
          </div>
        )}

        {/* Content body based on call state */}
        <div className="call-body">
          {/* 1. OUTGOING CALL (CALLING) */}
          {state.status === "CALLING" && (
            isVideo ? (
              <div className="call-preview-stage">
                <video
                  ref={localVideoRef}
                  className="call-preview-video"
                  autoPlay
                  playsInline
                  muted
                />
                <div className="call-preview-badge">
                  <span className="call-pulse-dot" />
                  <span>Đang kết nối camera...</span>
                </div>
                <div className="call-preview-peer-card">
                  <div className="call-avatar mini">
                    {peerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="call-peer-name">{peerName}</h4>
                    <p className="call-preview-ring-text">Đang đổ chuông...</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="call-status-view">
                <div className="call-avatar-container">
                  <div className="call-pulse-ring" />
                  <div className="call-pulse-ring delay-1" />
                  <div className="call-avatar">
                    {peerName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <h3 className="call-peer-name">{peerName}</h3>
                <p className="call-status-text">Đang đổ chuông...</p>
              </div>
            )
          )}

          {/* 2. INCOMING CALL (RINGING) */}
          {state.status === "RINGING" && (
            <div className="call-status-view">
              <div className="call-avatar-container ringing">
                <div className="call-pulse-ring pulse-green" />
                <div className="call-pulse-ring pulse-green delay-1" />
                <div className="call-avatar ring-avatar">
                  {peerName.charAt(0).toUpperCase()}
                </div>
              </div>
              <h3 className="call-peer-name">{peerName}</h3>
              <p className="call-status-text">
                {isVideo ? "Đang gọi video cho bạn..." : "Đang gọi thoại cho bạn..."}
              </p>
            </div>
          )}

          {/* 3. CONNECTED CALL */}
          {state.status === "CONNECTED" && (
            <div className="call-connected-view">
              {isVideo ? (
                <div className="call-video-stage">
                  {/* Remote video */}
                  {state.isRemoteCameraOff ? (
                    <div className="call-video-placeholder">
                      <div className="call-avatar large">
                        {peerName.charAt(0).toUpperCase()}
                      </div>
                      <p className="call-placeholder-text">Camera của đối phương đang tắt</p>
                    </div>
                  ) : (
                    <video
                      ref={remoteVideoRef}
                      className="call-remote-video"
                      autoPlay
                      playsInline
                    />
                  )}

                  {/* Local video PiP */}
                  <div className={`call-local-pip ${state.isCameraOff ? "camera-off" : ""}`}>
                    {state.isCameraOff ? (
                      <div className="call-pip-placeholder">
                        <VideoOff size={16} />
                      </div>
                    ) : (
                      <video
                        ref={localVideoRef}
                        className="call-local-video"
                        autoPlay
                        playsInline
                        muted
                      />
                    )}
                    <span className="call-pip-label">Bạn</span>
                  </div>

                  {/* Remote mic status badge */}
                  {state.isRemoteMicMuted && (
                    <div className="call-remote-muted-badge">
                      <MicOff size={14} />
                      <span>Đối phương tắt mic</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Voice call layout */
                <div className="call-voice-stage">
                  <div className="call-voice-avatar-wrap">
                    <div className="call-voice-wave" />
                    <div className="call-avatar large voice-avatar">
                      {peerName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <h3 className="call-peer-name">{peerName}</h3>
                  <div className="call-voice-status">
                    {state.isRemoteMicMuted ? (
                      <span className="call-remote-muted-indicator">
                        <MicOff size={14} /> Đối phương đã tắt micro
                      </span>
                    ) : (
                      <span className="call-voice-active-indicator">
                        <span className="call-voice-bar" />
                        <span className="call-voice-bar b2" />
                        <span className="call-voice-bar b3" />
                        Đang kết nối thoại
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. ENDED STATE */}
          {state.status === "ENDED" && (
            <div className="call-status-view">
              <div className="call-avatar-container ended">
                <div className="call-avatar ended-avatar">
                  {peerName.charAt(0).toUpperCase()}
                </div>
              </div>
              <h3 className="call-peer-name">{peerName}</h3>
              <p className="call-status-text ended-text">
                {getEndReasonText(state.endReason)}
              </p>
              {state.duration > 0 && (
                <p className="call-ended-duration">
                  Thời lượng: {formatDuration(state.duration)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls action footer */}
        <div className="call-footer">
          {state.status === "RINGING" ? (
            <div className="call-incoming-actions">
              <button
                type="button"
                className="call-action-btn call-action-decline"
                onClick={onDecline}
                title="Từ chối cuộc gọi"
              >
                <PhoneOff size={24} />
                <span>Từ chối</span>
              </button>
              <button
                type="button"
                className="call-action-btn call-action-accept"
                onClick={onAccept}
                title="Trả lời"
              >
                <Phone size={24} />
                <span>Trả lời</span>
              </button>
            </div>
          ) : state.status === "CALLING" ? (
            <div className="call-single-action">
              <button
                type="button"
                className="call-action-btn call-action-end"
                onClick={onEnd}
                title="Hủy cuộc gọi"
              >
                <PhoneOff size={24} />
                <span>Hủy cuộc gọi</span>
              </button>
            </div>
          ) : state.status === "CONNECTED" ? (
            <div className="call-connected-actions">
              {/* Mic toggle */}
              <button
                type="button"
                className={`call-action-btn call-action-control ${state.isMicMuted ? "active-off" : ""}`}
                onClick={onToggleMic}
                title={state.isMicMuted ? "Bật micro" : "Tắt micro"}
              >
                {state.isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                <span>{state.isMicMuted ? "Bật mic" : "Tắt mic"}</span>
              </button>

              {/* End call button */}
              <button
                type="button"
                className="call-action-btn call-action-end"
                onClick={onEnd}
                title="Kết thúc cuộc gọi"
              >
                <PhoneOff size={24} />
                <span>Kết thúc</span>
              </button>

              {/* Camera / Video toggle */}
              <button
                type="button"
                className={`call-action-btn call-action-control ${state.isCameraOff ? "active-off" : ""}`}
                onClick={onToggleCamera}
                title={state.isCameraOff ? "Bật video" : "Tắt video"}
              >
                {state.isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                <span>{state.isCameraOff ? "Bật video" : "Tắt video"}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
