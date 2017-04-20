import {Operation} from './operation'
import {PromiseHelper} from '../helpers/promise-helper'
import {Map} from 'immutable'
import {Line} from './line'
import {BehaviorSubject} from 'rxjs/BehaviorSubject'
import {CollectionHelper} from '../helpers/collection-helper'
import {PDFJS} from 'pdfjs-dist'
import {OperationsAndErrors} from './operations-and-errors'
import {NumberHelper} from '../helpers/number-helper'

export class PdfParser {
  private readonly operationXPositions = [52.559999999999995, 53.519999999999996]
  private readonly operationXPositions2 = [89.28, 85.92]
  private readonly dateRegex = /^([0-9]{2}\/[0-9]{2})(.+?(?:[0-9]{7})?)([0-9]+?,[0-9]{2})/
  private readonly blacklist = /^(?:date| touche)/
  private readonly yearLineRegex = /[Aa]ncien solde au.+?([0-9]{4})/
  private progress = new BehaviorSubject(0)

  constructor() {
    PDFJS.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js'
    // true means no web worker is used, and everything is done on the UI thread
    // PDFJS.disableWorker = true
  }

  async parseFiles(files: File[], progressCallback: (progress: number) => void): Promise<OperationsAndErrors> {
    this.progress.subscribe(progressCallback)
    this.progress.next(0.1) // force progress to start to update the UI asap
    const result = new OperationsAndErrors([], [])
    await Promise.all(files.map(async (file) => {
      try {
        const fileOperations = await this.parseFile(file, files.length)
        result.operations.push(...fileOperations)
      } catch (error) {
        console.error(error)
        result.errors.push(error)
      }
    }))
    this.progress.next(100) // rounding may not lead to 100
    this.progress.next(0) // work is done
    return result
  }

  private async parseFile(file: File, nFiles: number): Promise<Operation[]> {
    try {
      return await this.operationsFromFile(file)
    } catch (error) {
      console.error(error)
      throw new Error('Failed parsing file: \'' + file.name + '\'')
    } finally {
      this.progress.next(this.progress.getValue() + 1 / nFiles * 100)
    }
  }

  private async operationsFromFile(file: File): Promise<Operation[]> {
    const fileContents = await PromiseHelper.fileReaderP(file)
    const pdfDocument = await PDFJS.getDocument(new Uint8Array(fileContents))
    const lines = await this.linesFromDocument(pdfDocument)
    const yearLine = lines.find(line => line.text.match(this.yearLineRegex) !== null)
    const year = yearLine.text.match(this.yearLineRegex)[1]
    const operationLines = lines
      .filter(line => this.looksLikeOperationLine(line))
      .map(line => line.text)
    return this.operationsFromLines(operationLines, year)
  }

  private async linesFromDocument(pdfDocument): Promise<Line[]> {
    return (await CollectionHelper.reduce(pdfDocument, (items, item) => {
      items.push(item)
      return items
    }, []))
      .reduce((line, item) => this.consolidateLinesByY(line, item), Map<number, Line>())
      .sortBy((line, y) => -y)
      .toList()
  }

  private consolidateLinesByY(linesByY: Map<number, Line>, item: any): Map<number, Line> {
    const line = {text: item.str, x: item.transform[4], y: item.transform[5]}
    const lineAtY = linesByY.get(line.y)
    if (lineAtY === undefined) {
      return linesByY.set(line.y, {text: line.text, x: line.x, y: line.y})
    } else {
      return linesByY.set(line.y, Object.assign(lineAtY, {text: lineAtY.text + line.text}))
    }
  }

  private looksLikeOperationLine(line: Line): boolean {
    return (this.operationXPositions.includes(line.x) && line.text.match(this.dateRegex) !== null)
      || (this.operationXPositions2.includes(line.x) && !line.text.match(this.blacklist))
  }


  private operationsFromLines(lines: string[], year: string): Operation[] {
    return lines.reduce((operations: Operation[], line: string) => {
      const matches = line.match(this.dateRegex)
      if (matches) {
        operations.push({
          date: matches[1] + '/' + year,
          description: matches[2],
          amount: NumberHelper.parseNumber(matches[3], ','),
        })
      } else {
        const latestOperation = operations.length - 1
        operations[latestOperation].description += line
      }
      return operations
    }, [])
  }
}
