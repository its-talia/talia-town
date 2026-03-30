import { SocketManager } from '../systems/SocketManager'

export class DialogueManager {
  isOpen = false
  private socket: SocketManager
  private box: HTMLElement
  private textEl: HTMLElement
  private input: HTMLInputElement
  private sendBtn: HTMLElement
  private voiceBtn: HTMLElement
  private recognition: SpeechRecognition | null = null
  private isRecording = false

  constructor(socket: SocketManager) {
    this.socket = socket
    this.box = document.getElementById('dialogue-box')!
    this.textEl = document.getElementById('dialogue-text')!
    this.input = document.getElementById('dialogue-input') as HTMLInputElement
    this.sendBtn = document.getElementById('btn-send')!
    this.voiceBtn = document.getElementById('btn-voice')!

    this.sendBtn.addEventListener('click', () => this.submit())
    this.voiceBtn.addEventListener('click', () => this.toggleVoice())
    this.setupSpeechRecognition()
  }

  private setupSpeechRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      this.voiceBtn.style.display = 'none'
      return
    }
    this.recognition = new SR()
    this.recognition.continuous = false
    this.recognition.interimResults = false
    this.recognition.lang = 'en-US'
    this.recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript
      this.input.value = transcript
      this.isRecording = false
      this.voiceBtn.classList.remove('recording')
      this.voiceBtn.textContent = '🎤'
      this.submit()
    }
    this.recognition.onerror = () => {
      this.isRecording = false
      this.voiceBtn.classList.remove('recording')
      this.voiceBtn.textContent = '🎤'
    }
  }

  private toggleVoice() {
    if (!this.recognition) return
    if (this.isRecording) {
      this.recognition.stop()
      this.isRecording = false
      this.voiceBtn.classList.remove('recording')
      this.voiceBtn.textContent = '🎤'
    } else {
      this.recognition.start()
      this.isRecording = true
      this.voiceBtn.classList.add('recording')
      this.voiceBtn.textContent = '⏹'
    }
  }

  open() {
    this.isOpen = true
    this.box.style.display = 'block'
    this.setText('...')
    setTimeout(() => this.input.focus(), 50)
  }

  close() {
    this.isOpen = false
    this.box.style.display = 'none'
    this.input.value = ''
  }

  async submit() {
    const msg = this.input.value.trim()
    if (!msg) return
    this.input.value = ''
    this.input.disabled = true
    this.sendBtn.setAttribute('disabled', 'true')
    this.setText('...')

    try {
      const response = await this.socket.sendMessage(msg)
      this.typewriterText(response)
    } catch (err) {
      this.setText('(Something went wrong. Try again.)')
    } finally {
      this.input.disabled = false
      this.sendBtn.removeAttribute('disabled')
      this.input.focus()
    }
  }

  private setText(text: string) {
    this.textEl.textContent = text
  }

  private typewriterText(text: string) {
    this.textEl.textContent = ''
    let i = 0
    const interval = setInterval(() => {
      this.textEl.textContent += text[i]
      i++
      if (i >= text.length) clearInterval(interval)
    }, 22)
  }
}
