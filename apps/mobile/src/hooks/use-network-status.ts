import * as Network from "expo-network";

export function useNetworkStatus() {
  const state = Network.useNetworkState();
  return {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    isOnline: state.isConnected !== false && state.isInternetReachable !== false,
  };
}
