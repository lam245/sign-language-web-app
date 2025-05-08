import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

// Counter to track number of uploads (for fallback mode only)
let uploadCounter = 0;

// API Configuration
const API_CONFIG = {
  // Use localhost in development, change to your server IP/domain for production
  baseUrl: 'http://localhost:3000/api',
  useServerWhenAvailable: true, // Set to true to use server when available
  fallbackToLocalWhenOffline: false // Set to false to disable local processing when server is unreachable
};

// Interface for the recognition result
interface RecognitionResult {
  success: boolean;
  prediction?: string;
  confidence?: number;
  error?: string;
}

// Interface for translation result
interface TranslationResult {
  success: boolean;
  translatedText?: string;
  error?: string;
}

// Mapping of keywords in filenames to specific sign predictions (for fallback mode)
const filenameToSignMap: Record<string, { prediction: string, confidence: number }> = {
  "hello": { prediction: "Hello", confidence: 0.95 },
  "thank": { prediction: "Thank you", confidence: 0.92 },
  "goodbye": { prediction: "Goodbye", confidence: 0.91 },
  "yes": { prediction: "Yes", confidence: 0.98 },
  "no": { prediction: "No", confidence: 0.97 },
  "please": { prediction: "Please", confidence: 0.90 },
  "help": { prediction: "Help", confidence: 0.92 },
  "love": { prediction: "I love you", confidence: 0.93 },
  "friend": { prediction: "Friend", confidence: 0.89 },
  "family": { prediction: "Family", confidence: 0.88 },
  "hungry": { prediction: "Hungry", confidence: 0.87 },
  "drink": { prediction: "Drink", confidence: 0.86 },
  "name": { prediction: "Name", confidence: 0.84 },
  "time": { prediction: "Time", confidence: 0.85 },
  "school": { prediction: "School", confidence: 0.86 },
  "howareyou": { prediction: "How are you?", confidence: 0.91 },
  "idontunderstand": { prediction: "I don't understand", confidence: 0.89 }
};

// Static translations for fallback functionality
const englishToVietnameseMap: Record<string, string> = {
  "Hello": "Xin chào",
  "Thank you": "Cảm ơn bạn",
  "Goodbye": "Tạm biệt",
  "Yes": "Vâng / Có",
  "No": "Không",
  "Please": "Xin vui lòng",
  "Help": "Giúp đỡ",
  "I love you": "Tôi yêu bạn",
  "Friend": "Bạn bè",
  "Family": "Gia đình",
  "Hungry": "Đói",
  "Drink": "Uống",
  "Name": "Tên",
  "Time": "Thời gian",
  "School": "Trường học",
  "How are you?": "Bạn khỏe không?",
  "I don't understand": "Tôi không hiểu",
  "Unknown Sign": "Ký hiệu không xác định"
};

/**
 * Sign Language Recognition API service
 */
