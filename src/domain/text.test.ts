import { describe, expect, it } from 'vitest';
import { plainText } from './text';

describe('plainText', () => {
  it('turns HTML line breaks and paragraphs into line breaks', () => {
    expect(plainText('First line.<br>Second line.<br />Third.')).toBe(
      'First line.\nSecond line.\nThird.',
    );
    expect(plainText('<p>One.</p><p>Two.</p>')).toBe('One.\n\nTwo.');
  });

  it('drops other tags and keeps their text', () => {
    expect(plainText('A <i>quiet</i> <b>night</b> <a href="x">here</a>.')).toBe(
      'A quiet night here.',
    );
  });

  it('leaves comparison signs in plain text alone', () => {
    expect(plainText('5 < 6 and 7 > 3')).toBe('5 < 6 and 7 > 3');
  });

  it('decodes entities once, so text stays text', () => {
    expect(plainText('Tom &amp; Jerry &lt;3 &#8211; &#x2014; &hellip;')).toBe(
      'Tom & Jerry <3 – — …',
    );
    expect(plainText('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
  });

  it('keeps plain text as it is and tidies blank lines', () => {
    expect(plainText('Just text, no markup.')).toBe('Just text, no markup.');
    expect(plainText('One\r\n\r\n\r\n\r\nTwo   words')).toBe('One\n\nTwo words');
  });

  it('returns null for missing or empty text', () => {
    expect(plainText(null)).toBeNull();
    expect(plainText(undefined)).toBeNull();
    expect(plainText(' <br> ')).toBeNull();
  });
});
