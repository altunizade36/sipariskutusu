import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BoxMascot from '../components/BoxMascot';

type Props = {
  onLogin?: () => void;
  onRegister?: () => void;
};

export default function WelcomeScreen({ onLogin, onRegister }: Props) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.logoArea}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Sipariş Kutusu</Text>
        </View>

        <BoxMascot variant="welcome" size={230} animated />

        <Text style={styles.title}>Sipariş Kutusu’na hoş geldin</Text>
        <Text style={styles.subtitle}>
          Instagram satıcılarıyla alıcıları tek yerde buluşturan modern ilan ve alışveriş platformu.
        </Text>

        <View style={styles.buttonArea}>
          <TouchableOpacity style={styles.primaryButton} onPress={onLogin}>
            <Text style={styles.primaryButtonText}>Giriş Yap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onRegister}>
            <Text style={styles.secondaryButtonText}>Kayıt Ol</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BLUE = '#0A66FF';
const DARK = '#0D1B2A';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 18,
  },
  brandName: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: '800',
    color: DARK,
  },
  title: {
    marginTop: 24,
    fontSize: 26,
    fontWeight: '800',
    color: DARK,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#516070',
    textAlign: 'center',
  },
  buttonArea: {
    width: '100%',
    marginTop: 34,
    gap: 12,
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: BLUE,
    fontSize: 16,
    fontWeight: '800',
  },
});