import { useEffect, useState } from 'react';
import { useFirebaseContext } from '../app/providers/FirebaseProvider';
import type { BiometricSystemStatus } from '../types';

export function useBiometricSystem(): BiometricSystemStatus {
  const { service } = useFirebaseContext();
  const [status, setStatus] = useState<BiometricSystemStatus>({
    online: false,
    kioskUrl: '',
  });

  useEffect(() => {
    if (!service) return;
    return service.subscribeBiometricSystem((next) => {
      setStatus(next);
    });
  }, [service]);

  return status;
}
