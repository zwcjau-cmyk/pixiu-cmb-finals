import { describe, expect, test } from 'bun:test'
import { encodePcm16, encodeWavPcm16 } from './audioPcm'

describe('语音输入 PCM 转码', () => {
  test('将 48kHz 单声道降采样成 16kHz 16-bit PCM', () => {
    const source = new Float32Array(48000).fill(0.5)
    const output = encodePcm16(source, 48000)
    expect(output.byteLength).toBe(16000 * 2)
    expect(new Int16Array(output.buffer)[0]).toBeCloseTo(16384, -1)
  })

  test('限制超出范围的采样值', () => {
    const output = encodePcm16(new Float32Array([-2, 2]), 16000)
    expect(Array.from(new Int16Array(output.buffer))).toEqual([-32768, 32767])
  })

  test('生成火山 ASR 可接收的单声道 WAV', () => {
    const output = encodeWavPcm16(new Float32Array(16000), 16000)
    expect(new TextDecoder().decode(output.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(output.slice(8, 12))).toBe('WAVE')
    expect(new DataView(output.buffer).getUint32(24, true)).toBe(16000)
    expect(output.byteLength).toBe(44 + 32000)
  })
})
