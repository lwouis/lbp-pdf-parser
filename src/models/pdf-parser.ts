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

export class PdfParser {
  private static readonly operationXPositions = [52.559999999999995, 53.519999999999996]
  private static readonly operationXPositions2 = [85.92, 89.28]
  private static readonly creditXRange = [400, 432]
  private static readonly debitXRange = [335, 367]
  private static readonly operationRegex = /^([0-9]{2}\/[0-9]{2})(.+?(?:[0-9]{7})?(?:\/[0-9]{4})?)([+-]?[0-9]+?,[0-9]{2})/
  private static readonly blacklist = /^(?:date| touche)/
  private static readonly yearLineRegex = /[Aa]ncien solde au.+?([0-9]{4})/

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
    const operationLines = lines
      .filter(PdfParser.looksLikeOperationLine)
    return PdfParser.operationsFromLines(operationLines, year)
  }

  private static async linesFromDocument(pdfDocument): Promise<Line[]> {
    return (await CollectionHelper.reduce(pdfDocument, (items, item) => {
      items.push(item)
      return items
    }, []))
      .reduce(PdfParser.consolidateLinesByY, Map<number, Line>())
      .sortBy((line, y) => -y)
      .toList()
  }

  private static consolidateLinesByY(linesByY: Map<number, Line>, item: any): Map<number, Line> {
    const line = {text: item.str, x: item.transform[4], y: item.transform[5]}
    const lineAtY = linesByY.get(line.y)
    if (lineAtY === undefined) {
      return linesByY.set(line.y, {text: line.text, x: line.x, y: line.y})
    } else {
      PdfParser.addSignIfAmount(line)
      return linesByY.set(line.y, Object.assign(lineAtY, {text: lineAtY.text + line.text}))
    }
  }

  private static addSignIfAmount(line: Line) {
    if (line.x >= PdfParser.creditXRange[0] && line.x <= PdfParser.creditXRange[1]) {
      line.text = '+' + line.text
    } else if (line.x >= PdfParser.debitXRange[0] && line.x <= PdfParser.debitXRange[1]) {
      line.text = '-' + line.text
    }
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
      } else {
        const latestOperation = operations.length - 1
        operations[latestOperation].description += '\n' + line.text
      }
      return operations
    }, [])
  }
}
