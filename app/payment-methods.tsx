import FeatureRetiredScreen from '../src/components/FeatureRetiredScreen';

export default function PaymentMethodsScreen() {
  return (
    <FeatureRetiredScreen
      title="Ödeme Altyapısı Devre Dışı"
      description="Bu uygulamada ödeme alma veya kart saklama bulunmuyor. Ödeme yöntemi alıcı ve satıcı arasında mesajlaşma ile belirlenir."
    />
  );
}
