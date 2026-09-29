export type AboutTopic = 'terms' | 'licence' | 'help';

export type AboutEntry = {
  id: AboutTopic;
  title: string;
  body: string;
};

const terms: AboutEntry = {
  id: 'terms',
  title: 'Terms & Conditions',
  body: [
    'By using Screen Guard you agree to these terms.',
    '',
    '1. Your lock credential never leaves this device. Screen Guard stores only a salted SHA-256 verifier of it in the Android Keystore. Your PIN, pattern and biometric data are never uploaded and cannot be recovered by us.',
    '',
    '2. If you forget your credential there is no recovery path. Clearing the app data or uninstalling Screen Guard permanently removes the verifier, and no protected app can be unlocked again.',
    '',
    '3. Screen Guard relies on Android usage access and the display-over-other-apps overlay. If you revoke either permission in system settings, protection stops until it is granted again.',
    '',
    '4. Android may terminate the protection monitor under memory pressure. Protection restarts automatically on boot, but we recommend keeping unused apps closed.',
    '',
    '5. We are not responsible for data loss, app access, or any indirect damage arising from device lockout. Always keep an unlocked copy of anything you cannot afford to lose.',
  ].join('\n'),
};

const licence: AboutEntry = {
  id: 'licence',
  title: 'Licence',
  body: [
    'Screen Guard is proprietary software. It is not open source and no source or redistribution rights are granted.',
    '',
    'This build bundles the following open-source components:',
    '',
    'React Native and React - MIT Licence',
    'Expo SDK and its modules - MIT Licence',
    'expo-secure-store - MIT Licence',
    'expo-crypto - MIT Licence',
    'expo-local-authentication - MIT Licence',
    'expo-image-picker - MIT Licence',
    'expo-file-system - MIT Licence',
    '@react-native-async-storage/async-storage - MIT Licence',
    'sass - MIT Licence',
    '',
    'Each component remains under its own licence, reproduced in its distributed package.',
  ].join('\n'),
};

const help: AboutEntry = {
  id: 'help',
  title: 'Help',
  body: [
    'Protected apps do not show the lock screen',
    'Grant Display over other apps and Usage access in Android Settings, then reopen Screen Guard. Both are required.',
    '',
    'Usage statistics are empty',
    'Usage access must be granted. Statistics also only appear for apps that have actually been opened since the last reboot.',
    '',
    'The black "Verifying app lock" screen stays up',
    'That overlay is a safety net. Close it with the back gesture and reopen Screen Guard.',
    '',
    'I forgot my PIN or pattern',
    'There is no recovery. Use Reset password in Settings, but remember that the old credential is destroyed immediately.',
    '',
    'Reset password does not work while an app is locked',
    'Close the lock screen first with the × in the corner, then reset from Settings.',
  ].join('\n'),
};

export const aboutEntries: AboutEntry[] = [terms, licence, help];

export const aboutEntriesById: Record<AboutTopic, AboutEntry> = {
  terms,
  licence,
  help,
};
