import * as ImagePicker from 'expo-image-picker';

type MediaPickMode = 'images' | 'videos';

export async function pickMediaFromLibrary(mode: MediaPickMode = 'images') {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Galeri izni gerekli.');
  }

  const mediaTypes: ImagePicker.MediaType[] = mode === 'videos' ? ['videos'] : ['images'];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: mode !== 'videos',
    aspect: [4, 3],
    quality: 0.85,
    videoMaxDuration: 60,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  return result.assets[0].uri;
}

export async function pickImageFromLibrary() {
  return pickMediaFromLibrary('images');
}

export async function pickImageFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Kamera izni gerekli.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
  });
  if (result.canceled || !result.assets?.length) {
    return null;
  }
  return result.assets[0].uri;
}
