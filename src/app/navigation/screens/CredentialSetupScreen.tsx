import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { LockMethod } from '../../../types';
import type { ThemePalette } from '../shared';
import { PinDisplay } from '../components/PinDisplay';
import { PinPad } from '../components/PinPad';
import { PatternPad } from '../components/PatternPad';
import { ValidationPage } from './ValidationPage';
import styles from './CredentialSetupScreen.scss';

type CredentialSetupScreenProps = {
  method: LockMethod;
  themeColors: ThemePalette;
  onComplete: (value: string) => Promise<void>;
  onBack: () => void;
};

export function CredentialSetupScreen({ method, themeColors, onComplete, onBack }: CredentialSetupScreenProps) {
  const [value, setValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const complete = async (nextValue: string) => {
    setBusy(true);
    setError('');
    try { await onComplete(nextValue); } catch { setError('Unable to save your lock credential.'); } finally { setBusy(false); }
  };

  if (method === 'Fingerprint') {
    const authenticate = async () => {
      setBusy(true);
      setError('');

      try {
        const supported = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();

        if (!supported) {
          setError('This device does not have supported biometric hardware.');
          return;
        }
        if (!enrolled) {
          setError('No fingerprint or biometric is enrolled. Add one in Android Settings, then try again.');
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm your fingerprint for Screen Guard',
          disableDeviceFallback: false,
        });

        if (result.success) {
          await onComplete('enabled');
        } else {
          setError('Fingerprint verification was cancelled or not completed.');
        }
      } catch {
        setError('Unable to check biometric security. Please try again.');
      } finally {
        setBusy(false);
      }
    };

    return (
      <ValidationPage title="Fingerprint setup" subtitle="Use your device's enrolled biometric to protect your selected apps." onBack={onBack} error="" themeColors={themeColors}>
        <View style={styles.fingerprintHero}>
          <View style={[styles.biometricOrb, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, busy && styles.biometricOrbActive, busy && { transform: [{ scale: 1.04 }] }]}>
            <View style={[styles.biometricRingOuter, { borderColor: themeColors.border }]} />
            <View style={[styles.biometricRingInner, { backgroundColor: themeColors.bg, borderColor: themeColors.teal }]} />
            <Text style={[styles.biometricGlyph, { color: themeColors.teal }]}>◎</Text>
          </View>
          <Text style={[styles.biometricLabel, { color: themeColors.teal }]}>BIOMETRIC PROTECTION</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan fingerprint"
          disabled={busy}
          onPress={() => { void authenticate(); }}
          style={({ pressed }) => [styles.biometricButton, busy && styles.disabled, pressed && !busy && styles.biometricButtonPressed, pressed && !busy && { transform: [{ scale: 0.99 }] }]}
        >
          <Text style={[styles.biometricButtonText, { color: themeColors.bg }]}>{busy ? 'Waiting for sensor...' : 'Scan fingerprint'}</Text>
        </Pressable>

        <View style={[styles.biometricStatus, { backgroundColor: themeColors.panel, borderColor: themeColors.border }, error && styles.biometricStatusError]}>
          <View style={[styles.biometricStatusDot, { backgroundColor: themeColors.teal }, error && styles.biometricStatusDotError]} />
          <View style={styles.biometricStatusCopy}>
            <Text style={[styles.biometricStatusTitle, { color: themeColors.text }]}>{error ? 'Action required' : 'Protected by your device'}</Text>
            <Text style={[styles.biometricStatusText, { color: error ? themeColors.danger : themeColors.muted }]}>{error || 'Biometric data is verified locally and is never uploaded.'}</Text>
          </View>
        </View>
      </ValidationPage>
    );
  }

  const isPattern = method === 'Pattern';
  const validLength = isPattern ? value.length >= 4 : value.length === 4;
  const continueToConfirmation = () => {
    if (!validLength) return setError(isPattern ? 'Connect at least 4 dots.' : 'Enter exactly 4 digits.');
    setError('');
    setStep('confirm');
  };
  const save = () => {
    if (value !== confirmation) return setError(`Your ${method.toLowerCase()} entries do not match.`);
    complete(value);
  };
  return (
    <ValidationPage
      title={step === 'enter' ? `Create your ${method.toLowerCase()}` : `Confirm your ${method.toLowerCase()}`}
      subtitle={step === 'enter' ? (isPattern ? 'Drag between at least four dots.' : 'Choose a 4-digit number.') : `Enter your ${method.toLowerCase()} again to confirm.`}
      onBack={step === 'enter' ? onBack : () => { setError(''); setStep('enter'); }}
      error={error}
      themeColors={themeColors}
    >
      {step === 'enter'
        ? (isPattern
          ? <PatternPad value={value} onChange={setValue} themeColors={themeColors} />
          : <><PinDisplay value={value} themeColors={themeColors} /><PinPad value={value} onChange={setValue} themeColors={themeColors} /></>)
        : (isPattern
          ? <PatternPad value={confirmation} onChange={setConfirmation} themeColors={themeColors} />
          : <><PinDisplay value={confirmation} themeColors={themeColors} /><PinPad value={confirmation} onChange={setConfirmation} themeColors={themeColors} /></>)}
      <Pressable
        style={[styles.continue, { borderColor: themeColors.teal }, (step === 'enter' ? !validLength : !confirmation) || busy ? styles.disabled : undefined]}
        disabled={step === 'enter' ? !validLength || busy : !confirmation || busy}
        onPress={step === 'enter' ? continueToConfirmation : save}
      >
        <Text style={[styles.tealText, { color: themeColors.teal }]}>{step === 'enter' ? 'Continue' : `Save ${method}`}</Text>
      </Pressable>
    </ValidationPage>
  );
}
