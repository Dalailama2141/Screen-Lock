function BottomNav({ tab, onChange }: { tab: Tab; onChange: (value: Tab) => void }) { return <View style={styles.bottom}>{(['Home', 'Apps', 'Activity'] as Tab[]).map((item) => <Pressable key={item} style={styles.nav} onPress={() => onChange(item)}><Text style={[styles.navIcon, tab === item && styles.tealText]}>{item === 'Home' ? '⌂' : item === 'Apps' ? '▦' : '♢'}</Text><Text style={[styles.navLabel, tab === item && styles.tealText]}>{item}</Text></Pressable>)}</View>; }
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { getInstalledApps } from '../../services/native/installedApps';

type Tab = 'Home' | 'Apps' | 'Activity';
type LockMethod = 'Fingerprint' | 'Pattern' | 'PIN';
type SetupStep = 'choose' | 'validate';
type AppItem = { name: string; packageName: string; color: string; mark: string; locked: boolean };

const colors = { bg: '#020b1b', panel: '#081525', border: '#203149', text: '#f5f7fb', muted: '#aeb7c9', teal: '#26e4d5', danger: '#ff5261' };
const lockMethods: LockMethod[] = ['Fingerprint', 'Pattern', 'PIN'];
const appColors = ['#25d366', '#d6249f', '#4267e8', '#159b9b', '#f5c342', '#2aabee'];
const CREDENTIAL_METHOD_KEY = '@screen-guard/method';
const CREDENTIAL_VALUE_KEY = '@screen-guard/credential';

function toAppItem(app: { name: string; packageName: string }, index: number): AppItem {
  return { ...app, color: appColors[index % appColors.length], mark: app.name.charAt(0).toUpperCase(), locked: false };
}

