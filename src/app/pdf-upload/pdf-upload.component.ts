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
  private selectedFiles: File[] = []
  private operations: Operation[] = []
  private errors: string[] = []
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

  async selectFilesBydropping(event: DragEvent): Promise<void> {
    event.preventDefault()
    this.dragEnterCount--
    await this.selectFiles(event.dataTransfer.files)
  }

  async selectFilesWithInput(event: Event | any): Promise<void> {
    await this.selectFiles(event.target.files as FileList)
  }

  private async selectFiles(files: FileList): Promise<void> {
    this.selectedFiles = Array.from(files)
    await this.parseFiles()
  }

  async parseFiles(): Promise<void> {
    this.progress = 0.1 // force progress to start to update the UI asap
    const operations = []
    const errors = []
    await Promise.all(Array.from(this.selectedFiles).map(async (file) => {
      try {
        const fileOperations = await this.parseFile(file, this.selectedFiles.length)
        operations.push(...fileOperations)
      } catch (error) {
        console.error(error)
        errors.push(error)
      }
    }))
    this.progress = 0
    this.operations = operations
    this.errors = errors
  }

  private async parseFile(file: File, nFiles: number) {
    try {
      return await this.operationsFromFile(file)
    } catch (error) {
      throw new Error('Failed parsing file: \'' + file.name + '\'')
    } finally {
      this.progress += 1 / nFiles * 100
    }
  }

  private async operationsFromFile(file: File): Promise<Operation[]> {
    this.configPdfjs()
    const fileContents: ArrayBuffer = await PromiseHelper.fileReaderP(file)
    const pdfDocument: PDFDocumentProxy = await PDFJS.getDocument(new Uint8Array(fileContents))
    const lines = await this.linesFromDocument(pdfDocument)
    const yearLine = lines.find(line => line.text.match(this.yearLineRegex) !== null)
    const year = yearLine.text.match(this.yearLineRegex)[1]
    const operationLines = lines
      .filter(line => this.looksLikeOperationLine(line.text, line.x))
      .map(line => line.text) as List<string>
    return this.operationsFromLines(operationLines, year)
  }

  private configPdfjs() {
    PDFJS.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js'
    // true means no web worker is used, and everything is done on the UI thread
    // PDFJS.disableWorker = true
  }

  private async linesFromDocument(pdfDocument: PDFDocumentProxy): Promise<List<Line>> {
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

  clear(): void {
    this.selectedFiles.length = 0
    this.operations.length = 0
  }

  private operationsFromLines(lines: List<string>, year: string): Operation[] {
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
