const VoiceRecognition = {
  mediaRecorder: null,
  audioChunks: [],
  stream: null,
  isRecording: false,

  async init() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch (err) {
      console.warn('Microphone not available:', err.message);
      return false;
    }
  },

  start() {
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        reject(new Error('请先调用 init() 获取麦克风权限'));
        return;
      }

      this.audioChunks = [];
      const mimeType = this._getSupportedMimeType();

      try {
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      } catch (e) {
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        reject(new Error('录音失败: ' + event.error));
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      resolve();
    });
  },

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('未在录音'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  },

  async transcribe(audioBlob) {
    const base64 = await this._blobToBase64(audioBlob);

    let format = 'pcm';
    if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a') || audioBlob.type.includes('aac')) {
      format = 'm4a';
    } else if (audioBlob.type.includes('wav')) {
      format = 'wav';
    }

    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: base64, format, rate: 16000, channel: 1 })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || '语音识别失败');
    }

    const data = await response.json();
    return data.text || '';
  },

  _getSupportedMimeType() {
    const types = [
      'audio/mp4',
      'audio/m4a',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/wav'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/mp4';
  },

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
};
