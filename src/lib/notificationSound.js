// Short chimes synthesized with the Web Audio API rather than external audio
// files - no assets to license, host, or keep in sync, and each sound is a
// handful of lines either way.
//
// Each notification type gets its own distinct sound so you can tell what
// happened without looking: a new ticket is three rising notes (a "work has
// arrived" attention cue, mostly heard by IT staff), a reply is a soft
// two-note chime (a conversation cue, heard by whoever is on the thread).
let audioContext

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext = new AudioContextClass()
  }
  return audioContext
}

function playTone(ctx, frequency, startOffset, duration, peak = 0.15) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency

  const startTime = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

const SOUNDS = {
  // Rising major triad (C5 -> E5 -> G5): "a new ticket needs attention."
  new_ticket: (ctx) => {
    playTone(ctx, 523.25, 0, 0.1)
    playTone(ctx, 659.25, 0.09, 0.1)
    playTone(ctx, 783.99, 0.18, 0.22)
  },
  // Gentle rising fifth (A5 -> E6): "someone replied."
  new_comment: (ctx) => {
    playTone(ctx, 880, 0, 0.12, 0.12)
    playTone(ctx, 1318.51, 0.1, 0.18, 0.12)
  },
}

export function playNotificationSound(type = 'new_comment') {
  try {
    const ctx = getAudioContext()
    ;(SOUNDS[type] ?? SOUNDS.new_comment)(ctx)
  } catch {
    // Browsers block audio before any user gesture on the page, and some
    // environments don't support AudioContext at all - the in-app badge
    // still shows the notification either way, so this fails silently.
  }
}
