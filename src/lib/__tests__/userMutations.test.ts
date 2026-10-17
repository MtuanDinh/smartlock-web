import { describe, expect, it } from 'vitest';
import {
  buildAddUserUpdates,
  buildChangePinUpdates,
  buildClearBiometricUpdates,
  buildDeleteUserUpdates,
  buildEditNameUpdates,
  buildToggleStatusUpdates,
} from '../userMutations';

describe('userMutations builders', () => {
  it('buildAddUserUpdates preserves leading zero in PIN and creates Passwords entry', () => {
    const updates = buildAddUserUpdates('user_100', 'Nguyen Van A', '012345');
    expect(updates).toEqual({
      'SmartLock/Users/user_100': {
        name: 'Nguyen Van A',
        pass: '012345',
        card: '',
        status: 'active',
      },
      'SmartLock/Passwords/012345': 'Nguyen Van A',
    });
  });

  it('buildAddUserUpdates omits Passwords entry when PIN is empty', () => {
    const updates = buildAddUserUpdates('user_101', 'Tran B', '');
    expect(updates).toEqual({
      'SmartLock/Users/user_101': {
        name: 'Tran B',
        pass: '',
        card: '',
        status: 'active',
      },
    });
  });

  it('buildEditNameUpdates updates Users, Passwords, and RFID when active', () => {
    const updates = buildEditNameUpdates(
      'user_100',
      'Ten Moi',
      '0123',
      'AABBCCDD',
      'active'
    );
    expect(updates).toEqual({
      'SmartLock/Users/user_100/name': 'Ten Moi',
      'SmartLock/Passwords/0123': 'Ten Moi',
      'SmartLock/RFID/AABBCCDD': 'Ten Moi',
    });
  });

  it('buildChangePinUpdates removes old PIN and sets new PIN', () => {
    const updates = buildChangePinUpdates(
      'user_100',
      'Nguyen Van A',
      '0123',
      '0987',
      'active'
    );
    expect(updates).toEqual({
      'SmartLock/Users/user_100/pass': '0987',
      'SmartLock/Passwords/0123': null,
      'SmartLock/Passwords/0987': 'Nguyen Van A',
    });
  });

  it('buildChangePinUpdates deletes PIN when newPin is empty', () => {
    const updates = buildChangePinUpdates(
      'user_100',
      'Nguyen Van A',
      '0123',
      '',
      'active'
    );
    expect(updates).toEqual({
      'SmartLock/Users/user_100/pass': '',
      'SmartLock/Passwords/0123': null,
    });
  });

  it('buildToggleStatusUpdates removes lookup entries when disabled and restores when active', () => {
    const disableUpdates = buildToggleStatusUpdates(
      'user_100',
      'Nguyen Van A',
      '0123',
      'AABB',
      'disabled'
    );
    expect(disableUpdates).toEqual({
      'SmartLock/Users/user_100/status': 'disabled',
      'SmartLock/Passwords/0123': null,
      'SmartLock/RFID/AABB': null,
    });

    const enableUpdates = buildToggleStatusUpdates(
      'user_100',
      'Nguyen Van A',
      '0123',
      'AABB',
      'active'
    );
    expect(enableUpdates).toEqual({
      'SmartLock/Users/user_100/status': 'active',
      'SmartLock/Passwords/0123': 'Nguyen Van A',
      'SmartLock/RFID/AABB': 'Nguyen Van A',
    });
  });

  it('buildDeleteUserUpdates removes Biometrics always and removes Passwords/RFID when user was active', () => {
    const activeDel = buildDeleteUserUpdates('user_1', '0123', 'AABB', 'active');
    expect(activeDel).toEqual({
      'SmartLock/Users/user_1': null,
      'SmartLock/Biometrics/user_1': null,
      'SmartLock/Passwords/0123': null,
      'SmartLock/RFID/AABB': null,
    });

    const disabledDel = buildDeleteUserUpdates('user_2', '0123', 'AABB', 'disabled');
    expect(disabledDel).toEqual({
      'SmartLock/Users/user_2': null,
      'SmartLock/Biometrics/user_2': null,
    });
  });

  it('buildClearBiometricUpdates clears voice, face, or both', () => {
    expect(buildClearBiometricUpdates('user_1', 'voice')).toEqual({
      'SmartLock/Users/user_1/hasVoice': false,
      'SmartLock/Users/user_1/voicePassphrase': null,
      'SmartLock/Biometrics/user_1/voiceEmbedding': null,
      'SmartLock/Biometrics/user_1/voicePassphrase': null,
    });

    expect(buildClearBiometricUpdates('user_1', 'face')).toEqual({
      'SmartLock/Users/user_1/hasFace': false,
      'SmartLock/Biometrics/user_1/faceEmbedding': null,
    });
  });
});

