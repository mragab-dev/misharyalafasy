
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { StyleSheet, TouchableOpacity, Linking, View } from 'react-native';
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

      <View style={styles.footerContainer}>
        <ThemedText style={styles.footerText}>هذا البرنامج من تطوير شركه</ThemedText>
        <TouchableOpacity onPress={() => Linking.openURL('https://www.quadravexa.com')}>
          <ThemedText style={[styles.footerText, styles.link]}>Quadravexa.com</ThemedText>
        </TouchableOpacity>
        
        <ThemedText style={[styles.footerText, { marginTop: 20 }]}>لأي استفسارات يمكنك التحدث معنا على</ThemedText>
        <TouchableOpacity onPress={() => Linking.openURL('mailto:support@quadravexa.com')}>
          <ThemedText style={[styles.footerText, styles.link]}>support@quadravexa.com</ThemedText>
        </TouchableOpacity>
      </View>
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
  footerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#888',
  },
  link: {
    color: '#1e90ff',
    textDecorationLine: 'underline',
    marginTop: 4,
  },
});
