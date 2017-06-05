import {Operation} from './operation'
import {PromiseHelper} from '../helpers/promise-helper'
import {Map} from 'immutable'
import {Line} from './line'
import {CollectionHelper} from '../helpers/collection-helper'
import {PDFJS} from 'pdfjs-dist'
import {OperationsAndErrors} from './operations-and-errors'
import {NumberHelper} from '../helpers/number-helper'
import {FilesParser} from './files-parser'
import * as moment from 'moment'

enum PdfFormat {
  WITH_FRANCS,
  WITHOUT_FRANCS
}

interface XRange {
  credit: [number, number];
  debit: [number, number];
}

class PdfFormatRanges {
  static getXRanges(pdfFormat: PdfFormat): XRange {
    if (pdfFormat === PdfFormat.WITHOUT_FRANCS) {
      return {
        credit: [504, 562],
        debit: [439, 491],
      }
    } else {
      return {
        credit: [400, 442],
        debit: [335, 371],
      }
    }
  }
}

export class PdfParser {
  private static readonly operationXPositions = [52.559999999999995, 53.519999999999996]
  private static readonly operationXPositions2 = [85.92, 89.28]
  private static readonly operationRegex = /^([0-9]{2}\/[0-9]{2})(.+?(?:[0-9]{7})?(?:\/[0-9]{4})?)([+-][ 0-9+-]+?,[0-9]{2})/
  private static readonly blacklist = /^(?:date| touche)/
  private static readonly yearLineRegex = /[Aa]ncien solde au.+?([0-9]{4})/
  private static readonly withFrancsFormatMarker = 'en francs'

  static async parseFiles(files: File[], progressCallback: (progress: number) => void): Promise<OperationsAndErrors> {
    PdfParser.configPdfJs()
    return await FilesParser.parseFiles(files, progressCallback, PdfParser.operationsFromFile)
  }

  private static configPdfJs() {
    PDFJS.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js'
    // true means no web worker is used, and everything is done on the UI thread
    // PDFJS.disableWorker = true
  }

  private static async operationsFromFile(file: File): Promise<Operation[]> {
    const fileContents = await PromiseHelper.fileReaderAsArrayBufferP(file)
    const pdfDocument = await PDFJS.getDocument(new Uint8Array(fileContents))
    const lines = await PdfParser.linesFromDocument(pdfDocument)
    const yearLine = lines.find(line => line.text.match(PdfParser.yearLineRegex) !== null)
    const year = yearLine.text.match(PdfParser.yearLineRegex)[1]
    const operationLines = lines.filter(PdfParser.looksLikeOperationLine)
    return PdfParser.operationsFromLines(operationLines, year)
  }

  private static async linesFromDocument(pdfDocument: PDFDocumentProxy): Promise<Line[]> {
    const [pdfItems, pdfFormat] = await this.extractItemsAndFormat(pdfDocument)
    const xRanges = PdfFormatRanges.getXRanges(pdfFormat)
    return this.extractLines(pdfItems, xRanges)
  }

  private static extractLines(pdfItems: T[], xRanges: XRange) {
    return pdfItems
      .reduce((linesByY: Map<number, Line>, item: any): Map<number, Line> => {
        const line = {text: item.str, x: item.transform[4], y: item.transform[5]}
        const lineAtY = linesByY.get(line.y)
        if (lineAtY === undefined) {
          return linesByY.set(line.y, {text: line.text, x: line.x, y: line.y})
        } else {
          const lineWithSign = PdfParser.addSignIfAmount(line, xRanges)
          return linesByY.set(lineWithSign.y, Object.assign(lineAtY, {text: lineAtY.text + lineWithSign.text}))
        }
      }, Map<number, Line>())
      .sortBy((line, y) => -y)
      .toArray()
  }

  private static async extractItemsAndFormat(pdfDocument: PDFDocumentProxy): Promise<[T[], PdfFormat]> {
    let pdfFormat = PdfFormat.WITHOUT_FRANCS
    const pdfItems = (await CollectionHelper.reduce(pdfDocument, (items, item) => {
      items.push(item)
      if (item.str.indexOf(this.withFrancsFormatMarker) !== -1) {
        pdfFormat = PdfFormat.WITH_FRANCS
      }
      return items
    }, []))
    return [pdfItems, pdfFormat]
  }

  private static addSignIfAmount(line: Line, xRanges: XRange): Line {
    const newLine = Object.assign({}, line)
    if (line.x >= xRanges.credit[0] && line.x <= xRanges.credit[1]) {
      newLine.text = '+' + line.text
    } else if (line.x >= xRanges.debit[0] && line.x <= xRanges.debit[1]) {
      newLine.text = '-' + line.text
    }
    return newLine
  }

  private static looksLikeOperationLine(line: Line): boolean {
    return (PdfParser.operationXPositions.includes(line.x) && line.text.match(PdfParser.operationRegex) !== null)
      || (PdfParser.operationXPositions2.includes(line.x) && !line.text.match(PdfParser.blacklist))
  }

  private static operationsFromLines(lines: Line[], year: string): Operation[] {
    return lines.reduce((operations: Operation[], line: Line) => {
      const matches = line.text.match(PdfParser.operationRegex)
      if (matches) {
        operations.push({
          date: moment(matches[1] + '/' + year, 'DD/MM/YYYY'),
          description: matches[2],
          amount: NumberHelper.parseNumber(matches[3], ','),
        })
      } else if (operations.length > 0) {
        operations[operations.length - 1].description += '\n' + line.text
      }
      return operations
    }, [])
  }
}
