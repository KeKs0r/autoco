export function stringLengthToBytes(length: number) {
  // this is a proxymation, some characters will have more than 1 byte. Git diffs are in utf-8 encoded
  const bytes = length;

  if (bytes < 1024) {
    return `${bytes}B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  } else {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}
