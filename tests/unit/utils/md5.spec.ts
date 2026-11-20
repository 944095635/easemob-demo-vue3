import { describe, expect, it } from 'vitest'

import { md5 } from '@/utils/md5'

describe('md5', () => {
  it('matches standard MD5 vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('timestamp=123&key=abc')).toBe('5c7fc452839cd6c7ae7c765c88dfe990')
  })

  it('encodes UTF-8 input', () => {
    expect(md5('hello 铁恋')).toBe('8c916260bf394fe24f357a61ea073e72')
  })
})
