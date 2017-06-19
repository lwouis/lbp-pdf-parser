import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core'
import {PdfParser} from '../../models/pdf-parser'
import {CsvWriter} from '../../models/csv-writer'
import {OperationsAndErrors} from '../../models/operations-and-errors'
import {CsvParser} from '../../models/csv-parser'
import {Operation} from '../../models/operation'
import * as moment from 'moment'
import {Point} from '../../models/point'
import {Options} from 'highcharts'
import * as Highcharts from 'highcharts/highcharts.src'
import * as HighchartsBoost from 'highcharts/modules/boost.src'
HighchartsBoost(Highcharts)

@Component({
  selector: 'app-pdf-upload',
  templateUrl: './pdf-upload.component.html',
  styleUrls: ['./pdf-upload.component.css'],
})
export class PdfUploadComponent implements OnInit, OnDestroy {
  @ViewChild('filterAmount') public filterAmount: ElementRef
  private _filterAmount: HTMLInputElement
  @ViewChild('filterText') public filterText: ElementRef
  private _filterText: HTMLInputElement
  @ViewChild('chart') public chart: ElementRef
  private _chart: any

  private selectedFiles = []
  private operations = []
  private errors = []
  private progress = 0

  ngOnInit() {
    this._filterAmount = this.filterAmount.nativeElement
    this._filterText = this.filterText.nativeElement
  }

  ngOnDestroy() {
    this._chart.destroy()
  }

  async importPdfFilesFromEvent(event: Event): Promise<void> {
    await this.importPdfFiles((event.target as HTMLInputElement).files)
  }

  async importCsvFilesFromEvent(event: Event): Promise<void> {
    await this.importCsvFiles((event.target as HTMLInputElement).files)
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
    await this.updateUi(result)
  }

  private async importCsvFiles(files: FileList): Promise<void> {
    if (files.length === 0) {
      return
    }
    this.selectFiles(files)
    const result = await CsvParser.parseFiles(this.selectedFiles, progress => this.progress += progress)
    await this.updateUi(result)
  }

  private selectFiles(files: FileList) {
    this.clear()
    this.selectedFiles = Array.from(files)
  }

  private async updateUi(operationsAndErrors: OperationsAndErrors): Promise<void> {
    this.progress = 0 // work is finished
    this.operations = operationsAndErrors.operations
    this.errors = operationsAndErrors.errors
    this.drawChart(this.operations, this._filterText.value, this._filterAmount.valueAsNumber)
  }

  public async filterAmountChange(event: Event): Promise<void> {
    const amount = (event.target as HTMLInputElement).valueAsNumber
    if (Number.isNaN(amount)) {
      this._filterAmount.value = this._filterAmount.defaultValue
      return
    }
    const text = this._filterText.value
    this.drawChart(this.operations, text, amount)
  }

  public async filterTextChange(event: Event): Promise<void> {
    const text = (event.target as HTMLInputElement).value
    const amount = this._filterAmount.valueAsNumber
    this.drawChart(this.operations, text, amount)
  }

  private drawChart(operations: Operation[], filterText: string, filterAmount: number) {
    this._chart = new Highcharts.Chart({
      chart: {
        renderTo: this.chart.nativeElement,
        zoomType: 'xy',
      },
      title: {
        text: 'Money movements',
      },
      xAxis: {
        type: 'datetime',
      },
      tooltip: {
        shared: true,
        formatter: function () {
          let tooltip = moment.utc(this.x).format('YYYY/MM/DD') + '<br/>' +
            '<b>' + this.points[0].point.amount.toFixed(0) + ' €</b><br/>' +
            this.points[0].point.description + '<br/>' +
            '-<br/>'
          this.points.forEach(point => {
            tooltip += '<br/>' + point.series.name + ': <span style="color:' + point.color + '">' + point.point.y.toFixed(0) + ' €</span>'
          })
          return tooltip
        },
      },
      plotOptions: {
        line: {
          step: 'left',
        },
        series: {
          turboThreshold: 0,
          boostThreshold: 1,
        },
      },
      series: [
        {
          name: 'Cumulated total',
          data: this.toHighChartCumulatedAmounts(operations, filterText, filterAmount, n => n > filterAmount || n < -filterAmount),
          color: '#5591c6',
        },
        {
          name: 'Cumulated earnings',
          data: this.toHighChartCumulatedAmounts(operations, filterText, filterAmount, n => n > filterAmount),
          color: '#72c648',
        },
        {
          name: 'Cumulated spendings',
          data: this.toHighChartCumulatedAmounts(operations, filterText, filterAmount, n => n < -filterAmount),
          color: '#9d1319',
        },
      ],
    } as Options)
  }

  private toHighChartCumulatedAmounts(operations: Operation[], filterText: string, filterAmount: number,
                                      filterFn: (n: number) => boolean): Point[] {
    return operations.reduce((cumulatedAmounts, operation) => {
      if (Math.abs(operation.amount) > filterAmount && (filterText.length === 0 ||
        !new RegExp(filterText, 'i').test(operation.description))) {
        cumulatedAmounts.push({
          x: operation.date.valueOf(),
          y: this.cumulatedAmount(cumulatedAmounts, filterFn, operation.amount),
          amount: operation.amount,
          description: operation.description,
        })
      }
      return cumulatedAmounts
    }, [] as Point[])
  }

  private cumulatedAmount(cumulatedAmounts: Point[], filterFn: (n: number) => boolean, amount: number) {
    if (cumulatedAmounts.length <= 0) {
      return 0
    }
    const previousAmount = cumulatedAmounts[cumulatedAmounts.length - 1].y
    if (filterFn(amount)) {
      return previousAmount + amount
    }
    return previousAmount
  }

  private clear(): void {
    this.selectedFiles.length = 0
    this.operations.length = 0
    this.errors.length = 0
  }
}
