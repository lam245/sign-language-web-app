import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';

// Counter to track number of uploads (for mock mode)
let uploadCounter = 0;

// Mock API Configuration
const API_CONFIG = {
  // Random external API address (mock only, not real endpoints)
  baseUrl: 'https://api.silenttalk-recognition.example.com/api',
  debugMode: false // Set to true to enable additional console logs
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

// Mapping of keywords in filenames to specific sign predictions (for mock responses)
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

// Static translations for mock functionality
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
 * Sign Language Recognition API service (Mock Implementation)
 * This service simulates API calls to a remote service
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
   * Simulate checking if the mock recognition service is available
   * @returns Promise with simulated service status
   */
  async checkServiceAvailability(): Promise<boolean> {
    try {
      // Check if we have an internet connection
      const hasConnection = await this.checkConnection();
      if (!hasConnection) {
        return false;
      }
      
      if (API_CONFIG.debugMode) {
        console.log('Simulating API health check to:', `${API_CONFIG.baseUrl}/health`);
      }
      
      // Simulate a network request with a short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Always return true if we have connection (since this is a mock)
      return true;
    } catch (error) {
      console.error('Mock service availability check failed:', error);
      return false;
    }
  },

  /**
   * Process a video for sign language recognition (mock implementation)
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
      
      // Check if the mock API is available
      const isServiceAvailable = await this.checkServiceAvailability();
      if (!isServiceAvailable) {
        return {
          success: false,
          error: 'Recognition service is not available. Please try again later.'
        };
      }
      
      if (API_CONFIG.debugMode) {
        console.log('Using mock API for recognition');
      }
      
      // Simulate network request to the mock API endpoint
      const result = await this.simulateVideoProcessing(videoUri, isRecorded);
      return result;
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
   * Simulate sending video to a remote API for processing
   * @param videoUri Video URI
   * @param isRecorded Whether video was recorded
   */
  async simulateVideoProcessing(videoUri: string, isRecorded: boolean): Promise<RecognitionResult> {
    // Log the mock API call if debug mode is enabled
    if (API_CONFIG.debugMode) {
      console.log(`Simulating API call to: ${API_CONFIG.baseUrl}/recognize`);
      console.log('Video URI:', videoUri);
      console.log('Is recorded:', isRecorded);
    }
    
    // Add a random delay between 1-3 seconds to simulate network latency
    const randomDelay = Math.floor(Math.random() * 2000) + 1000;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // Simulate success case
    // Use the same logic as the previous local processing implementation
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
      // For third and subsequent uploads, use the filename approach
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
   * Translate text to Vietnamese (mock implementation)
   * @param text Text to translate
   * @returns Promise with the translation result
   */
  async translateToVietnamese(text: string): Promise<TranslationResult> {
    try {
      // Check for internet connection
      const hasConnection = await this.checkConnection();
      if (!hasConnection) {
        return {
          success: false,
          error: 'No internet connection. Translation requires internet access.'
        };
      }
      
      // Use the mock service availability check
      const isServiceAvailable = await this.checkServiceAvailability();
      if (!isServiceAvailable) {
        return {
          success: false,
          error: 'Translation service is not available. Please try again later.'
        };
      }
      
      if (API_CONFIG.debugMode) {
        console.log('Using mock API for translation');
      }
      
      // Simulate sending a request to the mock API
      return await this.simulateTranslation(text);
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
   * Simulate sending text to a remote API for translation
   * @param text Text to translate
   */
  async simulateTranslation(text: string): Promise<TranslationResult> {
    // Log the mock API call if debug mode is enabled
    if (API_CONFIG.debugMode) {
      console.log(`Simulating API call to: ${API_CONFIG.baseUrl}/translate`);
      console.log('Text to translate:', text);
    }
    
    // Add a random delay between 500ms-1.5s to simulate network latency
    const randomDelay = Math.floor(Math.random() * 1000) + 500;
    await new Promise(resolve => setTimeout(resolve, randomDelay));
    
    // Look up the translation in our static map
    if (englishToVietnameseMap[text]) {
      return {
        success: true,
        translatedText: englishToVietnameseMap[text]
      };
    }
    
    // For unknown text, return a generic translation
    return {
      success: true,
      translatedText: `[${text} - Bản dịch tiếng Việt]`
    };
  },
  
  /**
   * Check if the remote service is running and available
   * @returns Promise with service status
   */
  async checkServiceStatus() {
    // Check for internet connection
    const hasConnection = await this.checkConnection();
    if (!hasConnection) {
      return {
        isRunning: false,
        message: 'No internet connection',
        modelAvailable: false
      };
    }
    
    // Check mock service availability
    const isServiceAvailable = await this.checkServiceAvailability();
    
    return { 
      isRunning: isServiceAvailable,
      message: isServiceAvailable ? 'Recognition service is running' : 'Service not available. Please try again later.',
      modelAvailable: isServiceAvailable
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
      
      const isServiceAvailable = await this.checkServiceAvailability();
      console.log('Mock service availability:', isServiceAvailable);
      
      return {
        netInfoConnected: netInfoState.isConnected,
        netInfoType: netInfoState.type,
        fetchSuccessful: isConnected,
        serviceAvailable: isServiceAvailable,
        mode: isServiceAvailable ? 'online' : 'offline'
      };
    } catch (error) {
      console.error('Test connection error:', error);
      return {
        error: error?.toString(),
        netInfoConnected: false,
        fetchSuccessful: false,
        serviceAvailable: false,
        mode: 'error'
      };
    }
  }
}; 