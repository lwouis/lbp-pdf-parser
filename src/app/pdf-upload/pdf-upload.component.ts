import {Component, OnInit} from '@angular/core'
import {PDFJS} from 'pdfjs-dist'
import {PromiseHelper} from '../../helpers/promise-helper'
import {Line} from '../../models/line'
import {List, Map} from 'immutable'

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent implements OnInit {
  private readonly operationXPosition = 52.559999999999995
  private readonly operationXPosition2 = 89.28
  private dragEnterCount = 0
  private results = []
  private errors = []

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

  drop(event: DragEvent) {
    event.preventDefault()
    this.dragEnterCount--
    this.handleFileSelect(event.dataTransfer.files)
  }

  selectFiles(event: Event | any) {
    this.handleFileSelect(event.target.files)
  }

  async handleFileSelect(files: FileList) {
    this.reset()
    for (let i = 0; i < files.length; i++) {
      try {
        await this.parse(files[i])
      } catch (error) {
        this.errors.push(error)
      }
    }
  }

  private async parse(file: File): Promise<void> {
    const fileContents: ArrayBuffer = await PromiseHelper.fileReaderP(file)
    // PDFJS.workerSrc = 'node_modules/pdfjs-dist/build/pdf.worker.js'
    PDFJS.disableWorker = true
    const pdfDocument = await PDFJS.getDocument(new Uint8Array(fileContents))
    const lines = await this.aggregatePdfDocumentLines(pdfDocument)
    lines.forEach(value => this.results.push(value))
  }

  private async aggregatePdfDocumentLines(pdfDocument): Promise<List<string>> {
    let lines = List<string>()
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i)
      const content = await page.getTextContent()
      lines = lines.concat(this.aggregatePageLines(content.items)) as List<string>
    }
    return lines
  }

  private aggregatePageLines(items: Array<any>): Set<string> {
    return items
      .reduce((lines, item) => this.consolidateLinesByY(lines, item), Map<number, Line>())
      .sortBy((line, y) => -y)
      .toList()
      .filter(line => this.looksLikeOperationLine(line.text, line.x))
      .map(line => line.text)
  }

  private consolidateLinesByY(linesByY: Map<number, Line>, item): Map<number, Line> {
    const line = {text: item.str, x: item.transform[4], y: item.transform[5]}
    const lineAtY = linesByY.get(line.y)
    if (lineAtY === undefined) {
      if (this.looksLikeStartOfOperationLine(line.x)) {
        return linesByY.set(line.y, {text: line.text, x: line.x, y: line.y})
      }
      return linesByY
    } else {
      return linesByY.set(line.y, Object.assign(lineAtY, {text: lineAtY.text + line.text}))
    }
  }

  private looksLikeOperationLine(lineText: string, lineX: number): boolean {
    return (lineX === this.operationXPosition && lineText.match(/^[0-9]{2}\/[0-9]{2}.+/) !== null)
      || (lineX === this.operationXPosition2 && !lineText.startsWith('date'))
  }

  private looksLikeStartOfOperationLine(lineX: number): boolean {
    return lineX === this.operationXPosition || lineX === this.operationXPosition2
  }

  private reset(): void {
    this.results.length = 0
    this.errors.length = 0
  }
}
