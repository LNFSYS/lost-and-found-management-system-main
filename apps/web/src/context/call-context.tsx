import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Socket } from "socket.io-client";
import { useAuth } from "./auth-context";
import { api } from "../services/api";
import { useWebRTCCall, type CallEndedSummary, type CallType, type CallState } from "../hooks/use-webrtc-call";
import { CallOverlay } from "../components/call-overlay";

export interface StartCallParams {
  calleeId: string;
  roomId?: string | null;
  claimId?: string | null;
  peerName?: string;
}

export interface CallContextValue {
  state: CallState;
  startCall: (callType: CallType, params: StartCallParams) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  socket: Socket | null;
  peerName: string;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeCalleeId, setActiveCalleeId] = useState<string | null>(null);
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string>("Người dùng");

  // Maintain global user socket as long as user is logged in
  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }

    const unsubscribe = api.subscribeClaimChatSocket({
      onSocket: (sock) => setSocket(sock),
      roomId: "global"
    });

    return () => {
      setSocket(null);
      unsubscribe();
    };
  }, [user?.id]);

  const handleCallEnded = async (summary: CallEndedSummary) => {
    if (!activeClaimId || !summary.isCaller) return;
    const isVideo = summary.callType === "VIDEO";
    const prefix = isVideo ? "📹 Cuộc gọi video" : "📞 Cuộc gọi thoại";

    let content = "";
    if (summary.duration > 0) {
      const minutes = Math.floor(summary.duration / 60);
      const seconds = summary.duration % 60;
      const formatted = `${minutes > 0 ? `${minutes}p ` : ""}${seconds < 10 && minutes > 0 ? `0${seconds}` : seconds}s`;
      content = `${prefix} (${formatted})`;
    } else if (summary.reason === "DECLINED") {
      content = `${prefix} bị từ chối`;
    } else if (summary.reason === "MISSED" || summary.reason === "BUSY") {
      content = `${prefix} nhỡ`;
    } else {
      content = `${prefix} đã hủy`;
    }

    try {
      await api.sendClaimMessage(activeClaimId, content);
    } catch (err) {
      console.warn("Failed to save call message log", err);
    }
  };

  const webrtc = useWebRTCCall({
    roomId: activeRoomId,
    userId: user?.id ?? null,
    calleeId: activeCalleeId,
    socket,
    onCallEnded: handleCallEnded
  });

  // Listen for incoming calls on socket to set peerName & activeRoomId
  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      if (typeof event.roomId === "string") setActiveRoomId(event.roomId);
      if (typeof event.callerId === "string") setActiveCalleeId(event.callerId);
      if (typeof event.roomId === "string") setActiveClaimId(event.roomId);
      if (typeof event.callerName === "string" && event.callerName) {
        setPeerName(event.callerName);
      } else {
        setPeerName("Người liên hệ");
      }
    };

    socket.on("call.incoming", handleIncoming);
    return () => {
      socket.off("call.incoming", handleIncoming);
    };
  }, [socket]);

  const startCall = async (callType: CallType, params: StartCallParams) => {
    setActiveCalleeId(params.calleeId);
    if (params.roomId) setActiveRoomId(params.roomId);
    if (params.claimId) setActiveClaimId(params.claimId);
    if (params.peerName) setPeerName(params.peerName);

    await webrtc.startCall(
      callType,
      params.calleeId,
      params.roomId ?? undefined,
      user?.fullName ?? "Người dùng"
    );
  };

  return (
    <CallContext.Provider value={{
      state: webrtc.state,
      startCall,
      acceptCall: webrtc.acceptCall,
      declineCall: webrtc.declineCall,
      endCall: webrtc.endCall,
      toggleMic: webrtc.toggleMic,
      toggleCamera: webrtc.toggleCamera,
      socket,
      peerName
    }}>
      {children}
      <CallOverlay
        state={webrtc.state}
        peerName={peerName}
        onAccept={webrtc.acceptCall}
        onDecline={webrtc.declineCall}
        onEnd={webrtc.endCall}
        onToggleMic={webrtc.toggleMic}
        onToggleCamera={webrtc.toggleCamera}
      />
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
}
