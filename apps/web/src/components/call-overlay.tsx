import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  AlertCircle,
  Maximize2,
  Minimize2,
  Minus
} from "lucide-react";
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

type ModalViewMode = "normal" | "maximized" | "minimized";

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
      return "Cuộc gọi đã hết thời gian";
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
  const [viewMode, setViewMode] = useState<ModalViewMode>("normal");

  // Ẩn/Hiện thanh công cụ nổi khi di chuột trên khung video (Hover & Inactivity Auto-hide)
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const isVideo = state.callType === "VIDEO";
  const isVideoMode = isVideo && (state.status === "CALLING" || state.status === "CONNECTED");
  const avatarLetter = (peerName || "U").charAt(0).toUpperCase();

  // Đặt lại bộ đếm tự động ẩn thanh công cụ khi di chuột (Ẩn sau 2.5s không di chuột)
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    // Tự động ẩn sau 2.5s nếu không di chuột khi đang trong cuộc gọi video
    if (state.status === "CONNECTED" && isVideo) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [state.status, isVideo]);

  const handleMouseMove = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  const handleMouseEnter = useCallback(() => {
    resetHideTimer();
  }, [resetHideTimer]);

  // Khi chuột rời khỏi modal: ẩn ngay lập tức các nút bấm
  const handleMouseLeave = useCallback(() => {
    if (state.status === "CONNECTED" && isVideo) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setControlsVisible(false);
    }
  }, [state.status, isVideo]);

  // Luôn hiển thị thanh điều khiển khi không phải là cuộc gọi video CONNECTED
  const isControlsVisible = controlsVisible || state.status !== "CONNECTED" || !isVideo;

  // Tự động khôi phục kích thước chuẩn khi cuộc gọi kết thúc hoặc reset
  useEffect(() => {
    if (state.status === "IDLE" || state.status === "ENDED") {
      setViewMode("normal");
      setControlsVisible(true);
    }
  }, [state.status]);

  // Dọn dẹp timer khi unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Callback ref đảm bảo video luôn gán srcObject ngay lập tức khi DOM mount
  const setLocalVideoNode = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    if (node && state.localStream) {
      if (node.srcObject !== state.localStream) {
        node.srcObject = state.localStream;
      }
      node.play().catch(() => {});
    }
  }, [state.localStream]);

  const setRemoteVideoNode = useCallback((node: HTMLVideoElement | null) => {
    remoteVideoRef.current = node;
    if (node && state.remoteStream) {
      if (node.srcObject !== state.remoteStream) {
        node.srcObject = state.remoteStream;
      }
      node.play().catch(() => {});
    }
  }, [state.remoteStream]);

  // Đồng bộ lại local stream khi đổi stream hoặc đổi camera state
  useEffect(() => {
    if (localVideoRef.current && state.localStream) {
      if (localVideoRef.current.srcObject !== state.localStream) {
        localVideoRef.current.srcObject = state.localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [state.localStream, state.status, state.isCameraOff]);

  // Đồng bộ lại remote stream khi nhận được hoặc đổi trạng thái
  useEffect(() => {
    if (remoteVideoRef.current && state.remoteStream) {
      if (remoteVideoRef.current.srcObject !== state.remoteStream) {
        remoteVideoRef.current.srcObject = state.remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && state.remoteStream) {
      if (remoteAudioRef.current.srcObject !== state.remoteStream) {
        remoteAudioRef.current.srcObject = state.remoteStream;
      }
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [state.remoteStream, state.status, state.isRemoteCameraOff]);

  // Nhạc chuông Web Audio API cho trạng thái đổ chuông (Calling / Ringing)
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
        osc.frequency.setValueAtTime(state.status === "RINGING" ? 440 : 425, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
      };

      playTone();
      timer = window.setInterval(playTone, state.status === "RINGING" ? 2500 : 3500);
    } catch {
      // Bỏ qua nếu browser yêu cầu tương tác người dùng
    }

    return () => {
      if (timer !== null) window.clearInterval(timer);
      if (audioCtx && audioCtx.state !== "closed") {
        void audioCtx.close();
      }
    };
  }, [state.status]);

  if (state.status === "IDLE") return null;

  return (
    <>
      {/* Thẻ audio ẩn phát âm thanh đối phương mượt mà */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className={`meet-call-backdrop meet-call--${state.status.toLowerCase()} meet-backdrop--${viewMode}`}>
        <div
          className={`meet-call-modal ${
            isVideoMode ? "meet-call-modal--video" : "meet-call-modal--voice"
          } meet-modal--${viewMode} ${
            isControlsVisible ? "meet-controls-visible" : "meet-controls-hidden"
          }`}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={resetHideTimer}
        >
          {/* 1. Thanh Header Nổi Trên Cùng (Hiện khi dddddi chuột / Hover) */}
          <div className="meet-top-bar" onMouseMove={handleMouseMove}>
            <div className="meet-info-pill">
              <span className={`meet-status-dot ${state.status === "CONNECTED" ? "active" : ""}`} />
              <span className="meet-info-text">
                {state.status === "CONNECTED" ? (
                  <>
                    <span className="meet-timer">{formatDuration(state.duration)}</span>
                    <span className="meet-separator">•</span>
                    <span className="meet-peer-name-top">{peerName}</span>
                  </>
                ) : state.status === "CALLING" ? (
                  "Đang gọi..."
                ) : state.status === "RINGING" ? (
                  "Cuộc gọi đến"
                ) : (
                  "Đã kết thúc"
                )}
              </span>

            </div>

            <div className="meet-top-actions">
              {/* Thông báo lỗi nếu có */}
              {state.error && (
                <div className="meet-error-pill">
                  <AlertCircle size={14} />
                  <span>{state.error}</span>
                </div>
              )}

              {/* Bộ điều khiển Phóng to / Thu nhỏ */}
              {state.status !== "ENDED" && (
                <div className="meet-window-controls">
                  {viewMode === "minimized" ? (
                    <button
                      type="button"
                      className="meet-win-btn"
                      onClick={() => setViewMode("normal")}
                      title="Mở rộng kích thước chuẩn"
                      aria-label="Mở rộng kích thước chuẩn"
                    >
                      <Maximize2 size={15} />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="meet-win-btn"
                        onClick={() => setViewMode("minimized")}
                        title="Thu nhỏ xuống góc màn hình"
                        aria-label="Thu nhỏ xuống góc màn hình"
                      >
                        <Minus size={15} />
                      </button>
                      <button
                        type="button"
                        className="meet-win-btn"
                        onClick={() => setViewMode(prev => prev === "maximized" ? "normal" : "maximized")}
                        title={viewMode === "maximized" ? "Thu về kích thước chuẩn" : "Phóng to toàn màn hình"}
                        aria-label={viewMode === "maximized" ? "Thu về kích thước chuẩn" : "Phóng to toàn màn hình"}
                      >
                        {viewMode === "maximized" ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Thân Hiển Thị Tràn Viền Toàn Bộ Modal (Stage Body) */}
          <div className="meet-stage">
            {/* 1. ĐANG GỌI ĐI (CALLING) */}
            {state.status === "CALLING" && (
              isVideo ? (
                <div className="meet-preview-stage">
                  <video
                    ref={setLocalVideoNode}
                    className="meet-preview-video"
                    autoPlay
                    playsInline
                    muted
                  />
                  <div className="meet-preview-overlay">
                    <div className="meet-preview-center">
                      <div className="meet-avatar mini-preview">{avatarLetter}</div>
                      <h3 className="meet-title">{peerName}</h3>
                      <p className="meet-subtitle">Đang đổ chuông đến đối phương...</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="meet-voice-center">
                  <div className="meet-avatar-container">
                    <div className="meet-pulse-ring ring-1" />
                    <div className="meet-pulse-ring ring-2" />
                    <div className="meet-pulse-ring ring-3" />
                    <div className="meet-avatar large">{avatarLetter}</div>
                  </div>
                  <h3 className="meet-title">{peerName}</h3>
                  <p className="meet-subtitle">Đang gọi đi, vui lòng chờ máy...</p>
                </div>
              )
            )}

            {/* 2. CUỘC GỌI ĐẾN (RINGING) */}
            {state.status === "RINGING" && (
              <div className="meet-voice-center">
                <div className="meet-avatar-container ringing">
                  <div className="meet-pulse-ring ring-green-1" />
                  <div className="meet-pulse-ring ring-green-2" />
                  <div className="meet-pulse-ring ring-green-3" />
                  <div className="meet-avatar large green-avatar">{avatarLetter}</div>
                </div>
                <h3 className="meet-title">{peerName}</h3>
                <p className="meet-subtitle">
                  {isVideo ? "Cuộc gọi video đến..." : "Cuộc gọi thoại đến..."}
                </p>
              </div>
            )}

            {/* 3. ĐÃ KẾT NỐI (CONNECTED) */}
            {state.status === "CONNECTED" && (
              isVideo ? (
                <div className="meet-video-stage">
                  {/* Video từ xa tràn viền toàn bộ modal */}
                  {state.isRemoteCameraOff ? (
                    <div className="meet-video-off-placeholder">
                      <div className="meet-avatar large dark-bg-avatar">{avatarLetter}</div>
                      <h4 className="meet-placeholder-name">{peerName}</h4>
                      <p className="meet-placeholder-text">Camera của {peerName} đang tắt</p>
                    </div>
                  ) : (
                    <video
                      ref={setRemoteVideoNode}
                      className="meet-remote-video"
                      autoPlay
                      playsInline
                      muted
                    />
                  )}

                  {/* Khung Camera Bản Thân Nổi (Picture-in-Picture) - Tự động trượt lên khi nút ở trên ẩn */}
                  <div className={`meet-pip-card ${state.isCameraOff ? "camera-off" : ""}`}>
                    {state.isCameraOff ? (
                      <div className="meet-pip-off">
                        <VideoOff size={18} />
                        <span>Camera tắt</span>
                      </div>
                    ) : (
                      <video
                        ref={setLocalVideoNode}
                        className="meet-pip-video"
                        autoPlay
                        playsInline
                        muted
                      />
                    )}
                    <div className="meet-pip-label">
                      <span>Bạn</span>
                      {state.isMicMuted && <MicOff size={11} className="meet-pip-muted-icon" />}
                    </div>
                  </div>

                  {/* Báo đối phương tắt mic */}
                  {state.isRemoteMicMuted && (
                    <div className="meet-remote-muted-pill">
                      <MicOff size={13} />
                      <span>{peerName} đã tắt micro</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Giao diện gọi thoại */
                <div className="meet-voice-center">
                  <div className="meet-avatar-container in-call">
                    <div className="meet-pulse-ring speaking-ring" />
                    <div className="meet-avatar large voice-avatar">{avatarLetter}</div>
                  </div>
                  <h3 className="meet-title">{peerName}</h3>
                  <div className="meet-voice-status">
                    {state.isRemoteMicMuted ? (
                      <span className="meet-status-badge muted">
                        <MicOff size={14} /> Đối phương đã tắt micro
                      </span>
                    ) : (
                      <span className="meet-status-badge speaking">
                        <span className="meet-wave-bar b1" />
                        <span className="meet-wave-bar b2" />
                        <span className="meet-wave-bar b3" />
                        Đang đàm thoại
                      </span>
                    )}
                  </div>
                </div>
              )
            )}

            {/* 4. KẾT THÚC (ENDED) */}
            {state.status === "ENDED" && (
              <div className="meet-voice-center">
                <div className="meet-avatar large ended-avatar">{avatarLetter}</div>
                <h3 className="meet-title">{peerName}</h3>
                <p className="meet-subtitle ended-text">
                  {getEndReasonText(state.endReason)}
                </p>
                {state.duration > 0 && (
                  <p className="meet-duration-text">
                    Thời lượng: {formatDuration(state.duration)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Thanh Điều Khiển Nổi Bên Dưới (Hiện khi di chuột / Hover) */}
          <div className="meet-bottom-dock" onMouseMove={handleMouseMove}>
            {state.status === "RINGING" ? (
              <div className="meet-incoming-dock">
                <button
                  type="button"
                  className="meet-circle-btn btn-decline"
                  onClick={onDecline}
                  title="Từ chối cuộc gọi"
                >
                  <div className="meet-icon-circle">
                    <PhoneOff size={24} />
                  </div>
                  <span className="meet-btn-text">Từ chối</span>
                </button>
                <button
                  type="button"
                  className="meet-circle-btn btn-accept"
                  onClick={onAccept}
                  title="Trả lời cuộc gọi"
                >
                  <div className="meet-icon-circle">
                    <Phone size={24} />
                  </div>
                  <span className="meet-btn-text">Trả lời</span>
                </button>
              </div>
            ) : state.status === "CALLING" ? (
              <div className="meet-single-dock">
                <button
                  type="button"
                  className="meet-circle-btn btn-cancel-call"
                  onClick={onEnd}
                  title="Hủy cuộc gọi"
                >
                  <div className="meet-icon-circle">
                    <PhoneOff size={24} />
                  </div>
                  <span className="meet-btn-text">Hủy gọi</span>
                </button>
              </div>
            ) : state.status === "CONNECTED" ? (
              <div className="meet-controls-pill">
                {/* Nút bật/tắt Micro */}
                <button
                  type="button"
                  className={`meet-pill-btn ${state.isMicMuted ? "is-off" : "is-active"}`}
                  onClick={onToggleMic}
                  title={state.isMicMuted ? "Bật micro" : "Tắt micro"}
                  aria-label={state.isMicMuted ? "Bật micro" : "Tắt micro"}
                >
                  {state.isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {/* Nút Kết Thúc Cuộc Gọi (Đỏ nổi bật) */}
                <button
                  type="button"
                  className="meet-pill-btn btn-leave-call"
                  onClick={onEnd}
                  title="Rời khỏi cuộc gọi"
                  aria-label="Rời khỏi cuộc gọi"
                >
                  <PhoneOff size={22} />
                </button>

                {/* Nút bật/tắt Camera */}
                <button
                  type="button"
                  className={`meet-pill-btn ${state.isCameraOff ? "is-off" : "is-active"}`}
                  onClick={onToggleCamera}
                  title={state.isCameraOff ? "Bật camera" : "Tắt camera"}
                  aria-label={state.isCameraOff ? "Bật camera" : "Tắt camera"}
                >
                  {state.isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
