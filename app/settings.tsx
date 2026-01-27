
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Link } from 'expo-router';

export default function SettingsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>الإعدادات</ThemedText>
      <ThemedView style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      
      <Link href="/terms" asChild>
        <TouchableOpacity style={styles.menuItem}>
          <ThemedText style={styles.menuText}>شروط الخدمة</ThemedText>
        </TouchableOpacity>
      </Link>

      <ThemedView style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />

      <TouchableOpacity onPress={() => Linking.openURL('https://quadravexa.com')}>
        <ThemedText style={styles.footerText}>هذا البرنامج من تطوير شركة quadravexa.com</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  separator: {
    marginVertical: 15,
    height: 1,
    width: '80%',
    alignSelf: 'center',
  },
  menuItem: {
    paddingVertical: 15,
  },
  menuText: {
    fontSize: 18,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    color: '#888',
  },
});
