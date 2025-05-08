# Sign Language Recognition Model

This directory contains a TensorFlow.js implementation of a sign language recognition model for the SilentTalk application.

## Implementation Details

The model uses a hybrid CNN-LSTM architecture:

- **Input**: Sequence of video frames (16 frames at 224x224 pixels)
- **Feature Extraction**: MobileNetV2-based CNN to extract spatial features from each frame
- **Sequence Modeling**: LSTM network to model temporal relationships between frames
- **Classification**: Dense layers with softmax activation for sign class prediction

## How It Works

1. When a video is uploaded, it's processed using FFmpeg to extract a sequence of frames
2. Each frame is preprocessed and fed through the model
3. The model produces a probability distribution over all supported sign classes
4. The class with the highest probability is returned as the recognition result

## Auto-Initialization

The model implements an auto-initialization system:

- On first run, if no pre-trained model is found, it creates and saves a simple model
- The model can be later replaced with a properly trained version by placing model files in the `model` directory
- Once initialized, the model is kept in memory for faster inference

## Fallback Mechanism

To ensure reliability, the system includes a fallback mechanism:

- When model confidence is low, it attempts to recognize signs from filename patterns
- For videos recorded in the app, it defaults to predicting common signs
- Error handling ensures the system always returns a result even if model inference fails

## Technical Implementation

The model leverages TensorFlow.js Node.js API for:

- Model loading and saving
- Tensor operations for image preprocessing
- Inference acceleration using native backends
- Memory management with tensor disposal

## Adding a Trained Model

To use a fully trained model:

1. Export a TensorFlow model to TensorFlow.js format
2. Place the model.json and shard files in the `server/model/model` directory
3. Restart the server

The system will automatically load your trained model instead of the fallback one.

## Important Note on Large Dependencies

The TensorFlow.js Node.js package contains large binary files (e.g., tensorflow.dll) that exceed GitHub's file size limits. To handle this:

1. These dependencies are excluded from Git via the .gitignore file
2. You must manually install dependencies after cloning:
   ```
   npm run server:install
   ```
   or
   ```
   cd server && npm install
   ```

3. For deployment:
   - Use a deployment platform that supports npm install during build
   - Or, consider using the TensorFlow.js web version with a smaller footprint
   - Docker deployments should include the npm install step in the Dockerfile 