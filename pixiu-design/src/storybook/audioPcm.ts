export function encodePcm16(samples: Float32Array, sourceRate: number, targetRate = 16000): Uint8Array {
  const ratio = sourceRate / targetRate
  const frameCount = Math.max(1, Math.floor(samples.length / ratio))
  const pcm = new Int16Array(frameCount)
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = Math.floor(frame * ratio)
    const end = Math.max(start + 1, Math.floor((frame + 1) * ratio))
    let sum = 0
    for (let index = start; index < end && index < samples.length; index += 1) sum += samples[index]
    const normalized = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
    pcm[frame] = normalized < 0 ? normalized * 0x8000 : normalized * 0x7fff
  }
  return new Uint8Array(pcm.buffer)
}

export function encodeWavPcm16(samples: Float32Array, sourceRate: number, targetRate = 16000): Uint8Array {
  const pcm = encodePcm16(samples, sourceRate, targetRate)
  const output = new Uint8Array(44 + pcm.byteLength)
  const view = new DataView(output.buffer)
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, targetRate, true)
  view.setUint32(28, targetRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, pcm.byteLength, true)
  output.set(pcm, 44)
  return output
}
