export class NumberHelper {
  static parseNumber(text: string, decimalSeparator: string): number {
    text = text.replace(decimalSeparator, '.')
    return Number.parseFloat(text)
  }
}
