import { useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { OfflineQueue } from './queue';

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean | null;
  type: string;            // wifi, cellular, none, unknown
  strength: 'strong' | 'weak' | 'offline';
}

export function useNetwork(): NetworkStatus {
  const [state, setState] = useState<NetworkStatus>({
    isOnline: true, isConnected: null, type: 'unknown', strength: 'strong',
  });
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((info: NetInfoState) => {
      const online = !!(info.isConnected && info.isInternetReachable !== false);

      // Came back online → flush queued requests
      if (online && wasOffline.current) {
        wasOffline.current = false;
        OfflineQueue.flush().catch(() => {});
      }
      if (!online) wasOffline.current = true;

      const strength: NetworkStatus['strength'] =
        !online ? 'offline'
        : info.type === 'wifi' ? 'strong'
        : (info.details as any)?.cellularGeneration === '2g' ? 'weak'
        : 'strong';

      setState({
        isOnline: online,
        isConnected: info.isConnected,
        type: info.type,
        strength,
      });
    });
    return unsub;
  }, []);

  return state;
}
