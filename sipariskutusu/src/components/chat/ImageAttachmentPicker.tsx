import { Alert } from 'react-native';
import { pickImageFromLibrary } from '../../utils/imagePicker';

type ImageAttachmentPickerProps = {
  onPicked: (uri: string) => Promise<void> | void;
};

export async function openImageAttachmentPicker({ onPicked }: ImageAttachmentPickerProps) {
  try {
    const uri = await pickImageFromLibrary();
    if (!uri) return;
    await onPicked(uri);
  } catch {
    Alert.alert('Hata', 'Görsel seçilirken bir sorun oluştu.');
  }
}
