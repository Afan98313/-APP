const VoiceRecognition = {
  recognition: null,
  isListening: false,

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return false;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    return true;
  },

  start() {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error('Speech recognition not available'));
        return;
      }
      this.isListening = true;
      this.recognition.start();
      this.recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        this.isListening = false;
        resolve(text);
      };
      this.recognition.onerror = (event) => {
        this.isListening = false;
        reject(new Error(event.error));
      };
      this.recognition.onend = () => {
        this.isListening = false;
      };
    });
  },

  stop() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
};
