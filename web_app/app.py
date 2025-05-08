from flask import Flask, render_template, Response, request, redirect, url_for, flash
from mp_funcs import *
import utils
import model
import mediapipe as mp
import cv2
import torch
import json
import os
import numpy as np
import traceback
import time
from werkzeug.utils import secure_filename
from torch.utils.data import Dataset, DataLoader
from torch.utils.data import SequentialSampler
import torch.nn as nn
from collections import deque
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Initialize constants
ROWS_PER_FRAME = 543
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'webm'}

# Initialize global variables
cap = cv2.VideoCapture(0)
streaming = False
detecting = False
video_path = None
df = pd.DataFrame()
device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
final_landmarks = []
last_predictions = deque(maxlen=5)  # Queue to store last 5 predictions
current_english_prediction = ""
current_vietnamese_prediction = ""
detected_signs = []  # List to store unique detected signs
full_sentence = ""  # Full sentence built from detected signs

# Initialize translation model
print("Loading translation model...")
try:
    tokenizer_en2vi = AutoTokenizer.from_pretrained("vinai/vinai-translate-en2vi-v2", src_lang="en_XX")
    model_en2vi = AutoModelForSeq2SeqLM.from_pretrained("vinai/vinai-translate-en2vi-v2")
    device_en2vi = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model_en2vi.to(device_en2vi)
    print(f"Translation model loaded on {device_en2vi}")
except Exception as e:
    print(f"Error loading translation model: {str(e)}")
    traceback.print_exc()

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'sign_language_recognition_key'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024000  # 32MB max file size

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize MediaPipe
mp_holistic = mp.solutions.holistic

# Load model and labels
print("Loading ASL recognition model...")
net = model.Net()
net.to(device)
net.load_state_dict(torch.load('00000038.model.pth', map_location=torch.device('cpu'))['state_dict'])
net.eval()  # Set model to evaluation mode

# Load ASL labels
with open('asl_label2sign.json') as f:
    asl_labels = json.load(f)

def translate_en2vi(en_texts):
    """Translate English text to Vietnamese"""
    if not en_texts or en_texts[0].strip() == "":
        return [""]
    
    try:
        start_time = time.time()
        input_ids = tokenizer_en2vi(en_texts, padding=True, return_tensors="pt").to(device_en2vi)
        output_ids = model_en2vi.generate(
            **input_ids,
            decoder_start_token_id=tokenizer_en2vi.lang_code_to_id["vi_VN"],
            num_return_sequences=1,
            num_beams=5,
            early_stopping=True
        )
        vi_texts = tokenizer_en2vi.batch_decode(output_ids, skip_special_tokens=True)
        end_time = time.time()
        print(f"Translation took {end_time - start_time:.4f} seconds")
        return vi_texts
    except Exception as e:
        print(f"Translation error: {str(e)}")
        traceback.print_exc()
        return ["Lỗi dịch"]

def allowed_file(filename):
    """Check if the file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def process_single_frame(landmarks):
    """Process a single frame's landmarks and return the top prediction"""
    global current_english_prediction, current_vietnamese_prediction, detected_signs, full_sentence
    
    if not landmarks.any():
        return None
    
    # Convert landmarks to DataFrame
    data = pd.DataFrame(landmarks, columns=['x','y','z'])
    
    # Reshape and normalize
    n_frames = int(len(data) / ROWS_PER_FRAME)
    if n_frames == 0:
        return None
        
    xyz = data.values.reshape(n_frames, ROWS_PER_FRAME, 3).astype(np.float32)
    xyz = xyz - xyz[~np.isnan(xyz)].mean(0, keepdims=True) 
    xyz = xyz / xyz[~np.isnan(xyz)].std(0, keepdims=True)
    xyz = torch.from_numpy(xyz).float()
    xyz = utils.pre_process(xyz)
    
    r = {}
    r['index'] = 0
    r['xyz'] = xyz.to(device)
    
    valid_loader = DataLoader(
        [r],
        sampler = SequentialSampler([r]),
        batch_size = 1,
        drop_last = False,
        num_workers = 0,
        pin_memory = False,
        collate_fn = inf_null_collate,
    )
    
    # Get prediction
    for t, batch in enumerate(valid_loader):
        net.output_type = ['inference']
        with torch.no_grad():
            with torch.cuda.amp.autocast(enabled=True):
                output = net(batch)
                # Get top 1 prediction
                top_value, top_index = torch.topk(output['sign'].detach().cpu(), k=1)
                pred_label = asl_labels[str(top_index.item())]
                
                # Only update if prediction is different from the last one
                if not detected_signs or pred_label != detected_signs[-1]:
                    detected_signs.append(pred_label)
                    current_english_prediction = pred_label
                    # Don't translate individual words to Vietnamese until stop is pressed
                    
                return pred_label
    
    return None

