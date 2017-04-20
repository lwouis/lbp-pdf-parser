export class CollectionHelper {
  static async reduce<E>(pdfDocument: any,
                         fn: <E>(accumulator: E[], item: E) => E[],
                         initialAccumulator: E[]): Promise<E[]> {
    let accumulator = initialAccumulator
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i)
      const content = await page.getTextContent()
      const items = content.items
      accumulator = items.reduce(fn, accumulator)
    }
    return accumulator
  }
}

