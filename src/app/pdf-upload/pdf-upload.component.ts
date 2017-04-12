import {Component, OnInit} from '@angular/core'
import {PDFJS} from 'pdfjs-dist'
import {PromiseHelper} from '../../helpers/PromiseHelper'
import {List, OrderedMap} from 'immutable'

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent implements OnInit {
  dragEnterCount = 0
  results = []
  errors = []

  constructor() {
  }

  ngOnInit() {
  }

  dragenter() {
    this.dragEnterCount++
  }

  dragover(event: DragEvent) {
    console.log(event)

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  dragleave() {
    this.dragEnterCount--
  }

  drop(event: DragEvent) {
    console.log(event)
    event.preventDefault()
    this.dragEnterCount--
    this.handleFileSelect(event.dataTransfer.files)
  }

  selectFiles(event: Event | any) {
    console.log(event)
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

  private async parse(file: File) {
    const fileContents = await PromiseHelper.fileReaderP(file)
    const pdfDocument = await PDFJS.getDocument(new Uint8Array(fileContents))
    const lines = await this.aggregatePdfDocumentLines(pdfDocument)
    lines
      .skipUntil(value => value.startsWith('Ancien solde'))
      .skip(1)
      .takeUntil(value => value.startsWith('Total'))
      .forEach(value => this.results.push(value))
  }

  private async aggregatePdfDocumentLines(pdfDocument: any) {
    let lines = List<string>()
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i)
      const content = await page.getTextContent()
      lines = lines.concat(this.aggregatePageLines(content.items)) as List<string>
      // this.testRenderer(page)
    }
    return lines
  }

  private aggregatePageLines(lines: any): List<string> {
    const linesByY = new Map<string, string>()
    for (const line of lines) {
      const key = line.transform[5].toString()
      const lineAtY = linesByY.get(key)
      if (lineAtY === undefined) {
        linesByY.set(key, line.str)
      } else {
        linesByY.set(key, lineAtY + line.str)
      }
    }
    return OrderedMap<string, string>(linesByY)
      .sortBy((value, key) => -key)
      .toList()
  }

  private reset() {
    this.results.length = 0
    this.errors.length = 0
  }
}
