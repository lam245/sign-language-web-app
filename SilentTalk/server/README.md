# Sign Language Recognition API

An advanced API server for recognizing and translating sign language from video content. This server uses deep learning technologies to analyze sign language gestures and convert them to text.

## Features

- Sign language recognition from uploaded videos
- Real-time sign language recognition from camera recordings
- Translation of recognized signs to Vietnamese
- High-performance video processing with optimized response times

## Technology Stack

- **Backend**: Node.js with Express
- **ML Model**: 3D-ResNet-50 with Transformer architecture
- **Video Processing**: Specialized frame extraction and gesture analysis
- **Translation**: Neural machine translation techniques

## API Endpoints

### Health Check

```
GET /api/health
```

Returns status information about the API and recognition model.

### Recognize Sign Language

```
POST /api/recognize
Content-Type: multipart/form-data

Parameters:
- video: Video file containing sign language
- isRecorded: Boolean flag indicating if the video was recorded by the user
```

Processes a video to recognize sign language gestures and returns the detected sign.

### Translate Text

```
POST /api/translate
Content-Type: application/json

Body:
{
  "text": "Text to translate",
  "targetLanguage": "vi"
}
```

Translates recognized sign language text to the target language (currently supports Vietnamese).

## Getting Started

### Prerequisites

- Node.js v14 or higher
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
```
npm install
```
3. Start the server:
```
npm start
```

The server will be available at `http://localhost:3000`

## Usage with SilentTalk App

This API is designed to work with the SilentTalk mobile application, providing the backend processing capabilities for sign language recognition and translation.

## License

Copyright © 2023 SilentTalk. All rights reserved. 