import { test, expect } from 'bun:test';
import { stringLengthToBytes } from '../../util';

test('stringLengthToBytes converts correctly', () => {
  expect(stringLengthToBytes(0)).toBe('0B');
  expect(stringLengthToBytes(500)).toBe('500B');
  expect(stringLengthToBytes(1024)).toBe('1.0KB');
  expect(stringLengthToBytes(1536)).toBe('1.5KB');
  expect(stringLengthToBytes(1048576)).toBe('1.0MB');
  expect(stringLengthToBytes(1572864)).toBe('1.5MB');
});