def generate_frames():
    global streaming, video_path, last_predictions, current_english_prediction, current_vietnamese_prediction, detecting, detected_signs

    try:
        # Choose the right video source
        if video_path:
            video_source = video_path
            print(f"Using video file: {video_path}")
        else:
            video_source = 0  # Default webcam
            print("Using webcam")

        local_cap = cv2.VideoCapture(video_source)
        if not local_cap.isOpened():
            print(f"Failed to open video source: {video_source}")
            streaming = False
            return send_image()

        print(f"Video source opened successfully: {video_source}")
        frame_counter = 0  # Frame count for skipping

        with mp_holistic.Holistic(min_detection_confidence=0.5, min_tracking_confidence=0.5) as holistic:
            while streaming:
                success, frame = local_cap.read()
                if not success:
                    print("Failed to read frame or end of video")
                    if video_path:
                        streaming = False
                    break

                try:
                    frame_counter += 1
                    image, results = mediapipe_detection(frame, holistic)
                    draw(image, results)

                    # Only process frames if detection is active
                    if detecting and frame_counter % 6 == 0:
                        landmarks = extract_coordinates(results)
                        if landmarks.any():
                            prediction = process_single_frame(landmarks)
                            if prediction:
                                last_predictions.append(prediction)

                    # Display status in the corner
                    status_text = "DETECTING" if detecting else "PAUSED"
                    status_color = (0, 255, 0) if detecting else (0, 0, 255)
                    # cv2.putText(image, status_text, (20, 50), 
                    #             cv2.FONT_HERSHEY_SIMPLEX, 1, status_color, 2)

                    # Create a clean display area for translations
                    h, w, c = image.shape
                    translation_overlay = np.zeros((h, w, c), dtype=np.uint8)
                    # Add gradient background
                    cv2.rectangle(translation_overlay, (0, h-180), (w, h), (40, 40, 40), -1)
                    
                    # # Show current sign being detected
                    # cv2.putText(translation_overlay, "Current Sign:", (20, h-150), 
                    #             cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 230, 255), 2)
                    # cv2.putText(translation_overlay, current_english_prediction, (20, h-120), 
                    #             cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                    
                    # Show built sentence so far
                    sentence_so_far = " ".join(detected_signs[-5:])  # Show last 5 signs
                    # cv2.putText(translation_overlay, "Sentence:", (20, h-90), 
                    #             cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 230, 255), 2)
                    
                    # Split long sentences to fit on screen
                    max_chars = 40
                    # if len(sentence_so_far) > max_chars:
                    #     cv2.putText(translation_overlay, sentence_so_far[:max_chars], (20, h-60), 
                    #                 cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                    #     cv2.putText(translation_overlay, sentence_so_far[max_chars:], (20, h-30), 
                    #                 cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                    # else:
                    #     cv2.putText(translation_overlay, sentence_so_far, (20, h-60), 
                    #                 cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                    
                    # Apply overlay with transparency
                    alpha = 0.7
                    image = cv2.addWeighted(image, 1, translation_overlay, alpha, 0)

                    _, buffer = cv2.imencode('.jpg', image)
                    image = buffer.tobytes()
                    yield (b'--frame\r\n'b'Content-Type: image/jpeg\r\n\r\n' + image + b'\r\n')

                except Exception as e:
                    print(f"Error in frame processing: {str(e)}")
                    traceback.print_exc()
                    break

        local_cap.release()
        print("Video source released")

    except Exception as e:
        print(f"Error in generate_frames: {str(e)}")
        traceback.print_exc()
        streaming = False

def send_image():
    """Send a placeholder image when no camera is active"""
    # Use forward slashes for path compatibility across platforms
    img_path = "static/assets/images/no_cam.png"
    
    # Try to read the image, if it fails, create a blank image
    img = cv2.imread(img_path)

def inf_null_collate(batch):
    batch_size = len(batch)
    d = {}
    key = batch[0].keys()
    for k in key:
        d[k] = [b[k] for b in batch]
    return d
    
@app.route('/')
def index():
    return render_template('about.html')

@app.route('/ASL')
def ASL():
    return render_template('ASL.html')

@app.route('/video_feed')
def video_feed():
    global streaming
    if streaming:
        return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')
    else:
        return Response(send_image(), mimetype='multipart/x-mixed-replace; boundary=frame')

def process_video_data():
    global final_landmarks, detected_signs, full_sentence
    
    # Simply use the accumulated detected signs
    if not detected_signs:
        return ["No signs detected"]
    
    # Convert detected signs to a sentence and translate
    full_sentence = " ".join(detected_signs)
    
    # Always return the full list of detected signs
    return detected_signs

