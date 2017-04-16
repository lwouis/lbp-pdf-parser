import {Component, OnInit} from '@angular/core'
import {PDFDocumentProxy, PDFJS} from 'pdfjs-dist'
import {PromiseHelper} from '../../helpers/promise-helper'
import {Line} from '../../models/line'
import {List, Map} from 'immutable'
import {Operation} from '../../models/operation'

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent implements OnInit {
  private readonly operationXPositions = [52.559999999999995, 53.519999999999996]
  private readonly operationXPositions2 = [89.28, 85.92]
  private readonly dateRegex = /^([0-9]{2}\/[0-9]{2})(.+?)([0-9]+,[0-9]{2})/
  private readonly blacklist = /^(?:date| touche)/
  private readonly yearLineRegex = /[Aa]ncien solde au.+?([0-9]{4})/
  private dragEnterCount = 0
  private operations = []
  private errors = []
  private progress = 0

  constructor() {
  }

  ngOnInit() {
  }

  dragenter() {
    this.dragEnterCount++
  }

  dragover(event: DragEvent) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  dragleave() {
    this.dragEnterCount--
  }

  async drop(event: DragEvent): Promise<void> {
    event.preventDefault()
    this.dragEnterCount--
    await this.handleFileSelect(event.dataTransfer.files)
  }

  async selectFiles(event: Event | any): Promise<void> {
    await this.handleFileSelect(event.target.files)
  }

  private async handleFileSelect(files: FileList): Promise<void> {
    this.reset()
    const operations: Operation[][] = await Promise.all(Array.from(files).map(async (file, i, array) => {
      try {
        const fileOperations = await this.parse(file)
        this.progress += 1 / array.length * 100
        return fileOperations
      } catch (error) {
        this.errors.push('Failed parsing file: \'' + file.name + '\'')
        console.error(error)
      }
    }))
    this.operations = Array.prototype.concat(...operations)

  }

  private async parse(file: File): Promise<Operation[]> {
    this.configPdfjs()
    const fileContents: ArrayBuffer = await PromiseHelper.fileReaderP(file)
    const pdfDocument: PDFDocumentProxy = await PDFJS.getDocument(new Uint8Array(fileContents))
    const lines = await this.aggregatePdfDocumentLines(pdfDocument)
    const yearLine = lines.find(line => line.text.match(this.yearLineRegex) !== null)
    const year = yearLine.text.match(this.yearLineRegex)[1]
    const operationLines = lines
      .filter(line => this.looksLikeOperationLine(line.text, line.x))
      .map(line => line.text) as List<string>
    return this.parseOperations(operationLines, year)
  }

  private configPdfjs() {
    PDFJS.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js'
    // PDFJS.disableWorker = true
  }

  private async aggregatePdfDocumentLines(pdfDocument: PDFDocumentProxy): Promise<List<Line>> {
    let lines = List<Line>()
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i)
      const content = await page.getTextContent()
      lines = lines.concat(this.aggregatePageLines(content.items)) as List<Line>
    }
    return lines
  }

  private aggregatePageLines(items: Array<any>): List<Line> {
    return items
      .reduce((lines, item) => this.consolidateLinesByY(lines, item), Map<number, Line>())
      .sortBy((line, y) => -y)
      .toList()
  }

  private consolidateLinesByY(linesByY: Map<number, Line>, item): Map<number, Line> {
    const line = {text: item.str, x: item.transform[4], y: item.transform[5]}
    const lineAtY = linesByY.get(line.y)

    if (lineAtY === undefined) {
      return linesByY.set(line.y, {text: line.text, x: line.x, y: line.y})
    } else {
      return linesByY.set(line.y, Object.assign(lineAtY, {text: lineAtY.text + line.text}))
    }
  }

  private looksLikeOperationLine(lineText: string, lineX: number): boolean {
    return (this.operationXPositions.includes(lineX) && lineText.match(this.dateRegex) !== null)
      || (this.operationXPositions2.includes(lineX) && !lineText.match(this.blacklist))
  }

  private reset(): void {
    this.operations.length = 0
    this.errors.length = 0
    this.progress = 0
  }

  private parseOperations(lines: List<string>, year: string): Operation[] {
    return lines.reduce((operations, line) => {
      const matches = line.match(this.dateRegex)
      if (matches) {
        operations.push({date: matches[1] + '/' + year, description: matches[2], amount: matches[3]})
      } else {
        operations[operations.length - 1].description += line
      }
      return operations
    }, [])
  }
}
