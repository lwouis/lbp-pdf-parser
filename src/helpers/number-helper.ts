export class NumberHelper {
  static parseNumber(text: string, decimalSeparator: string): number {
    const textWithoutExtraSigns = text[0] + text.substring(1, text.length).replace(/[ +-]/g, '')
    const textWithEnglishDecimalSeperator = textWithoutExtraSigns.replace(decimalSeparator, '.')
    return Number.parseFloat(textWithEnglishDecimalSeperator)
  }
}
