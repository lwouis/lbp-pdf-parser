import {Component} from '@angular/core'
import {PdfParser} from '../../models/pdf-parser'
import {CsvWritter} from '../../models/csv-writer'

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

  async downloadCsv(): Promise<void> {
    await CsvWritter.write(this.operations)
  }

  private async selectFiles(files: FileList): Promise<void> {
    this.clear()
    this.selectedFiles = Array.from(files)
    await this.parseFiles()
  }

  private async parseFiles(): Promise<void> {
    const result = await PdfParser.parseFiles(this.selectedFiles, progress => this.progress += progress)
    this.progress = 0 // work is finished
    this.operations = result.operations
    this.errors = result.errors
  }

  private clear(): void {
    this.selectedFiles.length = 0
    this.operations.length = 0
    this.errors.length = 0
  }
}
