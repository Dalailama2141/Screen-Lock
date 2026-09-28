import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const WALLPAPER_DIRECTORY = 'wallpapers';

function getWallpaperDirectory(): string {
  if (!FileSystem.documentDirectory) {
    throw new Error('App storage is not available on this device.');
  }
  return `${FileSystem.documentDirectory}${WALLPAPER_DIRECTORY}/`;
}

function getSafeFileName(packageName: string): string {
  return packageName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function pickAndStoreWallpaper(packageName: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to choose an app wallpaper.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    selectionLimit: 1,
    quality: 0.85,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.uri) {
    throw new Error('The selected photo could not be read.');
  }

  const directory = getWallpaperDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });

  const sourceExtension = asset.uri.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const extension = sourceExtension && ['jpg', 'jpeg', 'png', 'webp'].includes(sourceExtension) ? sourceExtension : 'jpg';
  const destination = `${directory}${getSafeFileName(packageName)}-${Date.now()}.${extension}`;

  await FileSystem.copyAsync({ from: asset.uri, to: destination });
  return destination;
}

export async function deleteStoredWallpaper(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    return;
  }
}
