import { SocketManager } from '../systems/SocketManager'

export class DialogueManager {
  isOpen = false
  private socket: SocketManager
  private box: HTMLElement
  private textEl: HTMLElement
  private input: HTMLInputElement
  private sendBtn: HTMLElement
  private voiceBtn: HTMLElement
  private closeBtn: HTMLElement
  private recognition: SpeechRecognition | null = null
  private isRecording = false

  // Cooldown prevents dialogue from instantly reopening after closing
  private closedAt = 0
  private readonly REOPEN_COOLDOWN_MS = 2000

  constructor(socket: SocketManager) {
    this.socket = socket
    this.box = document.getElementById('dialogue-box')!
    this.textEl = document.getElementById('dialogue-text')!
    this.input = document.getElementById('dialogue-input') as HTMLInputElement
    this.sendBtn = document.getElementById('btn-send')!
    this.voiceBtn = document.getElementById('btn-voice')!
    this.closeBtn = document.getElementById('btn-close')!

    this.sendBtn.addEventListener('click', () => this.submit())
    this.closeBtn.addEventListener('click', () => this.close())
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

  canOpen(): boolean {
    return !this.isOpen && (Date.now() - this.closedAt > this.REOPEN_COOLDOWN_MS)
  }

  open() {
    if (!this.canOpen()) return
    this.isOpen = true
    this.box.style.display = 'block'
    this.setText('hey. you found me.')
    setTimeout(() => this.input.focus(), 50)
  }

  close() {
    if (!this.isOpen) return
    this.isOpen = false
    this.closedAt = Date.now()
    this.box.style.display = 'none'
    this.input.value = ''
    if (this.isRecording) {
      this.recognition?.stop()
      this.isRecording = false
      this.voiceBtn.classList.remove('recording')
      this.voiceBtn.textContent = '🎤'
    }
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
    } catch {
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
