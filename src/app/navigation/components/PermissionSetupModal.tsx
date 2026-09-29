import React from 'react';
import { Pressable, Text, View } from 'react-native';
import styles from './PermissionSetupModal.scss';

type PermissionSetupModalProps = {
  overlayPermission: boolean;
  usageAccessGranted: boolean;
  notificationPermission: boolean;
  onOpenOverlay: () => void;
  onOpenUsage: () => void;
  onRequestNotification: () => void;
  onDismiss: () => void;
};

type PermissionRowProps = {
  title: string;
  description: string;
  granted: boolean;
  onPress: () => void;
};

function PermissionRow({ title, description, granted, onPress }: PermissionRowProps) {
  return (
    <View style={styles.modalRow}>
      <View style={styles.modalRowCopy}>
        <Text style={styles.modalRowTitle}>{title}</Text>
        <Text style={styles.modalRowText}>{description}</Text>
      </View>
      {granted ? (
        <Text style={styles.modalGranted}>Granted</Text>
      ) : (
        <Pressable onPress={onPress} style={styles.modalButton}>
          <Text style={styles.modalButtonText}>Allow</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PermissionSetupModal({ overlayPermission, usageAccessGranted, notificationPermission, onOpenOverlay, onOpenUsage, onRequestNotification, onDismiss }: PermissionSetupModalProps) {
  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Finish Screen Guard setup</Text>
        <Text style={styles.modalText}>These permissions let Screen Guard show your lock before a protected app opens. Android requires you to approve each one.</Text>

        <PermissionRow title="Display over other apps" description="Shows the lock overlay above other apps." granted={overlayPermission} onPress={onOpenOverlay} />
        <PermissionRow title="Usage access" description="Lets Screen Guard know which app is in front." granted={usageAccessGranted} onPress={onOpenUsage} />
        <PermissionRow title="Notifications" description="Shows the active protection monitor notification." granted={notificationPermission} onPress={onRequestNotification} />

        <Pressable onPress={onDismiss} style={styles.modalDismiss}>
          <Text style={styles.modalDismissText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}
