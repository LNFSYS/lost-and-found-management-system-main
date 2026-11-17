import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import type { Socket } from "socket.io-client";
import { CallOverlay } from "@/components/call-overlay";
import { useAuth } from "@/context/auth-context";
import { useWebRTCCall, type CallEndedSummary, type CallState, type CallType } from "@/hooks/use-webrtc-call";
import { claimService, createRequestUuid, subscribeClaimChatSocket } from "@/services/api";

export interface StartCallParams {
  calleeId: string;
  roomId?: string | null;
  claimId?: string | null;
  peerName?: string;
}

interface CallContextValue {
  state: CallState;
  startCall: (type: CallType, params: StartCallParams) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [socket, setSocket] = useState<Socket | null>(null);
  const [peerName, setPeerName] = useState("Người liên hệ");
  const activeClaimId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    return subscribeClaimChatSocket({ roomId: "global", onSocket: setSocket });
  }, [userId]);

  const handleCallEnded = useCallback(async (summary: CallEndedSummary) => {
    const claimId = activeClaimId.current;
    if (!claimId || !summary.isCaller) return;
    const callName = summary.callType === "VIDEO" ? "Cuộc gọi video" : "Cuộc gọi thoại";
    const minutes = Math.floor(summary.duration / 60);
    const seconds = summary.duration % 60;
    const duration = `${minutes > 0 ? `${minutes}p ` : ""}${minutes > 0 && seconds < 10 ? `0${seconds}` : seconds}s`;
    const content = summary.duration > 0
      ? `${callName} (${duration})`
      : summary.reason === "DECLINED"
        ? `${callName} bị từ chối`
        : summary.reason === "MISSED" || summary.reason === "BUSY"
          ? `${callName} nhỡ`
          : `${callName} đã hủy`;
    try {
      await claimService.sendMessage(claimId, content, createRequestUuid());
    } catch (error) {
      console.warn("Không thể lưu nhật ký cuộc gọi vào cuộc trao đổi.", error);
    }
  }, []);

  const call = useWebRTCCall({ userId, calleeId: null, socket, onCallEnded: handleCallEnded });

  useEffect(() => {
    if (!socket) return;
    const handleIncoming = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as Record<string, unknown>;
      setPeerName(typeof event.callerName === "string" && event.callerName.trim() ? event.callerName : "Người liên hệ");
    };
    socket.on("call.incoming", handleIncoming);
    return () => { socket.off("call.incoming", handleIncoming); };
  }, [socket]);

  const startCallAction = call.startCall;
  const startCall = useCallback(async (type: CallType, params: StartCallParams) => {
    activeClaimId.current = params.claimId ?? null;
    setPeerName(params.peerName ?? "Người liên hệ");
    await startCallAction(type, params.calleeId, params.roomId ?? undefined, user?.fullName ?? "Người dùng");
  }, [startCallAction, user?.fullName]);

  return (
    <CallContext.Provider value={{
      state: call.state,
      startCall,
      acceptCall: call.acceptCall,
      declineCall: call.declineCall,
      endCall: call.endCall,
      toggleMic: call.toggleMic,
      toggleCamera: call.toggleCamera,
    }}>
      {children}
      <CallOverlay
        state={call.state}
        peerName={peerName}
        onAccept={call.acceptCall}
        onDecline={call.declineCall}
        onEnd={call.endCall}
        onToggleMic={call.toggleMic}
        onToggleCamera={call.toggleCamera}
      />
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used within CallProvider");
  return context;
}