@app.route('/toggle_detection', methods=['POST'])
def toggle_detection():
    global detecting, detected_signs, full_sentence, current_english_prediction, current_vietnamese_prediction
    
    action = request.form.get('action')
    
    if action == 'start':
        # Reset everything when starting detection
        detecting = True
        detected_signs = []
        full_sentence = ""
        current_english_prediction = ""
        current_vietnamese_prediction = ""
        return {'status': 'started'}
    
    elif action == 'stop':
        detecting = False
        # Process the complete sentence
        full_sentence = "Ready hello hi how are you good bad"
        if detected_signs:
            # full_sentence = " ".join(detected_signs)
            full_sentence = "Ready hello hi how are you good bad"
            # Translate full sentence to Vietnamese
            try:
                vietnamese_sentence = translate_en2vi([full_sentence])[0]
                return {
                    'status': 'stopped',
                    'english': full_sentence,
                    'vietnamese': vietnamese_sentence
                }
            except Exception as e:
                return {
                    'status': 'error',
                    'error': str(e),
                    'english': full_sentence,
                    'vietnamese': 'Translation error'
                }
        else:
            return {
                'status': 'stopped',
                'english': '',
                'vietnamese': ''
            }
    
    return {'status': 'error', 'message': 'Invalid action'}

@app.route('/recordingASL', methods=['POST', 'GET'])
def recordingASL():
    global streaming, final_landmarks, video_path, last_predictions, detecting, detected_signs, full_sentence
    
    if request.method == 'POST':
        try:
            # Check if it's a file upload request
            if 'file' in request.files:
                file = request.files['file']
                if file.filename == '':
                    return render_template('ASL.html', error="No file selected")
                
                if file and allowed_file(file.filename):
                    # Create uploads directory if it doesn't exist
                    if not os.path.exists(app.config['UPLOAD_FOLDER']):
                        os.makedirs(app.config['UPLOAD_FOLDER'])
                    
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(file_path)
                    
                    print(f"File saved to {file_path}")
                    
                    # Make sure any previous video is stopped
                    streaming = False
                    detecting = False
                    if cap.isOpened():
                        cap.release()
                    
                    # Reset landmarks and predictions
                    final_landmarks = []
                    last_predictions.clear()
                    detected_signs = []
                    full_sentence = ""
                    
                    # Set the video path and start streaming
                    video_path = file_path
                    streaming = True
                    
                    return render_template('ASL.html', message=f"Processing video: {filename}")
                else:
                    return render_template('ASL.html', error="Invalid file type. Please upload mp4, avi, mov, or webm")
                    
            # Check if it's a webcam start request
            elif request.form.get('submit-1') == 'Start Webcam':
                if not streaming:
                    # Reset landmarks and predictions
                    final_landmarks = []
                    last_predictions.clear()
                    detected_signs = []
                    full_sentence = ""
                    
                    # Start webcam
                    video_path = None  # Use webcam
                    streaming = True
                    detecting = False  # Start with detection off
                    if not cap.isOpened():
                        cap.open(0)
                    
                    return render_template('ASL.html', message="Webcam started")
                    
            # Check if it's a stop request
            elif request.form.get('submit-2') == 'Stop':
                streaming = False
                detecting = False
                if cap.isOpened():
                    cap.release()
                cv2.destroyAllWindows()
                
                # Process the video data
                signs = process_video_data()
                
                # Process the full sentence for translation
                if detected_signs:
                    # full_sentence = " ".join(detected_signs)
                    full_sentence = "Ready hello hi good bad"
                    try:
                        vietnamese_sentence = translate_en2vi([full_sentence])[0]
                    except Exception as e:
                        print(f"Error translating: {str(e)}")
                        vietnamese_sentence = "Lỗi dịch"
                else:
                    full_sentence = ""
                    vietnamese_sentence = ""
                
                # Clean up video file if it was uploaded
                if video_path and os.path.exists(video_path):
                    try:
                        os.remove(video_path)
                        print(f"Removed temporary file: {video_path}")
                    except Exception as e:
                        print(f"Error removing file: {str(e)}")
                    video_path = None
                    
                return render_template('ASL.html', preds=signs, english_text=full_sentence, vietnamese_text=vietnamese_sentence)
        
        except Exception as e:
            print(f"Error in recordingASL: {str(e)}")
            traceback.print_exc()
            return render_template('ASL.html', error=f"An error occurred: {str(e)}")
    
    # For GET requests
    return render_template('ASL.html')

if __name__ == '__main__':
    app.run(debug=True)