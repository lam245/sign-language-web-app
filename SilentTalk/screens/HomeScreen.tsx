import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  StatusBar,
  Text,
  Dimensions,
  Animated,
  Easing,
  Modal,
  BackHandler,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import NetInfo from '@react-native-community/netinfo';
import apiService from '../services/apiService';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function HomeScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.front);
  const [isRecording, setIsRecording] = useState(false);
  const [video, setVideo] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    status: 'ready' | 'processing' | 'offline';
    modelAvailable: boolean;
  }>({ status: 'ready', modelAvailable: true });
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const cameraRef = useRef<Camera | null>(null);

  // Animated spin value and loop reference
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Set mock service status on mount
  useEffect(() => {
    const initMockService = async () => {
      try {
        const status = await apiService.checkServerStatus();
        setServerStatus({
          status: status.isRunning ? 'ready' : 'offline',
          modelAvailable: status.modelAvailable
        });
        
        if (!status.isRunning) {
          Alert.alert(
            'No Internet Connection',
            'The sign recognition model requires internet access. Please connect to the internet and try again.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error("Error initializing mock service:", error);
        setServerStatus({
          status: 'offline',
          modelAvailable: false
        });
      }
    };
    
    initMockService();
  }, []);

  // Network connection listener
  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log("Connection state changed:", state);
      
      const isConnected = state.isConnected && 
        (state.type === 'cellular' || state.type === 'wifi');
      
      // Update server status based on connection state
      setServerStatus(prevStatus => {
        // Only update if connection state actually changed
        // or if we're currently in 'processing' state
        if ((isConnected && prevStatus.status === 'offline') || 
            (!isConnected && prevStatus.status === 'ready') ||
            prevStatus.status === 'processing') {
          
          return {
            status: isConnected ? 'ready' : 'offline',
            modelAvailable: isConnected
          };
        }
        
        // No change needed
        return prevStatus;
      });
      
      // Show an alert if connection is lost while not processing
      if (!isConnected && serverStatus.status === 'ready') {
        Alert.alert(
          'Connection Lost',
          'Internet connection lost. The sign recognition model requires internet access.',
          [{ text: 'OK' }]
        );
      } 
      // Show reconnected message if connection is restored
      else if (isConnected && serverStatus.status === 'offline') {
        Alert.alert(
          'Connected',
          'Internet connection restored. The sign recognition model is now available.',
          [{ text: 'OK' }]
        );
      }
    });

    // Clean up the listener on component unmount
    return () => {
      unsubscribe();
    };
  }, [serverStatus.status]);

  // Handle Android back button to close modal
  useEffect(() => {
    const backAction = () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [modalVisible]);

  // Start or stop the spinning animation when `processing` changes
  useEffect(() => {
    if (processing) {
      spinLoop.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinLoop.current = null;
      spinValue.setValue(0);
    }
  }, [processing, spinValue]);

  // Interpolate spin value to degrees
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Request permissions for camera, microphone, and media library
  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      const mediaLibraryStatus = await MediaLibrary.requestPermissionsAsync();

      setHasPermission(
        cameraStatus.status === 'granted' &&
        audioStatus.status === 'granted' &&
        mediaLibraryStatus.status === 'granted'
      );
    })();
  }, []);

  // Pick video from library
  const pickVideo = async () => {
    // Check current connection status
    if (serverStatus.status === 'offline') {
      Alert.alert(
        'No Internet Connection',
        'The sign recognition model requires internet access. Please connect to the internet and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      console.log('Selected video:', result.assets[0]);
      console.log('File URI:', result.assets[0].uri);
      const filename = result.assets[0].uri.split('/').pop() || '';
      console.log('Extracted filename:', filename);
      
      setVideo(result.assets[0]);
      processVideo(result.assets[0].uri);
    }
  };

  // Toggle between front and back cameras
  const toggleCameraType = () => {
    setCameraType(current =>
      current === CameraType.back
        ? CameraType.front
        : CameraType.back
    );
  };

  // Toggle recording
  const toggleRecording = async () => {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      // Check current connection status
      if (serverStatus.status === 'offline') {
        Alert.alert(
          'No Internet Connection',
          'The sign recognition model requires internet access. Please connect to the internet and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      setRecognitionResult(null);
      if (cameraRef.current) {
        setIsRecording(true);
        try {
          const recorded = await cameraRef.current.recordAsync({
            maxDuration: 10,
            quality: '720p',
          });
          setVideo(recorded);
          processVideoRecorded(recorded.uri);
        } catch (error) {
          console.error('Recording error:', error);
          setIsRecording(false);
          Alert.alert(
            'Recording Error',
            'Failed to record video. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  };

  // Process video from gallery
  const processVideo = async (videoUri: string) => {
    try {
      setProcessing(true);
      setServerStatus({
        status: 'processing',
        modelAvailable: true
      });
      
      // Call the mock service to process the video with skipConnectionCheck=true
      // since we've already checked connection before getting here
      const result = await apiService.processVideo(videoUri, false, true);
      
      // Always wait exactly 5 seconds for the loading animation regardless of processing time
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (result.success) {
        setRecognitionResult(result.prediction);
        setConfidence(result.confidence);
      } else {
        setRecognitionResult(result.error || 'Error: Unable to recognize sign');
        setConfidence(null);
      }
      
      setProcessing(false);
      setIsCameraActive(false);
      setModalVisible(true);
      
      // Update server status based on the result
      setServerStatus({
        status: 'ready',
        modelAvailable: true
      });
    } catch (error) {
      console.error('Error processing video:', error);
      setProcessing(false);
      Alert.alert(
        'Error',
        'Failed to process video. Please try again.',
        [{ text: 'OK' }]
      );
      setServerStatus({
        status: 'ready',
        modelAvailable: true
      });
    }
  };

  // Process recorded video
  const processVideoRecorded = async (videoUri: string) => {
    try {
      setProcessing(true);
      setServerStatus({
        status: 'processing',
        modelAvailable: true
      });
      
      // Call the mock service to process the video with skipConnectionCheck=true
      // since we've already checked connection before getting here
      const result = await apiService.processVideo(videoUri, true, true);
      
      // Always wait exactly 5 seconds for the loading animation regardless of processing time
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      if (result.success) {
        setRecognitionResult(result.prediction);
        setConfidence(result.confidence);
      } else {
        setRecognitionResult(result.error || 'Error: Unable to recognize sign');
        setConfidence(null);
      }
      
      setProcessing(false);
      setIsCameraActive(false);
      setModalVisible(true);
      
      // Update server status based on the result
      setServerStatus({
        status: 'ready',
        modelAvailable: true
      });
    } catch (error) {
      console.error('Error processing video:', error);
      setProcessing(false);
      Alert.alert(
        'Error',
        'Failed to process video. Please try again.',
        [{ text: 'OK' }]
      );
      setServerStatus({
        status: 'ready',
        modelAvailable: true
      });
    }
  };

  // Close modal and reactivate camera
  const closeModal = () => {
    setModalVisible(false);
    setTranslatedText(null); // Reset translation when closing modal
    setTimeout(() => {
      setIsCameraActive(true);
    }, 300);
  };

  // Add a reconnect function to check internet connection
  const checkInternetConnection = async () => {
    setServerStatus({
      status: 'processing',
      modelAvailable: false
    });
    
    try {
      // Get current network state
      const state = await NetInfo.fetch();
      const isNetInfoConnected = state.isConnected && 
        (state.type === 'cellular' || state.type === 'wifi');
      
      // Double-check with a lightweight fetch 
      let isFetchSuccessful = false;
      if (isNetInfoConnected) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch('https://www.google.com', { 
            method: 'HEAD',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          isFetchSuccessful = response.ok;
        } catch (error) {
          console.log('Network fetch check failed:', error);
          isFetchSuccessful = false;
        }
      }
      
      // Final connection status
      const isConnected = isNetInfoConnected && isFetchSuccessful;
      
      setServerStatus({
        status: isConnected ? 'ready' : 'offline',
        modelAvailable: isConnected
      });
      
      if (isConnected) {
        Alert.alert(
          'Connected',
          'Internet connection restored. The sign recognition model is now available.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Internet Connection',
          'Unable to connect to the internet. The sign recognition model requires internet access.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setServerStatus({
        status: 'offline',
        modelAvailable: false
      });
    }
  };

  // Translate the recognition result to Vietnamese
  const translateToVietnamese = async () => {
    if (!recognitionResult) return;
    
    try {
      setIsTranslating(true);
      const result = await apiService.translateToVietnamese(recognitionResult);
      
      if (result.success) {
        setTranslatedText(result.translatedText || null);
      } else {
        Alert.alert('Translation Error', result.error || 'Failed to translate');
      }
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Failed to translate text');
    } finally {
      setIsTranslating(false);
    }
  };

  // Permission states rendering
  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No access to camera or media library</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* Local processing status indicator */}
      <View style={styles.serverStatusContainer}>
        <View style={[
          styles.statusIndicator,
          serverStatus.status === 'ready' 
            ? styles.statusOnline 
            : serverStatus.status === 'offline'
              ? styles.statusOffline
              : styles.statusChecking
        ]} />
        <Text style={styles.statusText}>
          Status: {
            serverStatus.status === 'ready' 
              ? 'Ready' 
              : serverStatus.status === 'offline'
                ? 'No Internet'
                : 'Processing...'
          }
        </Text>
        {serverStatus.status === 'processing' && <ActivityIndicator size="small" color="#fff" />}
        {serverStatus.status === 'offline' && (
          <TouchableOpacity onPress={checkInternetConnection} style={styles.reconnectButton}>
            <Text style={styles.reconnectText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {isCameraActive ? (
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={cameraType}
          ratio="16:9"
        >
          {processing && (
            <View style={styles.processingOverlay}>
              <View style={styles.processingIndicatorContainer}>
                <Animated.View 
                  style={[
                    styles.rotatingRing, 
                    { transform: [{ rotate: spin }] }
                  ]}
                />
                <Text style={styles.overlappingProcessingText}>Đang xử lý</Text>
              </View>
            </View>
          )}

          <View style={styles.controlBarContainer}>
            <View style={styles.controlBar}>
              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={pickVideo}
              >
                <MaterialIcons name="photo-library" size={36} color="black" />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.recordButton} 
                onPress={toggleRecording}
              >
                <MaterialCommunityIcons
                  name={isRecording ? "stop" : "camera-iris"}
                  size={42}
                  color="black"
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton} onPress={toggleCameraType}>
                <MaterialIcons name="flip-camera-ios" size={36} color="black" />
              </TouchableOpacity>
            </View>
          </View>
        </Camera>
      ) : (
        <View style={[styles.camera, { backgroundColor: 'black' }]} />
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalResultText}>{recognitionResult}</Text>
                
                {translatedText && (
                  <View style={styles.translationContainer}>
                    <Text style={styles.translationLabel}>Tiếng Việt:</Text>
                    <Text style={styles.translationText}>{translatedText}</Text>
                  </View>
                )}
                
                <View style={styles.modalButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modalButton, 
                      styles.translateButton,
                      translatedText ? styles.disabledButton : null
                    ]}
                    onPress={translateToVietnamese}
                    disabled={isTranslating || !recognitionResult || translatedText !== null}
                  >
                    {isTranslating ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[
                        styles.modalButtonText,
                        translatedText ? styles.disabledButtonText : null
                      ]}>Translate to Vietnamese</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.closeButton]}
                    onPress={closeModal}
                  >
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  text: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    padding: 20,
  },
  controlBarContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  controlBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(231, 161, 167, 1)',
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 25,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.8,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(231, 161, 167, 1)',
    marginHorizontal: 15,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingIndicatorContainer: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rotatingRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    borderColor: 'rgba(231, 161, 167, 0.5)',
    borderBottomColor: 'rgba(231, 161, 167, 1)',
    position: 'absolute',
  },
  overlappingProcessingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalResultText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  confidenceText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 10,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    marginVertical: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  translateButton: {
    backgroundColor: '#4CAF50',
  },
  closeButton: {
    backgroundColor: '#e7a1a7',
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalCloseButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
  translationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 15,
    width: '100%',
  },
  translationLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 5,
  },
  translationText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  serverStatusContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusChecking: {
    backgroundColor: '#FFC107',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
  },
  statusOffline: {
    backgroundColor: '#F44336', // Red color for offline status
  },
  reconnectButton: {
    marginLeft: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  reconnectText: {
    color: 'white',
    fontSize: 10,
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.7,
  },
  disabledButtonText: {
    color: '#aaa',
  },
});
