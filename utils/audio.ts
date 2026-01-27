import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';



let sound: Audio.Sound | null = null;

type DownloadProgressData = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
};

const getAudioURI = (surahNumber: number) => {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return null;
  return `${docDir}surah_${surahNumber}.mp3`;
};

export const downloadAudio = async (surahNumber: number, onProgress: (progress: number) => void): Promise<boolean> => {
  const url = `https://server8.mp3quran.net/afs/${String(surahNumber).padStart(3, '0')}.mp3`;
  const uri = getAudioURI(surahNumber);
  if (!uri) return false;

  const callback = (downloadProgress: DownloadProgressData) => {
    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
    onProgress(progress);
  };

  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    uri,
    {},
    callback
  );

  try {
    const downloadResult = await downloadResumable.downloadAsync();
    if (downloadResult) {
      console.log('Finished downloading to ', downloadResult.uri);
      return true;
    }
    return false;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const playAudio = async (surahNumber: number, onPlaybackStatusUpdate: (status: any) => void, isLooping: boolean, positionMillis: number = 0) => {
  if (sound) {
    await sound.unloadAsync();
  }
  const uri = getAudioURI(surahNumber);
  if (!uri) return;

  try {
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true, isLooping, positionMillis },
      onPlaybackStatusUpdate
    );
    sound = newSound;
  } catch (error) {
    console.error('Error playing audio:', error);
  }
};

export const pauseAudio = async () => {
  if (sound) {
    await sound.pauseAsync();
  }
};

export const resumeAudio = async () => {
  if (sound) {
    await sound.playAsync();
  }
};

export const setLooping = async (isLooping: boolean) => {
  if (sound) {
    await sound.setIsLoopingAsync(isLooping);
  }
};

export const seekAudio = async (position: number) => {
    if (sound) {
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) {
            const newPositionMillis = position * status.durationMillis;
            await sound.setPositionAsync(newPositionMillis);
        }
    }
};

export const stopAudio = async () => {
    if (sound) {
        await sound.unloadAsync();
        sound = null;
    }
};

export const checkIfAudioExists = async (surahNumber: number): Promise<boolean> => {
    const uri = getAudioURI(surahNumber);
    if (!uri) return false;
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists;
};

export const deleteAudio = async (surahNumber: number) => {
    const uri = getAudioURI(surahNumber);
    if (!uri) return;
    try {
        await FileSystem.deleteAsync(uri);
    } catch (error) {
        console.error("Error deleting audio:", error);
    }
};
