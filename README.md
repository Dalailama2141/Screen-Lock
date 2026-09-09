# Screen Lock React Native App

Feature-oriented React Native structure for a mobile screen-lock application.

## Structure

- `src/app`: app bootstrap, navigation, and global state
- `src/features/auth`: PIN, password, and biometric setup/unlock flows
- `src/features/lock`: lock-screen experience and lock-state services
- `src/features/settings`: security, appearance, and app settings
- `src/components`: reusable UI and security controls
- `src/services/native`: Android/iOS device integrations
- `src/services/storage`: secure persistence and settings storage
- `src/theme`: colors, typography, spacing, and design tokens
- `src/hooks`, `src/utils`, `src/types`: shared application utilities
- `tests`: unit and integration tests
- `android`, `ios`: native platform projects

## Suggested dependencies

- React Navigation
- Zustand or Redux Toolkit
- `react-native-keychain` for secure credentials
- `react-native-biometrics` for biometric authentication
- Jest and React Native Testing Library
