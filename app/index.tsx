import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as audio from '@/utils/audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
}

type PlaybackMode = 'playOnce' | 'repeat';

const LAST_PLAYBACK_STATE_KEY = 'lastPlaybackState';

export default function HomeScreen() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(true);
  const [downloadedSurahs, setDownloadedSurahs] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState<{ [key: number]: boolean }>({});
  const [downloadProgress, setDownloadProgress] = useState<{ [key: number]: number }>({});
  const [playbackStatus, setPlaybackStatus] = useState<AVPlaybackStatus | null>(null);
  const [activeSurah, setActiveSurah] = useState<Surah | null>(null);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('playOnce');
  const [sliderValue, setSliderValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [extraData, setExtraData] = useState(0);

  const appState = useRef(AppState.currentState);
  const tintColor = useThemeColor({}, 'tint');
  const theme = useColorScheme();

  const updateDownloadedStatus = useCallback(async (allSurahs: Surah[]) => {
    if (allSurahs.length === 0) return;
    const statuses = await Promise.all(allSurahs.map(s => audio.checkIfAudioExists(s.number)));
    const downloaded = new Set<number>();
    statuses.forEach((exists, index) => {
      if (exists) {
        downloaded.add(allSurahs[index].number);
      }
    });
    setDownloadedSurahs(downloaded);
  }, []);

  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(response => response.json())
      .then(async data => {
        const allSurahs: Surah[] = data.data;
        setSurahs(allSurahs);
        await updateDownloadedStatus(allSurahs);
        setLoading(false);
      })
      .catch(error => {
        console.error(error);
        setLoading(false);
      });
  }, [updateDownloadedStatus]);

  useEffect(() => {
    const saveState = async () => {
      const status = playbackStatus as AVPlaybackStatusSuccess;
      if (activeSurah && status && status.isLoaded) {
        const state = {
          surahNumber: activeSurah.number,
          positionMillis: status.positionMillis,
          durationMillis: status.durationMillis,
        };
        await AsyncStorage.setItem(LAST_PLAYBACK_STATE_KEY, JSON.stringify(state));
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        saveState();
      }
      appState.current = nextAppState;
    });

    return () => {
      saveState(); 
      subscription.remove();
    };
  }, [activeSurah, playbackStatus]);

  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedStateJSON = await AsyncStorage.getItem(LAST_PLAYBACK_STATE_KEY);
        if (!savedStateJSON) return;

        const savedState = JSON.parse(savedStateJSON);
        if (!downloadedSurahs.has(savedState.surahNumber)) return;

        const surahToRestore = surahs.find(s => s.number === savedState.surahNumber);
        if (surahToRestore) {
          setActiveSurah(surahToRestore);
          const initialStatus: AVPlaybackStatusSuccess = {
            isLoaded: true, uri: '', progressUpdateIntervalMillis: 100,
            durationMillis: savedState.durationMillis, positionMillis: savedState.positionMillis,
            playableDurationMillis: savedState.durationMillis, shouldPlay: false, isPlaying: false, isBuffering: false,
            rate: 1.0, shouldCorrectPitch: false, volume: 1.0, isMuted: false, isLooping: false, didJustFinish: false,
            seekMillisToleranceBefore: 0, seekMillisToleranceAfter: 0, audioPan: 0
          };
          setPlaybackStatus(initialStatus);
          if (savedState.durationMillis) {
            setSliderValue(savedState.positionMillis / savedState.durationMillis);
          }
        }
      } catch (e) {
        console.error("Failed to load playback state.", e);
      } finally {
        setIsRestoring(false);
      }
    };

    if (!loading && surahs.length > 0 && downloadedSurahs.size > 0) {
      restoreState();
    } else if (!loading) {
      setIsRestoring(false);
    }
  }, [surahs, loading, downloadedSurahs]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    setPlaybackStatus(status);
    const successStatus = status as AVPlaybackStatusSuccess;
    if (successStatus.isLoaded && !isSeeking) {
      const progress = successStatus.positionMillis / (successStatus.durationMillis || 1);
      setSliderValue(progress);
    }
    if (successStatus?.didJustFinish && !successStatus.isLooping) {
      handleNextTrack();
    }
  };

  const handleNextTrack = () => {
    if (!activeSurah) return;
    const currentSurahIndex = surahs.findIndex(s => s.number === activeSurah.number);
    if (currentSurahIndex < surahs.length - 1) {
      const nextSurah = surahs[currentSurahIndex + 1];
      if (downloadedSurahs.has(nextSurah.number)) {
        handlePlayPause(nextSurah);
      } else {
        setActiveSurah(null);
        setPlaybackStatus(null);
      }
    } else {
      setActiveSurah(null);
      setPlaybackStatus(null);
    }
  };

  const handleDownloadAndPlay = async (surah: Surah) => {
    if (downloading[surah.number]) return;

    setDownloading(prev => ({ ...prev, [surah.number]: true }));
    setDownloadProgress(prev => ({ ...prev, [surah.number]: 0 }));
    setExtraData(val => val + 1);

    const onProgress = (progress: number) => {
        setDownloadProgress(prev => ({ ...prev, [surah.number]: progress }));
        setExtraData(val => val + 1);
    };

    const success = await audio.downloadAudio(surah.number, onProgress);

    setDownloading(prev => ({ ...prev, [surah.number]: false }));
    
    if (success) {
      setDownloadedSurahs(prev => new Set(prev).add(surah.number));
      await audio.playAudio(surah.number, handlePlaybackStatusUpdate, playbackMode === 'repeat', 0);
      setActiveSurah(surah);
    } else {
      Alert.alert('خطأ', 'فشل تحميل السورة. يرجى التحقق من اتصالك بالإنترنت.');
    }
    setExtraData(val => val + 1);
  };

  const handleDownloadAll = async () => {
    for (const surah of surahs) {
      if (!downloadedSurahs.has(surah.number)) {
        await handleDownloadAndPlay(surah); 
      }
    }
  };

  const handleDelete = async (surah: Surah) => {
    if (activeSurah?.number === surah.number) {
      await audio.stopAudio();
      setActiveSurah(null);
      setPlaybackStatus(null);
      await AsyncStorage.removeItem(LAST_PLAYBACK_STATE_KEY);
    }
    await audio.deleteAudio(surah.number);
    setDownloadedSurahs(prev => {
      const newSet = new Set(prev);
      newSet.delete(surah.number);
      return newSet;
    });
    setExtraData(val => val + 1);
  };

  const handleDeleteAll = () => {
    Alert.alert(
      'حذف الكل', 'هل أنت متأكد أنك تريد حذف جميع السور المحملة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف', style: 'destructive',
          onPress: async () => {
            await audio.stopAudio();
            setActiveSurah(null);
            setPlaybackStatus(null);
            await Promise.all(Array.from(downloadedSurahs).map(surahNumber => audio.deleteAudio(surahNumber)));
            setDownloadedSurahs(new Set());
            await AsyncStorage.removeItem(LAST_PLAYBACK_STATE_KEY);
            setExtraData(val => val + 1);
          },
        },
      ]
    );
  };

  const handlePlayPause = async (surah: Surah) => {
    const currentStatus = playbackStatus as AVPlaybackStatusSuccess;
    if (activeSurah?.number === surah.number && currentStatus?.isLoaded) {
      if (currentStatus.isPlaying) {
        await audio.pauseAudio();
      } else {
        await audio.resumeAudio();
      }
    } else {
      await audio.playAudio(surah.number, handlePlaybackStatusUpdate, playbackMode === 'repeat', 0);
      setActiveSurah(surah);
    }
  };

  const onSeek = (value: number) => {
      setSliderValue(value);
      setIsSeeking(true);
  };

  const onSlidingComplete = async (value: number) => {
      await audio.seekAudio(value);
      setIsSeeking(false);
  };

  const togglePlaybackMode = (mode: PlaybackMode) => {
    setPlaybackMode(mode);
    const isLooping = mode === 'repeat';
    audio.setLooping(isLooping);
  };

  const renderItem = ({ item }: { item: Surah }) => {
    const isDownloaded = downloadedSurahs.has(item.number);
    const isDownloading = downloading[item.number];
    const isPlaying = activeSurah?.number === item.number && (playbackStatus as AVPlaybackStatusSuccess)?.isPlaying;

    const onPress = () => {
        if (isDownloaded) {
            handlePlayPause(item);
        } else {
            handleDownloadAndPlay(item);
        }
    }

    let buttonText = isDownloaded ? (isPlaying ? 'وقف' : 'تشغيل') : 'تحميل و تشغيل';
    if (isDownloading) {
        const progress = downloadProgress[item.number] || 0;
        buttonText = `جاري التحميل... ${Math.round(progress * 100)}%`;
    }

    return (
        <ThemedView style={styles.itemContainer}>
            <View style={styles.surahInfoContainer}>
                <ThemedText style={styles.surahName}>{item.name}</ThemedText>
                <ThemedText type="subtitle">{item.englishName}</ThemedText>
            </View>
            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={onPress} disabled={isDownloading}>
                    <ThemedText style={{ color: tintColor }}>{buttonText}</ThemedText>
                </TouchableOpacity>
                {isDownloaded && !isDownloading && (
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item)}>
                        <ThemedText style={{ color: 'red' }}>حذف</ThemedText>
                    </TouchableOpacity>
                )}
            </View>
        </ThemedView>
    );
};


  const formatTime = (millis: number) => {
    if (!millis) return '0:00';
    const totalSeconds = millis / 1000;
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  if (loading || isRestoring) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.headerContainer}>
        <ThemedText style={styles.headerText}>برنامج العفاسي</ThemedText>
      </ThemedView>
      <ThemedView lightColor="#4CAF50" darkColor="#2E7D32" style={styles.bannerContainer}>
          <TouchableOpacity onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.quadravexa.salaty')}>
            <ThemedText style={styles.bannerText}>تحميل برنامج صلاتى لمواقيت الصلاة و الاذكار</ThemedText>
        </TouchableOpacity>
      </ThemedView>
      <View style={styles.mainButtonsContainer}>
        <TouchableOpacity style={[styles.mainButton, {backgroundColor: tintColor}]} onPress={handleDownloadAll} disabled={Object.values(downloading).some(d => d)}>
          <ThemedText style={[styles.mainButtonText, { color: theme === 'dark' ? '#000' : '#fff' }]}>تحميل الكل</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.mainButton, {backgroundColor: '#AA0000'}]} onPress={handleDeleteAll}>
          <ThemedText style={styles.mainButtonText}>حذف الكل</ThemedText>
        </TouchableOpacity>
      </View>
      <FlatList
        data={surahs}
        renderItem={renderItem}
        keyExtractor={item => item.number.toString()}
        extraData={extraData}
        contentContainerStyle={{ paddingBottom: activeSurah ? 180 : 0 }}
      />
      {activeSurah && (playbackStatus as AVPlaybackStatusSuccess)?.isLoaded && (
        <ThemedView style={styles.playerContainer}>
          <ThemedText style={styles.playerSurahName}>{activeSurah.name}</ThemedText>
           <View style={styles.playerControls}>
            <TouchableOpacity onPress={() => handlePlayPause(activeSurah)}>
              <ThemedText style={[styles.playerButton, {color: tintColor}]}>{(playbackStatus as AVPlaybackStatusSuccess).isPlaying ? 'وقف' : 'تشغيل'}</ThemedText>
            </TouchableOpacity>
             <View style={styles.timeContainer}>
                <ThemedText>{formatTime((playbackStatus as AVPlaybackStatusSuccess).positionMillis)}</ThemedText>
                <ThemedText>{formatTime((playbackStatus as AVPlaybackStatusSuccess).durationMillis || 0)}</ThemedText>
            </View>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={sliderValue}
            minimumTrackTintColor={tintColor}
            maximumTrackTintColor="#e0e0e0"
            thumbTintColor={tintColor}
            onValueChange={onSeek}
            onSlidingComplete={onSlidingComplete}
          />
          <View style={styles.modeSelectorContainer}>
            <TouchableOpacity onPress={() => togglePlaybackMode('playOnce')} style={[styles.modeButton, {borderColor: tintColor}, playbackMode === 'playOnce' && {backgroundColor: tintColor}]}>
              <ThemedText style={[styles.modeButtonText, {color: tintColor}, playbackMode === 'playOnce' && styles.activeModeButtonText]}>تشغيل مرة واحدة</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => togglePlaybackMode('repeat')} style={[styles.modeButton, {borderColor: tintColor}, playbackMode === 'repeat' && {backgroundColor: tintColor}]}>
              <ThemedText style={[styles.modeButtonText, {color: tintColor}, playbackMode === 'repeat' && styles.activeModeButtonText]}>تكرار السورة</ThemedText>
            </TouchableOpacity>
          </View>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: {
    padding: 15,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  bannerContainer: { padding: 10, margin: 10, borderRadius: 5 },
  bannerText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  mainButtonsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 10 },
  mainButton: { flex: 1, padding: 15, marginHorizontal: 5, borderRadius: 5, alignItems: 'center' },
  mainButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  itemContainer: { padding: 15, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  surahInfoContainer: { flex: 1 },
  surahName: { fontSize: 18 },
  actionsContainer: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { paddingHorizontal: 10 },
  playerContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, borderTopWidth: 1 },
  playerSurahName: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  playerControls: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  playerButton: { fontSize: 18 },
  slider: { width: '100%', height: 40 },
  timeContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10, flex: 1, marginLeft: 15 },
  modeSelectorContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
  modeButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  modeButtonText: { fontSize: 14 },
  activeModeButtonText: { color: '#fff' }
});
