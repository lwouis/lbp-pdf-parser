export class NumberHelper {
  static parseNumber(text: string, decimalSeparator: string): number {
    if (text.indexOf(decimalSeparator)) {
      text = text.replace(decimalSeparator, '.')
      return Number.parseFloat(text)
    }
    return Number.parseInt(text)
  }
}
