export type CallType = "VOICE" | "VIDEO";
export type CallEndReason = "DECLINED" | "ENDED" | "MISSED" | "BUSY" | "TIMEOUT" | "DISCONNECTED";

export interface ActiveCall {
  callId: string;
  roomId: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  startedAt: number;
  connectedAt: number | null;
  status: "RINGING" | "CONNECTED" | "ENDED";
}

const maxCallDurationMs = 10 * 60 * 1000; // 10 minutes
const ringingTimeoutMs = 30 * 1000; // 30 seconds to answer

export function createCallSocketUseCases() {
  const activeCalls = new Map<string, ActiveCall>();
  const callsByRoom = new Map<string, string>(); // roomId → callId
  const callTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearCallTimer(callId: string) {
    const timer = callTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      callTimers.delete(callId);
    }
  }

  function removeCall(callId: string) {
    const call = activeCalls.get(callId);
    if (!call) return;
    clearCallTimer(callId);
    activeCalls.delete(callId);
    if (callsByRoom.get(call.roomId) === callId) callsByRoom.delete(call.roomId);
  }

  return {
    initiateCall(input: { callId: string; roomId: string; callerId: string; calleeId: string; callType: CallType; onTimeout?: (call: ActiveCall) => void }) {
      const existingCallId = callsByRoom.get(input.roomId);
      if (existingCallId) {
        const existingCall = activeCalls.get(existingCallId);
        if (existingCall && existingCall.status !== "ENDED") {
          return { error: "BUSY" as const, activeCall: existingCall };
        }
        removeCall(existingCallId);
      }

      const call: ActiveCall = {
        callId: input.callId,
        roomId: input.roomId,
        callerId: input.callerId,
        calleeId: input.calleeId,
        callType: input.callType,
        startedAt: Date.now(),
        connectedAt: null,
        status: "RINGING"
      };

      activeCalls.set(call.callId, call);
      callsByRoom.set(call.roomId, call.callId);

      // Auto-end if not answered within 30 seconds
      const timer = setTimeout(() => {
        const current = activeCalls.get(call.callId);
        if (current && current.status === "RINGING") {
          current.status = "ENDED";
          input.onTimeout?.(current);
          removeCall(call.callId);
        }
      }, ringingTimeoutMs);
      callTimers.set(call.callId, timer);

      return { error: null, call };
    },

    acceptCall(callId: string) {
      const call = activeCalls.get(callId);
      if (!call || call.status !== "RINGING") return null;

      clearCallTimer(callId);
      call.status = "CONNECTED";
      call.connectedAt = Date.now();

      // Auto-end after max duration
      const timer = setTimeout(() => {
        const current = activeCalls.get(callId);
        if (current && current.status === "CONNECTED") {
          current.status = "ENDED";
          removeCall(callId);
        }
      }, maxCallDurationMs);
      callTimers.set(callId, timer);

      return call;
    },

    endCall(callId: string, _reason: CallEndReason) {
      const call = activeCalls.get(callId);
      if (!call) return null;
      call.status = "ENDED";
      removeCall(callId);
      return call;
    },

    findActiveCall(roomId: string): ActiveCall | null {
      const callId = callsByRoom.get(roomId);
      if (!callId) return null;
      const call = activeCalls.get(callId);
      if (!call || call.status === "ENDED") return null;
      return call;
    },

    getCall(callId: string): ActiveCall | null {
      return activeCalls.get(callId) ?? null;
    },

    stop() {
      for (const timer of callTimers.values()) clearTimeout(timer);
      callTimers.clear();
      activeCalls.clear();
      callsByRoom.clear();
    },

    stats() {
      return {
        activeCalls: activeCalls.size,
        ringing: [...activeCalls.values()].filter(c => c.status === "RINGING").length,
        connected: [...activeCalls.values()].filter(c => c.status === "CONNECTED").length
      };
    }
  };
}

export type CallSocketUseCases = ReturnType<typeof createCallSocketUseCases>;
