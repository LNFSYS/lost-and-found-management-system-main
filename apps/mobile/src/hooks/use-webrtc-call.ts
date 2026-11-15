import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  MediaStream,
  type MediaStreamTrack,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from "react-native-webrtc";
import type { Socket } from "socket.io-client";

export type CallType = "VOICE" | "VIDEO";
export type CallStatus = "IDLE" | "CALLING" | "RINGING" | "CONNECTED" | "ENDED";
export type CallEndReason = "DECLINED" | "ENDED" | "MISSED" | "BUSY" | "TIMEOUT" | "DISCONNECTED" | "ERROR";

export interface CallEndedSummary {
  callType: CallType;
  duration: number;
  reason: CallEndReason;
  isCaller: boolean;
}

export interface CallState {
  status: CallStatus;
  callType: CallType | null;
  callId: string | null;
  callerId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isRemoteMicMuted: boolean;
  isRemoteCameraOff: boolean;
  duration: number;
  endReason: CallEndReason | null;
  error: string | null;
}

const initialState: CallState = {
  status: "IDLE",
  callType: null,
  callId: null,
  callerId: null,
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraOff: false,
  isRemoteMicMuted: false,
  isRemoteCameraOff: false,
  duration: 0,
  endReason: null,
  error: null,
};

function parseSessionDescription(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Dữ liệu kết nối cuộc gọi không hợp lệ.");
  const description = value as Record<string, unknown>;
  if (typeof description.type !== "string" || typeof description.sdp !== "string") {
    throw new Error("Dữ liệu kết nối cuộc gọi không hợp lệ.");
  }
  return new RTCSessionDescription({ type: description.type, sdp: description.sdp });
}

