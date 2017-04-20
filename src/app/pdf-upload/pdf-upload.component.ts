import {Component} from '@angular/core'
import {PdfParser} from '../../models/pdf-parser'

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent {
  private selectedFiles = []
  private operations = []
  private errors = []
  private progress = 0

  async selectFilesWithInput(event: Event | any): Promise<void> {
    await this.selectFiles(event.target.files as FileList)
  }

  private async selectFiles(files: FileList): Promise<void> {
    this.selectedFiles = Array.from(files)
    await this.parseFiles()
  }

  async parseFiles(): Promise<void> {
    const result = await new PdfParser().parseFiles(this.selectedFiles, (progress) => this.progress = progress)
    this.operations = result.operations
    this.errors = result.errors
  }

  clear(): void {
    this.selectedFiles.length = 0
    this.operations.length = 0
    this.errors.length = 0
  }
}