export default {
  /**
   * Check if the device has an internet connection
   * @returns Promise with connection status
   */
  async checkConnection(): Promise<boolean> {
    try {
      // Use NetInfo to check connectivity status
      const netInfoState = await NetInfo.fetch();
      
      // If it's a cellular or wifi connection and isConnected is true
      if (netInfoState.isConnected && 
         (netInfoState.type === 'cellular' || netInfoState.type === 'wifi')) {
        // Double-check with a lightweight fetch
        try {
          // Use AbortController instead of AbortSignal.timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch('https://www.google.com', { 
            method: 'HEAD',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response.ok;
        } catch (error) {
          console.log('Network fetch check failed:', error);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.log('Network connection check failed:', error);
      return false;
    }
  },
  
  /**
   * Check if the recognition server is available
   * @returns Promise with server status
   */
  async checkServerAvailability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${API_CONFIG.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Server status:', data);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Server availability check failed:', error);
      return false;
    }
  },

  /**
   * Process a video for sign language recognition
   * @param videoUri URI to the video file
   * @param isRecorded Optional flag to indicate if the video was recorded by the user
   * @param skipConnectionCheck Optional flag to skip the connection check
   * @returns Promise with the recognition result
   */
  async processVideo(videoUri: string, isRecorded: boolean = false, skipConnectionCheck: boolean = false): Promise<RecognitionResult> {
    try {
      console.log(`Processing video: ${videoUri}`);
      
      // Check for internet connection first (unless we're skipping this check)
      if (!skipConnectionCheck) {
        const hasConnection = await this.checkConnection();
        if (!hasConnection) {
          return {
            success: false,
            error: 'No internet connection. The sign recognition model requires internet access.'
          };
        }
      }
      
      // Get file info to verify it exists
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }
      
      console.log(`File size: ${fileInfo.size} bytes`);
      
      // Extract the filename for logging
      const filename = videoUri.split('/').pop() || '';
      console.log(`Video submitted: ${filename}`);
      
      // Check if the server is available
      const isServerAvailable = await this.checkServerAvailability();
      if (!isServerAvailable) {
        return {
          success: false,
          error: 'Recognition server is not available. Please try again later.'
        };
      }
      
      // Use server for recognition
      console.log('Using server for recognition');
      return await this.processVideoWithServer(videoUri, isRecorded);
    } catch (error: any) {
      console.error('Error processing video:', error.message);
      
      // Return error response
      return {
        success: false,
        error: error.message || 'Failed to process video'
      };
    }
  },
  
  /**
   * Process video using the remote server
   * @param videoUri Video URI
   * @param isRecorded Whether video was recorded
   */
  async processVideoWithServer(videoUri: string, isRecorded: boolean): Promise<RecognitionResult> {
    try {
      // Create form data for file upload
      const formData = new FormData();
      
      // Add the video file
      // Note: We need to give a proper name with file extension for multer to work correctly
      const fileExtension = videoUri.split('.').pop() || 'mp4';
      const fileName = `video_${Date.now()}.${fileExtension}`;
      
      // @ts-ignore - This is a react-native specific FormData format
      formData.append('video', {
        uri: Platform.OS === 'ios' ? videoUri.replace('file://', '') : videoUri,
        name: fileName,
        type: `video/${fileExtension}`
      });
      
      // Add metadata
      formData.append('isRecorded', isRecorded.toString());
      
      // Send the request
      const response = await fetch(`${API_CONFIG.baseUrl}/recognize`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data'
        },
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return {
          success: true,
          prediction: result.prediction,
          confidence: result.confidence
        };
      } else {
        throw new Error(result.error || 'Failed to process video on server');
      }
    } catch (error: any) {
      console.error('Server processing error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to process video on the server'
      };
    }
  },
  
  /**
   * Fallback local processing (same as the old implementation)
   * @param videoUri Video URI
   * @param isRecorded Whether video was recorded
   */
  processVideoLocally(videoUri: string, isRecorded: boolean): RecognitionResult {
    // If the video was recorded by the user, always return "Hello"
    if (isRecorded) {
      return {
        success: true,
        prediction: "Hello",
        confidence: 0.98
      };
    }
    
    // For uploaded videos, use the upload counter for testing specific signs
    uploadCounter++;
    console.log(`Upload counter: ${uploadCounter}`);
    
    // Based on upload order
    if (uploadCounter === 1) {
      console.log('First upload: How are you?');
      return {
        success: true,
        prediction: "How are you?",
        confidence: 0.91
      };
    } else if (uploadCounter === 2) {
      console.log('Second upload: I don\'t understand');
      return {
        success: true,
        prediction: "I don't understand",
        confidence: 0.89
      };
    } else {
      // For third and subsequent uploads, use the filename approach as fallback
      const filename = videoUri.split('/').pop() || '';
      const filenameLower = filename.toLowerCase();
      
      // Remove file extension before matching
      const filenameWithoutExt = filenameLower.replace(/\.\w+$/, '');
      
      // Look for keywords in the filename without extension
      for (const [keyword, signInfo] of Object.entries(filenameToSignMap)) {
        if (filenameWithoutExt.includes(keyword)) {
          return {
            success: true,
            prediction: signInfo.prediction,
            confidence: signInfo.confidence
          };
        }
      }
      
      // Default response if no match found
      return {
        success: true,
        prediction: "Unknown Sign",
        confidence: 0.6
      };
    }
  },
  
  /**
   * Translate text to Vietnamese
   * @param text Text to translate
   * @returns Promise with the translation result
   */
  async translateToVietnamese(text: string): Promise<TranslationResult> {
    try {
      // Check for internet connection first
      const hasConnection = await this.checkConnection();
      if (!hasConnection) {
        return {
          success: false,
          error: 'No internet connection. Translation requires internet access.'
        };
      }
      
      // Check if the server is available
      const isServerAvailable = await this.checkServerAvailability();
      if (!isServerAvailable) {
        return {
          success: false,
          error: 'Translation server is not available. Please try again later.'
        };
      }
      
      // Use server for translation
      console.log('Using server for translation');
      return await this.translateWithServer(text);
    } catch (error: any) {
      console.error('Error translating text:', error.message);
      
      // Return error response
      return {
        success: false,
        error: error.message || 'Failed to translate text'
      };
    }
  },
  
  /**
   * Translate text using the server
   * @param text Text to translate
   */
  async translateWithServer(text: string): Promise<TranslationResult> {
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          text,
          targetLanguage: 'vi'
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        return {
          success: true,
          translatedText: result.translatedText
        };
      } else {
        throw new Error(result.error || 'Failed to translate text on server');
      }
    } catch (error: any) {
      console.error('Server translation error:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to translate text on the server'
      };
    }
  },
  
  /**
   * Local fallback translation
   * @param text Text to translate
   */
  translateLocally(text: string): TranslationResult {
    if (englishToVietnameseMap[text]) {
      return {
        success: true,
        translatedText: englishToVietnameseMap[text]
      };
    }
    
    // Generic translation for unknown texts
    return {
      success: true,
      translatedText: `[${text} - Bản dịch tiếng Việt]`
    };
  },
  
  /**
   * Check if the remote server is running and available
   * @returns Promise with server status
   */
  async checkServerStatus() {
    // Check for internet connection
    const hasConnection = await this.checkConnection();
    if (!hasConnection) {
      return {
        isRunning: false,
        message: 'No internet connection',
        modelAvailable: false
      };
    }
    
    // Check server availability
    const isServerAvailable = await this.checkServerAvailability();
    
    return { 
      isRunning: isServerAvailable,
      message: isServerAvailable ? 'Recognition server is running' : 'Server not available. Please try again later.',
      modelAvailable: isServerAvailable // Model is only available if server is running
    };
  },
  
  /**
   * Simple test function to directly check connectivity
   * This can be called to diagnose network issues
   */
  async testConnection() {
    try {
      const netInfoState = await NetInfo.fetch();
      console.log('NetInfo state:', netInfoState);
      
      const isConnected = await this.checkConnection();
      console.log('Connection check result:', isConnected);
      
      const isServerAvailable = await this.checkServerAvailability();
      console.log('Server availability:', isServerAvailable);
      
      return {
        netInfoConnected: netInfoState.isConnected,
        netInfoType: netInfoState.type,
        fetchSuccessful: isConnected,
        serverAvailable: isServerAvailable,
        mode: isServerAvailable ? 'server' : 'offline'
      };
    } catch (error) {
      console.error('Test connection error:', error);
      return {
        error: error?.toString(),
        netInfoConnected: false,
        fetchSuccessful: false,
        serverAvailable: false,
        mode: 'error'
      };
    }
  }
}; 