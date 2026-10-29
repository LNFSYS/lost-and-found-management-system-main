import { useCallback, useEffect, useRef, useState } from "react";

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
  error: null
};

const iceServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface CallSocket {
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
  connected?: boolean;
}

export function useWebRTCCall({ roomId, userId, calleeId, socket, onCallEnded }: {
  roomId: string | null;
  userId: string | null;
  calleeId: string | null;
  socket: CallSocket | null;
  onCallEnded?: (summary: CallEndedSummary) => void;
}) {
  const [state, setState] = useState<CallState>(initialState);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const durationTimer = useRef<number | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const cleanup = useCallback(() => {
    if (durationTimer.current) {
      window.clearInterval(durationTimer.current);
      durationTimer.current = null;
    }
    connectedAtRef.current = null;
    pendingCandidatesRef.current = [];

    if (peerConnection.current) {
      peerConnection.current.ontrack = null;
      peerConnection.current.onicecandidate = null;
      peerConnection.current.oniceconnectionstatechange = null;
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    remoteStreamRef.current = null;
    callIdRef.current = null;
  }, []);

  const endCallState = useCallback((reason: CallEndReason) => {
    const currentDuration = stateRef.current.duration;
    const currentCallType = stateRef.current.callType;
    const isCaller = stateRef.current.callerId === userId;

    if (currentCallType && isCaller && onCallEnded) {
      onCallEnded({
        callType: currentCallType,
        duration: currentDuration,
        reason,
        isCaller: true
      });
    }

    cleanup();
    if (reason === "ENDED" || reason === "DECLINED") {
      setState(initialState);
    } else {
      setState(prev => ({
        ...initialState,
        status: "ENDED",
        endReason: reason,
        callType: prev.callType,
        error: reason === "BUSY" ? "Đối phương đang bận cuộc gọi khác." : reason === "MISSED" ? "Đối phương không trả lời." : null
      }));
      setTimeout(() => {
        setState(prev => prev.status === "ENDED" ? initialState : prev);
      }, 1500);
    }
  }, [cleanup, onCallEnded, userId]);

  const getMediaStream = useCallback(async (callType: CallType): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "VIDEO" ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false
      });
      return stream;
    } catch (error) {
      // Graceful fallback for video testing when two windows on same machine try to open single webcam
      if (callType === "VIDEO") {
        try {
          console.warn("Camera locked or unavailable, generating fallback audio + canvas track for testing");
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, 640, 480);
            ctx.fillStyle = "#0b63b6";
            ctx.beginPath();
            ctx.arc(320, 200, 50, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 22px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("📷 Camera đang bận (Kiểm thử)", 320, 290);
            ctx.font = "14px system-ui, sans-serif";
            ctx.fillStyle = "#94a3b8";
            ctx.fillText("(Camera đang được sử dụng ở cửa sổ gọi kia)", 320, 325);
          }
          const canvasStream = (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(10);
          const dummyVideoTrack = canvasStream.getVideoTracks()[0];
          if (dummyVideoTrack) {
            audioStream.addTrack(dummyVideoTrack);
          }
          return audioStream;
        } catch {
          // If audio also failed, continue below
        }
      }

      const message = error instanceof DOMException
        ? error.name === "NotAllowedError" ? "Vui lòng cho phép truy cập micro" + (callType === "VIDEO" ? " và camera" : "") + " để thực hiện cuộc gọi."
          : error.name === "NotFoundError" ? "Không tìm thấy thiết bị " + (callType === "VIDEO" ? "camera/micro" : "micro") + "."
            : error.name === "NotReadableError" ? "Camera đang được sử dụng bởi ứng dụng/cửa sổ khác."
              : "Không thể truy cập thiết bị phương tiện."
        : "Không thể truy cập thiết bị phương tiện.";
      throw new Error(message);
    }
  }, []);

  const createPeerConnection = useCallback((currentCallId: string) => {
    const pc = new RTCPeerConnection({ iceServers });

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;
    setState(prev => ({ ...prev, remoteStream }));

    pc.ontrack = event => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach(track => {
          if (!remoteStream.getTracks().some(t => t.id === track.id)) {
            remoteStream.addTrack(track);
          }
        });
      } else if (event.track) {
        if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }
      }
      setState(prev => ({ ...prev, remoteStream }));
    };

    pc.onicecandidate = event => {
      if (event.candidate && socket) {
        socket.emit("call.ice-candidate", { callId: currentCallId, candidate: event.candidate.toJSON() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        if (stateRef.current.status === "CONNECTED") {
          socket?.emit("call.end", { callId: currentCallId });
          endCallState("DISCONNECTED");
        }
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [socket, endCallState]);

  // Start a call (caller side)
  const startCall = useCallback(async (callType: CallType) => {
    if (!socket || !socket.connected) {
      alert("Đang kết nối lại máy chủ chat. Vui lòng thử lại sau vài giây.");
      return;
    }
    if (!roomId || !userId || !calleeId) {
      alert("Không tìm thấy người nhận cuộc gọi hợp lệ.");
      return;
    }
    if (stateRef.current.status !== "IDLE") return;
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Trình duyệt không hỗ trợ micro/camera hoặc chưa cấp quyền.");
      return;
    }

    try {
      const stream = await getMediaStream(callType);
      localStreamRef.current = stream;

      setState({
        ...initialState,
        status: "CALLING",
        callType,
        callerId: userId,
        localStream: stream,
        isCameraOff: callType === "VOICE",
        error: null
      });

      socket.emit("call.initiate", { calleeId, callType });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể truy cập camera hoặc micro.");
    }
  }, [socket, roomId, userId, calleeId, getMediaStream]);

  // Accept an incoming call (callee side)
  const acceptCall = useCallback(async () => {
    const currentCallId = stateRef.current.callId;
    const callType = stateRef.current.callType;
    if (!socket || !currentCallId || stateRef.current.status !== "RINGING" || !callType) return;

    try {
      const stream = await getMediaStream(callType);
      localStreamRef.current = stream;

      setState(prev => ({ ...prev, localStream: stream }));
      socket.emit("call.accept", { callId: currentCallId });
    } catch (error) {
      socket.emit("call.decline", { callId: currentCallId });
      endCallState("ERROR");
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : "Lỗi cuộc gọi" }));
    }
  }, [socket, getMediaStream, endCallState]);

  // Decline an incoming call
  const declineCall = useCallback(() => {
    const currentCallId = stateRef.current.callId;
    if (socket && currentCallId) {
      socket.emit("call.decline", { callId: currentCallId });
    }
    endCallState("DECLINED");
  }, [socket, endCallState]);

  // End an active call or cancel outgoing call
  const endCall = useCallback(() => {
    const currentCallId = callIdRef.current ?? stateRef.current.callId;
    if (socket && currentCallId) {
      socket.emit("call.end", { callId: currentCallId });
    }
    endCallState("ENDED");
  }, [socket, endCallState]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const muted = !audioTrack.enabled;
      setState(prev => ({ ...prev, isMicMuted: muted }));
      if (socket && callIdRef.current) {
        socket.emit("call.toggle-media", { callId: callIdRef.current, mediaType: "audio", enabled: !muted });
      }
    }
  }, [socket]);

  // Toggle camera (or turn on camera in voice call)
  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) {
      // In voice call: camera is currently off, turn it on
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
        });
        const newTrack = camStream.getVideoTracks()[0];
        if (newTrack) {
          stream.addTrack(newTrack);
          if (peerConnection.current) {
            peerConnection.current.addTrack(newTrack, stream);
          }
          setState(prev => ({ ...prev, callType: "VIDEO", isCameraOff: false, localStream: stream }));
          if (socket && callIdRef.current) {
            socket.emit("call.toggle-media", { callId: callIdRef.current, mediaType: "video", enabled: true });
          }
        }
      } catch (err) {
        alert("Không thể bật camera: " + (err instanceof Error ? err.message : "Thiết bị không khả dụng"));
      }
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    const off = !videoTrack.enabled;
    setState(prev => ({ ...prev, isCameraOff: off }));
    if (socket && callIdRef.current) {
      socket.emit("call.toggle-media", { callId: callIdRef.current, mediaType: "video", enabled: !off });
    }
  }, [socket]);

  // Setup WebRTC after both sides accept — caller creates offer
  const setupCallerWebRTC = useCallback(async (currentCallId: string, callType: CallType) => {
    try {
      let stream = localStreamRef.current;
      if (!stream) {
        stream = await getMediaStream(callType);
        localStreamRef.current = stream;
        setState(prev => ({ ...prev, localStream: stream }));
      }

      const pc = createPeerConnection(currentCallId);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket?.emit("call.offer", { callId: currentCallId, sdp: pc.localDescription });
    } catch (error) {
      socket?.emit("call.end", { callId: currentCallId });
      endCallState("ERROR");
      setState(prev => ({ ...prev, error: error instanceof Error ? error.message : "Lỗi thiết lập cuộc gọi" }));
    }
  }, [socket, getMediaStream, createPeerConnection, endCallState]);

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    // Called when the server confirms our call initiation
    const handleInitiated = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      const callId = event.callId as string;
      callIdRef.current = callId;
      setState(prev => prev.status === "CALLING" ? { ...prev, callId } : prev);
    };

    // An incoming call from the peer
    const handleIncoming = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      if (stateRef.current.status !== "IDLE") return; // Already in a call
      const callId = event.callId as string;
      callIdRef.current = callId;
      const callType = event.callType as CallType;
      setState({
        ...initialState,
        status: "RINGING",
        callId,
        callType,
        callerId: event.callerId as string,
        isCameraOff: callType === "VOICE"
      });
    };

    // Call was accepted — start WebRTC negotiation
    const handleAccepted = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      const currentCallId = event.callId as string;

      if (stateRef.current.status === "CALLING" && stateRef.current.callId === currentCallId) {
        // We are the caller — create offer
        setState(prev => ({ ...prev, status: "CONNECTED" }));
        connectedAtRef.current = Date.now();
        durationTimer.current = window.setInterval(() => {
          if (connectedAtRef.current) {
            setState(prev => prev.status === "CONNECTED" ? { ...prev, duration: Math.floor((Date.now() - connectedAtRef.current!) / 1000) } : prev);
          }
        }, 1000);
        void setupCallerWebRTC(currentCallId, stateRef.current.callType!);
      } else if (stateRef.current.status === "RINGING" && stateRef.current.callId === currentCallId) {
        // We are the callee — wait for offer
        setState(prev => ({ ...prev, status: "CONNECTED" }));
        connectedAtRef.current = Date.now();
        durationTimer.current = window.setInterval(() => {
          if (connectedAtRef.current) {
            setState(prev => prev.status === "CONNECTED" ? { ...prev, duration: Math.floor((Date.now() - connectedAtRef.current!) / 1000) } : prev);
          }
        }, 1000);
      }
    };

    // Received SDP offer (callee side)
    const handleOffer = async (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      const currentCallId = event.callId as string;
      if (!localStreamRef.current) return;

      try {
        const pc = createPeerConnection(currentCallId);
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));

        await pc.setRemoteDescription(new RTCSessionDescription(event.sdp as RTCSessionDescriptionInit));

        // Flush buffered ICE candidates
        if (pendingCandidatesRef.current.length > 0) {
          for (const cand of pendingCandidatesRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* Ignore */ }
          }
          pendingCandidatesRef.current = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("call.answer", { callId: currentCallId, sdp: pc.localDescription });
      } catch (err) {
        console.error("handleOffer error:", err);
        socket.emit("call.end", { callId: currentCallId });
        endCallState("ERROR");
      }
    };

    // Received SDP answer (caller side)
    const handleAnswer = async (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      if (!peerConnection.current) return;

      try {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(event.sdp as RTCSessionDescriptionInit));

        // Flush buffered ICE candidates
        if (pendingCandidatesRef.current.length > 0) {
          for (const cand of pendingCandidatesRef.current) {
            try { await peerConnection.current.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* Ignore */ }
          }
          pendingCandidatesRef.current = [];
        }
      } catch {
        endCallState("ERROR");
      }
    };

    // Received ICE candidate
    const handleIceCandidate = async (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      const candidate = event.candidate as RTCIceCandidateInit;
      if (!candidate) return;

      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch { /* Non-fatal */ }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    // Call ended by peer or server
    const handleEnded = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      const reason = (event.reason as CallEndReason) ?? "ENDED";
      if (typeof event.error === "string" && event.error) {
        alert(event.error);
      }
      endCallState(reason);
    };

    // Remote media toggled
    const handleMediaToggled = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const event = data as Record<string, unknown>;
      if (event.mediaType === "audio") setState(prev => ({ ...prev, isRemoteMicMuted: !event.enabled }));
      if (event.mediaType === "video") setState(prev => ({ ...prev, isRemoteCameraOff: !event.enabled }));
    };

    socket.on("call.initiated", handleInitiated);
    socket.on("call.incoming", handleIncoming);
    socket.on("call.accepted", handleAccepted);
    socket.on("call.offer", handleOffer as (data: unknown) => void);
    socket.on("call.answer", handleAnswer as (data: unknown) => void);
    socket.on("call.ice-candidate", handleIceCandidate as (data: unknown) => void);
    socket.on("call.ended", handleEnded);
    socket.on("call.media-toggled", handleMediaToggled);

    return () => {
      socket.off("call.initiated", handleInitiated);
      socket.off("call.incoming", handleIncoming);
      socket.off("call.accepted", handleAccepted);
      socket.off("call.offer", handleOffer as (data: unknown) => void);
      socket.off("call.answer", handleAnswer as (data: unknown) => void);
      socket.off("call.ice-candidate", handleIceCandidate as (data: unknown) => void);
      socket.off("call.ended", handleEnded);
      socket.off("call.media-toggled", handleMediaToggled);
    };
  }, [socket, setupCallerWebRTC, createPeerConnection, endCallState]);

  return {
    state,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCamera
  };
}