export function Navigation() {
  const [tab, setTab] = useState<Tab>('Home');
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('choose');
  const [method, setMethod] = useState<LockMethod>('Fingerprint');
  const [credential, setCredential] = useState('');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [search, setSearch] = useState('');
  const [lockedApp, setLockedApp] = useState<AppItem | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const lockedCount = apps.filter((app) => app.locked).length;
  const visibleApps = useMemo(() => apps.filter((app) => app.name.toLowerCase().includes(search.toLowerCase())), [apps, search]);
  const toggleApp = (packageName: string) => setApps((current) => current.map((app) => app.packageName === packageName ? { ...app, locked: !app.locked } : app));

  useEffect(() => {
    AsyncStorage.multiGet([CREDENTIAL_METHOD_KEY, CREDENTIAL_VALUE_KEY]).then(([storedMethod, storedCredential]) => {
      if (storedMethod[1] && storedCredential[1]) {
        setMethod(storedMethod[1] as LockMethod);
        setCredential(storedCredential[1]);
        setSetupComplete(true);
      }
    }).catch((error) => console.error('Unable to load lock settings', error));

    let active = true;
    getInstalledApps()
      .then((installedApps) => {
        if (active) setApps(installedApps.map(toAppItem));
      })
      .catch((error) => console.error('Unable to load installed apps', error))
      .finally(() => {
        if (active) setLoadingApps(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const finishSetup = async (value: string) => {
    await AsyncStorage.multiSet([[CREDENTIAL_METHOD_KEY, method], [CREDENTIAL_VALUE_KEY, value]]);
    setCredential(value);
    setSetupComplete(true);
    setSetupStep('choose');
  };

  if (lockedApp) return <LockScreen app={lockedApp} method={method} credential={credential} setMethod={setMethod} onUnlock={() => setLockedApp(null)} onClose={() => setLockedApp(null)} />;
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={colors.bg} />
    {setupComplete ? <>{tab === 'Home' && <HomeScreen lockedCount={lockedCount} onApps={() => setTab('Apps')} />}{tab === 'Apps' && <AppsScreen apps={visibleApps} lockedCount={lockedCount} loading={loadingApps} search={search} setSearch={setSearch} onToggle={toggleApp} onOpen={setLockedApp} />}{tab === 'Activity' && <ActivityScreen />}<BottomNav tab={tab} onChange={setTab} /></> : setupStep === 'choose' ? <SetupScreen method={method} setMethod={setMethod} onContinue={() => setSetupStep('validate')} /> : <CredentialSetupScreen method={method} onComplete={finishSetup} onBack={() => setSetupStep('choose')} />}
  </SafeAreaView>;
}

function SetupScreen({ method, setMethod, onContinue }: { method: LockMethod; setMethod: (value: LockMethod) => void; onContinue: () => void }) {
  return <View style={styles.fill}><ScrollView contentContainerStyle={styles.setup}><Text style={styles.hero}>♢</Text><Text style={styles.title}>Protect your apps</Text><Text style={styles.subtitle}>Step 1 of 2  ·  Choose your lock</Text><View style={styles.progress}><View style={styles.progressFill} /></View>
    {lockMethods.map((option) => <Pressable key={option} style={[styles.methodCard, method === option && styles.activeCard]} onPress={() => setMethod(option)}><Text style={styles.bigIcon}>{option === 'Fingerprint' ? '◉' : option === 'Pattern' ? '⠿' : '••••'}</Text><View style={styles.methodCopy}><Text style={styles.methodTitle}>{option}{option === 'Fingerprint' && <Text style={styles.recommended}>  Recommended</Text>}</Text><Text style={styles.methodDescription}>{option === 'Fingerprint' ? 'Unlock instantly with your finger' : option === 'Pattern' ? 'Draw your secret shape' : '4-digit numeric code'}</Text></View><View style={[styles.radio, method === option && styles.radioOn]} /></Pressable>)}
    <Text style={styles.note}>♢   You can change this anytime</Text></ScrollView><Pressable style={styles.continue} onPress={onContinue}><Text style={styles.tealText}>Continue</Text><Text style={styles.arrow}>→</Text></Pressable><BottomNav tab="Home" onChange={() => undefined} /></View>;
}

function HomeScreen({ lockedCount, onApps }: { lockedCount: number; onApps: () => void }) { return <ScrollView contentContainerStyle={styles.home}><Text style={styles.eyebrow}>SCREEN GUARD</Text><Text style={styles.title}>Your apps, protected.</Text><Text style={styles.subtitle}>Keep private apps behind one simple lock.</Text><View style={styles.homePanel}><Text style={styles.hero}>♢</Text><View><Text style={styles.statValue}>{lockedCount}</Text><Text style={styles.statLabel}>apps locked</Text></View></View><Pressable style={styles.primary} onPress={onApps}><Text style={styles.tealText}>Manage protected apps</Text><Text style={styles.arrow}>→</Text></Pressable></ScrollView>; }

function AppsScreen({ apps, lockedCount, loading, search, setSearch, onToggle, onOpen }: { apps: AppItem[]; lockedCount: number; loading: boolean; search: string; setSearch: (value: string) => void; onToggle: (packageName: string) => void; onOpen: (app: AppItem) => void }) { return <ScrollView contentContainerStyle={styles.list}><TextInput value={search} onChangeText={setSearch} placeholder="Search apps" placeholderTextColor={colors.muted} style={styles.search} /><View style={styles.count}><Text style={styles.countIcon}>♢</Text><Text style={styles.countText}>{lockedCount} of {apps.length} apps locked</Text></View>{loading ? <Text style={styles.package}>Loading installed apps...</Text> : apps.length === 0 ? <Text style={styles.package}>No installed apps are available on this platform.</Text> : apps.map((app) => <Pressable key={app.packageName} style={styles.appRow} onPress={() => app.locked && onOpen(app)}><View style={[styles.appIcon, { backgroundColor: app.color }]}><Text style={styles.appMark}>{app.mark}</Text></View><View style={styles.appCopy}><Text style={styles.appName}>{app.name}</Text><Text style={styles.package}>{app.packageName}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: app.locked }} style={[styles.switch, app.locked && styles.switchOn]} onPress={() => onToggle(app.packageName)}><View style={[styles.thumb, app.locked && styles.thumbOn]} /></Pressable></Pressable>)}</ScrollView>; }

function ActivityScreen() { const data = [5, 9, 7, 11, 6, 4, 12]; return <ScrollView contentContainerStyle={styles.activity}><View style={styles.header}><Text style={styles.title}>Security Activity</Text><Text style={styles.hero}>♢</Text></View><View style={styles.stats}><View style={styles.stat}><Text style={styles.statIcon}>♙</Text><View><Text style={styles.statValue}>4</Text><Text style={styles.statLabel}>apps locked</Text></View></View><View style={styles.stat}><Text style={styles.statIcon}>♢</Text><View><Text style={styles.statValue}>12</Text><Text style={styles.statLabel}>unlocks today</Text></View></View></View><View style={styles.chartPanel}><Text style={styles.sectionTitle}>Unlocks this week</Text><View style={styles.chart}>{data.map((value, index) => <View key={index} style={styles.barColumn}><View style={[styles.bar, { height: value * 8 }, index === 6 && styles.barActive]} /><Text style={styles.day}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</Text></View>)}</View></View><View style={styles.header}><Text style={styles.sectionTitle}>Recent activity</Text><Text style={styles.link}>View all</Text></View>{['WhatsApp unlocked', 'Gallery unlocked', 'Wrong PIN entered · WhatsApp', 'Instagram unlocked'].map((name, index) => <View key={name} style={[styles.activityRow, index === 2 && styles.warning]}><View style={[styles.activityIcon, { backgroundColor: index === 2 ? colors.danger : '#25d366' }]}><Text style={styles.appMark}>◉</Text></View><View style={styles.appCopy}><Text style={[styles.appName, index === 2 && styles.danger]}>{name}</Text><Text style={styles.package}>{['Today 2:41 PM', 'Today 11:08 AM', 'Today 9:12 AM', 'Yesterday 10:30 PM'][index]}</Text></View><Text style={[styles.link, index === 2 && styles.danger]}>♙</Text></View>)}</ScrollView>; }

function CredentialSetupScreen({ method, onComplete, onBack }: { method: LockMethod; onComplete: (value: string) => Promise<void>; onBack: () => void }) {
  const [value, setValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
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
      const supported = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!supported || !enrolled) { setError('Set up a fingerprint or device biometric first.'); setBusy(false); return; }
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm your fingerprint for Screen Guard' });
      if (result.success) await complete('enabled'); else setError('Fingerprint verification was not completed.');
      setBusy(false);
    };
    return <ValidationPage title="Set up fingerprint" subtitle="Verify your fingerprint to protect every selected app." onBack={onBack} error={error}><Pressable style={styles.fingerprint} disabled={busy} onPress={authenticate}><Text style={styles.fingerprintGlyph}>◉</Text></Pressable><Text style={styles.unlockHint}>{busy ? 'Checking fingerprint...' : 'Touch the sensor to continue'}</Text></ValidationPage>;
  }

  const isPattern = method === 'Pattern';
  const validLength = isPattern ? value.length >= 4 : value.length === 4;
  const save = () => {
    if (!validLength) return setError(isPattern ? 'Connect at least 4 dots.' : 'Enter exactly 4 digits.');
    if (value !== confirmation) return setError(`Your ${method.toLowerCase()} entries do not match.`);
    complete(value);
  };
  return <ValidationPage title={`Create your ${method.toLowerCase()}`} subtitle={isPattern ? 'Connect at least 4 dots, then repeat the pattern.' : 'Choose a 4-digit number, then confirm it.'} onBack={onBack} error={error}>
    {isPattern ? <PatternPad value={value} onChange={setValue} /> : <PinPad value={value} onChange={setValue} />}
    {value && <Text style={validationStyles.validationLabel}>Confirm {method.toLowerCase()}</Text>}
    {value && (isPattern ? <PatternPad value={confirmation} onChange={setConfirmation} /> : <PinPad value={confirmation} onChange={setConfirmation} />)}
    <Pressable style={[styles.continue, (!validLength || value !== confirmation || busy) && validationStyles.disabled]} disabled={!validLength || value !== confirmation || busy} onPress={save}><Text style={styles.tealText}>Save {method}</Text></Pressable>
  </ValidationPage>;
}

function ValidationPage({ title, subtitle, onBack, error, children }: { title: string; subtitle: string; onBack: () => void; error: string; children: React.ReactNode }) { return <View style={styles.fill}><ScrollView contentContainerStyle={validationStyles.validation}><Pressable onPress={onBack}><Text style={styles.link}>← Change lock method</Text></Pressable><Text style={styles.hero}>♢</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text>{error ? <Text style={validationStyles.error}>{error}</Text> : null}{children}</ScrollView></View>; }

function PatternPad({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <View style={validationStyles.patternPad}>{Array.from({ length: 9 }, (_, index) => <Pressable key={index} style={[validationStyles.patternDot, value.includes(String(index)) && validationStyles.patternDotActive]} onPress={() => onChange(value.includes(String(index)) ? value : value + index)}><Text style={validationStyles.patternNumber}>{value.includes(String(index)) ? value.indexOf(String(index)) + 1 : ''}</Text></Pressable>)}</View>; }

function PinPad({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <View style={validationStyles.pinPad}>{['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => <Pressable key={key} style={validationStyles.key} onPress={() => key === 'clear' ? onChange('') : key === 'back' ? onChange(value.slice(0, -1)) : value.length < 4 ? onChange(value + key) : undefined}><Text style={validationStyles.keyText}>{key === 'back' ? '←' : key === 'clear' ? 'C' : key}</Text></Pressable>)}</View>; }

function LockScreen({ app, method, credential, setMethod, onUnlock, onClose }: { app: AppItem; method: LockMethod; credential: string; setMethod: (value: LockMethod) => void; onUnlock: () => void; onClose: () => void }) { const [value, setValue] = useState(''); const [error, setError] = useState(''); const verify = async () => { if (method === 'Fingerprint') { const result = await LocalAuthentication.authenticateAsync({ promptMessage: `Unlock ${app.name}` }); if (result.success) onUnlock(); else setError('Fingerprint verification failed.'); return; } if (value === credential) onUnlock(); else setError(`Incorrect ${method.toLowerCase()}.`); }; return <SafeAreaView style={styles.safe}><StatusBar barStyle="light-content" backgroundColor={colors.bg} /><ScrollView contentContainerStyle={styles.lock}><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable><View style={[styles.lockIcon, { backgroundColor: app.color }]}><Text style={styles.lockMark}>{app.mark}</Text></View><Text style={styles.lockTitle}>{app.name} is locked</Text><View style={styles.selector}>{lockMethods.map((option) => <Pressable key={option} style={[styles.selectorItem, method === option && styles.selectorActive]} onPress={() => { setMethod(option); setValue(''); setError(''); }}><Text style={[styles.selectorText, method === option && styles.tealText]}>{option === 'Fingerprint' ? '◉' : option === 'Pattern' ? '⠿' : '••••'} {option}</Text></Pressable>)}</View>{method === 'Fingerprint' ? <Pressable style={styles.fingerprint} onPress={verify}><Text style={styles.fingerprintGlyph}>◉</Text></Pressable> : method === 'Pattern' ? <PatternPad value={value} onChange={setValue} /> : <PinPad value={value} onChange={setValue} />}<Pressable style={styles.verifyButton} onPress={verify}><Text style={styles.tealText}>Verify {method}</Text></Pressable>{error ? <Text style={validationStyles.error}>{error}</Text> : null}<Text style={styles.unlockHint}>{method === 'Fingerprint' ? 'Touch the sensor to unlock' : `Enter your ${method.toLowerCase()} to unlock`}</Text></ScrollView></SafeAreaView>; }

const validationStyles = StyleSheet.create({ validation: { padding: 30, paddingTop: 42, paddingBottom: 40 }, validationLabel: { color: colors.muted, fontSize: 16, marginTop: 20, marginBottom: 10 }, error: { color: colors.danger, fontSize: 15, marginTop: 16, textAlign: 'center' }, disabled: { opacity: 0.45 }, patternPad: { width: 270, height: 270, marginTop: 30, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', alignContent: 'space-around' }, patternDot: { width: 72, height: 72, borderRadius: 40, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' }, patternDotActive: { borderColor: colors.teal, backgroundColor: '#07303b' }, patternNumber: { color: colors.teal, fontSize: 22, fontWeight: '700' }, pinPad: { width: 270, marginTop: 25, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, key: { width: 80, height: 58, marginBottom: 10, borderRadius: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, keyText: { color: colors.text, fontSize: 22, fontWeight: '700' } });

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.bg }, fill: { flex: 1 }, setup: { padding: 30, paddingTop: 42, paddingBottom: 20 }, home: { padding: 30, paddingTop: 65, flexGrow: 1 }, list: { padding: 25, paddingBottom: 110 }, activity: { padding: 30, paddingBottom: 110 }, lock: { padding: 30, paddingTop: 60, alignItems: 'center', minHeight: '100%' }, hero: { color: colors.teal, fontSize: 52, marginBottom: 12 }, title: { color: colors.text, fontSize: 31, fontWeight: '700' }, subtitle: { color: colors.muted, fontSize: 19, marginTop: 12 }, progress: { height: 7, backgroundColor: '#26344b', borderRadius: 5, marginVertical: 25 }, progressFill: { width: '50%', height: '100%', backgroundColor: colors.teal, borderRadius: 5 }, methodCard: { minHeight: 130, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, marginBottom: 16, padding: 20, flexDirection: 'row', alignItems: 'center' }, activeCard: { borderColor: colors.teal, backgroundColor: '#07303b' }, bigIcon: { width: 62, height: 62, borderRadius: 34, backgroundColor: '#243044', color: colors.text, fontSize: 27, textAlign: 'center', textAlignVertical: 'center' }, methodCopy: { flex: 1, paddingHorizontal: 18 }, methodTitle: { color: colors.text, fontSize: 21, fontWeight: '700' }, methodDescription: { color: colors.muted, fontSize: 16, marginTop: 7 }, recommended: { color: colors.teal, fontSize: 13 }, radio: { width: 27, height: 27, borderRadius: 20, borderWidth: 2, borderColor: colors.muted }, radioOn: { borderColor: colors.teal, backgroundColor: colors.teal }, note: { color: colors.muted, fontSize: 16, marginTop: 8 }, continue: { height: 64, borderWidth: 1.5, borderColor: colors.teal, borderRadius: 17, margin: 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, tealText: { color: colors.teal, fontWeight: '700', fontSize: 18 }, arrow: { position: 'absolute', right: 20, color: colors.teal, fontSize: 30 }, bottom: { height: 100, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10 }, nav: { alignItems: 'center', width: '30%' }, navIcon: { color: colors.muted, fontSize: 28, height: 37 }, navLabel: { color: colors.muted, fontSize: 16 }, eyebrow: { color: colors.teal, fontSize: 14, letterSpacing: 3, fontWeight: '700', marginBottom: 20 }, homePanel: { marginTop: 45, padding: 25, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center' }, statValue: { color: colors.text, fontSize: 30, fontWeight: '700' }, statLabel: { color: colors.muted, fontSize: 16 }, primary: { height: 64, marginTop: 25, borderRadius: 17, backgroundColor: '#073c48', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, search: { height: 68, borderWidth: 1, borderColor: '#3a4860', borderRadius: 15, color: colors.text, fontSize: 19, paddingHorizontal: 22, marginBottom: 28 }, count: { height: 62, borderRadius: 15, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 18 }, countIcon: { color: colors.teal, fontSize: 30, marginRight: 17 }, countText: { color: colors.text, fontSize: 19, fontWeight: '600' }, appRow: { minHeight: 92, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, marginBottom: 7, padding: 17, flexDirection: 'row', alignItems: 'center' }, appIcon: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 18 }, appMark: { color: '#fff', fontSize: 27, fontWeight: '700' }, appCopy: { flex: 1 }, appName: { color: colors.text, fontSize: 18, fontWeight: '700' }, package: { color: colors.muted, fontSize: 15, marginTop: 4 }, switch: { height: 34, width: 60, borderRadius: 20, borderWidth: 2, borderColor: '#435067', padding: 2, justifyContent: 'center' }, switchOn: { backgroundColor: colors.teal }, thumb: { height: 28, width: 28, borderRadius: 20, backgroundColor: '#cbd1db' }, thumbOn: { alignSelf: 'flex-end', backgroundColor: '#2eced0' }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }, stats: { flexDirection: 'row', gap: 15 }, stat: { flex: 1, minHeight: 110, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center' }, statIcon: { color: colors.teal, fontSize: 30, marginRight: 13 }, chartPanel: { marginVertical: 24, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }, sectionTitle: { color: colors.text, fontSize: 19, fontWeight: '700' }, chart: { height: 180, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', paddingTop: 25 }, barColumn: { height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, bar: { width: 30, minHeight: 20, borderRadius: 5, backgroundColor: '#195b61' }, barActive: { backgroundColor: colors.teal }, day: { color: colors.muted, marginTop: 9 }, link: { color: colors.teal, fontSize: 16 }, activityRow: { minHeight: 84, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, marginBottom: 7, padding: 13, flexDirection: 'row', alignItems: 'center' }, warning: { backgroundColor: '#25131f', borderColor: '#6d2538' }, danger: { color: colors.danger }, activityIcon: { width: 52, height: 52, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 16 }, close: { position: 'absolute', right: 8, top: 10, width: 42, height: 42, borderRadius: 25, borderWidth: 1, borderColor: '#637086', alignItems: 'center', justifyContent: 'center', zIndex: 1 }, closeText: { color: colors.muted, fontSize: 32 }, lockIcon: { width: 70, height: 70, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, lockMark: { color: '#fff', fontSize: 40 }, lockTitle: { color: colors.text, fontSize: 29, fontWeight: '700', marginVertical: 30 }, selector: { width: '100%', height: 70, borderRadius: 38, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, flexDirection: 'row' }, selectorItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, selectorActive: { borderWidth: 1, borderColor: colors.teal, borderRadius: 38, backgroundColor: '#0c3a43' }, selectorText: { color: colors.muted, fontSize: 14 }, fingerprint: { width: 275, height: 275, borderRadius: 150, borderWidth: 10, borderColor: colors.teal, backgroundColor: '#06232e', alignItems: 'center', justifyContent: 'center', marginTop: 100, shadowColor: colors.teal, shadowOpacity: 0.8, shadowRadius: 25, elevation: 15 }, fingerprintGlyph: { color: colors.teal, fontSize: 100 }, unlockHint: { color: colors.muted, fontSize: 19, marginTop: 42 }, useInstead: { color: colors.teal, fontSize: 18, fontWeight: '600', marginTop: 45 }, verify: { marginTop: 100, alignItems: 'center' }, inputDots: { color: colors.teal, fontSize: 35 }, verifyButton: { marginTop: 30, height: 56, minWidth: 210, borderWidth: 1, borderColor: colors.teal, borderRadius: 15, alignItems: 'center', justifyContent: 'center' } });

