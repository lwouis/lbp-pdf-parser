import {Component, OnInit} from '@angular/core'
import {PDFDocumentProxy, PDFJS} from 'pdfjs-dist'
import {Operation} from '../../models/operation'
import {PdfParser} from '../../models/pdf-parser'

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent {
  private selectedFiles: File[] = []
  private operations: Operation[] = []
  private errors: Error[] = []
  private progress = 0

  async selectFilesWithInput(event: Event | any): Promise<void> {
    await this.selectFiles(event.target.files as FileList)
  }

  private async selectFiles(files: FileList): Promise<void> {
    this.selectedFiles = Array.from(files)
    await this.parseFiles()
  }

  async parseFiles(): Promise<void> {
    [this.operations, this.errors] = await new PdfParser().parseFiles(this.selectedFiles, (progress) => this.progress = progress)
  }

  clear(): void {
    this.selectedFiles.length = 0
    this.operations.length = 0
    this.errors.length = 0
  }
}
