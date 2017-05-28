import {Component, ElementRef, OnDestroy, ViewChild} from '@angular/core'
import {PdfParser} from '../../models/pdf-parser'
import {CsvWriter} from '../../models/csv-writer'
import * as Highcharts from 'highcharts/highcharts.src'
import {OperationsAndErrors} from '../../models/operations-and-errors'
import {CsvParser} from '../../models/csv-parser'
import {Operation} from '../../models/operation'

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent implements OnDestroy {
  @ViewChild('chart') public chart: ElementRef
  private _chart: any

  private selectedFiles = []
  private operations = []
  private errors = []
  private progress = 0

  public ngOnDestroy() {
    this._chart.destroy()
  }

  async importPdfFilesFromEvent(event: Event | any): Promise<void> {
    await this.importPdfFiles(event.target.files as FileList)
  }

  async importCsvFilesFromEvent(event: Event | any): Promise<void> {
    await this.importCsvFiles(event.target.files as FileList)
  }

  async exportToCsvFile(): Promise<void> {
    await CsvWriter.write(this.operations)
  }

  private async importPdfFiles(files: FileList): Promise<void> {
    if (files.length === 0) {
      return
    }
    this.selectFiles(files)
    const result = await PdfParser.parseFiles(this.selectedFiles, progress => this.progress += progress)
    await this.parseFiles(result)
  }

  private async importCsvFiles(files: FileList): Promise<void> {
    if (files.length === 0) {
      return
    }
    this.selectFiles(files)
    const result = await CsvParser.parseFiles(this.selectedFiles, progress => this.progress += progress)
    await this.parseFiles(result)
  }

  private selectFiles(files: FileList) {
    this.clear()
    this.selectedFiles = Array.from(files)
  }

  private async parseFiles(operationsAndErrors: OperationsAndErrors): Promise<void> {
    this.progress = 0 // work is finished
    this.operations = operationsAndErrors.operations
    this.errors = operationsAndErrors.errors
    this.drawChart(this.operations)
  }

  private drawChart(operations: Operation[]) {
    this._chart = new Highcharts.Chart({
      chart: {
        renderTo: this.chart.nativeElement,
        zoomType: 'x',
      },
      title: {
        text: 'Money movements',
      },
      xAxis: {
        type: 'datetime',
      },
      tooltip: {
        pointFormat: 'Total: {point.y:.0f} €<br/>' +
        'Operation: <b>{point.amount:.0f} €</b><br/>' +
        '{point.description}',
      },
      series: [{
        name: 'Operations',
        data: this.toHighChartCumulatedAmounts(operations),
        turboThreshold: 0,
      }],
    })
  }

  private toHighChartCumulatedAmounts(operations: Operation[]): any[] {
    return operations.reduce((cumulatedAmounts, operation, i) => {
      let cumulatedAmount = operation.amount
      if (cumulatedAmounts.length > 0) {
        cumulatedAmount += cumulatedAmounts[i - 1].y
      }
      cumulatedAmounts.push({
        x: operation.date.valueOf(),
        y: cumulatedAmount,
        amount: operation.amount,
        description: operation.description,
      })
      return cumulatedAmounts
    }, [])
  }

  private clear(): void {
    this.selectedFiles.length = 0
    this.operations.length = 0
    this.errors.length = 0
  }
}