const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTCCall({
  userId,
  calleeId,
  socket,
  onCallEnded,
}: {
  userId: string | null;
  calleeId: string | null;
  socket: Socket | null;
  onCallEnded?: (summary: CallEndedSummary) => void;
}) {
  const [state, setState] = useState<CallState>(initialState);
  const stateRef = useRef(state);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const callId = useRef<string | null>(null);
  const cancelWhenInitiated = useRef(false);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const connectedAt = useRef<number | null>(null);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cleanup = useCallback(() => {
    if (durationTimer.current) clearInterval(durationTimer.current);
    durationTimer.current = null;
    connectedAt.current = null;
    pendingCandidates.current = [];
    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }
    localStream.current?.getTracks().forEach((track) => track.stop());
    localStream.current = null;
    remoteStream.current = null;
    callId.current = null;
  }, []);

  const endCallState = useCallback((reason: CallEndReason, errorMessage?: string) => {
    const current = stateRef.current;
    if (current.status === "IDLE") return;
    if (current.callType && current.callerId === userId) {
      onCallEnded?.({
        callType: current.callType,
        duration: current.duration,
        reason,
        isCaller: true,
      });
    }
    cleanup();
    if (reason === "ENDED" || reason === "DECLINED") {
      setState(initialState);
      return;
    }
    const message = errorMessage ?? (reason === "BUSY"
      ? "Đối phương đang bận cuộc gọi khác."
      : reason === "MISSED"
        ? "Đối phương không trả lời."
        : reason === "DISCONNECTED"
          ? "Cuộc gọi mất kết nối."
          : null);
    setState((previous) => ({
      ...initialState,
      status: "ENDED",
      endReason: reason,
      callType: previous.callType,
      duration: previous.duration,
      error: message,
    }));
    setTimeout(() => setState((previous) => previous.status === "ENDED" ? initialState : previous), 1800);
  }, [cleanup, onCallEnded, userId]);

  useEffect(() => {
    if (socket?.connected || stateRef.current.status === "IDLE") return;
    endCallState("DISCONNECTED", "Kết nối máy chủ bị gián đoạn. Cuộc gọi đã kết thúc.");
  }, [endCallState, socket]);

  const getMediaStream = useCallback(async (type: CallType) => {
    try {
      return await mediaDevices.getUserMedia({
        audio: true,
        video: type === "VIDEO"
          ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
          : false,
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "";
      const message = errorName === "NotAllowedError" || errorName === "SecurityError"
        ? `Vui lòng cho phép truy cập micro${type === "VIDEO" ? " và camera" : ""} để gọi.`
        : errorName === "NotFoundError"
          ? `Không tìm thấy ${type === "VIDEO" ? "camera hoặc micro" : "micro"} trên thiết bị.`
          : "Không thể truy cập camera hoặc micro. Hãy kiểm tra quyền của ứng dụng.";
      throw new Error(message);
    }
  }, []);

  const createPeerConnection = useCallback((activeCallId: string) => {
    const connection = new RTCPeerConnection({ iceServers });
    const incomingStream = new MediaStream();
    remoteStream.current = incomingStream;
    setState((previous) => ({ ...previous, remoteStream: incomingStream }));

    connection.ontrack = (rawEvent: unknown) => {
      const event = rawEvent as { streams: MediaStream[]; track: MediaStreamTrack };
      const stream = event.streams[0] ?? remoteStream.current;
      if (!stream) return;
      if (event.streams.length === 0) stream.addTrack(event.track);
      remoteStream.current = stream;
      setState((previous) => ({ ...previous, remoteStream: stream }));
    };
    connection.onicecandidate = (rawEvent: unknown) => {
      const event = rawEvent as { candidate: RTCIceCandidate | null };
      if (event.candidate && socket) {
        socket.emit("call.ice-candidate", { callId: activeCallId, candidate: event.candidate.toJSON() });
      }
    };
    connection.oniceconnectionstatechange = () => {
      if (["failed", "disconnected"].includes(connection.iceConnectionState) && stateRef.current.status === "CONNECTED") {
        socket?.emit("call.end", { callId: activeCallId });
        endCallState("DISCONNECTED");
      }
    };
    peerConnection.current = connection;
    return connection;
  }, [endCallState, socket]);

  const startDuration = useCallback(() => {
    if (durationTimer.current) clearInterval(durationTimer.current);
    connectedAt.current = Date.now();
    durationTimer.current = setInterval(() => {
      if (connectedAt.current) {
        setState((previous) => previous.status === "CONNECTED"
          ? { ...previous, duration: Math.floor((Date.now() - connectedAt.current!) / 1000) }
          : previous);
      }
    }, 1000);
  }, []);

  const startCall = useCallback(async (
    type: CallType,
    targetCalleeId?: string,
    roomId?: string,
    callerName?: string,
  ) => {
    const targetId = targetCalleeId ?? calleeId;
    if (!socket?.connected) {
      Alert.alert("Chưa kết nối", "Đang kết nối lại máy chủ cuộc gọi. Vui lòng thử lại sau ít giây.");
      return;
    }
    if (!userId || !targetId) {
      Alert.alert("Không thể gọi", "Không tìm thấy người nhận cuộc gọi hợp lệ.");
      return;
    }
    if (stateRef.current.status !== "IDLE") return;

    try {
      const stream = await getMediaStream(type);
      if (!socket.connected) {
        stream.getTracks().forEach((track) => track.stop());
        Alert.alert("Chưa kết nối", "Kết nối máy chủ bị gián đoạn. Vui lòng thử gọi lại.");
        return;
      }
      cancelWhenInitiated.current = false;
      localStream.current = stream;
      setState({
        ...initialState,
        status: "CALLING",
        callType: type,
        callerId: userId,
        localStream: stream,
        isCameraOff: type === "VOICE",
      });
      socket.emit("call.initiate", { calleeId: targetId, roomId: roomId ?? "global", callerName, callType: type });
    } catch (error) {
      Alert.alert("Không thể bắt đầu cuộc gọi", error instanceof Error ? error.message : "Không thể mở camera hoặc micro.");
    }
  }, [calleeId, getMediaStream, socket, userId]);

  const acceptCall = useCallback(async () => {
    const activeCallId = stateRef.current.callId;
    const type = stateRef.current.callType;
    if (!socket || !activeCallId || type === null || stateRef.current.status !== "RINGING") return;
    try {
      const stream = await getMediaStream(type);
      localStream.current = stream;
      setState((previous) => ({ ...previous, localStream: stream }));
      socket.emit("call.accept", { callId: activeCallId });
    } catch (error) {
      socket.emit("call.decline", { callId: activeCallId });
      endCallState("ERROR", error instanceof Error ? error.message : "Không thể truy cập camera hoặc micro.");
    }
  }, [endCallState, getMediaStream, socket]);

  const declineCall = useCallback(() => {
    const activeCallId = callId.current ?? stateRef.current.callId;
    if (socket && activeCallId) socket.emit("call.decline", { callId: activeCallId });
    endCallState("DECLINED");
  }, [endCallState, socket]);

  const endCall = useCallback(() => {
    const activeCallId = callId.current ?? stateRef.current.callId;
    if (socket && activeCallId) socket.emit("call.end", { callId: activeCallId });
    else if (stateRef.current.status === "CALLING") cancelWhenInitiated.current = true;
    endCallState("ENDED");
  }, [endCallState, socket]);

  const toggleMic = useCallback(() => {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const muted = !track.enabled;
    setState((previous) => ({ ...previous, isMicMuted: muted }));
    if (socket && callId.current) socket.emit("call.toggle-media", { callId: callId.current, mediaType: "audio", enabled: !muted });
  }, [socket]);

  const toggleCamera = useCallback(() => {
    const track = localStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const isOff = !track.enabled;
    setState((previous) => ({ ...previous, isCameraOff: isOff }));
    if (socket && callId.current) socket.emit("call.toggle-media", { callId: callId.current, mediaType: "video", enabled: !isOff });
  }, [socket]);

  const setupCallerWebRTC = useCallback(async (activeCallId: string, type: CallType) => {
    try {
      let stream = localStream.current;
      if (!stream) {
        stream = await getMediaStream(type);
        localStream.current = stream;
        setState((previous) => ({ ...previous, localStream: stream }));
      }
      const connection = createPeerConnection(activeCallId);
      stream.getTracks().forEach((track) => connection.addTrack(track, stream));
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      socket?.emit("call.offer", { callId: activeCallId, sdp: connection.localDescription });
    } catch (error) {
      socket?.emit("call.end", { callId: activeCallId });
      endCallState("ERROR", error instanceof Error ? error.message : "Lỗi thiết lập cuộc gọi.");
    }
  }, [createPeerConnection, endCallState, getMediaStream, socket]);

  useEffect(() => {
    if (!socket) return;

    const handleInitiated = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const activeCallId = (payload as Record<string, unknown>).callId;
      if (typeof activeCallId !== "string") return;
      if (cancelWhenInitiated.current) {
        cancelWhenInitiated.current = false;
        socket.emit("call.end", { callId: activeCallId });
        return;
      }
      callId.current = activeCallId;
      setState((previous) => previous.status === "CALLING" ? { ...previous, callId: activeCallId } : previous);
    };
    const handleIncoming = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as Record<string, unknown>;
      if (typeof event.callId !== "string" || (event.callType !== "VOICE" && event.callType !== "VIDEO")) return;
      if (stateRef.current.status !== "IDLE") {
        socket.emit("call.decline", { callId: event.callId });
        return;
      }
      callId.current = event.callId;
      setState({
        ...initialState,
        status: "RINGING",
        callId: event.callId,
        callerId: typeof event.callerId === "string" ? event.callerId : null,
        callType: event.callType,
        isCameraOff: event.callType === "VOICE",
      });
    };
    const handleAccepted = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const activeCallId = (payload as Record<string, unknown>).callId;
      if (typeof activeCallId !== "string") return;
      const current = stateRef.current;
      if (current.callId !== activeCallId) return;
      if (current.status === "CALLING" && current.callId === activeCallId && current.callType) {
        setState((previous) => ({ ...previous, status: "CONNECTED" }));
        startDuration();
        void setupCallerWebRTC(activeCallId, current.callType);
      } else if (current.status === "RINGING" && current.callId === activeCallId) {
        setState((previous) => ({ ...previous, status: "CONNECTED" }));
        startDuration();
      }
    };
    const handleOffer = async (payload: unknown) => {
      if (!payload || typeof payload !== "object" || !localStream.current) return;
      const event = payload as Record<string, unknown>;
      if (typeof event.callId !== "string" || !event.sdp || typeof event.sdp !== "object") return;
      if (stateRef.current.callId !== event.callId) return;
      try {
        const connection = createPeerConnection(event.callId);
        localStream.current.getTracks().forEach((track) => connection.addTrack(track, localStream.current!));
        await connection.setRemoteDescription(parseSessionDescription(event.sdp));
        for (const candidate of pendingCandidates.current) {
          try { await connection.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Ignore stale candidates. */ }
        }
        pendingCandidates.current = [];
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        socket.emit("call.answer", { callId: event.callId, sdp: connection.localDescription });
      } catch (error) {
        socket.emit("call.end", { callId: event.callId });
        endCallState("ERROR", error instanceof Error ? error.message : "Không thiết lập được kết nối WebRTC.");
      }
    };
    const handleAnswer = async (payload: unknown) => {
      if (!payload || typeof payload !== "object" || !peerConnection.current) return;
      const event = payload as Record<string, unknown>;
      if (typeof event.callId !== "string" || stateRef.current.callId !== event.callId) return;
      const sdp = event.sdp;
      if (!sdp || typeof sdp !== "object") return;
      try {
        await peerConnection.current.setRemoteDescription(parseSessionDescription(sdp));
        for (const candidate of pendingCandidates.current) {
          try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Ignore stale candidates. */ }
        }
        pendingCandidates.current = [];
      } catch (error) {
        endCallState("ERROR", error instanceof Error ? error.message : "Không thiết lập được kết nối WebRTC.");
      }
    };
    const handleIceCandidate = async (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as Record<string, unknown>;
      if (typeof event.callId !== "string" || stateRef.current.callId !== event.callId) return;
      const candidate = event.candidate as RTCIceCandidateInit | undefined;
      if (!candidate) return;
      if (peerConnection.current?.remoteDescription) {
        try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* Non-fatal ICE update. */ }
      } else {
        pendingCandidates.current.push(candidate);
      }
    };
    const handleEnded = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as Record<string, unknown>;
      if (typeof event.callId !== "string" || (stateRef.current.callId !== event.callId && callId.current !== event.callId)) return;
      const reason = typeof event.reason === "string" ? event.reason as CallEndReason : "ENDED";
      endCallState(reason, typeof event.error === "string" ? event.error : undefined);
    };
    const handleMediaToggled = (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const event = payload as Record<string, unknown>;
      if (typeof event.callId !== "string" || stateRef.current.callId !== event.callId) return;
      if (event.mediaType === "audio") setState((previous) => ({ ...previous, isRemoteMicMuted: !event.enabled }));
      if (event.mediaType === "video") setState((previous) => ({ ...previous, callType: "VIDEO", isRemoteCameraOff: !event.enabled }));
    };

    socket.on("call.initiated", handleInitiated);
    socket.on("call.incoming", handleIncoming);
    socket.on("call.accepted", handleAccepted);
    socket.on("call.offer", handleOffer);
    socket.on("call.answer", handleAnswer);
    socket.on("call.ice-candidate", handleIceCandidate);
    socket.on("call.ended", handleEnded);
    socket.on("call.media-toggled", handleMediaToggled);
    return () => {
      socket.off("call.initiated", handleInitiated);
      socket.off("call.incoming", handleIncoming);
      socket.off("call.accepted", handleAccepted);
      socket.off("call.offer", handleOffer);
      socket.off("call.answer", handleAnswer);
      socket.off("call.ice-candidate", handleIceCandidate);
      socket.off("call.ended", handleEnded);
      socket.off("call.media-toggled", handleMediaToggled);
    };
  }, [createPeerConnection, endCallState, setupCallerWebRTC, socket, startDuration]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { state, startCall, acceptCall, declineCall, endCall, toggleMic, toggleCamera };
}
